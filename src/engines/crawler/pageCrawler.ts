// Multi-page & Detail Page Crawler with persistent queue and loop prevention
import { StorageService } from '../../storage/storageService';
import type { PerformanceConfig } from '../../types';
import { DataNormalizer } from '../normalization/dataNormalizer';

export interface CrawlerEventHandlers {
  onPageStart?: (url: string, pageNum: number) => void;
  onPageComplete?: (url: string, recordsFound: number) => void;
  onError?: (url: string, error: string) => void;
  onFinished?: () => void;
}

export class PageCrawler {
  private jobId: string;
  private config: PerformanceConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private visitedUrls: Set<string> = new Set<string>();
  private pageFingerprints: Set<string> = new Set<string>();
  private handlers: CrawlerEventHandlers = {};

  constructor(jobId: string, config: PerformanceConfig, handlers: CrawlerEventHandlers = {}) {
    this.jobId = jobId;
    this.config = config;
    this.handlers = handlers;
  }

  setHandlers(handlers: CrawlerEventHandlers): void {
    this.handlers = handlers;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  stop(): void {
    this.isRunning = false;
  }

  /**
   * Detects next page URL from document using multiple heuristics
   */
  static detectNextPageUrl(doc: Document = document, currentUrl: string = window.location.href): string | null {
    // 1. rel="next"
    const relNext = doc.querySelector('a[rel="next"]');
    if (relNext && relNext.getAttribute('href')) {
      try {
        return new URL(relNext.getAttribute('href')!, currentUrl).href;
      } catch {}
    }

    // 2. Text match: Next, >>, بعدی, صفحه بعد
    const nextTextRegex = /^(next|بعدی|صفحه بعد|>>|>|›)$/i;
    const links = Array.from(doc.querySelectorAll('a[href]'));

    for (const a of links) {
      const text = a.textContent?.trim() || '';
      const aria = a.getAttribute('aria-label') || '';
      if (nextTextRegex.test(text) || nextTextRegex.test(aria)) {
        try {
          return new URL(a.getAttribute('href')!, currentUrl).href;
        } catch {}
      }
    }

    // 3. Class patterns
    const classNext = doc.querySelector('a[class*="pagination-next"], a[class*="next-page"], .pagination .next a');
    if (classNext && classNext.getAttribute('href')) {
      try {
        return new URL(classNext.getAttribute('href')!, currentUrl).href;
      } catch {}
    }

    // 4. Numbered pagination: find active page and take next sibling link
    const activePage = doc.querySelector('.pagination .active, .pager .current, [aria-current="page"]');
    if (activePage) {
      const nextSiblingLink = activePage.nextElementSibling?.querySelector('a') || (activePage.nextElementSibling?.tagName === 'A' ? activePage.nextElementSibling : null);
      if (nextSiblingLink && (nextSiblingLink as HTMLAnchorElement).getAttribute('href')) {
        try {
          return new URL((nextSiblingLink as HTMLAnchorElement).getAttribute('href')!, currentUrl).href;
        } catch {}
      }
    }

    return null;
  }

  /**
   * Triggers infinite scroll down by executing smooth scroll and waiting for DOM mutations
   */
  static async triggerInfiniteScroll(windowObj: Window = window, maxScrolls: number = 5, delayMs: number = 1000): Promise<boolean> {
    let previousHeight = windowObj.document.body.scrollHeight;
    let scrollsDone = 0;

    while (scrollsDone < maxScrolls) {
      windowObj.scrollTo({ top: windowObj.document.body.scrollHeight, behavior: 'smooth' });
      await new Promise((r) => setTimeout(r, delayMs));

      const newHeight = windowObj.document.body.scrollHeight;
      if (newHeight <= previousHeight) {
        // No new content loaded
        break;
      }

      previousHeight = newHeight;
      scrollsDone++;
    }

    return scrollsDone > 0;
  }

  /**
   * Main crawl runner processing the durable IndexedDB queue
   */
  async run(): Promise<void> {
    this.isRunning = true;
    this.isPaused = false;
    await StorageService.updateJobState(this.jobId, 'RUNNING');

    let processedCount = 0;

    while (this.isRunning && processedCount < this.config.maxPages) {
      if (this.isPaused) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const queueItem = await StorageService.getNextQueueItem(this.jobId);
      if (!queueItem) {
        // Queue empty
        break;
      }

      const url = queueItem.url;
      if (this.visitedUrls.has(url)) {
        await StorageService.updateQueueStatus(queueItem.id!, 'completed');
        continue;
      }

      this.visitedUrls.add(url);
      if (this.handlers.onPageStart) {
        this.handlers.onPageStart(url, processedCount + 1);
      }

      try {
        await StorageService.updateQueueStatus(queueItem.id!, 'processing');

        // Bounded delay between requests (respects performance profile)
        if (this.config.requestDelayMs > 0 && processedCount > 0) {
          await new Promise((r) => setTimeout(r, this.config.requestDelayMs));
        }

        // Fetch page content
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Check for duplicate page content / loop prevention
        const fingerprint = DataNormalizer.generateFingerprint({ text: doc.body.textContent?.substring(0, 1000) });
        if (this.pageFingerprints.has(fingerprint)) {
          await StorageService.updateQueueStatus(queueItem.id!, 'completed');
          continue;
        }
        this.pageFingerprints.add(fingerprint);

        // Multi-page next page discovery
        if (queueItem.depth < this.config.maxCrawlDepth) {
          const nextUrl = PageCrawler.detectNextPageUrl(doc, url);
          if (nextUrl && !this.visitedUrls.has(nextUrl)) {
            await StorageService.enqueueUrl(this.jobId, nextUrl, queueItem.depth + 1, 'pagination');
          }
        }

        await StorageService.updateQueueStatus(queueItem.id!, 'completed');
        await StorageService.updateJobStats(this.jobId, { pagesProcessed: 1 });
        processedCount++;

        if (this.handlers.onPageComplete) {
          this.handlers.onPageComplete(url, 0);
        }
      } catch (err: any) {
        await StorageService.updateQueueStatus(queueItem.id!, 'failed', err.message);
        if (this.handlers.onError) {
          this.handlers.onError(url, err.message);
        }
      }
    }

    this.isRunning = false;
    await StorageService.updateJobState(this.jobId, 'COMPLETED');

    if (this.handlers.onFinished) {
      this.handlers.onFinished();
    }
  }
}
