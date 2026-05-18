import { MongooseParser } from "./schema-parser/mongooseParser";
import { PrismaParser } from "./schema-parser/prismaParser";
import { SchemaParser } from "./schema-parser/schemaParser";
import {
  StringGenerator,
  NumberGenerator,
  DateGenerator,
  BooleanGenerator,
  EnumGenerator,
  ObjectIdGenerator,
} from "./generators";
import { ConfigLoader } from "./config/config";
import { Logger } from "./utils/logger";
import {
  SeederOptions,
  SeederConfig,
  SchemaModel,
  SchemaField,
  SeedResult,
  ModelConfig,
  FieldConfig,
} from "./types";
import _ from "lodash";
import mongoose from "mongoose";

const MIN_SEED_COUNT = 1;
const MAX_SEED_COUNT = 100_000;

function clampSeedCount(count: number): number {
  if (!Number.isFinite(count)) {
    return 10;
  }
  const n = Math.floor(count);
  return Math.min(MAX_SEED_COUNT, Math.max(MIN_SEED_COUNT, n));
}

export class Seeder {
  private options: SeederOptions;
  private parser: SchemaParser;
  private config: SeederConfig;
  private models: SchemaModel[] = [];
  private generatedData: Map<string, any[]> = new Map();
  private mongooseModels: Map<string, any> = new Map();
  private prismaClient: any;
  private dbType: "mongodb" | "postgresql";

  constructor(options: SeederOptions) {
    this.options = options;
    this.dbType = options.dbType || this.detectDbType(options.dbUrl);

    if (this.dbType === "mongodb") {
      this.parser = new MongooseParser(options.schemaPath, options.dbUrl);
    } else {
      this.parser = new PrismaParser(options.schemaPath, options.dbUrl);
    }

    this.config = ConfigLoader.mergeWithDefaults(ConfigLoader.load(options.configPath));
  }

  async initialize(): Promise<void> {
    Logger.step("Initializing seeder...");

    try {
      await this.parser.connect();

      this.models = await this.parser.introspectDatabase();
      Logger.success(`Found ${this.models.length} models in schema`);

      if (this.dbType === "mongodb") {
        this.mongooseModels = this.parser.getModels?.() ?? new Map();
        const connection = this.parser.getConnection?.();
        if (!connection || connection.connection.readyState !== 1) {
          throw new Error("MongoDB connection not ready");
        }
      } else {
        this.prismaClient = this.parser.getPrismaClient?.();
        if (!this.prismaClient) {
          throw new Error("Prisma client not initialized");
        }
      }
    } catch (error: any) {
      Logger.error(`Failed to initialize seeder: ${error.message}`);
      throw error;
    }
  }

