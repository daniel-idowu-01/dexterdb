# Dexter DB Seeder - Complete Setup Guide

## 🚀 Quick Setup (10 minutes)

### Step 1: Install Dependencies

```bash
npm install dexterdb mongoose
# or
yarn add dexterdb mongoose

# dev dependencies for TypeScript
npm install -D @types/node typescript ts-node
```

### Step 2: Start MongoDB

#### Option A: Docker (Recommended)

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  mongodb:
    image: mongo:7
    container_name: dexter-mongodb
    environment:
      MONGO_INITDB_ROOT_USERNAME: dexter
      MONGO_INITDB_ROOT_PASSWORD: dexter123
      MONGO_INITDB_DATABASE: dexter_test
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongodb_data:
EOF

# Start MongoDB
docker-compose up -d

# Verify it's running
docker ps
```

#### Option B: MongoDB Atlas (Cloud - Free)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account and M0 cluster (512MB)
3. Add your IP to whitelist (or `0.0.0.0/0` for testing)
4. Create database user
5. Get connection string from "Connect" button

#### Option C: Local Installation

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows:**
Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

### Step 3: Configure Environment

```bash
cat > .env << 'EOF'
# For Docker
DATABASE_URL="mongodb://<username>:<password>@localhost:27017/dexter_test?authSource=admin"

# MongoDB Atlas example
# DATABASE_URL="mongodb+srv://<username>:<password>@<cluster-url>/dexter_test?retryWrites=true&w=majority"

# Local MongoDB (no auth)
# DATABASE_URL="mongodb://localhost:27017/dexter_test"
EOF
```

### Step 4: Create Mongoose Models

#### Create Directory Structure

```bash
mkdir -p src/models
```

#### User Model (`src/models/User.ts`)

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  firstName: string;
  lastName: string;
  age?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

UserSchema.index({ email: 1 });

// IMPORTANT: Use default export
export default mongoose.model<IUser>('User', UserSchema);
```

#### Post Model (`src/models/Post.ts`)

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content?: string;
  published: boolean;
  tags: string[];
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
    },
    published: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'posts',
  }
);

PostSchema.index({ authorId: 1 });
PostSchema.index({ published: 1, createdAt: -1 });

// IMPORTANT: Use default export
export default mongoose.model<IPost>('Post', PostSchema);
```

#### OTP Model (`src/models/Otp.ts`) - Real-world Example

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  otp?: string;
  rawOtp?: string;
  expiresAt: Date;
  email?: string;
  username?: string;
  smsOtp?: string;
  rawSmsOtp?: string;
  phoneNumber?: string;
  otpCount: number;
  termiiPinId?: string;
  channel?: string;
}

const OtpSchema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    otp: {
      type: String,
    },
    rawOtp: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    email: {
      type: String,
    },
    username: {
      type: String,
    },
    smsOtp: {
      type: String,
    },
    rawSmsOtp: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    otpCount: {
      type: Number,
      default: 0,
    },
    termiiPinId: {
      type: String,
    },
    channel: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'otps',
  }
);

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOtp>('Otp', OtpSchema);
```

**⚠️ Critical**: All models MUST use `export default mongoose.model(...)` for the seeder to detect them!

### Step 5: Create Seeder Configuration

```bash
cat > seeder.config.json << 'EOF'
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
          "generator": "internet.email"
        },
        "firstName": {
          "generator": "person.firstName"
        },
        "lastName": {
          "generator": "person.lastName"
        },
        "age": {
          "type": "number",
          "min": 18,
          "max": 80
        }
      }
    },
    "Post": {
      "count": 200,
      "fields": {
        "title": {
          "generator": "lorem.sentence"
        },
        "content": {
          "generator": "lorem.paragraphs"
        },
        "published": {
          "type": "boolean"
        },
        "tags": {
          "type": "array",
          "values": ["javascript", "typescript", "mongodb", "nodejs", "react"]
        }
      }
    },
    "Otp": {
      "count": 100,
      "fields": {
        "otp": {
          "type": "string",
          "pattern": "[0-9]{6}"
        },
        "rawOtp": {
          "type": "string",
          "pattern": "[0-9]{6}"
        },
        "smsOtp": {
          "type": "string",
          "pattern": "[0-9]{6}"
        },
        "rawSmsOtp": {
          "type": "string",
          "pattern": "[0-9]{6}"
        },
        "expiresAt": {
          "type": "date",
          "generator": "date.future"
        },
        "email": {
          "generator": "internet.email"
        },
        "username": {
          "generator": "internet.userName"
        },
        "phoneNumber": {
          "generator": "phone.number"
        },
        "termiiPinId": {
          "generator": "string.uuid"
        },
        "channel": {
          "type": "enum",
          "values": ["email", "sms", "whatsapp"]
        },
        "otpCount": {
          "type": "number",
          "min": 0,
          "max": 5
        }
      }
    }
  }
}
EOF
```

