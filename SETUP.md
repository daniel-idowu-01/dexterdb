# Setup Instructions

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   - Copy `.env.example` to `.env` (if it exists) or create `.env` with:
     ```
     DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
     ```

3. **Setup Prisma**
   - Create `prisma/schema.prisma` (see `prisma/schema.example.prisma` for reference)
   - Generate Prisma client:
     ```bash
     npm run prisma:generate
     ```

4. **Build the Project**
   ```bash
   npm run build
   ```

5. **Run the Seeder**
   ```bash
   # Using CLI
   npm start seed --model User --count 50

   # Or using npx
   npx dexterdb seed --model User --count 50
   ```

## Development

```bash
# Run in development mode
npm run dev

# Watch mode (auto-reload)
npm run dev:watch

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
dexter/
├── src/                    # Source code
│   ├── index.ts           # Main exports
│   ├── seeder.ts          # Core Seeder class
│   ├── generators/        # Data generators
│   ├── schema-parser/     # Schema parsing
│   ├── config/            # Configuration
│   ├── utils/             # Utilities
│   └── types/             # TypeScript types
├── cli.ts                 # CLI entry point
├── tests/                 # Test files
├── prisma/                # Prisma schema
├── dist/                  # Compiled output (generated)
└── package.json
```

## Configuration

Create `seeder.config.json` to customize seeding behavior. See `seeder.config.example.json` for reference.

## Troubleshooting

1. **"Prisma client not found"**
   - Run `npm run prisma:generate` to generate the Prisma client

2. **"DATABASE_URL not found"**
   - Make sure `.env` file exists with `DATABASE_URL` set

3. **"Model not found in schema"**
   - Verify your Prisma schema file is correct
   - Make sure the model name matches exactly (case-sensitive)

4. **Type errors**
   - Run `npm run build` to check for TypeScript errors
   - Make sure all dependencies are installed