  async seed(
    modelName: string,
    count: number = 10,
    options?: Partial<ModelConfig>
  ): Promise<SeedResult> {
    count = clampSeedCount(count);
    try {
      Logger.step(`Seeding ${modelName} with ${count} records...`);

      if (this.dbType === "mongodb") {
        const connection = this.parser.getConnection?.();
        if (!connection || connection.connection.readyState !== 1) {
          Logger.warning("Connection not ready, attempting to reconnect...");
          await this.parser.connect();
        }
      }

      const model = this.models.find((m) => m.name === modelName);
      if (!model) {
        throw new Error(`Model ${modelName} not found in schema`);
      }

      const modelConfig: any = {
        ...ConfigLoader.getModelConfig(this.config, modelName),
        ...options,
      };

      if (modelConfig.reset || this.config.global?.reset) {
        const action = this.dbType === "mongodb" ? "collection" : "table";
        Logger.warning(`Resetting ${modelName} ${action}...`);
        if (this.dbType === "mongodb") {
          const mongooseModel = this.mongooseModels.get(modelName);
          if (!mongooseModel) {
            throw new Error(`Mongoose model ${modelName} not loaded`);
          }
          await mongooseModel.deleteMany({});
        } else {
          const prismaModel = this.getPrismaDelegate(modelName);
          await prismaModel.deleteMany({});
        }
      }

      const data = await this.generateModelData(model, count, modelConfig);
      let result;

      if (this.dbType === "mongodb") {
        const mongooseModel = this.mongooseModels.get(modelName);
        if (!mongooseModel) {
          throw new Error(`Mongoose model ${modelName} not loaded`);
        }
        result = await this.insertData(modelName, mongooseModel, data);
      } else {
        const prismaModel = this.getPrismaDelegate(modelName);
        result = await this.insertData(modelName, prismaModel, data);
      }

      const insertedRecords = result.records ?? await this.fetchInsertedRecords(modelName, result.count);
      this.generatedData.set(modelName, insertedRecords);

      Logger.success(`Successfully seeded ${result.count} ${modelName} records`);
      return {
        model: modelName,
        count: result.count,
        success: true,
      };
    } catch (error: any) {
      Logger.error(`Failed to seed ${modelName}: ${error.message}`);

      if (error.message.includes("buffering timed out") && this.dbType === "mongodb") {
        Logger.error("Connection timeout detected. Possible causes:");
        Logger.error("1. MongoDB server is not running");
        Logger.error("2. DATABASE_URL is incorrect");
        Logger.error("3. Network/firewall issues");
        Logger.error("4. Model not properly connected to database");

        const connection = (this.parser as MongooseParser).getConnection?.();
        if (connection) {
          Logger.error(
            `Connection state: ${connection.connection.readyState} (1=connected, 0=disconnected)`
          );
        }
      }

      return {
        model: modelName,
        count: 0,
        success: false,
        error: error.message,
      };
    }
  }

  private async generateModelData(
    model: SchemaModel,
    count: number,
    config: ModelConfig
  ): Promise<any[]> {
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const record: any = {};

      for (const field of model.fields) {
        if (this.shouldSkipField(field, config)) {
          continue;
        }

        const fieldConfig = config.fields?.[field.name];

        if (field.isForeignKey && field.relationModel) {
          const refValue = await this.resolveReference(field, model.name);

          if (refValue !== null && refValue !== undefined) {
            // Check if it's a many-to-many or one-to-many with array
            const relation = model.relations.find(r => r.name === field.name);

            if (relation && relation.type === "manyToMany") {
              const relationConfig = config.relations?.[field.name];
              const min = relationConfig?.min ?? 0;
              const max = relationConfig?.max ?? 3;
              const refCount = _.random(min, max);

              const refs = [];
              for (let j = 0; j < refCount; j++) {
                const ref = await this.resolveReference(field, model.name);
                if (ref) refs.push(ref);
              }
              record[field.name] = refs;
            } else {
              // Single reference
              record[field.name] = refValue;
            }
          } else {
            Logger.warning(
              `No related records found for ${field.relationModel}. Make sure to seed ${field.relationModel} first.`
            );
          }
          continue;
        }

        const value = await this.generateFieldValue(field, fieldConfig, model.name);

        if (value !== undefined) {
          record[field.name] = value;
        }
      }

      data.push(record);
    }

