// Advanced Image Discovery Engine
import type { ExtractedImage } from '../../types';

export class ImageDiscovery {
  /**
   * Scans a DOM document or element and discovers all images with highest resolution candidates
   */
  static discoverImages(root: Document | Element = document, jobId: string = '', baseUrl: string = window.location.href): ExtractedImage[] {
    const images: ExtractedImage[] = [];
    const seenUrls = new Set<string>();

    // 1. Scan <img> elements
    const imgElements = Array.from(root.querySelectorAll('img'));
    for (const img of imgElements) {
      const candidates = this.extractCandidatesFromImg(img, baseUrl);
      const bestCandidate = this.selectBestCandidate(candidates);

      if (bestCandidate && !seenUrls.has(bestCandidate.url)) {
        seenUrls.add(bestCandidate.url);
        const classification = this.classifyImage(img, bestCandidate);
        images.push({
          jobId,
          sourceUrl: bestCandidate.url,
          resolvedUrl: bestCandidate.url,
          fileName: this.deriveFileName(bestCandidate.url, classification.type, images.length + 1),
          width: bestCandidate.width || img.naturalWidth || (img as any).width || undefined,
          height: bestCandidate.height || img.naturalHeight || (img as any).height || undefined,
          classification: classification.type,
          confidence: classification.confidence,
          status: 'discovered',
          downloadAttempts: 0,
        });
      }
    }

    // 2. Scan <picture> elements
    const pictureElements = Array.from(root.querySelectorAll('picture'));
    for (const pic of pictureElements) {
      const sources = Array.from(pic.querySelectorAll('source'));
      for (const src of sources) {
        const srcset = src.getAttribute('srcset');
        if (srcset) {
          const parsed = this.parseSrcset(srcset, baseUrl);
          const best = this.selectBestCandidate(parsed);
          if (best && !seenUrls.has(best.url)) {
            seenUrls.add(best.url);
            images.push({
              jobId,
              sourceUrl: best.url,
              resolvedUrl: best.url,
              fileName: this.deriveFileName(best.url, 'product', images.length + 1),
              width: best.width,
              height: best.height,
              classification: 'product',
              confidence: 0.9,
              status: 'discovered',
              downloadAttempts: 0,
            });
          }
        }
      }
    }

    // 3. Scan elements with background-image style
    const bgElements = Array.from(root.querySelectorAll('[style*="background"]'));
    for (const el of bgElements) {
      const style = el.getAttribute('style') || '';
      const match = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
      if (match && match[1]) {
        try {
          const fullUrl = new URL(match[1], baseUrl).href;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            images.push({
              jobId,
              sourceUrl: fullUrl,
              resolvedUrl: fullUrl,
              fileName: this.deriveFileName(fullUrl, 'banner', images.length + 1),
              classification: 'banner',
              confidence: 0.75,
              status: 'discovered',
              downloadAttempts: 0,
            });
          }
        } catch {
          // Ignore URL resolution error
        }
      }
    }

    // 4. OpenGraph and JSON-LD images
    if (root instanceof Document) {
      const ogImg = root.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImg) {
        try {
          const fullUrl = new URL(ogImg, baseUrl).href;
          if (!seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            images.push({
              jobId,
              sourceUrl: fullUrl,
              resolvedUrl: fullUrl,
              fileName: this.deriveFileName(fullUrl, 'product', images.length + 1),
              classification: 'product',
              confidence: 0.88,
              status: 'discovered',
              downloadAttempts: 0,
            });
          }
        } catch {}
      }
    }

    return images;
  }

  private static extractCandidatesFromImg(img: HTMLImageElement, baseUrl: string): { url: string; width?: number; height?: number }[] {
    const candidates: { url: string; width?: number; height?: number }[] = [];

    // 1. Parse Srcset with explicit width descriptors
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      candidates.push(...this.parseSrcset(srcset, baseUrl));
    }

    // 2. High-priority zoom/data attributes
    for (const attr of ['data-zoom-image', 'data-large', 'data-highres', 'data-original', 'data-src', 'data-lazy-src']) {
      const val = img.getAttribute(attr);
      if (val && !val.startsWith('data:image/svg+xml;base64')) {
        try {
          candidates.push({ url: new URL(val, baseUrl).href, width: 1200, height: 1200 });
        } catch {}
      }
    }

    // Standard src / currentSrc
    const src = img.getAttribute('src') || (img as any).currentSrc;
    if (src && !src.startsWith('data:image/svg+xml;base64')) {
      try {
        candidates.push({
          url: new URL(src, baseUrl).href,
          width: img.naturalWidth || (img as any).width || undefined,
          height: img.naturalHeight || (img as any).height || undefined,
        });
      } catch {}
    }

    return candidates;
  }

  private static parseSrcset(srcset: string, baseUrl: string): { url: string; width?: number; height?: number }[] {
    const list: { url: string; width?: number; height?: number }[] = [];
    const entries = srcset.split(',');

    for (const entry of entries) {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) continue;

      try {
        const fullUrl = new URL(parts[0], baseUrl).href;
        let width: number | undefined;

        if (parts[1]) {
          if (parts[1].endsWith('w')) {
            width = parseInt(parts[1].replace('w', ''), 10);
          } else if (parts[1].endsWith('x')) {
            const density = parseFloat(parts[1].replace('x', ''));
            width = Math.round(density * 800);
          }
        }

        list.push({ url: fullUrl, width });
      } catch {}
    }

    return list;
  }

  private static selectBestCandidate(candidates: { url: string; width?: number; height?: number }[]): { url: string; width?: number; height?: number } | null {
    if (candidates.length === 0) return null;
    // Prefer highest width descriptor
    return candidates.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  }

  private static classifyImage(img: HTMLImageElement, candidate: { url: string; width?: number; height?: number }): {
    type: ExtractedImage['classification'];
    confidence: number;
  } {
    const lower = candidate.url.toLowerCase();
    const className = (img.className || '').toLowerCase();
    const alt = (img.getAttribute('alt') || '').toLowerCase();

    // Check for logo
    if (lower.includes('logo') || className.includes('logo') || alt.includes('logo')) {
      return { type: 'logo', confidence: 0.9 };
    }

    // Check for icon
    if (lower.includes('icon') || className.includes('icon') || (candidate.width && candidate.width <= 48)) {
      return { type: 'icon', confidence: 0.88 };
    }

    // Check for thumbnail
    if (lower.includes('thumb') || className.includes('thumb') || (candidate.width && candidate.width < 150)) {
      return { type: 'thumbnail', confidence: 0.85 };
    }

    // Check for banner
    if (lower.includes('banner') || className.includes('banner') || (candidate.width && candidate.width > 1200 && (!candidate.height || candidate.height < 400))) {
      return { type: 'banner', confidence: 0.8 };
    }

    // Check for product
    if (
      lower.includes('product') ||
      className.includes('product') ||
      className.includes('gallery') ||
      img.closest('[class*="product"], [class*="gallery"], [class*="item"]')
    ) {
      return { type: 'product', confidence: 0.95 };
    }

    return { type: 'product', confidence: 0.7 };
  }

  private static deriveFileName(url: string, classification: string, index: number): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const basename = pathname.substring(pathname.lastIndexOf('/') + 1);
      const extMatch = basename.match(/\.(jpe?g|png|webp|avif|gif|svg|bmp)(\?.*)?$/i);
      const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';

      return `${classification.toUpperCase()}_${String(index).padStart(4, '0')}${ext}`;
    } catch {
      return `IMG_${String(index).padStart(4, '0')}.jpg`;
    }
  }
}
