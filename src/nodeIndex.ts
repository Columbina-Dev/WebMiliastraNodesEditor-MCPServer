import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_NODE_DEFS_PATH = path.join(__dirname, "..", "data", "nodeDefinitions.sample.json");

let cachedPath: string | null = null;
let cachedNodes: unknown[] | null = null;

const resolveNodeDefinitionsPath = () =>
  process.env.NODEGRAPH_NODE_DEFS_PATH
    ? path.resolve(process.env.NODEGRAPH_NODE_DEFS_PATH)
    : DEFAULT_NODE_DEFS_PATH;

export const loadNodeDefinitions = async () => {
  const nodeDefsPath = resolveNodeDefinitionsPath();
  if (cachedNodes && cachedPath === nodeDefsPath) {
    return cachedNodes;
  }

  const raw = await fs.readFile(nodeDefsPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Node definitions file must contain a JSON array: ${nodeDefsPath}`);
  }
  cachedPath = nodeDefsPath;
  cachedNodes = parsed;
  return parsed;
};