    return data;
  }

  private async generateFieldValue(
    field: SchemaField,
    fieldConfig: FieldConfig | undefined,
    modelName: string
  ): Promise<any> {
    if (fieldConfig?.ignore) {
      return undefined;
    }

    if (field.name === "id" || field.name === "_id") {
      return undefined;
    }

    if (field.defaultValue !== undefined && !fieldConfig?.ignore) {
      if (typeof field.defaultValue === "function") {
        return undefined;
      }
      return field.defaultValue;
    }

    if (fieldConfig?.defaultValue !== undefined) {
      return fieldConfig.defaultValue;
    }

    const type = fieldConfig?.type || field.type;

    switch (type) {
      case "string":
        return new StringGenerator().generate(field.name, fieldConfig);

      case "number":
        return new NumberGenerator().generate(field.name, fieldConfig);

      case "date":
      case "datetime":
        const dateValue = new DateGenerator().generate(field.name, fieldConfig);
        return dateValue instanceof Date ? dateValue : new Date();

      case "boolean":
        return new BooleanGenerator().generate(field.name, fieldConfig);

      case "enum":
        return new EnumGenerator().generate(field.name, {
          ...fieldConfig,
          values: field.enumValues || fieldConfig?.values,
        });

      case "objectid":
        return new mongoose.Types.ObjectId();

      case "array":
        const arrayLength = _.random(fieldConfig?.min ?? 0, fieldConfig?.max ?? 5);
        const arrayValues = [];
        for (let i = 0; i < arrayLength; i++) {
          if (fieldConfig?.values && fieldConfig.values.length > 0) {
            arrayValues.push(_.sample(fieldConfig.values));
          } else {
            arrayValues.push(new StringGenerator().generate(field.name, fieldConfig));
          }
        }
        return arrayValues;

      case "json":
        return fieldConfig?.defaultValue || {};

      default:
        return new StringGenerator().generate(field.name, fieldConfig);
    }
  }

  private async resolveReference(field: SchemaField, currentModel: string): Promise<any> {
    if (!field.relationModel) {
      return null;
    }

    const relatedData = this.generatedData.get(field.relationModel);
    if (relatedData && relatedData.length > 0) {
      const randomRecord = _.sample(relatedData);
      if (randomRecord) {
        const key = field.relationField || this.getPrimaryKeyField(field.relationModel) || "id";
        return randomRecord[key] ?? randomRecord._id;
      }
    }

    try {
      if (this.dbType === "mongodb") {
        const relatedModel = this.mongooseModels.get(field.relationModel);

        if (relatedModel) {
          const records = await relatedModel.find().limit(100).select("_id").lean();

          if (records.length > 0) {
            const randomRecord = _.sample(records);
            return randomRecord?._id;
          }
        }
      } else {
        const relatedModel = this.getPrismaDelegate(field.relationModel);
        const selectField = field.relationField || this.getPrimaryKeyField(field.relationModel) || "id";

        if (relatedModel) {
          const records = await relatedModel.findMany({
            take: 100,
            select: { [selectField]: true },
          });

          if (records.length > 0) {
            const randomRecord = _.sample(records);
            return randomRecord ? randomRecord[selectField] : null;
          }
        }
      }
    } catch (error) {
      Logger.debug(`Could not fetch related records for ${field.relationModel}: ${error}`);
    }

    return null;
  }

  private shouldSkipField(field: SchemaField, config: ModelConfig): boolean {
    if (field.name === "id" || field.name === "_id") {
      return true;
    }

    if (config.fields?.[field.name]?.ignore) {
      return true;
    }

    return false;
  }

  private async insertData(
    modelName: string,
    model: any,
    data: any[]
  ): Promise<{ count: number; records?: any[] }> {
    const cleanData = data.map((record) => {
      const clean: any = {};
      for (const [key, value] of Object.entries(record)) {
        if (value !== undefined) {
          clean[key] = value;
        }
      }
      return clean;
    });

    try {
      if (this.dbType === "mongodb") {
        if (this.config.global?.randomize) {
          const shuffled = _.shuffle(cleanData);
          const results = [];
          for (const record of shuffled) {
            const doc = new model(record);
            const saved = await doc.save();
            results.push(saved);
          }
          return { count: results.length, records: results };
        }

        const results = await model.insertMany(cleanData, {
          ordered: false, // Continue on error
        });
        return { count: results.length, records: results };
      }

      // Prisma / PostgreSQL path
      const insertedRecords: any[] = [];
      const writeData = this.config.global?.randomize ? _.shuffle(cleanData) : cleanData;
      for (const record of writeData) {
        const created = await model.create({ data: record });
        insertedRecords.push(created);
      }
      return { count: insertedRecords.length, records: insertedRecords };
    } catch (error: any) {
      Logger.error(`Insert error: ${error.message}`);
      throw error;
    }
  }

  private async fetchInsertedRecords(modelName: string, count: number): Promise<any[]> {
    if (this.dbType === "mongodb") {
      try {
        const mongooseModel = this.mongooseModels.get(modelName);
        if (!mongooseModel) {
          return [];
        }
        const records = await mongooseModel.find().sort({ _id: -1 }).limit(count).lean();
        return records;
      } catch (error) {
        Logger.debug(`Could not fetch inserted records: ${error}`);
        return [];
      }
    }

    try {
      const prismaModel = this.getPrismaDelegate(modelName);
      const sortField = this.getSortField(modelName);
      const records = await prismaModel.findMany({
        take: count,
        orderBy: { [sortField]: "desc" },
      });
      return records;
    } catch (error) {
      Logger.debug(`Could not fetch inserted records: ${error}`);
      return [];
    }
  }

  private detectDbType(dbUrl: string): "mongodb" | "postgresql" {
    const normalized = dbUrl.toLowerCase();
    if (normalized.startsWith("mongodb://") || normalized.startsWith("mongodb+srv://")) {
      return "mongodb";
    }
    if (normalized.startsWith("postgresql://") || normalized.startsWith("postgres://")) {
      return "postgresql";
    }
    throw new Error("Unsupported DATABASE_URL scheme. Supported: mongodb://, mongodb+srv://, postgres://, postgresql://");
  }

  private getPrismaDelegate(modelName: string): any {
    if (!this.prismaClient) {
      throw new Error("Prisma client not initialized");
    }

    const modelKey = Object.keys(this.prismaClient).find((key) => {
      return key.toLowerCase() === modelName.toLowerCase() || key === `${modelName[0].toLowerCase()}${modelName.slice(1)}`;
    });

    if (!modelKey) {
      throw new Error(`Prisma delegate for model ${modelName} not found`);
    }

    return this.prismaClient[modelKey];
  }

  private getPrimaryKeyField(modelName: string): string | undefined {
    const model = this.models.find((m) => m.name === modelName);
    return model?.fields.find((field) => field.isPrimaryKey)?.name;
  }

  private getSortField(modelName: string): string {
    const model = this.models.find((m) => m.name === modelName);
    if (!model) {
      return "id";
    }

    const createdAtField = model.fields.find((field) => field.name.toLowerCase() === "createdat");
    if (createdAtField) {
      return createdAtField.name;
    }

    return this.getPrimaryKeyField(modelName) || model.fields[0]?.name || "id";
  }

  async seedAll(): Promise<SeedResult[]> {
    const results: SeedResult[] = [];
    const sortedModels = this.sortModelsByDependencies();

    for (const model of sortedModels) {
      const modelConfig = ConfigLoader.getModelConfig(this.config, model.name);
      const count = clampSeedCount(modelConfig.count ?? 10);

      const result = await this.seed(model.name, count, modelConfig);
      results.push(result);
    }

    return results;
  }

  private sortModelsByDependencies(): SchemaModel[] {
    const sorted: SchemaModel[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (model: SchemaModel) => {
      if (visiting.has(model.name)) {
        return;
      }
      if (visited.has(model.name)) {
        return;
      }

      visiting.add(model.name);

      for (const field of model.fields) {
        if (field.isForeignKey && field.relationModel) {
          const depModel = this.models.find(m => m.name === field.relationModel);
          if (depModel) {
            visit(depModel);
          }
        }
      }

      visiting.delete(model.name);
      visited.add(model.name);
      sorted.push(model);
    };

    for (const model of this.models) {
      if (!visited.has(model.name)) {
        visit(model);
      }
    }

    return sorted;
  }

  getModels(): SchemaModel[] {
    return this.models;
  }

  async disconnect(): Promise<void> {
    await this.parser.disconnect();
  }
}