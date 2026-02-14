/**
 * Add-sources command - Add more URLs, OpenAPI, GraphQL, or codebase to existing MCP server
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { DocumentationScraper } from '../scraper.js';
import { loadOpenAPI } from '../loaders/openapi.js';
import { loadGraphQL } from '../loaders/graphql.js';
import { loadCodebase } from '../loaders/codebase.js';

function mergePages(existing, incoming) {
  const seen = new Set(existing.map((p) => p.url + '|' + p.title));
  const merged = [...existing];
  for (const p of incoming) {
    const key = p.url + '|' + p.title;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(p);
    }
  }
  return merged;
}

export async function addSourcesCommand(directory) {
  const dir = directory || process.cwd();

  const metaPath = path.join(dir, 'context', 'metadata.json');
  const docsPath = path.join(dir, 'context', 'docs.json');
  const meta = await fs.readJson(metaPath).catch(() => null);
  const docsData = await fs.readJson(docsPath).catch(() => null);

  if (!meta || !docsData) {
    console.log(chalk.red('Not a Super MCP project. Run from project directory.'));
    process.exit(1);
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceType',
      message: 'What do you want to add?',
      choices: [
        { name: 'Documentation URL(s)', value: 'url' },
        { name: 'OpenAPI/Swagger schema (URL or path)', value: 'openapi' },
        { name: 'GraphQL schema (URL or path)', value: 'graphql' },
        { name: 'Local codebase (directory path)', value: 'codebase' },
      ],
    },
    {
      type: 'input',
      name: 'source',
      message: (a) => {
        switch (a.sourceType) {
          case 'url': return 'Enter URL(s), comma-separated:';
          case 'openapi': return 'OpenAPI URL or file path:';
          case 'graphql': return 'GraphQL schema URL or file path:';
          case 'codebase': return 'Directory path to index:';
          default: return 'Source:';
        }
      },
      validate: (v) => !!v?.trim() || 'Required',
    },
  ]);

  const spinner = ora('Loading source...').start();

  try {
    let newPages = [];

    if (answers.sourceType === 'url') {
      const urls = answers.source.split(',').map((u) => u.trim()).filter(Boolean);
      const scraper = new DocumentationScraper({ maxPages: 50 });
      for (const u of urls) {
        const data = await scraper.scrape(u);
        newPages = mergePages(newPages, data.pages || []);
      }
    } else if (answers.sourceType === 'openapi') {
      const data = await loadOpenAPI(answers.source.trim());
      newPages = data.pages || [];
    } else if (answers.sourceType === 'graphql') {
      const data = await loadGraphQL(answers.source.trim());
      newPages = data.pages || [];
    } else if (answers.sourceType === 'codebase') {
      const data = await loadCodebase(answers.source.trim(), { maxFiles: 50 });
      newPages = data.pages || [];
    }

    const mergedPages = mergePages(docsData.pages || [], newPages);
    const updated = {
      ...docsData,
      pageCount: mergedPages.length,
      pages: mergedPages,
      scrapedAt: new Date().toISOString(),
      sources: [...(docsData.sources || []), answers.sourceType],
    };

    await fs.writeJson(docsPath, updated, { spaces: 2 });
    await fs.writeJson(metaPath, {
      ...meta,
      generatedAt: new Date().toISOString(),
      pageCount: mergedPages.length,
      totalWords: mergedPages.reduce((s, p) => s + (p.wordCount || 0), 0),
    }, { spaces: 2 });

    spinner.succeed(`Added ${newPages.length} pages. Total: ${mergedPages.length}`);
    console.log(chalk.green('\nRestart the MCP server to use the new context.\n'));
  } catch (error) {
    spinner.fail(`Failed: ${error.message}`);
    process.exit(1);
  }
}
