import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { graphDocumentSchema, projectDocumentSchema } from "./schemas.js";
import { loadNodeDefinitions } from "./nodeIndex.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = process.env.NODEGRAPH_WORKSPACE
  ? path.resolve(process.env.NODEGRAPH_WORKSPACE)
  : process.cwd();
const GRAPHS_DIR = process.env.NODEGRAPH_GRAPHS_DIR
  ? path.resolve(process.env.NODEGRAPH_GRAPHS_DIR)
  : path.join(WORKSPACE_ROOT, "graphs");
const PROJECTS_DIR = process.env.NODEGRAPH_PROJECTS_DIR
  ? path.resolve(process.env.NODEGRAPH_PROJECTS_DIR)
  : path.join(WORKSPACE_ROOT, "projects");
const DOCS_DIR = path.join(WORKSPACE_ROOT, "docs");
const DATA_DIR = path.join(WORKSPACE_ROOT, "data");

const normalizeForCompare = (value: string) =>
  process.platform === "win32" ? value.toLowerCase() : value;

const isPathInside = (baseDir: string, targetPath: string) => {
  const baseResolved = normalizeForCompare(path.resolve(baseDir));
  const targetResolved = normalizeForCompare(path.resolve(targetPath));
  if (baseResolved === targetResolved) return true;
  return targetResolved.startsWith(`${baseResolved}${path.sep}`);
};

const resolveInside = (baseDir: string, inputPath: string) => {
  const resolved = path.resolve(baseDir, inputPath);
  if (!isPathInside(baseDir, resolved)) {
    throw new Error(`Path escapes base directory: ${inputPath}`);
  }
  return resolved;
};

const readJson = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const writeJson = async (filePath: string, data: unknown, pretty = true) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = JSON.stringify(data, null, pretty ? 2 : 0);
  await fs.writeFile(filePath, text, "utf8");
};

const formatZodIssues = (issues: { path: (string | number)[]; message: string }[]) =>
  issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

const toolResponse = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
});

const collectFiles = async (
  dirPath: string,
  recursive: boolean,
  filter?: (entryName: string) => boolean,
) => {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          const nested = await collectFiles(entryPath, recursive, filter);
          results.push(...nested);
        }
        continue;
      }
      if (entry.isFile() && (!filter || filter(entry.name))) {
        results.push(entryPath);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return results;
};

const listGraphs = async (input: {
  dir?: string;
  recursive?: boolean;
  includeDetails?: boolean;
  environment?: string;
}) => {
  const baseDir = input.dir ? resolveInside(GRAPHS_DIR, input.dir) : GRAPHS_DIR;
  const recursive = input.recursive !== false;
  const includeDetails = input.includeDetails !== false || Boolean(input.environment);
  const files = await collectFiles(baseDir, recursive, (name) => name.toLowerCase().endsWith(".json"));
  const results: Array<Record<string, unknown>> = [];

  for (const filePath of files) {
    const relativePath = path.relative(GRAPHS_DIR, filePath).split(path.sep).join("/");
    if (!includeDetails) {
      results.push({ path: relativePath });
      continue;
    }
    try {
      const parsed = graphDocumentSchema.safeParse(await readJson(filePath));
      if (!parsed.success) {
        results.push({ path: relativePath, error: formatZodIssues(parsed.error.issues) });
        continue;
      }
      if (input.environment && parsed.data.environment !== input.environment) {
        continue;
      }
      results.push({
        path: relativePath,
        name: parsed.data.name,
        environment: parsed.data.environment ?? null,
        schemaVersion: parsed.data.schemaVersion,
        nodeCount: parsed.data.nodes.length,
        edgeCount: parsed.data.edges.length,
      });
    } catch (error) {
      results.push({ path: relativePath, error: String(error) });
    }
  }

  return {
    baseDir: GRAPHS_DIR,
    count: results.length,
    graphs: results,
  };
};

