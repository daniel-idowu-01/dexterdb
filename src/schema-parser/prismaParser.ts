import { readFileSync } from "fs";
import { join } from "path";
import { SchemaModel, SchemaField, SchemaRelation } from "../types";
import { Logger } from "../utils/logger";

function getPrismaClient(): any {
  try {
    const { PrismaClient } = require("@prisma/client");
    return PrismaClient;
  } catch (error) {
    throw new Error(
      "@prisma/client not found. Please run 'npm run prisma:generate' to generate the Prisma client."
    );
  }
}

export class PrismaParser {
  private schemaPath: string;
  private prisma: any;

  constructor(schemaPath?: string) {
    this.schemaPath = schemaPath || join(process.cwd(), "prisma", "schema.prisma");
    const PrismaClient = getPrismaClient();
    this.prisma = new PrismaClient();
  }


  async parseSchema(): Promise<SchemaModel[]> {
    try {
      const schemaContent = readFileSync(this.schemaPath, "utf-8");
      const models = this.extractModels(schemaContent);
      Logger.debug(`Parsed ${models.length} models from schema`);
      return models;
    } catch (error) {
      Logger.error(`Failed to parse Prisma schema: ${error}`);
      throw error;
    }
  }

  async introspectDatabase(): Promise<SchemaModel[]> {
    try {
      const models = await this.parseSchema();
      
      return models;
    } catch (error) {
      Logger.error(`Failed to introspect database: ${error}`);
      throw error;
    }
  }

  private extractModels(schemaContent: string): SchemaModel[] {
    const models: SchemaModel[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      
      const relations = this.extractRelations(modelBody, modelName);
      const fields = this.extractFields(modelBody, modelName, models);

      models.push({
        name: modelName,
        fields,
        relations,
      });
    }

    return models;
  }

  private extractFields(modelBody: string, modelName: string, allModels: SchemaModel[] = []): SchemaField[] {
    const fields: SchemaField[] = [];
    const lines = modelBody.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("}")) {
        continue;
      }

      const fieldMatch = trimmed.match(/^(\w+)\s+([A-Z][a-zA-Z0-9]*\??)(\s+.*)?$/);
      if (!fieldMatch) {
        continue;
      }

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const attributes = fieldMatch[3] || "";

      const isRelationField = 
        !["String", "Int", "Float", "Boolean", "DateTime", "Json", "Bytes", "BigInt", "Decimal"].includes(fieldType.replace("?", "")) &&
        (attributes.includes("@relation") || trimmed.includes("[]") || fieldType.endsWith("?"));
      
      if (isRelationField && !attributes.includes("fields:")) {
        continue;
      }

      const isRequired = !fieldType.includes("?");
      const cleanType = fieldType.replace("?", "");
      const isUnique = attributes.includes("@unique");
      const isPrimaryKey = attributes.includes("@id");
      const isForeignKey = modelBody.includes(`@relation`) && 
                          modelBody.includes(`fields: [${fieldName}]`);
      const isUpdatedAt = attributes.includes("@updatedAt");
      
      let defaultValue: any = undefined;
      const defaultMatch = attributes.match(/@default\(([^()]+(?:\([^()]*\)[^()]*)*)\)/);
      if (defaultMatch) {
        const defaultValueStr = defaultMatch[1].trim();
        if (defaultValueStr === "now()" || 
            defaultValueStr === "uuid()" || 
            defaultValueStr === "autoincrement()" ||
            defaultValueStr.startsWith("autoincrement")) {
          defaultValue = undefined;
        } else {
          defaultValue = this.parseDefaultValue(defaultValueStr);
        }
      }
      
      if (isUpdatedAt) {
        continue;
      }

      let enumValues: string[] | undefined = undefined;
      if (cleanType.toLowerCase().startsWith("enum")) {
        enumValues = undefined;
      }

      let relationModel: string | undefined = undefined;
      let relationField: string | undefined = undefined;
      
      if (isForeignKey) {
        const relationLineMatch = modelBody.match(
          new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\([^)]*fields:\\s*\\[${fieldName}\\][^)]*\\)`, 'g')
        );
        if (relationLineMatch && relationLineMatch.length > 0) {
          const parts = relationLineMatch[0].match(/(\w+)\s+(\w+)/);
          if (parts && parts[2]) {
            const potentialModel = parts[2];
            if (!["String", "Int", "Float", "Boolean", "DateTime", "Json", "Bytes", "BigInt", "Decimal"].includes(potentialModel)) {
              relationModel = potentialModel;
            }
          }
        }
      }
      const relationMatch = attributes.match(/@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\][^)]*\)/);
      if (relationMatch) {
        relationField = relationMatch[2].trim();
        const relationLineMatch = modelBody.match(new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\([^)]*fields:\\s*\\[${fieldName}\\][^)]*\\)`, 'g'));
        if (relationLineMatch) {
          const parts = relationLineMatch[0].match(/(\w+)\s+(\w+)/);
          if (parts && parts[2]) {
            const potentialModel = parts[2];
            if (!["String", "Int", "Float", "Boolean", "DateTime", "Json", "Bytes", "BigInt", "Decimal"].includes(potentialModel)) {
              relationModel = potentialModel;
            }
          }
        }
      }

      fields.push({
        name: fieldName,
        type: this.normalizeType(cleanType),
        isRequired,
        isUnique,
        isPrimaryKey,
        isForeignKey,
        relationModel,
        relationField,
        defaultValue,
        enumValues,
      });
    }

    return fields;
  }

  private extractRelations(modelBody: string, modelName: string): SchemaRelation[] {
    const relations: SchemaRelation[] = [];
    const relationRegex = /(\w+)\s+(\w+)(\?|\[\])?\s+(@relation\([^)]+\))?/g;
    let match;

    while ((match = relationRegex.exec(modelBody)) !== null) {
      const fieldName = match[1];
      const relationModelName = match[2];
      const isOptional = match[3] === "?";
      const isArray = match[3] === "[]";
      const relationAttr = match[4] || "";

      let relationType: "oneToOne" | "oneToMany" | "manyToMany" = "oneToMany";
      if (isOptional && !isArray) {
        relationType = "oneToOne";
      } else if (isArray) {
        relationType = "manyToMany";
      }

      let foreignKey: string | undefined = undefined;
      const fkMatch = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
      if (fkMatch) {
        foreignKey = fkMatch[1].trim();
      }

      relations.push({
        name: fieldName,
        type: relationType,
        model: relationModelName,
        field: fieldName,
        foreignKey,
      });
    }

    return relations;
  }

  private normalizeType(prismaType: string): string {
    const cleanType = prismaType.replace("?", "").replace("[]", "").trim();

    if (cleanType === "DateTime") {
      return "datetime";
    }

    if (["String", "Json", "Bytes"].includes(cleanType)) {
      return "string";
    }

    if (["Int", "BigInt", "Float", "Decimal"].includes(cleanType)) {
      return "number";
    }

    if (cleanType === "Boolean") {
      return "boolean";
    }

    if (cleanType.startsWith("enum") || cleanType.match(/^[A-Z]/)) {
      return "enum";
    }

    return cleanType.toLowerCase();
  }

  private parseDefaultValue(value: string): any {
    const trimmed = value.trim();

    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      return trimmed.slice(1, -1);
    }

    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    if (/^-?\d+\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

    if (trimmed.startsWith("now()")) return new Date();
    if (trimmed.startsWith("uuid()")) return undefined;

    return trimmed;
  }

  getPrismaClient(): any {
    return this.prisma;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