### Step 6: Build and Test

```bash
npm install

npm run build

# Test with a small dataset
npx dexterdb seed --model User --count 10

# Seed all models
npx dexterdb seed

# Using ts-node for development (no build needed)
npx ts-node cli.ts seed --model User --count 10
```

### Step 7: Verify Data

#### Using MongoDB Compass (GUI)

1. Download: https://www.mongodb.com/products/compass
2. Connect: `mongodb://dexter:dexter123@localhost:27017/?authSource=admin`
3. Select database: `dexter_test`
4. Browse collections: `users`, `posts`, `otps`

#### Using mongosh (CLI)

```bash
# Connect
mongosh "mongodb://dexter:dexter123@localhost:27017/?authSource=admin"

# Switch to database
use dexter_test

# View collections
show collections

# Count documents
db.users.countDocuments()
db.posts.countDocuments()
db.otps.countDocuments()

# Find documents
db.users.find().limit(5).pretty()
db.posts.find({ published: true }).limit(5).pretty()
db.otps.find({ channel: "sms" }).limit(5).pretty()

# Verify references
db.posts.aggregate([
  {
    $lookup: {
      from: "users",
      localField: "authorId",
      foreignField: "_id",
      as: "author"
    }
  },
  { $limit: 3 }
]).pretty()
```

#### Using Mongoose Script

Create `verify-data.ts`:

```typescript
import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from './src/models/User';
import Post from './src/models/Post';
import Otp from './src/models/Otp';

config();

async function verify() {
  await mongoose.connect(process.env.DATABASE_URL!);

  const userCount = await User.countDocuments();
  const postCount = await Post.countDocuments();
  const otpCount = await Otp.countDocuments();

  console.log(`Document Counts:`);
  console.log(`Users: ${userCount}`);
  console.log(`Posts: ${postCount}`);
  console.log(`OTPs: ${otpCount}`);

  console.log(`Sample Users:`);
  const users = await User.find().limit(3);
  users.forEach(u => console.log(`- ${u.firstName} ${u.lastName} (${u.email})`));

  console.log(`Sample Posts:`);
  const posts = await Post.find().populate('authorId').limit(3);
  posts.forEach(p => console.log(`- ${p.title} by ${(p.authorId as any).firstName}`));

  console.log(`Sample OTPs:`);
  const otps = await Otp.find().limit(3);
  otps.forEach(o => console.log(`- OTP: ${o.otp}, Channel: ${o.channel}, Expires: ${o.expiresAt}`));

  await mongoose.disconnect();
}

verify();
```

Run it:
```bash
npx ts-node verify-data.ts
```

## 🎯 Common Workflows

### Development Workflow

```bash
# 1. Make model changes
# Edit src/models/User.ts

# 2. Clear old data
mongosh "your-db-url" --eval "db.users.deleteMany({})"

# 3. Reseed with ts-node (no build)
npx ts-node cli.ts seed --model User --count 20 --reset

# 4. Verify
npx ts-node verify-data.ts
```

### Production Seeding

```bash
# 1. Build project
npm run build

# 2. Set production DB
export DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/prod"

# 3. Seed with production config
npx dexterdb seed --config seeder.prod.json

# 4. Verify counts
mongosh "$DATABASE_URL" --eval "db.users.countDocuments()"
```

### Testing Setup

