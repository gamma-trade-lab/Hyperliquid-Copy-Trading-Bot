import * as path from "path";
import * as fs from "fs";
import { createRequire } from "module";
import {
  AgentRuntime,
  elizaLogger,
  type Character,
  validateCharacterConfig,
  stringToUuid,
  type IDatabaseAdapter,
} from "@ai16z/eliza";

import { loadCharacters } from "./loader.ts";
import { DirectClient } from "@ai16z/client-direct";
import { pathToFileURL, fileURLToPath } from "url";

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Plugin {
  name: string;
  description: string;
  actions?: any[];
  providers?: any[];
  evaluators?: any[];
  services?: any[];
  clients?: any[];
}

// Minimal DatabaseAdapter Mock
const minimalDatabaseAdapter: IDatabaseAdapter = {
  db: null,
  init: async () => {},
  close: async () => {},
  getAccountById: async () => null,
  createAccount: async () => true,
  getMemories: async () => [],
  getMemoryById: async () => null,
  getMemoriesByRoomIds: async () => [],
  getCachedEmbeddings: async () => [],
  searchMemories: async () => [],
  searchMemoriesByEmbedding: async () => [],
  createMemory: async () => {},
  removeMemory: async () => {},
  removeAllMemories: async () => {},
  countMemories: async () => 0,
  log: async () => {},
  getActorDetails: async () => [],
  updateGoalStatus: async () => {},
  getGoals: async () => [],
  updateGoal: async () => {},
  createGoal: async () => {},
  removeGoal: async () => {},
  removeAllGoals: async () => {},

  getRoom: async () =>
    stringToUuid(
      "mock-room-id",
    ) as `${string}-${string}-${string}-${string}-${string}`,
  createRoom: async () =>
    stringToUuid(
      "mock-room-id",
    ) as `${string}-${string}-${string}-${string}-${string}`,
  removeRoom: async () => {},
  getRoomsForParticipant: async () => [],
  getRoomsForParticipants: async () => [],
  addParticipant: async () => true,
  removeParticipant: async () => true,
  getParticipantsForAccount: async () => [],
  getParticipantsForRoom: async () => [],
  getParticipantUserState: async () => "FOLLOWED",
  setParticipantUserState: async () => {},
  createRelationship: async () => true,
  getRelationship: async () => null,
  getRelationships: async () => [],
};

