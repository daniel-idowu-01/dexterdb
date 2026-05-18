# PostgreSQL Seeding Guide - Dexter DB

This guide shows how to use Dexter DB to seed data into PostgreSQL databases using Prisma.

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL database (local or cloud)
- Prisma project with generated `@prisma/client`
- Prisma schema defining your models

## Installation

```bash
npm install dexterdb @prisma/client
npm install -D prisma typescript @types/node ts-node
```

## Setup

### 1. Create Your Prisma Schema

Create `prisma/schema.prisma`:

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String
  posts Post[]
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### 2. Set Environment Variables

Create `.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
npx prisma db push
```

### 4. Use Dexter DB to Seed

#### Via CLI

```bash
# Seed a specific model
npx dexterdb seed --model User --count 50

# Seed all models (respects foreign key dependencies)
npx dexterdb seed

# Reset table before seeding
npx dexterdb seed --model User --count 50 --reset

# List available models
npx dexterdb list
```

#### Programmatically

```typescript
import { Seeder } from "dexterdb";

const seeder = new Seeder({
  dbUrl: process.env.DATABASE_URL!,
  dbType: "postgresql",
});

await seeder.initialize();

// Seed individual model
await seeder.seed("User", 50);
await seeder.seed("Post", 100);

// Or seed all models
const results = await seeder.seedAll();

await seeder.disconnect();
```

## Configuration

Create `seeder.config.json`:

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
          "pattern": "[a-z]+@example\\.com"
        },
        "name": {
          "generator": "person.fullName"
        }
      }
    },
    "Post": {
      "count": 100,
      "fields": {
        "title": {
          "generator": "lorem.sentence"
        },
        "content": {
          "generator": "lorem.paragraph"
        }
      },
      "relations": {
        "author": {
          "min": 1,
          "max": 1
        }
      }
    }
  }
}
```

## Field Configuration

### Field Types

- `string` - Text fields
- `number` - Numeric fields
- `date` / `datetime` - Date/time fields
- `boolean` - Boolean fields
- `enum` - Enum fields (specify `values`)
- `json` - JSON/JSONB fields

### Field Attributes

```json
{
  "fields": {
    "email": {
      "type": "string",
      "pattern": "[a-z]{5}@example\\.com"
    },
    "age": {
      "type": "number",
      "min": 18,
      "max": 100
    },
    "status": {
      "type": "enum",
      "values": ["DRAFT", "PUBLISHED"]
    },
    "ignore": true
  }
}
```

### Smart Field Detection

Dexter DB automatically detects field patterns:

- `email` → generates valid emails
- `firstName`, `lastName`, `name` → generates names
- `phone` → generates phone numbers
- `address` → generates addresses
- `birthDate` → generates birthdates
- `price` → generates prices
- `password` → generates strong passwords
- And many more...

## Using Docker

### Start PostgreSQL

```bash
docker run -d \
  --name postgres-dexter \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dexter_test \
  -p 5432:5432 \
  postgres:15
```

Or use docker-compose:

```bash
npm run db:up
```

### Connect from Dexter

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dexter_test?schema=public"
```

## Example: Complete Workflow

### 1. Create Schema

```bash
mkdir prisma
cat > prisma/schema.prisma << 'EOF'
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String
  posts Post[]
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  Int
}
EOF
```

### 2. Setup Database

```bash
npx prisma generate
npx prisma db push
```

### 3. Create Config

```bash
cat > seeder.config.json << 'EOF'
{
  "global": { "reset": true },
  "models": {
    "User": { "count": 30 },
    "Post": { "count": 100 }
  }
}
EOF
```

### 4. Seed Database

```bash
npx dexterdb seed --config seeder.config.json
```

### 5. View Results

```bash
npx prisma studio
```

## Relationship Handling

### Foreign Keys (One-to-Many)

Automatically resolved by seeding parent first:

```prisma
model Author {
  id    Int     @id @default(autoincrement())
  name  String
  posts Post[]
}

model Post {
  id       Int     @id @default(autoincrement())
  title    String
  author   Author  @relation(fields: [authorId], references: [id])
  authorId Int
}
```

Configure:

```json
{
  "models": {
    "Author": { "count": 10 },
    "Post": {
      "count": 50,
      "relations": {
        "author": { "min": 1, "max": 1 }
      }
    }
  }
}
```

### Many-to-Many

```prisma
model Tag {
  id    Int     @id @default(autoincrement())
  name  String
  posts Post[]
}

model Post {
  id   Int     @id @default(autoincrement())
  title String
  tags Tag[]
}
```

Configure:

```json
{
  "models": {
    "Tag": { "count": 20 },
    "Post": {
      "count": 100,
      "relations": {
        "tags": { "min": 0, "max": 5 }
      }
    }
  }
}
```

## Troubleshooting

### "Cannot connect to PostgreSQL"

Check connection string:

```bash
psql postgresql://username:password@localhost:5432/mydb
```

### "Prisma client not found"

Run:

```bash
npx prisma generate
```

### "Model not found in schema"

Verify model name matches `schema.prisma` exactly (case-sensitive):

```bash
npx dexterdb list
```

### "Foreign key constraint error"

Seed parent models first or use `seedAll()` which auto-orders dependencies.

### Performance Issues

For large datasets:

```json
{
  "global": {
    "randomize": false,
    "incremental": true
  }
}
```

Use Prisma's batch operations (configured automatically).

## Best Practices

1. **Always generate Prisma client after schema changes:**
   ```bash
   npx prisma generate
   ```

2. **Test with small counts first:**
   ```bash
   npx dexterdb seed --model User --count 5
   ```

3. **Use `seeder.config.json` for complex setups** - easier to version control

4. **Reset between test runs** - prevents duplicate key errors:
   ```bash
   npx dexterdb seed --reset
   ```

5. **Monitor resource usage** - PostgreSQL handles concurrent writes well but watch connection pool

6. **Use descriptive field names** - Dexter auto-detects patterns like `email`, `phone`, `birthDate`

## API Reference

### Seeder Options

```typescript
interface SeederOptions {
  dbUrl: string;                    // PostgreSQL connection URL
  dbType?: "mongodb" | "postgresql"; // Auto-detected if not provided
  schemaPath?: string;              // Path to Prisma schema (default: prisma/schema.prisma)
  configPath?: string;              // Path to seeder config (default: seeder.config.json)
  verbose?: boolean;                // Enable debug logging
}
```

### Methods

```typescript
// Initialize and connect to database
await seeder.initialize();

// Seed a single model
const result = await seeder.seed(modelName, count, options);

// Seed all models (respects dependencies)
const results = await seeder.seedAll();

// Get available models
const models = seeder.getModels();

// Close database connection
await seeder.disconnect();
```

## Performance Tips

| Operation | Time (1000 records) |
| --- | --- |
| Simple strings | ~500ms |
| With relations | ~1.2s |
| Complex enum logic | ~800ms |
| With randomization | +50% |

Recommendations:
- For > 50k records: increase Prisma client connection pool
- Use `incremental: true` for multiple seed runs
- Consider batch operations for very large datasets

## See Also

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Dexter DB README](./README.md)
- [MongoDB Setup Guide](./SETUP.md)
