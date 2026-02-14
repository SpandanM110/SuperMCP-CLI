#!/usr/bin/env node

import { program } from 'commander';
import { createCommand } from '../src/commands/create.js';
import { refreshCommand } from '../src/commands/refresh.js';
import { listCommand } from '../src/commands/list.js';
import { testCommand } from '../src/commands/test.js';
import { addToClaudeCommand } from '../src/commands/add-to-claude.js';
import { exportArchestraCommand } from '../src/commands/export-archestra.js';
import { addSourcesCommand } from '../src/commands/add-sources.js';

program
  .name('super-mcp')
  .description('Generate production-ready MCP servers from docs, APIs, schemas & codebases')
  .version('1.0.0');

program
  .command('create')
  .description('Create a new MCP server from documentation, OpenAPI, GraphQL, or codebase')
  .option('-n, --name <name>', 'Server name (e.g., stripe-expert)')
  .option('-u, --url <url...>', 'Documentation URL (repeat for multiple: -u url1 -u url2)')
  .option('-l, --lang <lang>', 'Language: typescript | python', 'typescript')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('-p, --preset <preset>', 'Preset: archestra | claude-desktop', 'default')
  .option('--openapi <path>', 'OpenAPI/Swagger schema (URL or file path)', (v, p) => (p || []).concat(v), [])
  .option('--graphql <path>', 'GraphQL schema (URL or file path)', (v, p) => (p || []).concat(v), [])
  .option('--codebase <path>', 'Local codebase directory to index', (v, p) => (p || []).concat(v), [])
  .option('--auth-header <header>', 'Auth header for private docs (e.g. "Bearer token")')
  .option('--cookies <cookies>', 'Cookie header for private docs')
  .option('--no-docker', 'Skip Docker file generation')
  .option('--max-pages <num>', 'Maximum pages to scrape per URL', '200')
  .action(createCommand);

program
  .command('refresh [directory]')
  .description('Refresh documentation for an existing MCP server')
  .action(refreshCommand);

program
  .command('add-sources [directory]')
  .description('Add more URLs, OpenAPI, GraphQL, or codebase to existing server')
  .action(addSourcesCommand);

program
  .command('list')
  .description('List generated MCP servers in current directory')
  .action(listCommand);

program
  .command('test [directory]')
  .description('Test an MCP server\'s LLM connection and MCP protocol')
  .action(testCommand);

program
  .command('add-to-claude [directory]')
  .description('Add generated MCP server to Claude Desktop config')
  .action(addToClaudeCommand);

program
  .command('export-archestra [directory]')
  .description('Export Archestra-ready manifest for MCP server')
  .action(exportArchestraCommand);

program.parse();
