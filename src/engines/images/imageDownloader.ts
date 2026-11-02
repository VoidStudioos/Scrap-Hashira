// Advanced Image Downloader Engine with queue, deduplication, retry, and manifest
import type { ExtractedImage } from '../../types';
import { StorageService } from '../../storage/storageService';
import { computeSha256 } from '../../utils/hash';
import { SecuritySanitizer } from '../../security/sanitizer';

export interface ImageManifestEntry {
  recordId?: string;
  sourceUrl: string;
  localPath: string;
  width?: number;
  height?: number;
  hashSha256: string;
  status: 'completed' | 'failed' | 'skipped';
}

export interface ImageManifest {
  jobId: string;
  generatedAt: number;
  totalImages: number;
  downloadedImages: number;
  entries: ImageManifestEntry[];
}

export class ImageDownloader {
  private queue: ExtractedImage[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private concurrency: number = 4;
  private activeCount: number = 0;
  private seenHashes: Set<string> = new Set<string>();
  private manifestEntries: ImageManifestEntry[] = [];
  private onProgressCallback?: (completed: number, failed: number, total: number) => void;

  constructor(concurrency: number = 4) {
    this.concurrency = concurrency;
  }

  setConcurrency(limit: number): void {
    this.concurrency = Math.max(1, Math.min(10, limit));
  }

  onProgress(cb: (completed: number, failed: number, total: number) => void): void {
    this.onProgressCallback = cb;
  }

  enqueue(images: ExtractedImage[]): void {
    this.queue.push(...images);
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    if (this.isRunning) {
      this.processQueue();
    }
  }

  stop(): void {
    this.isRunning = false;
    this.queue = [];
  }

  async start(): Promise<ImageManifest> {
    this.isRunning = true;
    this.isPaused = false;

    await this.processQueue();

    const jobId = this.queue[0]?.jobId || 'default';
    return {
      jobId,
      generatedAt: Date.now(),
      totalImages: this.manifestEntries.length,
      downloadedImages: this.manifestEntries.filter((e) => e.status === 'completed').length,
      entries: this.manifestEntries,
    };
  }

  private async processQueue(): Promise<void> {
    const promises: Promise<void>[] = [];

    while (this.isRunning && !this.isPaused && this.queue.length > 0) {
      while (this.activeCount < this.concurrency && this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;

        this.activeCount++;
        const p = this.downloadItem(item).finally(() => {
          this.activeCount--;
          if (this.onProgressCallback) {
            const completed = this.manifestEntries.filter((e) => e.status === 'completed').length;
            const failed = this.manifestEntries.filter((e) => e.status === 'failed').length;
            this.onProgressCallback(completed, failed, this.manifestEntries.length + this.queue.length);
          }
        });
        promises.push(p);
      }

      if (promises.length > 0) {
        await Promise.race(promises);
      }
    }

    await Promise.all(promises);
  }

  private async downloadItem(item: ExtractedImage, attempt: number = 1): Promise<void> {
    try {
      const response = await fetch(item.resolvedUrl, {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      // Handle 429 Rate Limit with exponential backoff
      if (response.status === 429) {
        if (attempt <= 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
          const delay = Math.max(retryAfter * 1000, Math.pow(2, attempt) * 1000);
          await new Promise((r) => setTimeout(r, delay));
          return await this.downloadItem(item, attempt + 1);
        }
        throw new Error('HTTP 429: Rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // MIME verification
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error(`Invalid image MIME type received: ${contentType}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // SHA-256 Deduplication
      const hash = await computeSha256(arrayBuffer);
      if (this.seenHashes.has(hash)) {
        item.status = 'skipped';
        item.hashSha256 = hash;
        this.manifestEntries.push({
          recordId: item.recordId,
          sourceUrl: item.sourceUrl,
          localPath: 'skipped (duplicate)',
          width: item.width,
          height: item.height,
          hashSha256: hash,
          status: 'skipped',
        });
        return;
      }

      this.seenHashes.add(hash);

      // Save via Chrome Downloads API if available
      const cleanFileName = SecuritySanitizer.sanitizeFilename(item.fileName, `image_${Date.now()}.jpg`);
      const folder = item.recordId ? `hashira_images/${item.recordId}/` : 'hashira_images/';
      const targetPath = `${folder}${cleanFileName}`;

      if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        try {
          const objectUrl = URL.createObjectURL(blob);
          await chrome.downloads.download({
            url: objectUrl,
            filename: targetPath,
            saveAs: false,
          });
        } catch {
          // Chrome downloads limitation fallback
        }
      }

      item.status = 'completed';
      item.localPath = targetPath;
      item.hashSha256 = hash;
      item.fileSize = blob.size;
      item.mimeType = contentType || blob.type;

      if (item.id) {
        await StorageService.updateImage(item.id, {
          status: 'completed',
          localPath: targetPath,
          hashSha256: hash,
          fileSize: blob.size,
          mimeType: item.mimeType,
        });
      }

      this.manifestEntries.push({
        recordId: item.recordId,
        sourceUrl: item.sourceUrl,
        localPath: targetPath,
        width: item.width,
        height: item.height,
        hashSha256: hash,
        status: 'completed',
      });
    } catch (err: any) {
      if (attempt <= 2) {
        const backoff = Math.pow(2, attempt) * 800;
        await new Promise((r) => setTimeout(r, backoff));
        return await this.downloadItem(item, attempt + 1);
      }

      item.status = 'failed';
      item.error = err.message;
      if (item.id) {
        await StorageService.updateImage(item.id, { status: 'failed', error: err.message });
      }

      this.manifestEntries.push({
        recordId: item.recordId,
        sourceUrl: item.sourceUrl,
        localPath: '',
        hashSha256: '',
        status: 'failed',
      });
    }
  }
}
