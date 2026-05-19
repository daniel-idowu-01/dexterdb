import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { PrismaParser } from "../src/schema-parser/prismaParser";

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock(
  "@prisma/client",
  () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: mockConnect,
      $disconnect: mockDisconnect,
    })),
  }),
  { virtual: true }
);

describe("PrismaParser", () => {
  const schemaPath = join(__dirname, "temp-schema.prisma");

  afterEach(() => {
    if (existsSync(schemaPath)) {
      unlinkSync(schemaPath);
    }
    jest.clearAllMocks();
  });

  it("parses models and enum values from Prisma schema", async () => {
    const schema = `
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  posts     Post[]
}

model Post {
  id        Int         @id @default(autoincrement())
  title     String
  authorId  Int
  author    User        @relation(fields: [authorId], references: [id])
  status    PostStatus  @default(DRAFT)
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");

    const models = await parser.parseSchema();

    expect(models).toHaveLength(2);
    const userModel = models.find((m) => m.name === "User");
    const postModel = models.find((m) => m.name === "Post");

    expect(userModel).toBeDefined();
    expect(postModel).toBeDefined();
    expect(userModel?.fields.map((f) => f.name)).toEqual(["id", "email", "name"]);
    expect(postModel?.fields.map((f) => f.name)).toEqual(["id", "title", "authorId", "status"]);
    expect(postModel?.fields.find((f) => f.name === "status")?.enumValues).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
  });

  it("skips optional Prisma relation fields without explicit @relation", async () => {
    const schema = `
model User {
  id      Int      @id @default(autoincrement())
  email   String   @unique
  profile Profile?
}

model Profile {
  id     Int   @id @default(autoincrement())
  userId Int   @unique
  user   User  @relation(fields: [userId], references: [id])
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const userModel = models.find((m) => m.name === "User");

    expect(userModel).toBeDefined();
    expect(userModel?.fields.map((f) => f.name)).toEqual(["id", "email"]);
  });

  it("extracts foreign key relationModel and relationField for scalar FK fields", async () => {
    const schema = `
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
}
`;

    writeFileSync(schemaPath, schema);
    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    const models = await parser.parseSchema();
    const postModel = models.find((m) => m.name === "Post");
    const authorIdField = postModel?.fields.find((f) => f.name === "authorId");

    expect(authorIdField).toBeDefined();
    expect(authorIdField?.isForeignKey).toBe(true);
    expect(authorIdField?.relationModel).toBe("User");
    expect(authorIdField?.relationField).toBe("id");
  });

  it("connects and disconnects with Prisma client", async () => {
    const schema = `model Test { id Int @id @default(autoincrement()) }`;
    writeFileSync(schemaPath, schema);

    const parser = new PrismaParser(schemaPath, "postgresql://user:pass@localhost:5432/test");
    await parser.connect();
    expect(mockConnect).toHaveBeenCalled();

    await parser.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
