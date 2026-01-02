# Overview

This MCP server targets the JSON formats used by WebMiliastra Nodes Editor.
It exposes tools for GraphDocument files (single graphs) and project folders
(manifest.json + multiple graphs).

Key concepts:

- GraphDocument: a single graph with nodes, edges, and optional comments.
- Node definition: metadata for node ids and ports (used to wire edges).
- Project: a manifest.json file that lists graphs and their on-disk paths.

The server does not generate graph logic by itself; the AI agent should
produce valid GraphDocument payloads and use the tools to write them.
