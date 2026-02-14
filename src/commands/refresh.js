/**
 * Refresh command - Refresh documentation for an existing MCP server
 */

import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { DocumentationScraper } from '../scraper.js';
import { MCPGenerator } from '../generator.js';

export async function refreshCommand(directory) {
  const dir = directory || process.cwd();

  const spinner = ora('Refreshing documentation...').start();

  try {
    const metadataPath = path.join(dir, 'context', 'metadata.json');
    const metadata = await fs.readJson(metadataPath).catch(() => null);

    if (!metadata) {
      spinner.fail('Not a Super MCP project. Run from project directory or specify path.');
      process.exit(1);
    }

    const docsPath = path.join(dir, 'context', 'docs.json');
    const docsData = await fs.readJson(docsPath).catch(() => null);
    const baseUrl = docsData?.baseUrl;

    if (!baseUrl) {
      spinner.fail('No base URL found in docs. Re-run create command.');
      process.exit(1);
    }

    const scraper = new DocumentationScraper({ maxPages: 200 });
    const newDocs = await scraper.scrape(baseUrl);

    await fs.writeJson(docsPath, newDocs, { spaces: 2 });
    await fs.writeJson(metadataPath, {
      ...metadata,
      generatedAt: new Date().toISOString(),
      pageCount: newDocs.pageCount,
      totalWords: newDocs.pages?.reduce((s, p) => s + (p.wordCount || 0), 0) || 0,
    }, { spaces: 2 });

    spinner.succeed(`Refreshed ${newDocs.pageCount} pages`);
    console.log(chalk.green(`\nDocumentation updated in ${dir}\n`));
  } catch (error) {
    spinner.fail(`Refresh failed: ${error.message}`);
    process.exit(1);
  }
}
