# Quick Start Guide - Testing with Real Database

## Fastest Way: Docker PostgreSQL

### 1. Start Database (Docker)

```bash
# Start PostgreSQL and MongoDB services in Docker
npm run db:up

# Or manually:
docker-compose up -d
```

### 2. Setup Environment

Create `.env` file:

```env
DATABASE_URL="postgresql://dexter:dexter123@localhost:5432/dexter_test?schema=public"
```

### 3. Initialize Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push
```

### 4. Test the Seeder

```bash
# Option A: Use the test script
npm run test:seeder

# Option B: Use CLI
npm run build
npm start seed --model User --count 10
npm start seed --model Post --count 20
```

### 5. View Data

```bash
# Open Prisma Studio (browser interface)
npm run prisma:studio
```

### 6. Clean Up

```bash
# Stop Docker
npm run db:down

# Or reset database
npm run prisma:reset
```

## Alternative: Local PostgreSQL

If you have PostgreSQL installed locally:

1. Create database:
   ```bash
   psql -U postgres
   CREATE DATABASE dexter_test;
   \q
   ```

2. Update `.env` with your connection string:
   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/dexter_test?schema=public"
   ```

3. Follow steps 3-6 from above.

## Verify It Works

```bash
# Check database connection
npx prisma db pull

# View tables
psql -U dexter -d dexter_test -c "\dt"

# Count records
psql -U dexter -d dexter_test -c "SELECT COUNT(*) FROM \"User\";"
```

## Troubleshooting

- **"Connection refused"**: Make sure PostgreSQL is running (`npm run db:up`)
- **"Database does not exist"**: Run `npm run prisma:push` to create tables
- **"Prisma client not found"**: Run `npm run prisma:generate`

