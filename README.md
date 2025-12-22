# Dexter DB Seeder - MongoDB Edition

A powerful TypeScript Node.js library and CLI tool for automatically generating realistic test data for MongoDB databases using **Mongoose ODM**.

## Key Features

- **Mongoose Native Support** - Works directly with Mongoose schemas and models
- **Intelligent Data Generation** - Context-aware fake data using Faker.js
- **Smart Reference Resolution** - Automatically handles ObjectId references between documents
- **Highly Configurable** - JSON/YAML config files with field-level customization
- **CLI & Programmatic API** - Use as a CLI tool or import as a library
- **Dependency-Aware Seeding** - Automatically determines correct seeding order
- **Type-Aware Generators** - Detects field patterns (OTP, email, phone, etc.)

## Prerequisites

- Node.js >= 18.0.0
- MongoDB database (local or cloud like MongoDB Atlas)
- Mongoose models defined in TypeScript/JavaScript

## Quick Start

### 1. Install Dependencies

```bash
npm install dexterdb mongoose
# or
yarn add dexterdb mongoose

# dev dependencies
npm install -D typescript @types/node ts-node
```

### 2. Setup MongoDB Connection

Create a `.env` file:

```env
# Local MongoDB
DATABASE_URL="mongodb://localhost:27017/mydb"

# Docker MongoDB with auth
DATABASE_URL="mongodb://<username>:<password>@localhost:27017/mydb?authSource=admin"

# MongoDB Atlas (Cloud)
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster-url>/mydb?retryWrites=true&w=majority"
```

### 3. Create Mongoose Models

Create your models in `src/models/`:

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  firstName: string;
  lastName: string;
  age?: number;
  isActive: boolean;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
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
}, {
  timestamps: true,
  collection: 'users',
});

// IMPORTANT: Use default export
export default mongoose.model<IUser>('User', UserSchema);
```

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content?: string;
  authorId: mongoose.Types.ObjectId;
  tags: string[];
}

const PostSchema = new Schema<IPost>({
  title: {
    type: String,
    required: true,
  },
  content: String,
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tags: [String],
}, {
  timestamps: true,
  collection: 'posts',
});

// IMPORTANT: Use default export
export default mongoose.model<IPost>('Post', PostSchema);
```

**⚠️ Important**: Always use `export default` for your Mongoose models!

### 4. Seed Your Database

```bash
npm run build

npx dexterdb seed --model User --count 50

# Seed all models (automatic dependency ordering)
npx dexterdb seed

# Reset collection before seeding
npx dexterdb seed --model User --count 50 --reset

# List available models
npx dexterdb list

# Using ts-node for development
npx ts-node cli.ts seed --model User --count 50
```

## Smart Field Detection

Dexter DB automatically generates appropriate data based on field names:

| Field Name Pattern | Generated Data |
|-------------------|----------------|
| `email` | faker.internet.email() |
| `firstName`, `lastName` | faker.person.firstName/lastName() |
| `username` | faker.internet.userName() |
| `phone`, `phoneNumber` | faker.phone.number() |
| `otp`, `pin`, `code` | 6-digit numeric code |
| `address`, `street` | faker.location.streetAddress() |
| `city` | faker.location.city() |
| `country` | faker.location.country() |
| `url`, `website` | faker.internet.url() |
| `uuid`, `termiiPinId` | faker.string.uuid() |
| `age` | Number between 18-100 |
| `price`, `amount` | Decimal number |
| `channel` | Random from ['email', 'sms', 'whatsapp', 'push'] |

## Configuration

