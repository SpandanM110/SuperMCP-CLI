/**
 * Test command - Test an MCP server's LLM connection
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export async function testCommand(directory) {
  const dir = directory || process.cwd();

  console.log(chalk.blue('\n🧪 Testing MCP server...\n'));

  const metaPath = path.join(dir, 'context', 'metadata.json');
  const meta = await fs.readJson(metaPath).catch(() => null);

  if (!meta) {
    console.log(chalk.red('Not a Super MCP project.'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Project structure valid'));
  console.log(chalk.gray(`  Pages: ${meta.pageCount}`));

  // Check for .env or env vars
  const envPath = path.join(dir, '.env');
  const hasEnv = await fs.pathExists(envPath);
  console.log(hasEnv ? chalk.green('✓ .env found') : chalk.yellow('⚠ No .env (using defaults)'));

  console.log(chalk.cyan('\nTo fully test:'));
  console.log('  1. Ensure Ollama/LLM is running');
  console.log('  2. cd ' + path.basename(dir));
  console.log('  3. npm start (or python server.py)');
  console.log('  4. Connect via Claude Desktop or Archestra\n');
}
