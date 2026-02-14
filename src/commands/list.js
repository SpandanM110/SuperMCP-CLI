/**
 * List command - List generated MCP servers in current directory
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export async function listCommand() {
  const cwd = process.cwd();
  const entries = await fs.readdir(cwd, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && e.name.endsWith('-mcp'));

  if (dirs.length === 0) {
    console.log(chalk.yellow('No MCP servers found in current directory.'));
    console.log(chalk.gray('Run "super-mcp create" to generate one.\n'));
    return;
  }

  console.log(chalk.blue('\nGenerated MCP servers:\n'));

  for (const dir of dirs) {
    const metaPath = path.join(cwd, dir.name, 'context', 'metadata.json');
    const meta = await fs.readJson(metaPath).catch(() => ({}));
    const pageCount = meta.pageCount ?? '?';
    const generatedAt = meta.generatedAt
      ? new Date(meta.generatedAt).toLocaleDateString()
      : 'unknown';

    console.log(chalk.cyan(`  ${dir.name}`));
    console.log(chalk.gray(`    Pages: ${pageCount} | Generated: ${generatedAt}`));
    console.log('');
  }
}
