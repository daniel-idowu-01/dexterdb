import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { SeederConfig } from "../types";
import { Logger } from "../utils/logger";

export class ConfigLoader {
  static load(configPath?: string): SeederConfig {
    const defaultPath = join(process.cwd(), "seeder.config.json");
    const path = configPath || process.env.SEEDER_CONFIG_PATH || defaultPath;

    if (!existsSync(path)) {
      Logger.debug(`Config file not found at ${path}, using defaults`);
      return {};
    }

    try {
      const content = readFileSync(path, "utf-8");
      
      if (path.endsWith(".yaml") || path.endsWith(".yml")) {
        return parseYaml(content) as SeederConfig;
      } else {
        return JSON.parse(content) as SeederConfig;
      }
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

