import {
  StringGenerator,
  NumberGenerator,
  DateGenerator,
  BooleanGenerator,
  EnumGenerator,
} from "../src/generators";
import { FieldConfig } from "../src/types";

describe("Generators", () => {
  describe("StringGenerator", () => {
    const generator = new StringGenerator();

    it("should generate email for email fields", () => {
      const value = generator.generate("email");
      expect(value).toContain("@");
      expect(typeof value).toBe("string");
    });

    it("should generate name for name fields", () => {
      const value = generator.generate("firstName");
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });

    it("should generate address for address fields", () => {
      const value = generator.generate("address");
      expect(typeof value).toBe("string");
    });

    it("should use custom generator from config", () => {
      const config: FieldConfig = {
        generator: "internet.url",
      };
      const value = generator.generate("website", config);
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^https?:\/\//);
    });

    it("should reject non-faker generator paths", () => {
      const config: FieldConfig = {
        generator: "constructor.constructor",
      };
      const value = generator.generate("field", config);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    });
  });

  describe("NumberGenerator", () => {
    const generator = new NumberGenerator();

    it("should generate integer within range", () => {
      const config: FieldConfig = { min: 1, max: 100 };
      const value = generator.generate("count", config);
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    });

    it("should generate age for age fields", () => {
      const value = generator.generate("age");
      expect(value).toBeGreaterThanOrEqual(18);
      expect(value).toBeLessThanOrEqual(100);
    });

    it("should generate price for price fields", () => {
      const value = generator.generate("price");
      expect(value).toBeGreaterThan(0);
    });
  });

  describe("DateGenerator", () => {
    const generator = new DateGenerator();

    it("should generate date object", () => {
      const value = generator.generate("createdAt");
      expect(value).toBeInstanceOf(Date);
    });

    it("should generate birthdate for birth fields", () => {
      const value = generator.generate("birthDate");
      expect(value).toBeInstanceOf(Date);
      expect(value.getTime()).toBeLessThan(Date.now());
    });
  });

  describe("BooleanGenerator", () => {
    const generator = new BooleanGenerator();

    it("should generate boolean value", () => {
      const value = generator.generate("isActive");
      expect(typeof value).toBe("boolean");
    });
  });

  describe("EnumGenerator", () => {
    const generator = new EnumGenerator();

    it("should pick from enum values", () => {
      const config: FieldConfig = {
        values: ["red", "green", "blue"],
      };
      const value = generator.generate("color", config);
      expect(["red", "green", "blue"]).toContain(value);
    });

    it("should return null if no values provided", () => {
      const value = generator.generate("status");
      expect(value).toBeNull();
    });
  });
});

