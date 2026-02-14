/**
 * GraphQL schema loader
 * Converts GraphQL schema to doc-like format for context
 */

import axios from 'axios';
import fs from 'fs-extra';

export async function loadGraphQL(source) {
  let schemaStr;
  if (source.startsWith('http')) {
    const res = await axios.get(source, { timeout: 10000 });
    schemaStr = res.data;
  } else {
    schemaStr = await fs.readFile(source, 'utf-8');
  }

  const pages = [];
  const lines = schemaStr.split('\n');

  let currentBlock = '';
  let currentName = '';
  const blockTypes = ['type ', 'interface ', 'enum ', 'input ', 'scalar '];

  for (const line of lines) {
    for (const prefix of blockTypes) {
      if (line.trim().startsWith(prefix)) {
        if (currentBlock) {
          pages.push(createPage(currentName, currentBlock));
        }
        const match = line.match(new RegExp(prefix + '([A-Za-z0-9_]+)'));
        currentName = match ? match[1] : 'Unknown';
        currentBlock = line + '\n';
        break;
      }
    }
    if (!blockTypes.some((p) => line.trim().startsWith(p))) {
      currentBlock += line + '\n';
    }
  }
  if (currentBlock) {
    pages.push(createPage(currentName, currentBlock));
  }

  // If no structured blocks, treat whole schema as one page
  if (pages.length === 0 && schemaStr.trim()) {
    pages.push({
      url: source,
      title: 'GraphQL Schema',
      content: schemaStr,
      wordCount: schemaStr.split(/\s+/).length,
      scrapedAt: new Date().toISOString(),
      source: 'graphql',
    });
  }

  return {
    pageCount: pages.length,
    pages,
    scrapedAt: new Date().toISOString(),
    baseUrl: source,
    source: 'graphql',
  };
}

function createPage(name, content) {
  return {
    url: 'schema',
    title: name,
    content,
    wordCount: content.split(/\s+/).length,
    scrapedAt: new Date().toISOString(),
    source: 'graphql',
  };
}
