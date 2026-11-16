// Hashira Scraper Content Script Coordinator
import { AutoDetector } from '../engines/detection/autoDetector';
import { SiteExplorer } from '../engines/explorer/siteExplorer';
import { ImageDiscovery } from '../engines/images/imageDiscovery';
import { VisualElementSelector } from './visualSelector';
import { LearningEngine } from '../engines/learning/learningEngine';
import { DataNormalizer } from '../engines/normalization/dataNormalizer';
import { PaginationController } from '../engines/crawler/paginationController';

let activeSelector: VisualElementSelector | null = null;

// Message dispatcher listening for commands from SidePanel, Popup, or Background
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { action, payload } = message;

    switch (action) {
      case 'PING': {
        sendResponse({ success: true, timestamp: Date.now() });
        return;
      }

      case 'DETECT_PAGE_DATA': {
        const detection = AutoDetector.detect(document, window.location.href);
        sendResponse({ success: true, data: detection });
        return;
      }

      case 'EXPLORE_SITE': {
        const siteTree = SiteExplorer.explorePage(document, window.location.href, payload);
        sendResponse({ success: true, data: siteTree });
        return;
      }

      case 'DISCOVER_IMAGES': {
        const images = ImageDiscovery.discoverImages(document, payload?.jobId || '', window.location.href);
        sendResponse({ success: true, data: images });
        return;
      }

      case 'START_VISUAL_SELECTOR': {
        if (activeSelector) {
          activeSelector.deactivate();
        }
        activeSelector = new VisualElementSelector({
          onElementSelected: (data) => {
            chrome.runtime.sendMessage({ action: 'VISUAL_ELEMENT_SELECTED', payload: data }, () => {
              void chrome.runtime.lastError;
            });
          },
          onClosed: () => {
            chrome.runtime.sendMessage({ action: 'VISUAL_SELECTOR_CLOSED' }, () => {
              void chrome.runtime.lastError;
            });
          },
        });
        activeSelector.activate();
        sendResponse({ success: true, message: 'Visual selector activated' });
        return;
      }

      case 'STOP_VISUAL_SELECTOR': {
        if (activeSelector) {
          activeSelector.deactivate();
          activeSelector = null;
        }
        sendResponse({ success: true, message: 'Visual selector deactivated' });
        return;
      }

      case 'UPDATE_SELECTOR_HIGHLIGHT': {
        if (activeSelector && payload?.selector) {
          const res = activeSelector.highlightBySelector(payload.selector);
          sendResponse({ success: true, count: res.count, items: res.items });
          return;
        }
        sendResponse({ success: false });
        return;
      }

      case 'EXTRACT_BY_RULES': {
        const { recordSelector, fieldSelectors, jobId } = payload;
        const records = extractRecordsFromDom(recordSelector, fieldSelectors, jobId || '');
        sendResponse({ success: true, data: records });
        return;
      }

      case 'TRIGGER_SCROLL': {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        setTimeout(() => {
          sendResponse({ success: true, height: document.body.scrollHeight });
        }, 800);
        return true;
      }

      case 'DETECT_PAGINATION': {
        const info = PaginationController.detectPagination(document, window.location.href);
        sendResponse({
          success: true,
          data: {
            type: info.type,
            hasMorePages: info.hasMorePages,
            targetUrl: info.targetUrl,
          },
        });
        return;
      }

      case 'CLICK_NEXT_PAGE': {
        const info = PaginationController.detectPagination(document, window.location.href);
        if (!info.targetElement) {
          sendResponse({ success: false, error: 'NO_NEXT_BUTTON' });
          return;
        }
        const clicked = PaginationController.clickElement(info.targetElement);
        sendResponse({
          success: clicked,
          type: info.type,
          targetUrl: info.targetUrl,
        });
        return;
      }

      case 'AUTO_EXTRACT_AND_PAGINATE': {
        const { recordSelector, fieldSelectors, jobId, maxPages = 5, pageDelayMs = 1500 } = payload;
        (async () => {
          let currentPage = 1;
          const allRecords: any[] = [];
          const seenFingerprints = new Set<string>();

          while (currentPage <= maxPages) {
            // 1. Extract records on current view
            const currentBatch = extractRecordsFromDom(recordSelector, fieldSelectors, jobId || '');
            const pageFingerprint = currentBatch.map((r) => r.title).join('|');

            if (pageFingerprint && !seenFingerprints.has(pageFingerprint)) {
              seenFingerprints.add(pageFingerprint);
              allRecords.push(...currentBatch);
            }

            if (currentPage >= maxPages) break;

            // 2. Detect next page element
            const pagination = PaginationController.detectPagination(document, window.location.href);
            if (!pagination.hasMorePages || !pagination.targetElement) {
              break;
            }

            // 3. Click next element
            const prevCount = document.querySelectorAll(recordSelector).length;
            const prevUrl = window.location.href;
            const clicked = PaginationController.clickElement(pagination.targetElement);
            if (!clicked) break;

            // 4. Wait for page load / DOM change
            await new Promise((r) => setTimeout(r, pageDelayMs));

            // If URL changed, browser navigated to another page
            if (window.location.href !== prevUrl) {
              break;
            }

            // If load more / ajax, check if new items appeared
            const newCount = document.querySelectorAll(recordSelector).length;
            if (pagination.type === 'load_more' && newCount <= prevCount) {
              break;
            }

            currentPage++;
          }

          sendResponse({ success: true, data: allRecords, pagesProcessed: currentPage });
        })();
        return true;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
        return;
    }
  });
}

function extractRecordsFromDom(recordSelector: string, fieldSelectors: any[], jobId: string) {
  const elements = Array.from(document.querySelectorAll(recordSelector));
  const results: any[] = [];

  elements.forEach((el, idx) => {
    const rawData: Record<string, any> = {};

    for (const rule of fieldSelectors) {
      rawData[rule.field] = LearningEngine.extractFieldValue(el, rule);
    }

    const norm = DataNormalizer.normalizeRecord(rawData);
    results.push({
      jobId,
      recordIndex: idx,
      sourceUrl: window.location.href,
      title: rawData.product_name || rawData.title || `Record #${idx + 1}`,
      data: rawData,
      normalizedData: norm.normalized,
      images: [],
      confidence: norm.completenessScore / 100,
      extractedAt: Date.now(),
    });
  });

  return results;
}
