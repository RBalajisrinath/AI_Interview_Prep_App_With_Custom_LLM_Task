import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { config } from "../config";
import { CrawledPage, CrawlResult } from "../types";

const HIRE_KEYWORDS = [
  "career", "hiring", "job", "join", "work", "team", "interview",
  "process", "apply", "position", "opening", "talent", "recruit",
  "culture", "about", "company", "mission", "value"
];

const IRRELEVANT_PATTERNS = [
  /\.(pdf|jpg|jpeg|png|gif|css|js|zip|tar|gz|mp4|mp3)$/i,
  /\/tag\//, /\/category\//, /\/author\//, /\/feed/,
  /\/wp-content\//, /\/wp-includes\//, /\/cdn-cgi\//,
  /facebook\.com|twitter\.com|linkedin\.com|instagram\.com|youtube\.com/,
];

export class CrawlerService {
  private visited = new Set<string>();
  private queue: { url: string; depth: number }[] = [];
  private result: CrawlResult = { pages: [], hiring_pages: [], about_pages: [], errors: [] };
  private robotsCache = new Map<string, any>();
  private domain = "";
  private lastRequestTime = 0;
  private minRequestInterval = 500; // ms between requests to same domain

  async crawl(startUrl: string, maxPages: number = config.maxPagesPerCrawl): Promise<CrawlResult> {
    const normalized = this.normalizeUrl(startUrl);
    if (!normalized) {
      this.result.errors.push({ url: startUrl, error: "INVALID_URL" });
      return this.result;
    }

    this.domain = new URL(normalized).hostname;
    this.queue.push({ url: normalized, depth: 0 });

    while (this.queue.length > 0 && this.visited.size < maxPages) {
      const item = this.queue.shift()!;
      if (this.visited.has(item.url)) continue;
      this.visited.add(item.url);

      try {
        const page = await this.fetchPage(item.url);
        if (!page) continue;

        this.result.pages.push(page);

        // Classify page
        const hireScore = this.scoreHiringPage(page);
        const aboutScore = this.scoreAboutPage(page);
        if (hireScore > 0.6) this.result.hiring_pages.push(page);
        if (aboutScore > 0.6) this.result.about_pages.push(page);

        // Extract links for further crawling
        if (item.depth < 2) {
          for (const link of page.links) {
            const absUrl = this.resolveUrl(item.url, link);
            if (absUrl && this.shouldCrawl(absUrl) && !this.visited.has(absUrl)) {
              this.queue.push({ url: absUrl, depth: item.depth + 1 });
            }
          }
        }
      } catch (error: any) {
        this.result.errors.push({
          url: item.url,
          error: error.message || "FETCH_ERROR",
        });
      }
    }

    return this.result;
  }

  private async fetchPage(url: string): Promise<CrawledPage | null> {
    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((r) => setTimeout(r, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();

    // Check robots.txt
    if (!(await this.isAllowedByRobots(url))) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.crawlTimeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "InterviewPrepBot/1.0 (Educational Research; respects robots.txt)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return null;
      }

      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      if (contentLength > 5 * 1024 * 1024) {
        return null; // Skip pages larger than 5MB
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script/style/nav/footer elements
      $("script, style, nav, footer, header, iframe, noscript, svg, form").remove();

      const title = $("title").text().trim() || "";
      const content = $("main, article, [role=main], body").text().replace(/\s+/g, " ").trim();

      // Extract links
      const links: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href) links.push(href);
      });

      return {
        url,
        title,
        content: content.slice(0, 15000), // Cap content length
        links,
        status: response.status,
        fetched_at: new Date().toISOString(),
      };
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === "AbortError") {
        throw new Error("TIMEOUT");
      }
      throw error;
    }
  }

  private async isAllowedByRobots(url: string): Promise<boolean> {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;

    if (!this.robotsCache.has(robotsUrl)) {
      try {
        const response = await fetch(robotsUrl, {
          headers: { "User-Agent": "InterviewPrepBot/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        const text = await response.text();
        const robots = robotsParser(robotsUrl, text);
        this.robotsCache.set(robotsUrl, robots);
      } catch {
        this.robotsCache.set(robotsUrl, null);
      }
    }

    const robots = this.robotsCache.get(robotsUrl);
    if (!robots) return true; // If robots.txt is unreachable, assume allowed
    return robots.isAllowed(url, "InterviewPrepBot") ?? true;
  }

  private scoreHiringPage(page: CrawledPage): number {
    const urlLower = page.url.toLowerCase();
    const titleLower = page.title.toLowerCase();
    const contentLower = page.content.toLowerCase();
    let score = 0;

    for (const keyword of HIRE_KEYWORDS) {
      if (urlLower.includes(keyword)) score += 0.3;
      if (titleLower.includes(keyword)) score += 0.2;
      if (contentLower.includes(keyword)) score += 0.1;
    }

    // Boost for specific hiring-related phrases
    if (contentLower.includes("interview process")) score += 0.3;
    if (contentLower.includes("how we hire")) score += 0.3;
    if (contentLower.includes("hiring process")) score += 0.3;
    if (contentLower.includes("join our team")) score += 0.2;
    if (contentLower.includes("open positions")) score += 0.2;

    return Math.min(score, 1);
  }

  private scoreAboutPage(page: CrawledPage): number {
    const urlLower = page.url.toLowerCase();
    const titleLower = page.title.toLowerCase();
    let score = 0;

    if (urlLower.includes("/about")) score += 0.5;
    if (urlLower.includes("/team")) score += 0.3;
    if (urlLower.includes("/mission")) score += 0.3;
    if (urlLower.includes("/culture")) score += 0.3;
    if (titleLower.includes("about")) score += 0.2;
    if (titleLower.includes("our team")) score += 0.2;

    return Math.min(score, 1);
  }

  private shouldCrawl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== this.domain) return false;
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return false;
      if (IRRELEVANT_PATTERNS.some((p) => p.test(url))) return false;
      return true;
    } catch {
      return false;
    }
  }

  private normalizeUrl(url: string): string | null {
    try {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      const urlObj = new URL(url);
      // Reject private/loopback addresses
      const hostname = urlObj.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        return null;
      }
      if (hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")) {
        return null;
      }
      return urlObj.toString();
    } catch {
      return null;
    }
  }

  private resolveUrl(base: string, relative: string): string | null {
    try {
      return new URL(relative, base).toString();
    } catch {
      return null;
    }
  }
}
