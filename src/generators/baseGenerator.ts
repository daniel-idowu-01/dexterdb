import { faker } from "@faker-js/faker";
import { FieldConfig } from "../types";

export abstract class BaseGenerator {
  abstract generate(fieldName: string, config?: FieldConfig): any;
}

export class StringGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): string {
    const lowerName = fieldName.toLowerCase();

    if (lowerName.includes("email")) {
      return faker.internet.email();
    }
    if (lowerName.includes("name") || lowerName.includes("username")) {
      if (lowerName.includes("first")) {
        return faker.person.firstName();
      }
      if (lowerName.includes("last")) {
        return faker.person.lastName();
      }
      if (lowerName.includes("full")) {
        return faker.person.fullName();
      }
      return faker.person.firstName();
    }
    if (lowerName.includes("phone")) {
      return faker.phone.number();
    }
    if (lowerName.includes("address") || lowerName.includes("street")) {
      return faker.location.streetAddress();
    }
    if (lowerName.includes("city")) {
      return faker.location.city();
    }
    if (lowerName.includes("country")) {
      return faker.location.country();
    }
    if (lowerName.includes("zip") || lowerName.includes("postal")) {
      return faker.location.zipCode();
    }
    if (lowerName.includes("url") || lowerName.includes("website")) {
      return faker.internet.url();
    }
    if (lowerName.includes("description") || lowerName.includes("bio")) {
      return faker.lorem.paragraph();
    }
    if (lowerName.includes("title")) {
      return faker.lorem.sentence();
    }
    if (lowerName.includes("password") || lowerName.includes("hash")) {
      return faker.internet.password();
    }
    if (lowerName.includes("uuid") || lowerName.includes("id")) {
      return faker.string.uuid();
    }

    if (config?.generator) {
      return this.useCustomGenerator(config.generator);
    }

    if (config?.pattern) {
      return faker.helpers.regexpStyleStringParse(config.pattern);
    }

    return faker.lorem.words(3);
  }

  private useCustomGenerator(generator: string): string {
    const parts = generator.split(".");
    let value: any = faker;

    for (const part of parts) {
      if (value && typeof value[part] === "function") {
        value = value[part]();
      } else {
        return faker.lorem.words(3);
      }
    }

    return String(value);
  }
}

export class NumberGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): number {
    const min = config?.min ?? 0;
    const max = config?.max ?? 1000;

    const lowerName = fieldName.toLowerCase();

    if (lowerName.includes("age")) {
      return faker.number.int({ min: 18, max: 100 });
    }
    if (lowerName.includes("price") || lowerName.includes("cost") || lowerName.includes("amount")) {
      return faker.number.float({ min: 0.01, max: 10000, fractionDigits: 2 });
    }
    if (lowerName.includes("rating") || lowerName.includes("score")) {
      return faker.number.float({ min: 0, max: 5, fractionDigits: 2 });
    }
    if (lowerName.includes("percent") || lowerName.includes("percentage")) {
      return faker.number.float({ min: 0, max: 100, fractionDigits: 2 });
    }

    return faker.number.int({ min, max });
  }
}

export class DateGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): Date {
    const lowerName = fieldName.toLowerCase();

    if (lowerName.includes("birth") || lowerName.includes("dob")) {
      return faker.date.birthdate();
    }
    if (lowerName.includes("created") || lowerName.includes("updated")) {
      const daysAgo = config?.max ?? 365;
      return faker.date.recent({ days: daysAgo });
    }
    if (lowerName.includes("future")) {
      return faker.date.future();
    }
    if (lowerName.includes("past")) {
      return faker.date.past();
    }

    return faker.date.recent({ days: 30 });
  }
}

export class BooleanGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): boolean {
    const lowerName = fieldName.toLowerCase();
    if (lowerName.includes("is") || lowerName.includes("has") || lowerName.includes("active")) {
      return faker.datatype.boolean();
    }

    return faker.datatype.boolean();
  }
}

export class EnumGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): any {
    if (config?.values && config.values.length > 0) {
      return faker.helpers.arrayElement(config.values);
    }

    return null;
  }
}

export class ObjectIdGenerator extends BaseGenerator {
  generate(fieldName: string, config?: FieldConfig): string {
    const timestamp = Math.floor(Date.now() / 1000)
      .toString(16)
      .padStart(8, "0");
    const randomHex = faker.string.hexadecimal({ length: 10, prefix: "", casing: "lower" });
    const counter = faker.string.hexadecimal({ length: 6, prefix: "", casing: "lower" });

    return `${timestamp}${randomHex}${counter}`;
  }
}
