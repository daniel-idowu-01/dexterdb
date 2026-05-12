import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { SeederConfig } from "../types";
import { Logger } from "../utils/logger";
import { resolvePathWithinRoot } from "../utils/pathSecurity";
import { sanitizeConfigInput } from "../utils/configSanitize";

export class ConfigLoader {
  static load(configPath?: string): SeederConfig {
    const defaultPath = join(process.cwd(), "seeder.config.json");
    const rawPath = configPath || process.env.SEEDER_CONFIG_PATH || defaultPath;

    let path: string;
    try {
      path = resolvePathWithinRoot(rawPath);
    } catch {
      Logger.warning(`Rejected unsafe config path: ${rawPath}`);
      return {};
    }

    if (!existsSync(path)) {
      Logger.debug(`Config file not found at ${path}, using defaults`);
      return {};
    }

    try {
      const content = readFileSync(path, "utf-8");

      if (path.endsWith(".yaml") || path.endsWith(".yml")) {
        const parsed = parseYaml(content, {
          merge: false,
          maxAliasCount: 50,
          version: "1.2",
        });
        return sanitizeConfigInput(parsed) as SeederConfig;
      }

      const parsed = JSON.parse(content) as SeederConfig;
      return sanitizeConfigInput(parsed);
    } catch (error) {
      Logger.warning(`Failed to load config from ${path}: ${error}`);
      return {};
    }
  }

  
  static mergeWithDefaults(userConfig: SeederConfig): SeederConfig {
    return {
      global: {
        reset: false,
        incremental: false,
        randomize: false,
        ...userConfig.global,
      },
      models: {
        ...userConfig.models,
      },
    };
  }

  static getModelConfig(config: SeederConfig, modelName: string) {
    return config.models?.[modelName] || {};
  }
}

