/**
 * Add-to-Claude command - Add generated MCP server to Claude Desktop config
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

const CONFIG_PATHS = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
  path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json'),
];

export async function addToClaudeCommand(directory) {
  const dir = directory || process.cwd();

  const metaPath = path.join(dir, 'context', 'metadata.json');
  const meta = await fs.readJson(metaPath).catch(() => null);
  if (!meta) {
    console.log(chalk.red('Not a Super MCP project. Run from project directory.'));
    process.exit(1);
  }

  const pkg = await fs.readJson(path.join(dir, 'package.json')).catch(() => null);
  const serverName = pkg?.name?.replace(/-mcp$/, '') || path.basename(dir).replace(/-mcp$/, '');

  const indexPath = path.join(dir, 'dist', 'index.js');
  if (!(await fs.pathExists(indexPath))) {
    console.log(chalk.red('Build first: npm run build'));
    process.exit(1);
  }

  const absolutePath = path.resolve(indexPath);

  let configPath = null;
  for (const p of CONFIG_PATHS) {
    if (await fs.pathExists(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    console.log(chalk.yellow('Claude Desktop config not found. Create it at one of:'));
    CONFIG_PATHS.forEach((p) => console.log(chalk.gray('  ' + p)));
    console.log(chalk.cyan('\nAdd this to your config:'));
    printSnippet(serverName, absolutePath);
    return;
  }

  let config;
  try {
    config = await fs.readJson(configPath);
  } catch {
    config = { mcpServers: {} };
  }
  config.mcpServers = config.mcpServers || {};

  config.mcpServers[serverName] = {
    command: 'node',
    args: [absolutePath],
    env: {
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'llama3.2',
    },
  };

  await fs.writeJson(configPath, config, { spaces: 2 });
  console.log(chalk.green(`\n✓ Added ${serverName} to Claude Desktop config`));
  console.log(chalk.gray(configPath));
  console.log(chalk.cyan('\nRestart Claude Desktop to use the new MCP server.\n'));
}

function printSnippet(name, indexPath) {
  console.log(`
{
  "mcpServers": {
    "${name}": {
      "command": "node",
      "args": ["${indexPath}"],
      "env": {
        "LLM_PROVIDER": "ollama",
        "LLM_MODEL": "llama3.2"
      }
    }
  }
}
`);
}
