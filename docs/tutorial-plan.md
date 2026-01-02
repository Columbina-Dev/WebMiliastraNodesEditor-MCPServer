# Tutorial import plan

The official editor tutorial is currently stored as HTML under:

- `web/public/tutorial/`
- `web/dist/tutorial/` (built assets, including textmap JSON)

Planned conversion steps:

1. Extract text content from HTML pages into Markdown files.
2. Reference images by filename and summarize their meaning in text.
3. Link each tutorial page to relevant node or graph concepts.
4. Expose the converted docs via MCP resources.

This repo intentionally leaves the conversion for a later pass.
