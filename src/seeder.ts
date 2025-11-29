import { PrismaParser } from "./schema-parser/prismaParser";
import {
  StringGenerator,
  NumberGenerator,
  DateGenerator,
  BooleanGenerator,
  EnumGenerator,
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
  RelationConfig,
} from "./types";
import _ from "lodash";

export class Seeder {
  private options: SeederOptions;
  private prisma: any;
  private parser: PrismaParser;
  private config: SeederConfig;
  private models: SchemaModel[] = [];
  private generatedData: Map<string, any[]> = new Map();

  constructor(options: SeederOptions) {
    this.options = options;
    if (options.dbUrl) {
      process.env.DATABASE_URL = options.dbUrl;
    }
    
    // Get PrismaClient from parser which handles the import safely
    this.parser = new PrismaParser(options.schemaPath);
    this.prisma = this.parser.getPrismaClient();
    this.config = ConfigLoader.mergeWithDefaults(
      ConfigLoader.load(options.configPath)
    );
  }

  // Initialize seeder by parsing schema
  async initialize(): Promise<void> {
    Logger.step("Initializing seeder...");
    this.models = await this.parser.introspectDatabase();
    Logger.success(`Found ${this.models.length} models in schema`);
  }

  // Seed a specific model with data
  async seed(
    modelName: string,
    count: number = 10,
    options?: Partial<ModelConfig>
  ): Promise<SeedResult> {
    try {
      Logger.step(`Seeding ${modelName} with ${count} records...`);

      const model = this.models.find((m) => m.name === modelName);
      if (!model) {
        throw new Error(`Model ${modelName} not found in schema`);
      }

      const modelConfig = {
        ...ConfigLoader.getModelConfig(this.config, modelName),
        ...options,
      };

      const data = await this.generateModelData(model, count, modelConfig);

      const result = await this.insertData(modelName, data);

      this.generatedData.set(modelName, data);

      Logger.success(`Successfully seeded ${result.count} ${modelName} records`);
      return {
        model: modelName,
        count: result.count,
        success: true,
      };
    } catch (error: any) {
      Logger.error(`Failed to seed ${modelName}: ${error.message}`);
      return {
        model: modelName,
        count: 0,
        success: false,
        error: error.message,
      };
    }
  }

  // Generate data for a model
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
        
        if (field.isForeignKey) {
          let relationModelName = field.relationModel;
          if (!relationModelName && field.name.endsWith("Id")) {
            const baseName = field.name.replace(/Id$/, "");
            relationModelName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
          }
          
          if (relationModelName) {
            const fkValue = await this.resolveForeignKey(
              { ...field, relationModel: relationModelName },
              model.name
            );
            if (fkValue !== null && fkValue !== undefined) {
              const relationName = field.name.replace(/Id$/, "");
              record[relationName] = { connect: { id: fkValue } };
            }
          }
          continue;
        }
        
        const value = await this.generateFieldValue(
          field,
          fieldConfig,
          model.name
        );
        
        if (value !== undefined) {
          record[field.name] = value;
        }
      }

      data.push(record);
    }

    return data;
  }

  //  Generate value for a specific field
  private async generateFieldValue(
    field: SchemaField,
    fieldConfig: FieldConfig | undefined,
    modelName: string
  ): Promise<any> {
    if (fieldConfig?.ignore) {
      return undefined;
    }

    if (field.isPrimaryKey && field.type === "number") {
      return undefined;
    }

    if (field.defaultValue !== undefined && !fieldConfig?.ignore) {
      if (typeof field.defaultValue === "string" && 
          (field.defaultValue.includes("now()") || 
           field.defaultValue.includes("uuid()") ||
           field.defaultValue.includes("autoincrement()"))) {
        return undefined;
      }
      return field.defaultValue;
    }
    
    if (field.type === "date" || field.type === "datetime") {
      if (field.name.toLowerCase().includes("created") || 
          field.name.toLowerCase().includes("updated")) {
        if (field.defaultValue === undefined) {
          
        }
      }
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
      default:
        return new StringGenerator().generate(field.name, fieldConfig);
    }
  }

  // Resolve foreign key value from related model
  private async resolveForeignKey(
    field: SchemaField,
    currentModel: string
  ): Promise<any> {
    if (!field.relationModel) {
      return null;
    }
    const relatedData = this.generatedData.get(field.relationModel);
    if (relatedData && relatedData.length > 0) {
      const randomRecord = _.sample(relatedData);
      if (randomRecord && randomRecord.id) {
        return randomRecord.id;
      }
    }

    try {
      const camelCaseModelName =
        field.relationModel.charAt(0).toLowerCase() + field.relationModel.slice(1);
      const modelClient = (this.prisma as any)[camelCaseModelName];
      
      if (modelClient) {
        const records = await modelClient.findMany({
          take: 100,
          select: { [field.relationField || "id"]: true },
        });

        if (records.length > 0) {
          const randomRecord = _.sample(records);
          return randomRecord?.[field.relationField || "id"];
        }
      }
    } catch (error) {
      Logger.debug(
        `Could not fetch related records for ${field.relationModel}: ${error}`
      );
    }

    return null;
  }

  // Check if field should be skipped
  private shouldSkipField(field: SchemaField, config: ModelConfig): boolean {
    // Skip auto-generated primary keys
    if (field.isPrimaryKey && field.type === "number") {
      return true;
    }

    if (config.fields?.[field.name]?.ignore) {
      return true;
    }

    return false;
  }

  // Insert generated data into database
  private async insertData(modelName: string, data: any[]): Promise<{ count: number }> {
    const camelCaseName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const modelClient = (this.prisma as any)[camelCaseName];

    if (!modelClient) {
      throw new Error(
        `Prisma client not found for model ${modelName} (tried: ${camelCaseName}). Make sure the model exists in your schema and Prisma client is generated.`
      );
    }

    if (this.config.global?.reset) {
      Logger.warning(`Resetting ${modelName} table...`);
      await modelClient.deleteMany({});
    }

    // Filter out undefined values from records
    const cleanData = data.map((record) => {
      const clean: any = {};
      for (const [key, value] of Object.entries(record)) {
        if (value !== undefined) {
          clean[key] = value;
        }
      }
      return clean;
    });

    if (this.config.global?.randomize) {
      for (const record of cleanData) {
        await modelClient.create({ data: record });
      }
      return { count: cleanData.length };
    } else {
      const results = await Promise.all(
        cleanData.map((record) => modelClient.create({ data: record }))
      );
      return { count: results.length };
    }
  }

  // Seed all models in schema
  async seedAll(): Promise<SeedResult[]> {
    const results: SeedResult[] = [];

    const sortedModels = this.sortModelsByDependencies();

    for (const model of sortedModels) {
      const modelConfig = ConfigLoader.getModelConfig(this.config, model.name);
      const count = modelConfig.count || 10;

      const result = await this.seed(model.name, count, modelConfig);
      results.push(result);
    }

    return results;
  }

  // Sort models by their dependencies (simple topological sort)
  private sortModelsByDependencies(): SchemaModel[] {
    const sorted: SchemaModel[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (model: SchemaModel) => {
      if (visiting.has(model.name)) {
        return; // Circular dependency, skip
      }
      if (visited.has(model.name)) {
        return;
      }

      visiting.add(model.name);

      for (const field of model.fields) {
        if (field.isForeignKey && field.relationModel) {
          const depModel = this.models.find((m) => m.name === field.relationModel);
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
    await this.prisma.$disconnect();
    await this.parser.disconnect();
  }
}

