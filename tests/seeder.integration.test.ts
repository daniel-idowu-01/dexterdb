jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  };
}, { virtual: true });

import { Seeder } from "../src/seeder";
import { SchemaModel } from "../src/types";

// Mock database implementations to test both paths without actual DB
describe("Seeder Integration", () => {
  describe("Database Type Detection", () => {
    it("detects MongoDB from connection string", () => {
      const seeder = new Seeder({
        dbUrl: "mongodb://localhost:27017/test",
      });

      expect((seeder as any).dbType).toBe("mongodb");
    });

    it("detects PostgreSQL from connection string", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://user:pass@localhost:5432/test",
      });

      expect((seeder as any).dbType).toBe("postgresql");
    });

    it("rejects unsupported database URLs", () => {
      expect(() => {
        new Seeder({
          dbUrl: "mysql://localhost:3306/test",
        });
      }).toThrow("Unsupported DATABASE_URL scheme");
    });
  });

  describe("Configuration Loading", () => {
    it("loads seeder config from JSON", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://user:pass@localhost:5432/test",
        configPath: "./seeder.config.json",
      });

      expect((seeder as any).config).toBeDefined();
    });

    it("uses default config when file not found", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://user:pass@localhost:5432/test",
        configPath: "./non-existent-config.json",
      });

      const config = (seeder as any).config;
      expect(config.global?.reset).toBe(false);
      expect(config.global?.incremental).toBe(false);
    });
  });

  describe("Model Dependency Ordering", () => {
    it("sorts models by foreign key dependencies", () => {
      const seeder = new Seeder({
        dbUrl: "mongodb://localhost:27017/test",
      });

      // Simulate parsed models
      const models: SchemaModel[] = [
        {
          name: "Post",
          fields: [
            {
              name: "id",
              type: "objectid",
              isRequired: true,
              isPrimaryKey: true,
              isForeignKey: false,
            },
            {
              name: "authorId",
              type: "objectid",
              isRequired: true,
              isForeignKey: true,
              relationModel: "User",
            },
          ],
          relations: [],
        },
        {
          name: "User",
          fields: [
            {
              name: "id",
              type: "objectid",
              isRequired: true,
              isPrimaryKey: true,
              isForeignKey: false,
            },
          ],
          relations: [],
        },
      ];

      (seeder as any).models = models;
      const sorted = (seeder as any).sortModelsByDependencies();

      expect(sorted[0].name).toBe("User");
      expect(sorted[1].name).toBe("Post");
    });
  });

  describe("Field Value Generation", () => {
    it("respects ignore field configuration", async () => {
      const seeder = new Seeder({
        dbUrl: "mongodb://localhost:27017/test",
      });

      const field = {
        name: "internalId",
        type: "string",
        isRequired: false,
      };

      const config = {
        fields: {
          internalId: { ignore: true },
        },
      };

      const result = (seeder as any).shouldSkipField(field, config);
      expect(result).toBe(true);
    });

    it("generates correct value types based on field name patterns", async () => {
      const seeder = new Seeder({
        dbUrl: "mongodb://localhost:27017/test",
      });

      const emailField = { name: "email", type: "string" };
      const ageField = { name: "age", type: "number" };

      const emailValue = await (seeder as any).generateFieldValue(emailField, undefined);
      const ageValue = await (seeder as any).generateFieldValue(ageField, undefined);

      expect(emailValue).toContain("@");
      expect(typeof ageValue).toBe("number");
      expect(ageValue).toBeGreaterThanOrEqual(18);
    });
  });

  describe("Prisma Helper Methods", () => {
    it("identifies Prisma model delegates correctly", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://localhost:5432/test",
      });

      // Mock Prisma client with camelCase model names
      (seeder as any).prismaClient = {
        user: { findMany: jest.fn() },
        post: { findMany: jest.fn() },
      };

      const userDelegate = (seeder as any).getPrismaDelegate("User");
      expect(userDelegate).toBe((seeder as any).prismaClient.user);
    });

    it("finds primary key field correctly", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://localhost:5432/test",
      });

      (seeder as any).models = [
        {
          name: "User",
          fields: [
            { name: "id", type: "number", isPrimaryKey: true },
            { name: "email", type: "string", isPrimaryKey: false },
          ],
        },
      ];

      const primaryKey = (seeder as any).getPrimaryKeyField("User");
      expect(primaryKey).toBe("id");
    });

    it("chooses correct sort field for fetching records", () => {
      const seeder = new Seeder({
        dbUrl: "postgresql://localhost:5432/test",
      });

      (seeder as any).models = [
        {
          name: "User",
          fields: [
            { name: "id", type: "number", isPrimaryKey: true },
            { name: "createdAt", type: "datetime" },
          ],
        },
      ];

      const sortField = (seeder as any).getSortField("User");
      expect(sortField).toBe("createdAt");
    });
  });
});