```typescript
// tests/setup.ts
import { Seeder } from 'dexterdb';
import mongoose from 'mongoose';
import { join } from 'path';

export async function setupTestData() {
  const seeder = new Seeder({
    dbUrl: process.env.TEST_DATABASE_URL!,
    schemaPath: join(__dirname, '..', 'src', 'models'),
  });

  await seeder.initialize();
  
  // Seed test data
  await seeder.seed('User', 10, { reset: true });
  await seeder.seed('Post', 20);
  await seeder.seed('Otp', 15);
  
  await seeder.disconnect();
}

// Jest setup
beforeAll(async () => {
  await setupTestData();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
```

## 🔧 Troubleshooting Guide

### Issue: "No models found"

**Symptoms:**
```
⚠ No Mongoose models found in ./src/models
⚠ Failed to load model from User.ts
```

**Solutions:**

1. **Check model exports:**
```typescript
// Correct
export default mongoose.model<IUser>('User', UserSchema);

// Wrong - missing export
const User = mongoose.model<IUser>('User', UserSchema);

// Wrong - named export
export const User = mongoose.model<IUser>('User', UserSchema);
```

2. **Verify file structure:**
```bash
src/
└── models/
    ├── User.ts      # ✅ Must end with .ts or .js
    ├── Post.ts      # ✅ Good
    └── index.ts     # ⚠️ Skipped by seeder (optional re-export file)
```

3. **Check path:**
```typescript
// Use absolute path
import { join } from 'path';

const seeder = new Seeder({
  schemaPath: join(__dirname, 'src', 'models'),
});
```

### Issue: "Cannot connect to MongoDB"

**Solutions:**

```bash
# Test connection manually
mongosh "mongodb://dexter:dexter123@localhost:27017/?authSource=admin"

# Check if MongoDB is running
docker ps | grep mongo        # Docker
brew services list            # macOS
sudo systemctl status mongod  # Linux

# Check connection string format
# Correct
DATABASE_URL="mongodb://user:pass@localhost:27017/db?authSource=admin"

# Wrong - missing protocol
DATABASE_URL="localhost:27017/db"
```

### Issue: "Reference not found"

**Symptoms:**
```
⚠ No related records found for User. Make sure to seed User first.
```

**Solutions:**

```bash
# Option 1: Manual order
npx dexterdb seed --model User --count 50
npx dexterdb seed --model Post --count 100

# Option 2: Automatic (recommended)
npx dexterdb seed  # Seeds all in correct order
```

### Issue: "Module compilation failed"

**Solutions:**

```bash
# Clear build and rebuild
rm -rf dist
npm run build

# Or use ts-node directly
npx ts-node cli.ts seed --model User --count 10

# Check tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",  // Required
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

### Issue: Incorrect OTP/PIN data

**Problem:** OTPs contain words instead of numbers

**Solution:** Update generators or config:

```json
{
  "fields": {
    "otp": {
      "type": "string",
      "pattern": "[0-9]{6}"
    }
  }
}
```

Or rebuild after updating StringGenerator with OTP detection.

## 📊 TypeScript Configuration

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "cli.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## 🚀 Performance Optimization

### 1. Use Indexes

```typescript
// Add to your schemas
UserSchema.index({ email: 1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### 2. Limit Reference Queries

```json
{
  "relations": {
    "categoryIds": {
      "model": "Category",
      "min": 1,
      "max": 3  // Don't create too many references
    }
  }
}
```

### 3. Use Batch Inserts (Default)

The seeder uses `insertMany()` by default which is much faster than individual inserts.

### 4. Connection Pooling

```typescript
// Mongoose handles this automatically
// Default pool size is 5
```

## 🎓 Next Steps

1. ✅ Read the [Main README](./README.md) for full API documentation
2. ✅ Explore [Configuration Options](./seeder.config.json)
3. ✅ Check [Example Models](./src/models/)
4. ✅ Learn [Mongoose Best Practices](https://mongoosejs.com/docs/guide.html)
5. ✅ Deploy to production with [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

## 📞 Support

- **GitHub Issues**: [dexterdb/issues](https://github.com/daniel-idowu-01/dexterdb/issues)
- **Mongoose Docs**: [mongoosejs.com](https://mongoosejs.com/docs/)
- **MongoDB Docs**: [docs.mongodb.com](https://docs.mongodb.com/)

Happy seeding! 🌱✨