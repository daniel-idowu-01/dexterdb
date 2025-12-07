import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";
import { SchemaModel, SchemaField, SchemaRelation } from "../types";
import { Logger } from "../utils/logger";
import mongoose from "mongoose";

export class MongooseParser {
  private schemasPath: string;
  private connection: typeof mongoose;
  private models: Map<string, any> = new Map();

  constructor(schemasPath?: string, dbUrl?: string) {
    this.schemasPath = schemasPath || join(process.cwd(), "src", "models");
    this.connection = mongoose;

    if (dbUrl) {
      process.env.DATABASE_URL = dbUrl;
    }
  }

  async connect(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }

    try {
      await this.connection.connect(dbUrl);
      Logger.success("Connected to MongoDB");
    } catch (error) {
      Logger.error(`Failed to connect to MongoDB: ${error}`);
      throw error;
    }
  }

  async parseSchema(): Promise<SchemaModel[]> {
    try {
      await this.loadModels();

      const models: SchemaModel[] = [];

      for (const [modelName, model] of this.models.entries()) {
        const schemaModel = this.parseMongooseModel(modelName, model);
        models.push(schemaModel);
      }

      Logger.debug(`Parsed ${models.length} models from Mongoose schemas`);
      return models;
    } catch (error) {
      Logger.error(`Failed to parse Mongoose schemas: ${error}`);
      throw error;
    }
  }

  private async loadModels(): Promise<void> {
    try {
      const files = readdirSync(this.schemasPath);

      for (const file of files) {
        const filePath = join(this.schemasPath, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) continue;
        const ext = extname(file);
        if (![".js", ".ts"].includes(ext)) continue;
        if (file.includes(".test.") || file.includes(".spec.")) continue;
        if (file === "index.ts" || file === "index.js") continue;

        try {
          delete require.cache[require.resolve(filePath)];

          const modelModule = require(filePath);

          const exportedModel = modelModule.default || modelModule;

          if (exportedModel && exportedModel.modelName) {
            this.models.set(exportedModel.modelName, exportedModel);
            Logger.debug(`Loaded model: ${exportedModel.modelName}`);
          } else if (typeof exportedModel === "object") {
            for (const [key, value] of Object.entries(exportedModel)) {
              if (value && typeof value === "object" && (value as any).modelName) {
                this.models.set((value as any).modelName, value);
                Logger.debug(`Loaded model: ${(value as any).modelName}`);
              }
            }
          }
        } catch (error) {
          Logger.warning(`Failed to load model from ${file}: ${error}`);
        }
      }

      if (this.models.size === 0) {
        Logger.warning(`No Mongoose models found in ${this.schemasPath}`);
        Logger.info("Make sure your models are properly exported and the path is correct");
      }
    } catch (error) {
      Logger.error(`Failed to load models: ${error}`);
      throw error;
    }
  }

  private parseMongooseModel(modelName: string, model: any): SchemaModel {
    const schema = model.schema;
    const fields: SchemaField[] = [];
    const relations: SchemaRelation[] = [];

    schema.eachPath((pathname: string, schemaType: any) => {
      if (pathname === "__v" || pathname === "_id") {
        if (pathname === "_id") {
          fields.push({
            name: "id",
            type: "objectid",
            isRequired: true,
            isPrimaryKey: true,
            isUnique: true,
            isForeignKey: false,
          });
        }
        return;
      }

      const field = this.parseSchemaPath(pathname, schemaType, modelName);

      if (field.isRelation) {
        relations.push({
          name: field.name,
          type: field.relationType!,
          model: field.relationModel!,
          field: field.name,
          foreignKey: field.isForeignKey ? field.name : undefined,
        });
      }

      fields.push({
        name: field.name,
        type: field.type,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        isPrimaryKey: field.isPrimaryKey,
        isForeignKey: field.isForeignKey,
        relationModel: field.relationModel,
        relationField: "id",
        defaultValue: field.defaultValue,
        enumValues: field.enumValues,
      });
    });

    return {
      name: modelName,
      fields,
      relations,
    };
  }

  private parseSchemaPath(pathname: string, schemaType: any, modelName: string): any {
    const result: any = {
      name: pathname,
      type: "string",
      isRequired: false,
      isUnique: false,
      isPrimaryKey: false,
      isForeignKey: false,
      isRelation: false,
      relationType: undefined,
      relationModel: undefined,
      defaultValue: undefined,
      enumValues: undefined,
    };

    result.isRequired = schemaType.isRequired || false;

    result.isUnique = schemaType.options?.unique || false;

    if (schemaType.options?.default !== undefined) {
      result.defaultValue = schemaType.options.default;
    }

    const instanceType = schemaType.instance;

    switch (instanceType) {
      case "String":
        result.type = "string";
        if (schemaType.enumValues && schemaType.enumValues.length > 0) {
          result.type = "enum";
          result.enumValues = schemaType.enumValues;
        }
        break;

      case "Number":
        result.type = "number";
        break;

      case "Date":
        result.type = "datetime";
        break;

      case "Boolean":
        result.type = "boolean";
        break;

      case "ObjectID":
      case "ObjectId":
        result.type = "objectid";
        if (schemaType.options?.ref) {
          result.isForeignKey = true;
          result.isRelation = true;
          result.relationModel = schemaType.options.ref;
          result.relationType = "oneToOne";
        }
        break;

      case "Array":
        if (schemaType.caster) {
          const casterInstance = schemaType.caster.instance;

          if (casterInstance === "ObjectID" || casterInstance === "ObjectId") {
            if (schemaType.caster.options?.ref) {
              result.type = "objectid";
              result.isRelation = true;
              result.relationModel = schemaType.caster.options.ref;
              result.relationType = "manyToMany";
            }
          } else if (casterInstance === "String") {
            result.type = "array";
          } else if (casterInstance === "Number") {
            result.type = "array";
          } else {
            result.type = "array";
          }
        } else {
          result.type = "array";
        }
        break;

      case "Embedded":
      case "Mixed":
        result.type = "json";
        break;

      default:
        result.type = "string";
    }

    return result;
  }

  async introspectDatabase(): Promise<SchemaModel[]> {
    return await this.parseSchema();
  }

  getConnection(): typeof mongoose {
    return this.connection;
  }

  getModels(): Map<string, any> {
    return this.models;
  }

  async disconnect(): Promise<void> {
    await this.connection.disconnect();
    Logger.debug("Disconnected from MongoDB");
  }
}
