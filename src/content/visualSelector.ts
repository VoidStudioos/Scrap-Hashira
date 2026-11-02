// Interactive Visual Element Selector Overlay
import { LearningEngine } from '../engines/learning/learningEngine';

export interface ExtractedVisualItem {
  index: number;
  value: string;
  tag: string;
  isImage: boolean;
  imageUrl?: string;
  linkUrl?: string;
}

export interface VisualSelectorConfig {
  onElementSelected: (data: {
    cssSelector: string;
    exactSelector: string;
    repeatedSelector: string;
    repeatedMatchCount?: number;
    xpath: string;
    text: string;
    html: string;
    matchCount: number;
    sampleValues: string[];
    allExtractedItems: ExtractedVisualItem[];
  }) => void;
  onClosed: () => void;
}

export class VisualElementSelector {
  private highlightOverlay: HTMLDivElement | null = null;
  private infoBadge: HTMLDivElement | null = null;
  private floatingBanner: HTMLDivElement | null = null;
  private matchesOverlay: HTMLDivElement[] = [];
  private currentHoverTarget: HTMLElement | null = null;
  private isActive: boolean = false;
  private config: VisualSelectorConfig;

  constructor(config: VisualSelectorConfig) {
    this.config = config;
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    // Change cursor to indicate active selection mode
    try {
      document.body.style.cursor = 'crosshair';
    } catch {}

    // Create top floating indicator banner
    this.floatingBanner = document.createElement('div');
    this.floatingBanner.id = 'hashira-active-banner';
    this.floatingBanner.style.position = 'fixed';
    this.floatingBanner.style.top = '12px';
    this.floatingBanner.style.left = '50%';
    this.floatingBanner.style.transform = 'translateX(-50%)';
    this.floatingBanner.style.zIndex = '2147483647';
    this.floatingBanner.style.backgroundColor = '#042f2e';
    this.floatingBanner.style.color = '#5eead4';
    this.floatingBanner.style.border = '2px solid #14b8a6';
    this.floatingBanner.style.borderRadius = '30px';
    this.floatingBanner.style.padding = '8px 18px';
    this.floatingBanner.style.fontSize = '13px';
    this.floatingBanner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    this.floatingBanner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
    this.floatingBanner.style.display = 'flex';
    this.floatingBanner.style.alignItems = 'center';
    this.floatingBanner.style.gap = '12px';
    this.floatingBanner.style.userSelect = 'none';

    this.floatingBanner.innerHTML = `
      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 8px #2dd4bf;"></span>
      <span style="font-weight:700;letter-spacing:-0.2px;">🎯 Hashira Selector Active — Click any item on this page</span>
      <button id="hashira-banner-exit" style="background:#134e4a;color:#ccfbf1;border:1px solid #14b8a6;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:bold;cursor:pointer;">ESC / Close</button>
    `;
    document.body.appendChild(this.floatingBanner);

    const closeBtn = this.floatingBanner.querySelector('#hashira-banner-exit');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deactivate();
      });
    }

    // Create highlight overlay
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'hashira-selector-highlight';
    this.highlightOverlay.style.position = 'fixed';
    this.highlightOverlay.style.pointerEvents = 'none';
    this.highlightOverlay.style.zIndex = '2147483640';
    this.highlightOverlay.style.border = '2px solid #0d9488';
    this.highlightOverlay.style.backgroundColor = 'rgba(13, 148, 136, 0.2)';
    this.highlightOverlay.style.transition = 'all 0.05s ease';
    this.highlightOverlay.style.display = 'none';
    document.body.appendChild(this.highlightOverlay);

    // Create info badge
    this.infoBadge = document.createElement('div');
    this.infoBadge.id = 'hashira-selector-badge';
    this.infoBadge.style.position = 'fixed';
    this.infoBadge.style.zIndex = '2147483645';
    this.infoBadge.style.padding = '4px 8px';
    this.infoBadge.style.fontSize = '12px';
    this.infoBadge.style.fontFamily = 'monospace';
    this.infoBadge.style.color = '#ffffff';
    this.infoBadge.style.backgroundColor = '#115e59';
    this.infoBadge.style.borderRadius = '4px';
    this.infoBadge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    this.infoBadge.style.pointerEvents = 'none';
    this.infoBadge.style.display = 'none';
    document.body.appendChild(this.infoBadge);

    // Event listeners
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;

    try {
      document.body.style.cursor = '';
    } catch {}

    if (this.floatingBanner) {
      this.floatingBanner.remove();
      this.floatingBanner = null;
    }

    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
    if (this.infoBadge) {
      this.infoBadge.remove();
      this.infoBadge = null;
    }
    this.clearMatches();

    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);

    this.config.onClosed();
  }

  private handleMouseMove(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target || target.id?.startsWith('hashira-')) return;

    this.currentHoverTarget = target;
    const rect = target.getBoundingClientRect();

    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.top = `${rect.top}px`;
      this.highlightOverlay.style.left = `${rect.left}px`;
      this.highlightOverlay.style.width = `${rect.width}px`;
      this.highlightOverlay.style.height = `${rect.height}px`;
    }

    if (this.infoBadge) {
      this.infoBadge.style.display = 'block';
      this.infoBadge.style.top = `${Math.max(4, rect.top - 28)}px`;
      this.infoBadge.style.left = `${Math.max(4, rect.left)}px`;
      const tag = target.tagName.toLowerCase();
      const cls = typeof target.className === 'string' && target.className.trim() ? `.${target.className.trim().split(/\s+/)[0]}` : '';
      this.infoBadge.textContent = `<${tag}${cls}> (${Math.round(rect.width)}x${Math.round(rect.height)})`;
    }
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target || target.id?.startsWith('hashira-')) return;

    e.preventDefault();
    e.stopPropagation();

    const resilient = LearningEngine.createResilientSelector(target);
    const cssSelector = resilient.cssSelector;
    const xpath = resilient.xpathFallback;

    // Discover repeated sibling elements with same selector
    let matchedElements: HTMLElement[] = [];
    try {
      matchedElements = Array.from(document.querySelectorAll(cssSelector)) as HTMLElement[];
    } catch {
      matchedElements = [target];
    }

    this.highlightAllMatches(matchedElements);

    const allExtractedItems = this.extractItemsFromElements(matchedElements);

    this.config.onElementSelected({
      cssSelector,
      exactSelector: resilient.exactSelector,
      repeatedSelector: resilient.repeatedSelector,
      repeatedMatchCount: resilient.repeatedMatchCount,
      xpath,
      text: LearningEngine.getElementValue(target),
      html: target.outerHTML,
      matchCount: matchedElements.length,
      sampleValues: allExtractedItems.slice(0, 5).map((i) => i.value),
      allExtractedItems,
    });
  }

  highlightBySelector(selector: string): { count: number; items: ExtractedVisualItem[] } {
    try {
      const matched = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      this.highlightAllMatches(matched);
      const items = this.extractItemsFromElements(matched);
      return { count: matched.length, items };
    } catch {
      return { count: 0, items: [] };
    }
  }

  private extractItemsFromElements(elements: HTMLElement[]): ExtractedVisualItem[] {
    return elements.map((el, idx) => {
      const tag = el.tagName.toLowerCase();
      const isImg = tag === 'img' || Boolean(el.querySelector('img'));
      const val = LearningEngine.getElementValue(el);
      const imgEl = tag === 'img' ? (el as HTMLImageElement) : el.querySelector('img');
      const anchorEl = tag === 'a' ? (el as HTMLAnchorElement) : el.querySelector('a');

      return {
        index: idx + 1,
        value: val,
        tag,
        isImage: isImg,
        imageUrl: imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : undefined,
        linkUrl: anchorEl ? (anchorEl.href || anchorEl.getAttribute('href') || '') : undefined,
      };
    });
  }

  private highlightAllMatches(elements: HTMLElement[]): void {
    this.clearMatches();

    elements.slice(0, 100).forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'hashira-match-marker';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483639';
      overlay.style.border = '2px dashed #f59e0b';
      overlay.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      document.body.appendChild(overlay);
      this.matchesOverlay.push(overlay);
    });
  }

  private clearMatches(): void {
    this.matchesOverlay.forEach((el) => el.remove());
    this.matchesOverlay = [];
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.deactivate();
    }
  }
}