const readGraph = async (input: { path: string }) => {
  const graphPath = resolveInside(GRAPHS_DIR, input.path);
  const graph = await readJson(graphPath);
  return {
    path: path.relative(GRAPHS_DIR, graphPath).split(path.sep).join("/"),
    graph,
  };
};

const writeGraph = async (input: {
  path: string;
  graph: unknown;
  pretty?: boolean;
  overwrite?: boolean;
}) => {
  const graphPath = resolveInside(GRAPHS_DIR, input.path);
  if (!input.overwrite) {
    try {
      await fs.access(graphPath);
      throw new Error(`Graph already exists: ${input.path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  const parsed = graphDocumentSchema.safeParse(input.graph);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatZodIssues(parsed.error.issues),
    };
  }
  await writeJson(graphPath, parsed.data, input.pretty !== false);
  return {
    ok: true,
    path: path.relative(GRAPHS_DIR, graphPath).split(path.sep).join("/"),
  };
};

const validateGraph = async (input: { path?: string; graph?: unknown }) => {
  const graph = input.path
    ? await readJson(resolveInside(GRAPHS_DIR, input.path))
    : input.graph;
  if (!graph) {
    throw new Error("validate_graph requires either path or graph.");
  }
  const parsed = graphDocumentSchema.safeParse(graph);
  return parsed.success
    ? { valid: true }
    : { valid: false, errors: formatZodIssues(parsed.error.issues) };
};

const listNodes = async (input: {
  query?: string;
  kind?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) => {
  const rawNodes = await loadNodeDefinitions();
  const query = input.query?.toLowerCase().trim();
  const kind = input.kind?.toLowerCase().trim();
  const category = input.category?.toLowerCase().trim();

  const filtered = (rawNodes as Record<string, unknown>[]).filter((node) => {
    const nodeId = typeof node.id === "string" ? node.id : "";
    const displayName = typeof node.displayName === "string" ? node.displayName : "";
    const displayNameEN = typeof node.displayNameEN === "string" ? node.displayNameEN : "";
    const nodeKind = typeof node.kind === "string" ? node.kind : "";
    const nodeCategory = typeof node.category === "string" ? node.category : "";

    if (kind && nodeKind.toLowerCase() !== kind) return false;
    if (category && !nodeCategory.toLowerCase().includes(category)) return false;
    if (!query) return true;

    const haystack = `${nodeId} ${displayNameEN} ${displayName}`.toLowerCase();
    return haystack.includes(query);
  });

  const offset = Math.max(0, input.offset ?? 0);
  const limit = Math.max(1, input.limit ?? filtered.length);
  const sliced = filtered.slice(offset, offset + limit);
  const normalized = sliced.map((node) => ({
    id: node.id,
    displayName: node.displayName,
    displayNameEN: node.displayNameEN,
    officialID: node.officialID,
    category: node.category,
    kind: node.kind,
    ports: node.ports,
  }));

  return {
    total: filtered.length,
    count: normalized.length,
    nodes: normalized,
  };
};

const readProject = async (input: { path: string }) => {
  const projectRoot = resolveInside(PROJECTS_DIR, input.path);
  const manifestPath = resolveInside(projectRoot, "manifest.json");
  const manifest = await readJson(manifestPath);

  const graphs: Record<string, unknown> = {};
  if (Array.isArray(manifest.graphs)) {
    for (const entry of manifest.graphs) {
      if (!entry?.graphId || !entry?.path) continue;
      const graphPath = resolveInside(projectRoot, entry.path);
      graphs[entry.graphId] = await readJson(graphPath);
    }
  }

  const structs: Record<string, unknown> = {};
  if (Array.isArray(manifest.structures)) {
    for (const entry of manifest.structures) {
      if (!entry?.structId || !entry?.path) continue;
      const structPath = resolveInside(projectRoot, entry.path);
      structs[entry.structId] = await readJson(structPath);
    }
  }

  return {
    path: path.relative(PROJECTS_DIR, projectRoot).split(path.sep).join("/"),
    document: {
      manifest,
      graphs,
      structs: Object.keys(structs).length > 0 ? structs : undefined,
    },
  };
};

const writeProject = async (input: {
  path: string;
  document: unknown;
  pretty?: boolean;
  overwrite?: boolean;
}) => {
  const projectRoot = resolveInside(PROJECTS_DIR, input.path);
  if (!input.overwrite) {
    try {
      await fs.access(projectRoot);
      const existingManifest = path.join(projectRoot, "manifest.json");
      await fs.access(existingManifest);
      throw new Error(`Project already exists: ${input.path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  const parsed = projectDocumentSchema.safeParse(input.document);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatZodIssues(parsed.error.issues),
    };
  }

  await fs.mkdir(projectRoot, { recursive: true });
  await writeJson(path.join(projectRoot, "manifest.json"), parsed.data.manifest, input.pretty !== false);

  const warnings: string[] = [];
  for (const entry of parsed.data.manifest.graphs ?? []) {
    const graph = parsed.data.graphs[entry.graphId];
    if (!graph) {
      warnings.push(`Missing graph data for graphId: ${entry.graphId}`);
      continue;
    }
    const graphPath = resolveInside(projectRoot, entry.path);
    await writeJson(graphPath, graph, input.pretty !== false);
  }

  if (Array.isArray(parsed.data.manifest.structures) && parsed.data.structs) {
    for (const entry of parsed.data.manifest.structures) {
      if (!entry?.structId || !entry?.path) continue;
      const structDoc = parsed.data.structs[entry.structId];
      if (!structDoc) {
        warnings.push(`Missing struct data for structId: ${entry.structId}`);
        continue;
      }
      const structPath = resolveInside(projectRoot, entry.path);
      await writeJson(structPath, structDoc, input.pretty !== false);
    }
  }

  return {
    ok: true,
    path: path.relative(PROJECTS_DIR, projectRoot).split(path.sep).join("/"),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

const validateProject = async (input: { path?: string; document?: unknown }) => {
  const document = input.path
    ? (await readProject({ path: input.path })).document
    : input.document;
  if (!document) {
    throw new Error("validate_project requires either path or document.");
  }
  const parsed = projectDocumentSchema.safeParse(document);
  return parsed.success
    ? { valid: true }
    : { valid: false, errors: formatZodIssues(parsed.error.issues) };
};

const listDocResources = async () => {
  const docFiles = await collectFiles(DOCS_DIR, true, (name) => name.toLowerCase().endsWith(".md"));
  const docResources = docFiles.map((filePath) => {
      const relative = path.relative(DOCS_DIR, filePath).split(path.sep).join("/");
      return {
        uri: `nodegraph://docs/${relative}`,
        name: `docs/${relative}`,
        description: `Documentation: ${relative}`,
        mimeType: "text/markdown",
      };
    });

  return docResources;
};

const readResource = async (uri: string) => {
  const parsed = new URL(uri);
  if (parsed.protocol !== "nodegraph:") {
    throw new Error(`Unsupported resource URI: ${uri}`);
  }
  const hostCategory = parsed.hostname;
  const resourcePath = parsed.pathname.replace(/^\/+/, "");
  const pathParts = resourcePath ? resourcePath.split("/") : [];
  const category = hostCategory || pathParts[0];
  const rest = hostCategory ? pathParts : pathParts.slice(1);
  if (category === "docs") {
    const relativePath = rest.join("/");
    const filePath = resolveInside(DOCS_DIR, relativePath);
    const text = await fs.readFile(filePath, "utf8");
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text,
        },
      ],
    };
  }
  if (category === "data" && rest[0] === "node-definitions") {
    const nodes = await loadNodeDefinitions();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(nodes, null, 2),
        },
      ],
    };
  }
  if (category === "data" && rest[0] === "node-definitions-sample") {
    const filePath = resolveInside(DATA_DIR, "nodeDefinitions.sample.json");
    const text = await fs.readFile(filePath, "utf8");
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text,
        },
      ],
    };
  }
  throw new Error(`Unknown resource URI: ${uri}`);
};

