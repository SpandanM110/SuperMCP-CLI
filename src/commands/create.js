/**
 * Create command - Generate a new MCP server from documentation
 * Supports: multi-URL, OpenAPI, GraphQL, codebase, private docs (auth)
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { DocumentationScraper } from '../scraper.js';
import { LLMDetector } from '../llm-detector.js';
import { MCPGenerator } from '../generator.js';
import { loadOpenAPI } from '../loaders/openapi.js';
import { loadGraphQL } from '../loaders/graphql.js';
import { loadCodebase } from '../loaders/codebase.js';

function mergeDocsData(sources) {
  const seen = new Set();
  const pages = [];
  for (const data of sources) {
    for (const p of data.pages || []) {
      const key = p.url + '|' + p.title;
      if (!seen.has(key)) {
        seen.add(key);
        pages.push(p);
      }
    }
  }
  const totalWords = pages.reduce((s, p) => s + (p.wordCount || 0), 0);
  return {
    pageCount: pages.length,
    pages,
    scrapedAt: new Date().toISOString(),
    baseUrl: sources[0]?.baseUrl || 'multiple',
    sources: sources.map((s) => s.source || 'docs'),
    totalWords,
  };
}

export async function createCommand(options) {
  let { name, url, urls, lang, output, docker, maxPages } = options;
  const openapi = options.openapi;
  const graphql = options.graphql;
  const codebase = options.codebase;
  const authHeader = options.authHeader;
  const cookies = options.cookies;

  // Collect URLs: --url can be repeated (variadic gives array)
  const urlList = [];
  if (url) urlList.push(...(Array.isArray(url) ? url : [url]));
  if (urls) urlList.push(...(Array.isArray(urls) ? urls : [urls]));

  const hasUrls = urlList.length > 0;
  const hasOpenAPI = !!openapi;
  const hasGraphQL = !!graphql;
  const hasCodebase = !!codebase;
  const hasAnySource = hasUrls || hasOpenAPI || hasGraphQL || hasCodebase;

  // Interactive prompts for missing values
  if (!name || !hasAnySource) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Server name (e.g., stripe-expert):',
        default: name,
        when: () => !name,
        validate: (v) =>
          /^[a-z0-9-]+$/.test(v) || 'Use lowercase letters, numbers, and hyphens only',
      },
      {
        type: 'input',
        name: 'url',
        message: 'Documentation URL (or leave empty for schema/codebase only):',
        default: urlList[0] || '',
        when: () => !hasAnySource,
        validate: (v) => !v || (() => { try { new URL(v); return true; } catch { return 'Enter a valid URL'; } })(),
      },
      {
        type: 'list',
        name: 'lang',
        message: 'Language:',
        choices: [
          { name: 'TypeScript', value: 'typescript' },
          { name: 'Python', value: 'python' },
        ],
        default: lang || 'typescript',
        when: () => !lang,
      },
    ]);

    name = name || answers.name;
    if (!hasUrls && answers.url) urlList.push(answers.url);
    lang = lang || answers.lang;
  }

  lang = lang || 'typescript';
  output = output || process.cwd();
  const includeDocker = docker !== false;
  const maxPagesNum = parseInt(maxPages, 10) || 200;
  const preset = options.preset || 'default';

  console.log(chalk.blue('\n🚀 Super MCP - Creating your MCP server...\n'));

  // Step 1: Detect LLM
  const llmSpinner = ora('Detecting LLM...').start();
  const llmDetector = new LLMDetector();
  let llmConfig = await llmDetector.detect();

  if (llmConfig) {
    llmSpinner.succeed(`Found: ${llmConfig.name} on ${llmConfig.endpoint}`);
    llmConfig = {
      endpoint: llmConfig.endpoint,
      model: llmConfig.models?.[0] || 'llama3.2',
      type: llmConfig.type,
      provider: llmConfig.type === 'ollama' ? 'ollama' : 'openai',
    };
  } else {
    llmSpinner.warn('No local LLM. Using Ollama defaults (set API keys for cloud/BYOK).');
    llmConfig = {
      endpoint: 'http://localhost:11434/api/generate',
      model: 'llama3.2',
      type: 'ollama',
      provider: 'ollama',
    };
  }

  // Step 2: Collect content from all sources
  const sources = [];
  const scrapeSpinner = ora('Loading sources...').start();

  try {
    // URLs (docs)
    if (urlList.length > 0) {
      const scraper = new DocumentationScraper({
        maxPages: Math.floor(maxPagesNum / Math.max(urlList.length, 1)),
        timeout: 5000,
        concurrency: 5,
        authHeader,
        cookies,
      });
      for (const u of urlList) {
        const data = await scraper.scrape(u);
        sources.push(data);
      }
    }

    // OpenAPI
    if (openapi) {
      const list = Array.isArray(openapi) ? openapi : [openapi];
      for (const src of list) {
        const data = await loadOpenAPI(src);
        sources.push(data);
      }
    }

    // GraphQL
    if (graphql) {
      const list = Array.isArray(graphql) ? graphql : [graphql];
      for (const src of list) {
        const data = await loadGraphQL(src);
        sources.push(data);
      }
    }

    // Codebase
    if (codebase) {
      const list = Array.isArray(codebase) ? codebase : [codebase];
      for (const src of list) {
        const data = await loadCodebase(src, { maxFiles: 50 });
        sources.push(data);
      }
    }

    const docsData = sources.length > 0 ? mergeDocsData(sources) : {
      pageCount: 0,
      pages: [],
      scrapedAt: new Date().toISOString(),
      baseUrl: urlList[0] || 'none',
      sources: [],
    };

    scrapeSpinner.succeed(`Loaded ${docsData.pageCount} pages from ${sources.length} source(s)`);

    if (docsData.pageCount === 0) {
      console.log(chalk.yellow('\n⚠ No content found. Creating server with empty context.'));
    }

    // Step 3: Generate code
    const genSpinner = ora('Generating MCP server code...').start();
    const generator = new MCPGenerator();

    const projectDir = await generator.generate({
      serverName: name,
      docsUrl: urlList[0] || docsData.baseUrl,
      docsData,
      llmConfig,
      language: lang,
      outputDir: output,
      includeDocker,
      preset,
      hasGenerateCode: true,
    });
    genSpinner.succeed('Code generated');

    // Step 4: Install dependencies (TypeScript only)
    const projectName = name.endsWith('-mcp') ? name : `${name}-mcp`;
    const projectDirResolved = path.join(output, projectName);
    if (lang === 'typescript') {
      const installSpinner = ora('Installing dependencies...').start();
      try {
        const { execSync } = await import('child_process');
        execSync('npm install', {
          cwd: projectDirResolved,
          stdio: 'pipe',
        });
        installSpinner.succeed('Dependencies installed');
      } catch {
        installSpinner.warn('Run "npm install" manually in the project directory');
      }
    }

    // Success
    console.log(chalk.green('\n🎉 Success!\n'));
    console.log(chalk.white(`Created: ${projectDirResolved}\n`));
    console.log(chalk.cyan('Next steps:'));
    console.log(`  cd ${projectName}`);
    if (lang === 'typescript') {
      console.log('  npm run build');
      console.log('  npm start');
    } else {
      console.log('  pip install -r requirements.txt');
      console.log('  python server.py');
    }
    if (includeDocker) {
      console.log('\n  Or with Docker:');
      console.log('  docker-compose up');
      console.log('\n  Add to Archestra:');
      console.log(`  super-mcp export-archestra`);
      console.log(`  docker run --rm -i --network=host ${projectName}:latest`);
    }
    console.log(chalk.cyan('Integrations:'));
    console.log(`  super-mcp add-to-claude    # Add to Claude Desktop`);
    console.log(`  super-mcp export-archestra  # Export Archestra manifest`);
    console.log(chalk.cyan('\nManage sources:'));
    console.log(`  super-mcp add-sources       # Add more URLs/schemas to existing server`);
    console.log('');
  } catch (error) {
    scrapeSpinner.fail(`Failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}
