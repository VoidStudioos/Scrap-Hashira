// Interactive Visual Element Selector Overlay
import { LearningEngine } from '../engines/learning/learningEngine';

export interface VisualSelectorConfig {
  onElementSelected: (data: {
    cssSelector: string;
    exactSelector: string;
    repeatedSelector: string;
    xpath: string;
    text: string;
    html: string;
    matchCount: number;
    sampleValues: string[];
  }) => void;
  onClosed: () => void;
}

export class VisualElementSelector {
  private highlightOverlay: HTMLDivElement | null = null;
  private infoBadge: HTMLDivElement | null = null;
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

    const sampleValues = matchedElements.slice(0, 5).map((el) => {
      if (el instanceof HTMLImageElement) return el.src || el.getAttribute('data-src') || '';
      return el.textContent?.trim() || '';
    });

    this.config.onElementSelected({
      cssSelector,
      exactSelector: resilient.exactSelector,
      repeatedSelector: resilient.repeatedSelector,
      xpath,
      text: target.textContent?.trim() || (target instanceof HTMLImageElement ? target.src : ''),
      html: target.outerHTML,
      matchCount: matchedElements.length,
      sampleValues,
    });
  }

  highlightBySelector(selector: string): number {
    try {
      const matched = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      this.highlightAllMatches(matched);
      return matched.length;
    } catch {
      return 0;
    }
  }

  private highlightAllMatches(elements: HTMLElement[]): void {
    this.clearMatches();

    elements.slice(0, 50).forEach((el) => {
      const rect = el.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'hashira-match-marker';
      overlay.style.position = 'fixed';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483639';
      overlay.style.border = '2px dashed #f59e0b';
      overlay.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
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
