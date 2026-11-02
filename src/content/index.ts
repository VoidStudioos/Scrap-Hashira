// Hashira Scraper Content Script Coordinator
import { AutoDetector } from '../engines/detection/autoDetector';
import { SiteExplorer } from '../engines/explorer/siteExplorer';
import { ImageDiscovery } from '../engines/images/imageDiscovery';
import { VisualElementSelector } from './visualSelector';
import { LearningEngine } from '../engines/learning/learningEngine';
import { DataNormalizer } from '../engines/normalization/dataNormalizer';

let activeSelector: VisualElementSelector | null = null;

// Message dispatcher listening for commands from SidePanel, Popup, or Background
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { action, payload } = message;

    switch (action) {
      case 'DETECT_PAGE_DATA': {
        const detection = AutoDetector.detect(document, window.location.href);
        sendResponse({ success: true, data: detection });
        return true;
      }

      case 'EXPLORE_SITE': {
        const siteTree = SiteExplorer.explorePage(document, window.location.href, payload);
        sendResponse({ success: true, data: siteTree });
        return true;
      }

      case 'DISCOVER_IMAGES': {
        const images = ImageDiscovery.discoverImages(document, payload?.jobId || '', window.location.href);
        sendResponse({ success: true, data: images });
        return true;
      }

      case 'START_VISUAL_SELECTOR': {
        if (activeSelector) {
          activeSelector.deactivate();
        }
        activeSelector = new VisualElementSelector({
          onElementSelected: (data) => {
            chrome.runtime.sendMessage({ action: 'VISUAL_ELEMENT_SELECTED', payload: data });
          },
          onClosed: () => {
            chrome.runtime.sendMessage({ action: 'VISUAL_SELECTOR_CLOSED' });
          },
        });
        activeSelector.activate();
        sendResponse({ success: true, message: 'Visual selector activated' });
        return true;
      }

      case 'STOP_VISUAL_SELECTOR': {
        if (activeSelector) {
          activeSelector.deactivate();
          activeSelector = null;
        }
        sendResponse({ success: true, message: 'Visual selector deactivated' });
        return true;
      }

      case 'UPDATE_SELECTOR_HIGHLIGHT': {
        if (activeSelector && payload?.selector) {
          const count = activeSelector.highlightBySelector(payload.selector);
          sendResponse({ success: true, count });
          return true;
        }
        sendResponse({ success: false });
        return false;
      }

      case 'EXTRACT_BY_RULES': {
        const { recordSelector, fieldSelectors, jobId } = payload;
        const records = extractRecordsFromDom(recordSelector, fieldSelectors, jobId || '');
        sendResponse({ success: true, data: records });
        return true;
      }

      case 'TRIGGER_SCROLL': {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        setTimeout(() => {
          sendResponse({ success: true, height: document.body.scrollHeight });
        }, 800);
        return true;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
        return false;
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
