# Project format

A project folder contains `manifest.json` plus graph files referenced by the
manifest entries. The MCP server reads and writes this folder structure.

Example layout:

```
project/
  manifest.json
  server/entity/default/my-graph.json
  client/boolean-filter/default/check-flag.json
```

Manifest essentials:

- `manifest.project.id` and `manifest.project.name` identify the project.
- `manifest.graphs[]` contains entries with `graphId`, `name`, and `path`.
- `path` is relative to the project root and should end with `.json`.

The server only enforces basic validation. The editor may expect more
metadata (groups, appVersion, etc.) depending on your workflow.
