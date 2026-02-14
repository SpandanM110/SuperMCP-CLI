# Super MCP

**Generate production-ready MCP servers from docs, APIs, schemas & codebases.**  
Local + cloud LLMs (BYOK). Archestra & Claude Desktop ready.

```bash
npx super-mcp create
```

## Features

- **Multi-source** – Combine docs URLs, OpenAPI, GraphQL schemas, and local codebases
- **Private docs** – Auth headers & cookies for internal documentation
- **generate_code tool** – Docs-guided code generation for the LLM
- **Universal LLM** – Ollama, OpenAI, Anthropic, Groq, etc. (BYOK)
- **One-command integrations** – `add-to-claude`, `export-archestra`, `add-sources`

## Installation

```bash
npx super-mcp create
# or
npm install -g super-mcp
```

## Commands

| Command | Description |
|---------|-------------|
| `super-mcp create` | Create MCP server (docs, OpenAPI, GraphQL, codebase) |
| `super-mcp add-sources` | Add more sources to existing server |
| `super-mcp add-to-claude` | Add to Claude Desktop config |
| `super-mcp export-archestra` | Export Archestra manifest |
| `super-mcp refresh` | Refresh documentation |
| `super-mcp list` | List generated servers |
| `super-mcp test` | Test MCP server |

## Create Options

```bash
# Basic
super-mcp create -n stripe-expert -u https://stripe.com/docs/api

# Multi-URL
super-mcp create -n api-expert -u https://docs.example.com -u https://api.example.com

# OpenAPI schema
super-mcp create -n stripe-mcp --openapi https://api.stripe.com/openapi.json

# GraphQL schema
super-mcp create -n graphql-mcp --graphql ./schema.graphql

# Codebase indexing
super-mcp create -n my-app-mcp --codebase ./src

# Private docs (auth)
super-mcp create -n internal-mcp -u https://internal.company.com/docs \
  --auth-header "Bearer YOUR_TOKEN" --cookies "session=xyz"

# Combine sources
super-mcp create -n full-stack -u https://fastapi.tiangolo.com \
  --openapi ./openapi.json --codebase ./backend
```

## Generated Tools

| Tool | Description |
|------|-------------|
| `ask_docs` | Q&A about documentation |
| `search_docs` | Search docs by keyword |
| `generate_code` | Generate code from docs (guides LLM in right direction) |

## LLM Providers (BYOK)

Set `LLM_PROVIDER` and API key: `ollama`, `openai`, `anthropic`, `groq`, `together`, `mistral`, `azure_openai`

## Requirements

- Node.js 18+
- Ollama (optional) or API key for cloud

## License

MIT
