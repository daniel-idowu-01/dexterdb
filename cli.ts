#!/usr/bin/env node

import { Command } from "commander";
import { config } from "dotenv";
import ora from "ora";
import { Seeder } from "./src/seeder";
import { Logger } from "./src/utils/logger";
import { readFileSync } from "fs";
import { join } from "path";

config();

const program = new Command();

let version = "1.0.0";
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8")
  );
  version = packageJson.version;
} catch {
}

program
  .name("dexter")
  .description("Dexter DB - Generate realistic test data for databases")
  .version(version);

program
  .command("seed")
  .description("Seed a specific model with test data")
  .option("-m, --model <model>", "Model name to seed", "")
  .option("-c, --count <count>", "Number of records to generate", "10")
  .option("--config <path>", "Path to seeder config file")
  .option("--schema <path>", "Path to Prisma schema file")
  .option("--reset", "Reset table before seeding", false)
  .option("--incremental", "Add to existing data", false)
  .option("--randomize", "Randomize insertion order", false)
  .action(async (options) => {
    const spinner = ora("Initializing seeder...").start();

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        spinner.fail("DATABASE_URL not found in environment variables");
        Logger.error("Please set DATABASE_URL in your .env file");
        process.exit(1);
      }

      const seeder = new Seeder({
        dbUrl,
        schemaPath: options.schema,
        configPath: options.config,
        verbose: true,
      });

      spinner.text = "Parsing schema...";
      await seeder.initialize();

      if (options.model) {
        spinner.text = `Seeding ${options.model}...`;
        const count = parseInt(options.count, 10) || 10;

        const result = await seeder.seed(options.model, count, {
          ...(options.reset && { reset: true }),
          ...(options.incremental && { incremental: true }),
          ...(options.randomize && { randomize: true }),
        });

        if (result.success) {
          spinner.succeed(`Successfully seeded ${result.count} ${options.model} records`);
        } else {
          spinner.fail(`Failed to seed ${options.model}: ${result.error}`);
          process.exit(1);
        }
      } else {
        spinner.text = "Seeding all models...";
        const results = await seeder.seedAll();

        const successCount = results.filter((r) => r.success).length;
        const totalCount = results.reduce((sum, r) => sum + r.count, 0);

        if (successCount === results.length) {
          spinner.succeed(
            `Successfully seeded ${totalCount} records across ${results.length} models`
          );
        } else {
          spinner.warn(
            `Seeded ${successCount}/${results.length} models successfully (${totalCount} total records)`
          );
          results.forEach((result) => {
            if (result.success) {
              Logger.success(`${result.model}: ${result.count} records`);
            } else {
              Logger.error(`${result.model}: ${result.error}`);
            }
          });
        }
      }

      await seeder.disconnect();
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
      Logger.error(error.stack);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all available models in the schema")
  .option("--schema <path>", "Path to Prisma schema file")
  .action(async (options) => {
    const spinner = ora("Loading schema...").start();

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        spinner.fail("DATABASE_URL not found");
        process.exit(1);
      }

      const seeder = new Seeder({
        dbUrl,
        schemaPath: options.schema,
      });

      await seeder.initialize();

      const models = seeder.getModels();

      spinner.succeed(`Found ${models.length} models`);

      console.log("\nAvailable models:");
      models.forEach((model) => {
        console.log(`  - ${model.name} (${model.fields.length} fields)`);
      });

      await seeder.disconnect();
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();

