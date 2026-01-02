import { z } from "zod";

const graphEnvironmentSchema = z.enum([
  "server",
  "client",
  "client:role-skill",
  "client:creation-skill",
  "client:creation-state",
  "client:creation-state-decision",
  "client:boolean",
  "client:integer",
]);

const graphCommentSchema = z
  .object({
    id: z.string().optional(),
    nodeId: z.string().min(1).optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
      })
      .optional(),
    text: z.string().optional(),
    pinned: z.boolean().optional(),
    collapsed: z.boolean().optional(),
  })
  .refine((value) => Boolean((value.nodeId && value.nodeId.trim().length) || value.position), {
    message: "Comment requires nodeId or position.",
  });

export const graphDocumentSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    name: z.string(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    nodes: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          position: z.object({ x: z.number(), y: z.number() }),
          label: z.string().optional(),
          data: z
            .object({
              overrides: z.record(z.string(), z.unknown()).optional(),
              controls: z.record(z.string(), z.unknown()).optional(),
              sequenceFlowOutCount: z.number().optional(),
              branchFlowOutLabels: z.array(z.string()).optional(),
            })
            .optional(),
        }),
      )
      .default([]),
    edges: z
      .array(
        z.object({
          id: z.string(),
          source: z.object({ nodeId: z.string(), portId: z.string().min(1) }),
          target: z.object({ nodeId: z.string(), portId: z.string().min(1) }),
        }),
      )
      .default([]),
    comments: z.array(graphCommentSchema).optional().default([]),
    environment: graphEnvironmentSchema.optional(),
    executionIntervalSeconds: z.number().optional(),
  })
  .passthrough();

export const projectManifestSchema = z
  .object({
    manifestVersion: z.number().optional(),
    appVersion: z.string().optional(),
    project: z.object({
      id: z.string(),
      name: z.string(),
    }),
    graphs: z
      .array(
        z.object({
          graphId: z.string(),
          name: z.string(),
          path: z.string(),
          groupName: z.string().optional(),
          createdAt: z.string().optional(),
          updatedAt: z.string().optional(),
        }),
      )
      .default([]),
    groups: z
      .array(
        z.object({
          topFolder: z.enum(["server", "client"]).optional(),
          categoryKey: z.string().optional(),
          groupSlug: z.string().optional(),
          groupName: z.string().optional(),
        }),
      )
      .default([]),
    structGroups: z.array(z.unknown()).optional(),
    structures: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const projectDocumentSchema = z
  .object({
    manifest: projectManifestSchema,
    graphs: z.record(graphDocumentSchema).default({}),
    structs: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type GraphDocument = z.infer<typeof graphDocumentSchema>;
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
