# [简体中文](README.md) | [English](README_EN.md)

# 《原神·千星奇域》节点图模拟器MCP服务器

此仓库为AI代理提供可以创建和管理WebMiliastra节点图和项目的MCP服务器。目前提供了节点图/项目工具，将在后续完成参考文档

> [!WARNING]  
> 该项目90%以上代码均由AI生成。

## 此服务器提供的功能

- 节点图工具： 列出、读取、写入和验证 `GraphDocument` Json文件
- 项目工具： 读取/写入包含 `manifest.json` 和节点图文件的文件夹
- 节点索引： 一个小型的节点定义样本文件，以及用于完整数据的覆盖路径
- 通过MCP资源（`nodegraph://docs/...`）公开的文档资源

## 仓库目录

- `graphs/` - 节点图Json文件（节点图工具的默认目标）
- `projects/` - 项目文件夹（每个文件夹包含 `manifest.json` 和节点图文件）
- `docs/` - 作为MCP资源提供的参考文档
- `data/` - 节点定义数据（将在后续根据 [data.ts](https://github.com/Wu-Yijun/Genshin-Impact-Miliastra-Wonderland-Code-Node-Editor-Pack/blob/main/utils/node_data/data.ts) 完善数据）

## 安装与运行

```bash
git clone https://github.com/Columbina-Dev/WebMiliastraNodesEditor-MCPServer.git
cd WebMiliastraNodesEditor-MCPServer/
npm install
npm run build
node build/index.js
```

## 环境变量

- `NODEGRAPH_WORKSPACE`: 文档和数据的基础工作区（默认：当前工作目录）
- `NODEGRAPH_GRAPHS_DIR`: 节点图存储文件夹（默认：`<workspace>/graphs`）
- `NODEGRAPH_PROJECTS_DIR`: 项目存储文件夹（默认：`<workspace>/projects`）
- `NODEGRAPH_NODE_DEFS_PATH`: Json节点定义数据的路径

P.S.: `data/nodeDefinitions.sample.json` 为临时测试数据集，后续需将数据替换为完整的节点定义数据以保证准确性

## MCP 配置示例

<details>
  <summary>OpenAI Codex</summary>
  使用 [config/.codex/config.toml](config/%2Ecodex/config.toml)
</details>


## 注意事项

- 需根据官方编辑器教程HTML导入更多的参考文档，见 `docs/tutorial-plan.md`
- 目前为临时测试MCP服务器，几乎无法生成正常可用的节点图和项目文件，需在后续完善文档和节点定义数据以验证格式
- 与 [主项目](https://github.com/Columbina-Dev/WebMiliastraNodesEditor) 相同，此MCP服务器项目同样采用GPLv3许可证。