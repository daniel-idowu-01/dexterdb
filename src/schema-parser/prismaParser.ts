import { readFileSync } from "fs";
import { join } from "path";
import { SchemaModel, SchemaField, SchemaRelation } from "../types";
import { Logger } from "../utils/logger";
import { resolvePathWithinRoot } from "../utils/pathSecurity";

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
  private dbUrl?: string;
  private enums: Record<string, string[]> = {};

  constructor(schemaPath?: string, dbUrl?: string) {
    const fallback = join(process.cwd(), "prisma", "schema.prisma");
    this.schemaPath = resolvePathWithinRoot(schemaPath ?? fallback);
    this.dbUrl = dbUrl;

    const PrismaClient = getPrismaClient();
    const prismaOptions: any = {};
    if (dbUrl) {
      prismaOptions.datasources = {
        db: {
          url: dbUrl,
        },
      };
    }

    this.prisma = new PrismaClient(prismaOptions);
  }

  async connect(): Promise<void> {
    const dbUrl = this.dbUrl || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }

    try {
      await this.prisma.$connect();
      Logger.success("Connected to Prisma database");
    } catch (error: any) {
      Logger.error(`Failed to connect to Prisma database: ${error.message}`);
      throw error;
    }
  }

  async parseSchema(): Promise<SchemaModel[]> {
    try {
      const schemaContent = readFileSync(this.schemaPath, "utf-8");
      this.enums = this.extractEnums(schemaContent);
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
      return await this.parseSchema();
    } catch (error) {
      Logger.error(`Failed to introspect database: ${error}`);
      throw error;
    }
  }

  private extractEnums(schemaContent: string): Record<string, string[]> {
    const enums: Record<string, string[]> = {};
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = enumRegex.exec(schemaContent)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      const values = enumBody
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//"))
        .map((line) => line.split(" ")[0].trim())
        .filter((value) => value.length > 0);

      enums[enumName] = values;
    }

    return enums;
  }

  private extractModels(schemaContent: string): SchemaModel[] {
    const models: SchemaModel[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(schemaContent)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      const relations = this.extractRelations(modelBody);
      const fields = this.extractFields(modelBody);

      models.push({
        name: modelName,
        fields,
        relations,
      });
    }

    return models;
  }

  private extractFields(modelBody: string): SchemaField[] {
    const fields: SchemaField[] = [];
    const lines = modelBody.split("\n");
    const scalarTypes = new Set([
      "String",
      "Int",
      "Float",
      "Boolean",
      "DateTime",
      "Json",
      "Bytes",
      "BigInt",
      "Decimal",
    ]);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("}")) {
        continue;
      }

      const fieldMatch = trimmed.match(/^(\w+)\s+([A-Za-z0-9_]+(?:\[\])?\??)(\s+.*)?$/);
      if (!fieldMatch) {
        continue;
      }

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const attributes = fieldMatch[3] || "";
      const fieldTypeBase = fieldType.replace("?", "").replace("[]", "");
      const isEnumType = Boolean(this.enums[fieldTypeBase]);
      const isRelationField = !scalarTypes.has(fieldTypeBase) && !isEnumType;

      if (isRelationField) {
        continue;
      }

      const isRequired = !fieldType.includes("?");
      const cleanType = fieldType.replace("?", "");
      const isUnique = attributes.includes("@unique");
      const isPrimaryKey = attributes.includes("@id");
      const isForeignKey = modelBody.includes("@relation") &&
                          modelBody.includes(`fields: [${fieldName}]`);
      const isUpdatedAt = attributes.includes("@updatedAt");

      let defaultValue: any = undefined;
      const defaultMatch = attributes.match(/@default\(([^()]+(?:\([^()]*\)[^()]*)*)\)/);
      if (defaultMatch) {
        const defaultValueStr = defaultMatch[1].trim();
        if (
          defaultValueStr === "now()" ||
          defaultValueStr === "uuid()" ||
          defaultValueStr === "autoincrement()" ||
          defaultValueStr.startsWith("autoincrement")
        ) {
          defaultValue = undefined;
        } else {
          defaultValue = this.parseDefaultValue(defaultValueStr);
        }
      }

      if (isUpdatedAt) {
        continue;
      }

      let relationModel: string | undefined;
      let relationField: string | undefined;

      if (isForeignKey) {
        const relationLineMatch = modelBody.match(
          new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\([^)]*fields:\s*\\[${fieldName}\\][^)]*\\)`, 'g')
        );
        if (relationLineMatch && relationLineMatch.length > 0) {
          const parts = relationLineMatch[0].match(/(\w+)\s+(\w+)/);
          if (parts && parts[2]) {
            const potentialModel = parts[2];
            if (!scalarTypes.has(potentialModel)) {
              relationModel = potentialModel;
            }
          }
        }
      }

      const relationMatch = attributes.match(/@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\][^)]*\)/);
      if (relationMatch) {
        relationField = relationMatch[2].trim();
        const relationLineMatch = modelBody.match(new RegExp(`(\\w+)\\s+(\\w+)\\s+@relation\\([^)]*fields:\s*\\[${fieldName}\\][^)]*\\)`, 'g'));
        if (relationLineMatch) {
          const parts = relationLineMatch[0].match(/(\w+)\s+(\w+)/);
          if (parts && parts[2]) {
            const potentialModel = parts[2];
            if (!scalarTypes.has(potentialModel)) {
              relationModel = potentialModel;
            }
          }
        }
      }

      const enumValues = this.enums[fieldTypeBase];

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

  private extractRelations(modelBody: string): SchemaRelation[] {
    const relations: SchemaRelation[] = [];
    const scalarTypes = new Set([
      "String",
      "Int",
      "Float",
      "Boolean",
      "DateTime",
      "Json",
      "Bytes",
      "BigInt",
      "Decimal",
    ]);

    const relationRegex = /(\w+)\s+([A-Z][a-zA-Z0-9_]*)(\?|\[\])?\s+(@relation\([^)]+\))?/g;
    let match;

    while ((match = relationRegex.exec(modelBody)) !== null) {
      const fieldName = match[1];
      const relationModelName = match[2];
      const modifier = match[3] || "";
      const relationAttr = match[4] || "";

      if (scalarTypes.has(relationModelName)) {
        continue;
      }

      const isOptional = modifier === "?";
      const isArray = modifier === "[]";

      let relationType: "oneToOne" | "oneToMany" | "manyToMany" = "oneToMany";
      if (isOptional && !isArray) {
        relationType = "oneToOne";
      } else if (isArray) {
        relationType = "manyToMany";
      }

      let foreignKey: string | undefined;
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

    if (this.enums[cleanType]) {
      return "enum";
    }

    return "enum";
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
