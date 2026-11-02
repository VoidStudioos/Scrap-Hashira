// Complete Page Capture Engine: Rendered HTML, Visible Text, Tables, Metadata, and Structured Relationships
import { StorageService } from '../../storage/storageService';
import { AutoDetector } from '../detection/autoDetector';
import { ImageDiscovery } from '../images/imageDiscovery';
import type { PageSnapshot } from '../../storage/db';

export interface FullCaptureResult {
  snapshot: PageSnapshot;
  products: any[];
  tables: any[];
  images: any[];
  metadata: Record<string, any>;
}

export class FullCaptureEngine {
  /**
   * Captures the full page state from the active DOM document
   */
  static async captureCurrentPage(jobId: string, doc: Document = document, currentUrl: string = window.location.href): Promise<FullCaptureResult> {
    // 1. Metadata
    const metadata = this.extractMetadata(doc, currentUrl);

    // 2. Rendered HTML and visible text
    const renderedHtml = doc.documentElement.outerHTML;
    const visibleText = doc.body.innerText || doc.body.textContent || '';

    // 3. Auto detect products and structured schemas
    const detection = AutoDetector.detect(doc, currentUrl);
    const topSchema = detection.schemas[0];
    const products = topSchema?.previewRecords || [];

    // 4. Tables
    const tables = detection.tables;

    // 5. Images
    const images = ImageDiscovery.discoverImages(doc, jobId, currentUrl);

    // 6. Save snapshot in database
    const snapshot: PageSnapshot = {
      jobId,
      url: currentUrl,
      title: doc.title || metadata.title || 'Untitled Snapshot',
      htmlContent: renderedHtml,
      textContent: visibleText,
      metadata: {
        ...metadata,
        jsonLd: detection.jsonLdData,
        capturedAt: Date.now(),
      },
      capturedAt: Date.now(),
    };

    await StorageService.saveSnapshot(snapshot);
    await StorageService.log(jobId, 'info', `Full page snapshot captured for ${currentUrl}`);

    return {
      snapshot,
      products,
      tables,
      images,
      metadata,
    };
  }

  private static extractMetadata(doc: Document, currentUrl: string): Record<string, any> {
    const metaTags = Array.from(doc.querySelectorAll('meta'));
    const meta: Record<string, any> = {
      title: doc.title || '',
      url: currentUrl,
      canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || currentUrl,
    };

    metaTags.forEach((tag) => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });

    return meta;
  }
}