### Basic Configuration

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
      "count": 100,
      "fields": {
        "email": {
          "generator": "internet.email"
        },
        "firstName": {
          "generator": "person.firstName"
        },
        "age": {
          "type": "number",
          "min": 18,
          "max": 80
        }
      }
    },
    "Post": {
      "count": 300,
      "fields": {
        "title": {
          "generator": "lorem.sentence"
        },
        "tags": {
          "type": "array",
          "values": ["javascript", "mongodb", "nodejs", "typescript"]
        }
      }
    }
  }
}
```

### Advanced Configuration Examples

**OTP/Verification Code Model:**

```json
{
  "models": {
    "Otp": {
      "count": 50,
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
          "generator": "string.numeric",
          "min": 6,
          "max": 6
        },
        "expiresAt": {
          "type": "date",
          "generator": "date.future"
        },
        "email": {
          "generator": "internet.email"
        },
        "phoneNumber": {
          "generator": "phone.number"
        },
        "channel": {
          "type": "enum",
          "values": ["email", "sms", "whatsapp"]
        },
        "termiiPinId": {
          "generator": "string.uuid"
        }
      },
      "relations": {
        "userId": {
          "model": "User"
        }
      }
    }
  }
}
```

**E-commerce Product Model:**

```json
{
  "models": {
    "Product": {
      "count": 100,
      "fields": {
        "name": {
          "generator": "commerce.productName"
        },
        "description": {
          "generator": "commerce.productDescription"
        },
        "price": {
          "type": "number",
          "min": 9.99,
          "max": 999.99
        },
        "inStock": {
          "type": "boolean"
        },
        "categories": {
          "type": "array",
          "values": ["electronics", "clothing", "books", "toys", "home"]
        },
        "sku": {
          "generator": "string.alphanumeric",
          "min": 8,
          "max": 8
        }
      }
    }
  }
}
```

## Programmatic API

### Basic Usage

```typescript
import { Seeder } from "dexterdb";

const seeder = new Seeder({
  dbUrl: process.env.DATABASE_URL!,
  schemaPath: "./src/models",
  configPath: "./seeder.config.json",
  verbose: true,
});

async function seedDatabase() {
  try {
    await seeder.initialize();

    await seeder.seed("User", 100);
    await seeder.seed("Post", 500);

    await seeder.seedAll();

    console.log("Seeding completed!");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await seeder.disconnect();
  }
}

seedDatabase();
```

### Advanced Usage with Options

```typescript
import { Seeder } from "dexterdb";

const seeder = new Seeder({
  dbUrl: process.env.DATABASE_URL!,
  schemaPath: "./src/models",
});

await seeder.initialize();

await seeder.seed("User", 100, {
  reset: true,
  fields: {
    email: {
      generator: "internet.email",
    },
    age: {
      type: "number",
      min: 25,
      max: 65,
    },
    isActive: {
      defaultValue: true,
    },
  },
});

await seeder.seed("Post", 500, {
  fields: {
    tags: {
      type: "array",
      values: ["tech", "business", "lifestyle"],
    },
  },
  relations: {
    authorId: {
      model: "User",
    },
  },
});

await seeder.disconnect();
```

## Mongoose-Specific Features

### 1. ObjectId References

```typescript
const PostSchema = new Schema({
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

// Seeder automatically:
// 1. Seeds User first
// 2. Fetches User _ids
// 3. Assigns random User _id to Post.authorId
```

### 2. Array Fields

```typescript
tags: [String]

ratings: [Number]

categoryIds: [{
  type: Schema.Types.ObjectId,
  ref: 'Category'
}]
```

Configuration:
```json
{
  "fields": {
    "tags": {
      "type": "array",
      "values": ["tech", "business", "lifestyle"]
    }
  },
  "relations": {
    "categoryIds": {
      "model": "Category",
      "min": 1,
      "max": 5
    }
  }
}
```

### 3. Embedded Documents

```typescript
const OrderSchema = new Schema({
  customer: {
    name: String,
    email: String,
    address: String,
  },
  items: [{
    productId: Schema.Types.ObjectId,
    quantity: Number,
    price: Number,
  }]
});
```

Configuration:
```json
{
  "fields": {
    "customer": {
      "type": "json",
      "defaultValue": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  }
}
```

### 4. Enums

```typescript
enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
}

const OrderSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PENDING,
  }
});
```

### 5. Timestamps

```typescript
const UserSchema = new Schema({
  // ... fields
}, {
  timestamps: true  // Auto-generates createdAt and updatedAt
});

// Seeder respects timestamps option
```

## Docker Setup

### Quick Start with Docker Compose

```yaml
# docker-compose.yml
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
```

Start MongoDB:
```bash
docker-compose up -d
```

Connection string:
```env
DATABASE_URL="mongodb://dexter:dexter123@localhost:27017/dexter_test?authSource=admin"
```

## Verifying Data

### Using MongoDB Compass (GUI)

1. Download: https://www.mongodb.com/products/compass
2. Connect using your connection string
3. Browse collections and documents

### Using mongosh (CLI)

```bash
mongosh "mongodb://dexter:dexter123@localhost:27017/?authSource=admin"

