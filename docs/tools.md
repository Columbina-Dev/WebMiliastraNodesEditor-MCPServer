# MCP tools

Graph tools:

- `list_graphs`: list graph files in the graphs directory.
- `read_graph`: read a graph JSON by path.
- `write_graph`: write a graph JSON by path (validates schema).
- `validate_graph`: validate a graph file or inline payload.

Node tools:

- `list_nodes`: search node definitions by id/name/kind/category.

Project tools:

- `read_project`: read a project folder (manifest.json + graph files).
- `write_project`: write a project document to a folder.
- `validate_project`: validate a project file or inline payload.

Resource URIs:

- `nodegraph://docs/...` returns docs in `docs/`.
- `nodegraph://data/node-definitions` returns the current node list.