const server = new Server(
  {
    name: "webmiliastra-nodegraph",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_graphs",
      description: "List graph JSON files under the graphs directory.",
      inputSchema: {
        type: "object",
        properties: {
          dir: {
            type: "string",
            description: "Optional subdirectory under NODEGRAPH_GRAPHS_DIR.",
          },
          recursive: {
            type: "boolean",
            description: "Recurse into subdirectories (default true).",
          },
          includeDetails: {
            type: "boolean",
            description: "Parse graphs and include metadata (default true).",
          },
          environment: {
            type: "string",
            description: "Filter by graph environment.",
            enum: [
              "server",
              "client",
              "client:role-skill",
              "client:creation-skill",
              "client:creation-state",
              "client:creation-state-decision",
              "client:boolean",
              "client:integer",
            ],
          },
        },
      },
    },
    {
      name: "read_graph",
      description: "Read a graph JSON file relative to NODEGRAPH_GRAPHS_DIR.",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", description: "Graph file path." },
        },
      },
    },
    {
      name: "write_graph",
      description: "Write a graph JSON file under NODEGRAPH_GRAPHS_DIR.",
      inputSchema: {
        type: "object",
        required: ["path", "graph"],
        properties: {
          path: { type: "string", description: "Graph file path." },
          graph: { type: "object", description: "GraphDocument payload." },
          pretty: { type: "boolean", description: "Pretty-print JSON (default true)." },
          overwrite: { type: "boolean", description: "Allow overwriting existing file." },
        },
      },
    },
    {
      name: "validate_graph",
      description: "Validate a GraphDocument from a file path or inline payload.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Graph file path." },
          graph: { type: "object", description: "GraphDocument payload." },
        },
      },
    },
    {
      name: "list_nodes",
      description: "List node definitions for building graphs.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search by id or name." },
          kind: { type: "string", description: "Filter by node kind." },
          category: { type: "string", description: "Filter by category substring." },
          limit: { type: "number", description: "Max results (default all)." },
          offset: { type: "number", description: "Skip results (default 0)." },
        },
      },
    },
    {
      name: "read_project",
      description: "Read a project folder containing manifest.json and graph files.",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: {
          path: { type: "string", description: "Project folder path." },
        },
      },
    },
    {
      name: "write_project",
      description: "Write a project document to a folder with manifest.json and graphs.",
      inputSchema: {
        type: "object",
        required: ["path", "document"],
        properties: {
          path: { type: "string", description: "Project folder path." },
          document: { type: "object", description: "ProjectDocument payload." },
          pretty: { type: "boolean", description: "Pretty-print JSON (default true)." },
          overwrite: { type: "boolean", description: "Allow overwriting existing project." },
        },
      },
    },
    {
      name: "validate_project",
      description: "Validate a ProjectDocument from a folder or inline payload.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Project folder path." },
          document: { type: "object", description: "ProjectDocument payload." },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "list_graphs":
      return toolResponse(await listGraphs(args ?? {}));
    case "read_graph":
      return toolResponse(await readGraph(args as { path: string }));
    case "write_graph":
      return toolResponse(await writeGraph(args as { path: string; graph: unknown }));
    case "validate_graph":
      return toolResponse(await validateGraph(args ?? {}));
    case "list_nodes":
      return toolResponse(await listNodes(args ?? {}));
    case "read_project":
      return toolResponse(await readProject(args as { path: string }));
    case "write_project":
      return toolResponse(await writeProject(args as { path: string; document: unknown }));
    case "validate_project":
      return toolResponse(await validateProject(args ?? {}));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const docs = await listDocResources();
  const resources = [
    ...docs,
    {
      uri: "nodegraph://data/node-definitions",
      name: "data/node-definitions",
      description: "Node definitions loaded from NODEGRAPH_NODE_DEFS_PATH.",
      mimeType: "application/json",
    },
    {
      uri: "nodegraph://data/node-definitions-sample",
      name: "data/node-definitions-sample",
      description: "Bundled sample node definitions.",
      mimeType: "application/json",
    },
  ];
  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => readResource(request.params.uri));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`NodeGraph MCP server running from ${__dirname}`);