use dexter_test
db.users.find().pretty()
db.posts.find().pretty()
db.users.countDocuments()
db.otps.find({ channel: "sms" }).limit(5)
```

### Using Mongoose Script

```typescript
import mongoose from 'mongoose';
import User from './src/models/User';
import Post from './src/models/Post';

await mongoose.connect(process.env.DATABASE_URL!);

const userCount = await User.countDocuments();
const postCount = await Post.countDocuments();

console.log(`Users: ${userCount}, Posts: ${postCount}`);

const users = await User.find().limit(5);
const posts = await Post.find().populate('authorId').limit(5);

console.log('Sample data:', { users, posts });

await mongoose.disconnect();
```

## Project Structure

```
your-project/
├── src/
│   ├── models/              # Mongoose models
│   │   ├── User.ts
│   │   ├── Post.ts
│   │   ├── Otp.ts
│   │   └── index.ts         # Optional: re-exports
│   └── index.ts
├── seeder.config.json       # Seeder configuration
├── .env                     # Environment variables
├── package.json
├── tsconfig.json
└── docker-compose.yml       # Optional: MongoDB setup
```

## CLI Options

```bash
# Seed specific model
npx dexterdb seed --model User --count 100

# Reset before seeding
npx dexterdb seed --model User --count 50 --reset

# Use custom config
npx dexterdb seed --config ./custom-config.json

# Use custom models path
npx dexterdb seed --schema ./app/models

# Verbose output
npx dexterdb seed --model User --count 10 --verbose

# List all models
npx dexterdb list

# Help
npx dexterdb --help
npx dexterdb seed --help
```

## Testing Integration

```typescript
import { Seeder } from 'dexterdb';
import mongoose from 'mongoose';

export async function seedTestData() {
  const seeder = new Seeder({
    dbUrl: process.env.TEST_DATABASE_URL!,
    schemaPath: './src/models',
  });

  await seeder.initialize();
  
  await seeder.seed('User', 10, { reset: true });
  await seeder.seed('Post', 20, { reset: true });
  
  await seeder.disconnect();
}

beforeAll(async () => {
  await seedTestData();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
```

## Troubleshooting

### "No models found"

**Solution:**
- Ensure models use `export default mongoose.model(...)`
- Check that `schemaPath` points to correct directory
- Verify files end with `.ts` or `.js`
- Don't export from `index.ts` - let seeder load files directly

### "Cannot find module"

**Solution:**
```bash
npm run build

# Or use ts-node for development
npx ts-node cli.ts seed --model User --count 10
```

### "Reference not found"

**Solution:**
```bash
# Seed parent models first
npx dexterdb seed --model User --count 50
npx dexterdb seed --model Post --count 100

# Or let seeder determine order automatically
npx dexterdb seed
```

### "Model is not registered"

**Solution:**
Make sure models are exported correctly:
```typescript
// Correct
export default mongoose.model<IUser>('User', UserSchema);

// Wrong
const User = mongoose.model<IUser>('User', UserSchema);
// Missing export!
```

### Windows Path Issues

**Solution:**
Use `path.join` for cross-platform compatibility:
```typescript
import { join } from 'path';

const seeder = new Seeder({
  schemaPath: join(__dirname, 'src', 'models'),
});
```

## Performance Tips

1. **Use Batch Insert** - Default behavior for best performance
2. **Limit Relations** - Configure min/max for array references
3. **Use Indexes** - Add indexes to your schemas for faster queries
4. **Connection Pooling** - Mongoose handles this automatically

```typescript
// Add indexes to your schema
UserSchema.index({ email: 1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
```

## Production Considerations

### Environment Variables

```bash
# Development
DATABASE_URL="mongodb://localhost:27017/dev"

# Staging
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster-url>/staging"

# Production
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster-url>/prod"
```

### Security

- Never commit `.env` file
- Use strong passwords for MongoDB
- Enable authentication on MongoDB
- Use MongoDB Atlas for production (auto-scaling, backups)

### Data Quality

- Review generated data before production use
- Use realistic field configurations
- Test with small datasets first
- Consider data privacy regulations

## Additional Resources

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [Faker.js Guide](https://fakerjs.dev/guide/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Free cloud database
- [GitHub Repository](https://github.com/daniel-idowu-01/dexterdb)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

---

**Made with ❤️ for developers who need realistic test data fast!** 🚀