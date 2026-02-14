/**
 * Documentation Scraper
 * 
 * Intelligently scrapes and processes documentation into LLM-ready context.
 * Supports sitemap parsing and recursive crawling.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

export class DocumentationScraper {
  constructor(options = {}) {
    this.maxPages = options.maxPages || 200;
    this.timeout = options.timeout || 5000;
    this.concurrency = options.concurrency || 5;
    this.authHeader = options.authHeader;
    this.cookies = options.cookies;
    this.visited = new Set();
    this.queue = [];
    this.pages = [];
  }

  getHeaders() {
    const headers = { 'User-Agent': 'Super-MCP-Bot/1.0' };
    if (this.authHeader) {
      const val = this.authHeader.replace(/^Authorization:\s*/i, '').trim();
      headers['Authorization'] = val;
    }
    if (this.cookies) headers['Cookie'] = this.cookies;
    return headers;
  }

  async scrape(startUrl) {
    this.visited.clear();
    this.queue = [];
    this.pages = [];

    // Strategy 1: Try sitemap first
    const sitemapPages = await this.tryFetchSitemap(startUrl);

    if (sitemapPages.length > 0) {
      return await this.scrapeFromSitemap(sitemapPages);
    }

    // Strategy 2: Recursive crawl
    return await this.recursiveCrawl(startUrl);
  }

  async tryFetchSitemap(baseUrl) {
    const parsed = new URL(baseUrl);
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap.xml`,
      `${parsed.origin}/sitemap.xml`,
      `${parsed.origin}/sitemap_index.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get(sitemapUrl, {
          timeout: 3000,
          headers: this.getHeaders(),
        });
        const $ = cheerio.load(response.data, { xmlMode: true });

        const urls = [];
        $('url > loc').each((i, elem) => {
          const url = $(elem).text().trim();
          if (url) urls.push(url);
        });

        // Also check sitemap index
        $('sitemap > loc').each((i, elem) => {
          const url = $(elem).text().trim();
          if (url) urls.push(url);
        });

        if (urls.length > 0) return urls;
      } catch {
        continue;
      }
    }

    return [];
  }

  async scrapeFromSitemap(sitemapUrls) {
    const baseUrl = sitemapUrls[0] ? new URL(sitemapUrls[0]).origin : '';
    const basePath = sitemapUrls[0] ? this.getBasePath(sitemapUrls[0]) : '';

    // Filter to docs-related URLs
    const docUrls = sitemapUrls.filter((url) =>
      this.shouldFollow(url, baseUrl, basePath)
    );

    const toScrape = docUrls.slice(0, this.maxPages);
    this.queue = toScrape;

    while (this.queue.length > 0 && this.pages.length < this.maxPages) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.all(
        batch.map((url) => this.scrapePage(url, baseUrl, basePath))
      );
    }

    return {
      pageCount: this.pages.length,
      pages: this.pages,
      scrapedAt: new Date().toISOString(),
      baseUrl: baseUrl || sitemapUrls[0],
    };
  }

  async recursiveCrawl(startUrl) {
    this.queue.push(startUrl);
    const parsed = new URL(startUrl);
    const baseUrl = parsed.origin;
    const basePath = this.getBasePath(startUrl);

    while (this.queue.length > 0 && this.pages.length < this.maxPages) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.all(
        batch.map((url) => this.scrapePage(url, baseUrl, basePath))
      );
    }

    return {
      pageCount: this.pages.length,
      pages: this.pages,
      scrapedAt: new Date().toISOString(),
      baseUrl: startUrl,
    };
  }

  async scrapePage(url, baseUrl, basePath) {
    if (this.visited.has(url)) return;
    this.visited.add(url);

    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: this.getHeaders(),
      });

      const $ = cheerio.load(response.data);

      // Remove unwanted elements
      $(
        'nav, footer, header, script, style, .ad, .advertisement, .sidebar, .menu, aside'
      ).remove();

      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '.documentation',
        '.docs-content',
        '#content',
        'body',
      ];

      let content = null;
      for (const selector of contentSelectors) {
        const el = $(selector).first();
        if (el.length > 0 && el.text().trim().length > 100) {
          content = el;
          break;
        }
      }

      const html = content ? content.html() : $.html();
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
      });

      const markdown = turndownService.turndown(html || '');
      const title = $('h1').first().text() || $('title').text() || url;

      this.pages.push({
        url,
        title: title.trim(),
        content: markdown,
        wordCount: markdown.split(/\s+/).length,
        scrapedAt: new Date().toISOString(),
      });

      // Find links to follow (recursive crawl only when no sitemap)
      if (this.pages.length < this.maxPages) {
        $('a').each((i, elem) => {
          const href = $(elem).attr('href');
          if (!href) return;

          const fullUrl = this.resolveUrl(href, baseUrl, basePath);
          if (this.shouldFollow(fullUrl, baseUrl, basePath)) {
            this.queue.push(fullUrl);
          }
        });
      }
    } catch (error) {
      // Silent fail for individual pages
    }
  }

  resolveUrl(href, baseUrl, basePath) {
    try {
      if (href.startsWith('http')) {
        return href.split('#')[0];
      }
      if (href.startsWith('/')) {
        return baseUrl + href.split('#')[0];
      }
      return new URL(href, baseUrl + basePath).href.split('#')[0];
    } catch {
      return null;
    }
  }

  shouldFollow(url, baseUrl, basePath) {
    if (!url || !url.startsWith(baseUrl)) return false;
    if (this.visited.has(url)) return false;

    const excludePatterns = [
      '/blog/',
      '/changelog/',
      '.pdf',
      '.zip',
      '.tar.gz',
      '/downloads/',
      '/login',
      '/signup',
      '/api-reference/',
    ];

    for (const pattern of excludePatterns) {
      if (url.includes(pattern)) return false;
    }

    return true;
  }

  getBasePath(url) {
    try {
      const path = new URL(url).pathname;
      return path.split('/').slice(0, -1).join('/');
    } catch {
      return '';
    }
  }
}
