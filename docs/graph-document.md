# GraphDocument format

GraphDocument is the core JSON format for a single node graph.

Required fields:

- `schemaVersion`: 1 or 2 (current editor uses 2).
- `name`: graph name.
- `nodes`: list of nodes.
- `edges`: list of edges.

Common optional fields:

- `comments`: note annotations (either node-bound or positioned).
- `environment`: `server` or `client:*` (client graph types).
- `executionIntervalSeconds`: optional tick interval for some graphs.

Node shape:

```json
{
  "id": "node-id",
  "type": "action.printString",
  "position": { "x": 120, "y": 80 },
  "label": "Optional label",
  "data": {
    "overrides": { "text": "hello" },
    "controls": {},
    "sequenceFlowOutCount": 0,
    "branchFlowOutLabels": []
  }
}
```

Edge shape:

```json
{
  "id": "edge-id",
  "source": { "nodeId": "node-id-a", "portId": "flowOut" },
  "target": { "nodeId": "node-id-b", "portId": "flowIn" }
}
```

Port ids are defined by the node definition list. Use `list_nodes` to
discover valid ports for a node id.
