/**
 * OpenAPI/Swagger schema loader
 * Converts OpenAPI spec to doc-like format for context
 */

import axios from 'axios';
import fs from 'fs-extra';
import yaml from 'js-yaml';

function parseSpec(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return yaml.load(raw);
    } catch (e) {
      throw new Error(`Invalid OpenAPI spec: ${e.message}`);
    }
  }
}

export async function loadOpenAPI(source) {
  let spec;
  if (source.startsWith('http')) {
    const res = await axios.get(source, { timeout: 10000 });
    spec = typeof res.data === 'string' ? parseSpec(res.data) : res.data;
  } else {
    const raw = await fs.readFile(source, 'utf-8');
    spec = parseSpec(raw);
  }

  const pages = [];
  const info = spec.info || {};
  const baseTitle = info.title || 'API';

  // Paths
  const paths = spec.paths || {};
  for (const [pathStr, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method) && op) {
        const summary = op.summary || op.operationId || `${method.toUpperCase()} ${pathStr}`;
        let content = `## ${method.toUpperCase()} ${pathStr}\n\n`;
        content += (op.description || '') + '\n\n';
        if (op.parameters?.length) {
          content += '### Parameters\n\n';
          for (const p of op.parameters) {
            content += `- **${p.name}** (${p.in}): ${p.description || ''} ${p.required ? '(required)' : ''}\n`;
          }
        }
        if (op.requestBody) {
          content += '\n### Request Body\n\n' + (op.requestBody.description || '') + '\n';
        }
        if (op.responses) {
          content += '\n### Responses\n\n';
          for (const [code, res] of Object.entries(op.responses)) {
            content += `- ${code}: ${res.description || ''}\n`;
          }
        }
        pages.push({
          url: source,
          title: summary,
          content,
          wordCount: content.split(/\s+/).length,
          scrapedAt: new Date().toISOString(),
          source: 'openapi',
        });
      }
    }
  }

  // Components/schemas
  const schemas = spec.components?.schemas || {};
  for (const [name, schema] of Object.entries(schemas)) {
    let content = `## Schema: ${name}\n\n`;
    content += (schema.description || '') + '\n\n';
    if (schema.properties) {
      content += '### Properties\n\n';
      for (const [prop, def] of Object.entries(schema.properties)) {
        content += `- **${prop}** (${def.type || ''}): ${def.description || ''}\n`;
      }
    }
    pages.push({
      url: source,
      title: `Schema: ${name}`,
      content,
      wordCount: content.split(/\s+/).length,
      scrapedAt: new Date().toISOString(),
      source: 'openapi',
    });
  }

  return {
    pageCount: pages.length,
    pages,
    scrapedAt: new Date().toISOString(),
    baseUrl: source,
    source: 'openapi',
  };
}
