export interface SeederOptions {
  dbUrl: string;
  schemaPath?: string;
  configPath?: string;
  verbose?: boolean;
  dbType?: "mongodb" | "postgresql";
}

export interface FieldConfig {
  type?: "string" | "number" | "date" | "boolean" | "enum" | "relation";
  generator?: string;
  min?: number;
  max?: number;
  pattern?: string;
  values?: (string | number)[];
  ignore?: boolean;
  defaultValue?: any;
}

export interface ModelConfig {
  count?: number;
  fields?: Record<string, FieldConfig>;
  relations?: Record<string, RelationConfig>;
}

export interface RelationConfig {
  min?: number;
  max?: number;
  model?: string;
  cascade?: boolean;
}

export interface SeederConfig {
  models?: Record<string, ModelConfig>;
  global?: {
    reset?: boolean;
    incremental?: boolean;
    randomize?: boolean;
  };
}

export interface SchemaField {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  relationModel?: string;
  relationField?: string;
  defaultValue?: any;
  enumValues?: string[];
}

export interface SchemaModel {
  name: string;
  fields: SchemaField[];
  relations: SchemaRelation[];
}

export interface SchemaRelation {
  name: string;
  type: "oneToOne" | "oneToMany" | "manyToMany";
  model: string;
  field: string;
  foreignKey?: string;
}

export interface SeedResult {
  model: string;
  count: number;
  success: boolean;
  error?: string;
}