// Cache Adapter Implementation
class CompatibleCacheAdapter {
  private data = new Map<string, string>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = this.data.get(key);
    return (value ? JSON.parse(value) : undefined) as T;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

// Function to dynamically load plugins from ./src/plugins

async function loadLocalPlugins(): Promise<Plugin[]> {
  const pluginsDir = path.resolve(__dirname, "../plugins");
  const plugins: Plugin[] = [];

  elizaLogger.info(`Starting plugin loading process.`); // Ensure logger works
  console.log(`DEBUG: Checking plugins directory: ${pluginsDir}`); // Fallback log

  if (fs.existsSync(pluginsDir)) {
    const entries = fs.readdirSync(pluginsDir);
    elizaLogger.info(`Found entries in ${pluginsDir}: ${entries.join(", ")}`);
    console.log(`DEBUG: Entries in ${pluginsDir}: ${entries.join(", ")}`); // Fallback log

    for (const entry of entries) {
      const pluginPath = path.join(pluginsDir, entry);
      let importedPlugin: any;

      try {
        if (fs.statSync(pluginPath).isDirectory()) {
          elizaLogger.info(`Checking plugin directory: ${pluginPath}`);
          console.log(`DEBUG: Directory detected: ${pluginPath}`); // Fallback log

          const indexFilePath = fs.existsSync(path.join(pluginPath, "index.js"))
            ? path.join(pluginPath, "index.js")
            : path.join(pluginPath, "index.ts");

          if (fs.existsSync(indexFilePath)) {
            importedPlugin = await import(indexFilePath);
            elizaLogger.info(`Loaded plugin from index file: ${indexFilePath}`);
            console.log(`DEBUG: Loaded plugin file: ${indexFilePath}`); // Fallback log
          } else {
            elizaLogger.warn(
              `No index file found in plugin directory: ${pluginPath}`,
            );
            console.log(`DEBUG: Missing index file in ${pluginPath}`); // Fallback log
            continue;
          }
        } else if (pluginPath.endsWith(".js") || pluginPath.endsWith(".ts")) {
          elizaLogger.info(`Loading plugin file: ${pluginPath}`);
          console.log(`DEBUG: Loading file: ${pluginPath}`); // Fallback log
          importedPlugin = await import(pluginPath);
        } else {
          elizaLogger.warn(`Skipping unsupported plugin entry: ${pluginPath}`);
          console.log(`DEBUG: Skipping unsupported file: ${pluginPath}`); // Fallback log
          continue;
        }

        const plugin = importedPlugin.default || importedPlugin;
        if (plugin && plugin.name && plugin.description) {
          plugins.push(plugin as Plugin);
          elizaLogger.info(`Successfully loaded plugin: ${plugin.name}`);
          console.log(`DEBUG: Successfully loaded: ${plugin.name}`); // Fallback log
        } else {
          elizaLogger.warn(`Invalid plugin structure in: ${entry}`);
          console.log(`DEBUG: Invalid plugin structure: ${entry}`); // Fallback log
        }
      } catch (error) {
        elizaLogger.error(`Failed to load plugin from: ${entry}`, error);
        console.error(`DEBUG: Error loading plugin from: ${entry}`, error); // Fallback log
      }
    }

    return plugins;
  } else {
    elizaLogger.warn(`Plugins directory not found: ${pluginsDir}`);
    console.log(`DEBUG: Directory not found: ${pluginsDir}`); // Fallback log
  }

  elizaLogger.info(
    `Finished plugin loading process. Loaded plugins: ${plugins.length}`,
  );
  console.log(
    `DEBUG: Final loaded plugins: ${plugins.map((p) => p.name).join(", ")}`,
  ); // Fallback log

  return plugins;
}

// Function to resolve plugins from their string names

async function resolvePlugins(pluginNames: string[]): Promise<Plugin[]> {
  const localPlugins = await loadLocalPlugins();

  elizaLogger.info(
    `Local plugins available: ${localPlugins.map((p) => p.name).join(", ")}`,
  );

  return Promise.all(
    pluginNames.map(async (pluginName) => {
      // Check if the plugin is local
      const localPlugin = localPlugins.find(
        (plugin) => plugin.name === pluginName,
      );

      if (localPlugin) {
        elizaLogger.info(`Resolved local plugin: ${pluginName}`);
        return localPlugin;
      }

      // Attempt to resolve from node_modules
      try {
        const resolvedPath = createRequire(import.meta.url).resolve(
          pluginName,
          {
            paths: [process.cwd()],
          },
        );
        elizaLogger.info(`Resolved node_modules plugin: ${pluginName}`);
        const importedPlugin = await import(resolvedPath);
        return importedPlugin.default || importedPlugin;
      } catch (error) {
        elizaLogger.error(`Failed to resolve plugin: ${pluginName}`, error);
        throw error;
      }
    }),
  );
}

// Type Guard to check if plugins are strings
function isStringArray(plugins: unknown): plugins is string[] {
  return Array.isArray(plugins) && plugins.every((p) => typeof p === "string");
}

async function main() {
  elizaLogger.info("Starting Eliza Agent...");

  const characters: Character[] = await loadCharacters("characters.json");
  const localPlugins = await loadLocalPlugins();
  console.log(
    `DEBUG: Local plugins loaded: ${localPlugins.map((p) => p.name).join(", ")}`,
  );

  for (const character of characters) {
    const resolvedPlugins = isStringArray(character.plugins)
      ? await resolvePlugins(character.plugins)
      : (character.plugins as Plugin[]);

    const combinedPlugins = [...resolvedPlugins, ...localPlugins];

    elizaLogger.info(
      `Character "${character.name}" loaded with plugins: ${combinedPlugins.map(
        (p) => p.name,
      )}`,
    );

    const runtime = new AgentRuntime({
      character,
      plugins: combinedPlugins,
      token: "dummy-token",
      agentId: stringToUuid(
        character.name,
      ) as `${string}-${string}-${string}-${string}-${string}`,
      modelProvider: character.modelProvider,
      databaseAdapter: minimalDatabaseAdapter,
      cacheManager: new CompatibleCacheAdapter(),
      logging: true,
    });

    elizaLogger.success(`Agent "${character.name}" initialized successfully!`);

    const directClient = new DirectClient();
    directClient.registerAgent(runtime);
    directClient.start(3000);
  }

  elizaLogger.success("Eliza agents started successfully!");
}

// Run the main function
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
