# Dexter DB Seeder & Faker

A powerful TypeScript Node.js library and CLI tool for automatically generating realistic test data for databases. Supports PostgreSQL with Prisma ORM, handles relational dependencies, respects types, and provides configurable seeding options.

## Features

- 🎯 **Schema Introspection** - Automatically reads database schema from Prisma
- 🎲 **Realistic Data Generation** - Uses Faker.js for generating realistic fake data
- 🔗 **Relational Dependencies** - Automatically handles foreign keys and relationships
- ⚙️ **Highly Configurable** - JSON/YAML config files for fine-grained control
- 🚀 **CLI & Programmatic API** - Use as a CLI tool or import as a library
- 📊 **Multiple Seeding Modes** - Full reset, incremental, or randomized seeding
- 🎨 **Type-Aware** - Respects field types, constraints, and enums
- 📝 **Well Documented** - Comprehensive inline documentation

## Installation

```bash
npm install dexterdb
# or
yarn add dexterdb
# or
pnpm add dexterdb
```

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database
- Prisma setup with a `schema.prisma` file

## Quick Start

### 1. Setup Environment

Create a `.env` file in your project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Seed Your Database

**Using CLI:**

```bash
# Seed a specific model
npx dexterdb seed --model User --count 50

# Seed all models
npx dexterdb seed

# List available models
npx dexterdb list
```

**Using Programmatic API:**

```typescript
import { Seeder } from "dexterdb";

const seeder = new Seeder({
  dbUrl: process.env.DATABASE_URL!,
});

await seeder.initialize();
await seeder.seed("User", 50, {
  posts: { min: 1, max: 5 },
});
await seeder.disconnect();
```

## Configuration

Create a `seeder.config.json` file to customize seeding behavior:

```json
{
  "global": {
    "reset": false,
    "incremental": false,
    "randomize": false
  },
  "models": {
    "User": {
      "count": 50,
      "fields": {
        "email": {
          "generator": "internet.email",
          "type": "string"
        },
        "age": {
          "type": "number",
          "min": 18,
          "max": 100
        },
        "isActive": {
          "type": "boolean"
        }
      }
    },
    "Post": {
      "count": 100,
      "fields": {
        "title": {
          "generator": "lorem.sentence"
        }
      },
      "relations": {
        "author": {
          "min": 1,
          "max": 1,
          "model": "User"
        }
      }
    }
  }
}
```

### Configuration Options

#### Global Options

- `reset`: Delete all existing data before seeding
- `incremental`: Add to existing data (default: false)
- `randomize`: Randomize insertion order

#### Model Options

- `count`: Number of records to generate (default: 10)
- `fields`: Field-specific configuration
- `relations`: Relation configuration

#### Field Options

- `type`: Override field type (`string`, `number`, `date`, `boolean`, `enum`)
- `generator`: Custom Faker.js generator path (e.g., `"internet.email"`)
- `min`/`max`: Range for numbers
- `pattern`: Regex pattern for strings
- `values`: Array of values for enums
- `ignore`: Skip this field
- `defaultValue`: Use a specific value

## CLI Commands

### `seed` - Seed database

```bash
npx dexterdb seed [options]

Options:
  -m, --model <model>     Model name to seed
  -c, --count <count>     Number of records (default: 10)
  --config <path>         Path to config file
  --schema <path>         Path to Prisma schema
  --reset                 Reset table before seeding
  --incremental           Add to existing data
  --randomize             Randomize insertion order
```

### `list` - List available models

```bash
npx dexterdb list [options]

Options:
  --schema <path>         Path to Prisma schema file
```

## Programmatic API

### Basic Usage

```typescript
import { Seeder } from "dexterdb";

const seeder = new Seeder({
  dbUrl: process.env.DATABASE_URL!,
  schemaPath: "./prisma/schema.prisma", // optional
  configPath: "./seeder.config.json",  // optional
  verbose: true,                        // optional
});

// Initialize (parse schema)
await seeder.initialize();

// Seed a single model
const result = await seeder.seed("User", 50, {
  fields: {
    email: { generator: "internet.email" },
  },
});

// Seed all models
const results = await seeder.seedAll();

// Cleanup
await seeder.disconnect();
```

### Advanced Usage

```typescript
// Seed with relation configuration
await seeder.seed("Post", 100, {
  relations: {
    author: { min: 1, max: 1, model: "User" },
    comments: { min: 0, max: 10, model: "Comment" },
  },
});

// Custom field generation
await seeder.seed("Product", 50, {
  fields: {
    price: { type: "number", min: 10, max: 1000 },
    category: { type: "enum", values: ["electronics", "clothing", "books"] },
    description: { generator: "lorem.paragraphs", ignore: false },
  },
});
```

## Data Generators

The seeder automatically detects field types and generates appropriate data:

- **Strings**: Names, emails, addresses, URLs, descriptions
- **Numbers**: Integers, floats, prices, ages, ratings
- **Dates**: Recent dates, birthdates, timestamps
- **Booleans**: Random true/false values
- **Enums**: Random selection from enum values
- **Relations**: Automatically resolves foreign keys

### Field Name Hints

The seeder uses field names to generate contextually appropriate data:

- `email` → Email address
- `firstName`, `lastName` → Person names
- `address`, `city`, `country` → Location data
- `phone` → Phone number
- `age` → Age (18-100)
- `price`, `cost`, `amount` → Monetary values
- `createdAt`, `updatedAt` → Recent timestamps
- `birthDate`, `dob` → Birth dates

## Project Structure

```
dexter/
├── src/
│   ├── index.ts              # Main exports
│   ├── seeder.ts             # Core Seeder class
│   ├── generators/           # Data generators
│   │   ├── baseGenerator.ts
│   │   └── index.ts
│   ├── schema-parser/        # Schema parsing
│   │   └── prismaParser.ts
│   ├── config/               # Configuration
│   │   └── config.ts
│   ├── utils/                # Utilities
│   │   └── logger.ts
│   └── types/                # TypeScript types
│       └── index.ts
├── cli.ts                    # CLI entry point
├── tests/                    # Test files
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Build project
npm run build
```

### Development Scripts

```bash
# Run in development mode
npm run dev

# Watch mode with auto-reload
npm run dev:watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Examples

### Example 1: Basic User Seeding

```typescript
const seeder = new Seeder({ dbUrl: process.env.DATABASE_URL! });
await seeder.initialize();
await seeder.seed("User", 100);
await seeder.disconnect();
```

### Example 2: Seeding with Relations

```typescript
// Seed users first
await seeder.seed("User", 50);

// Then seed posts with user relations
await seeder.seed("Post", 200, {
  relations: {
    author: { model: "User" },
  },
});
```

### Example 3: Custom Field Generation

```typescript
await seeder.seed("Product", 50, {
  fields: {
    name: { generator: "commerce.productName" },
    price: { type: "number", min: 10, max: 500 },
    inStock: { type: "boolean" },
  },
});
```

## TypeScript Support

Full TypeScript support with type definitions included. Import types as needed:

```typescript
import type {
  SeederOptions,
  SeederConfig,
  ModelConfig,
  FieldConfig,
  SeedResult,
} from "dexterdb";
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

---

**Note**: This tool is designed for development and testing environments. Use with caution in production environments.

