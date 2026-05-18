import { SchemaModel } from "../types";

export interface SchemaParser {
  connect(): Promise<void>;
  introspectDatabase(): Promise<SchemaModel[]>;
  disconnect(): Promise<void>;
  getModels?(): Map<string, any>;
  getConnection?(): any;
  getPrismaClient?(): any;
}
