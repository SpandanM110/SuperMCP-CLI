/**
 * Codebase indexer
 * Indexes local source code for context
 */

import fs from 'fs-extra';
import path from 'path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'];
const IGNORE = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'vendor'];

export async function loadCodebase(dirPath, options = {}) {
  const maxFiles = options.maxFiles || 100;
  const maxSize = options.maxSize || 50000; // chars per file
  const pages = [];
  let count = 0;

  async function walk(dir) {
    if (count >= maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      if (count >= maxFiles) break;
      const full = path.join(dir, ent.name);
      const rel = path.relative(dirPath, full);
      if (IGNORE.some((i) => rel.includes(i))) continue;

      if (ent.isDirectory()) {
        await walk(full);
      } else if (EXTENSIONS.includes(path.extname(ent.name))) {
        const content = await fs.readFile(full, 'utf-8').catch(() => '');
        const truncated = content.length > maxSize ? content.slice(0, maxSize) + '\n... (truncated)' : content;
        pages.push({
          url: `file://${full}`,
          title: rel,
          content: `# ${rel}\n\n\`\`\`\n${truncated}\n\`\`\``,
          wordCount: truncated.split(/\s+/).length,
          scrapedAt: new Date().toISOString(),
          source: 'codebase',
        });
        count++;
      }
    }
  }

  const resolved = path.resolve(dirPath);
  if (!(await fs.pathExists(resolved))) {
    throw new Error(`Path not found: ${resolved}`);
  }
  await walk(resolved);

  return {
    pageCount: pages.length,
    pages,
    scrapedAt: new Date().toISOString(),
    baseUrl: resolved,
    source: 'codebase',
  };
}
