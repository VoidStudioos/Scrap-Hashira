// Pagination Controller & Auto-Clicker Engine
// Handles: Next Button detection & clicking, Load More detection & clicking,
// Numbered pagination traversal, and infinite scrolling.

export interface PaginationInfo {
  type: 'next_button' | 'load_more' | 'numbered' | 'infinite_scroll' | 'none';
  selector?: string;
  targetElement?: HTMLElement | null;
  targetUrl?: string;
  hasMorePages: boolean;
}

export class PaginationController {
  private static readonly NEXT_TEXT_PATTERNS = [
    /^(بعدی|صفحه بعد|صفحه بعدی|گام بعد|بعد)$/i,
    /^(next|next page|›|»|>|>>|→|&gt;)$/i,
  ];

  private static readonly LOAD_MORE_PATTERNS = [
    /(مشاهده بیشتر|بارگذاری بیشتر|نمایش بیشتر|کالاهای بیشتر|محصولات بیشتر|موارد بیشتر)/i,
    /(load more|show more|view more|more products|more items)/i,
  ];

  /**
   * Detects pagination method and finds the clickable next / load more element
   */
  static detectPagination(doc: Document = document, currentUrl: string = window.location?.href || ''): PaginationInfo {
    // 1. Try finding explicit Next button
    const nextEl = this.findNextElement(doc, currentUrl);
    if (nextEl) {
      const url = nextEl.getAttribute('href') ? this.resolveUrl(nextEl.getAttribute('href')!, currentUrl) : undefined;
      return {
        type: 'next_button',
        targetElement: nextEl,
        targetUrl: url,
        hasMorePages: true,
      };
    }

    // 2. Try finding "Load More" / "مشاهده بیشتر" button
    const loadMoreEl = this.findLoadMoreElement(doc);
    if (loadMoreEl) {
      return {
        type: 'load_more',
        targetElement: loadMoreEl,
        hasMorePages: true,
      };
    }

    // 3. Try finding numbered pagination (active page's next sibling)
    const numberedEl = this.findNumberedNextElement(doc, currentUrl);
    if (numberedEl) {
      const url = numberedEl.getAttribute('href') ? this.resolveUrl(numberedEl.getAttribute('href')!, currentUrl) : undefined;
      return {
        type: 'numbered',
        targetElement: numberedEl,
        targetUrl: url,
        hasMorePages: true,
      };
    }

    return {
      type: 'none',
      hasMorePages: false,
    };
  }

  /**
   * Finds the "Next" button element using standard CSS & text matching
   */
  static findNextElement(doc: Document = document, currentUrl: string = ''): HTMLElement | null {
    // A. Explicit rel="next"
    const relNext = doc.querySelector('a[rel="next"], link[rel="next"]') as HTMLElement;
    if (relNext && !this.isDisabled(relNext)) return relNext;

    // B. Semantic selectors
    const candidateSelectors = [
      '[aria-label*="next" i]',
      '[aria-label*="بعد" i]',
      'a[class*="pagination-next" i]',
      'button[class*="pagination-next" i]',
      'a[class*="next-page" i]',
      'button[class*="next-page" i]',
      '.pagination .next a',
      '.pagination .next button',
      '.pagination li.next a',
      '.pager-next a',
      '.page-next a',
      'a.next',
      'button.next',
      '[data-testid*="pagination-next" i]',
      '[data-test*="pagination-next" i]',
    ];

    for (const sel of candidateSelectors) {
      try {
        const el = doc.querySelector(sel) as HTMLElement;
        if (el && !this.isDisabled(el)) {
          return el;
        }
      } catch {}
    }

    // C. Text-based search across all links and buttons
    const interactiveElements = Array.from(doc.querySelectorAll('a[href], button, [role="button"]')) as HTMLElement[];
    for (const el of interactiveElements) {
      if (this.isDisabled(el)) continue;

      const text = el.textContent?.trim() || '';
      const aria = el.getAttribute('aria-label')?.trim() || '';
      const title = el.getAttribute('title')?.trim() || '';

      const isMatch = this.NEXT_TEXT_PATTERNS.some(
        (rx) => rx.test(text) || rx.test(aria) || rx.test(title)
      );

      if (isMatch) {
        return el;
      }
    }

    return null;
  }

  /**
   * Finds the "Load More" / "مشاهده بیشتر" button element
   */
  static findLoadMoreElement(doc: Document = document): HTMLElement | null {
    // A. Class patterns
    const selectors = [
      'button[class*="load-more" i]',
      'a[class*="load-more" i]',
      'div[class*="load-more" i]',
      'button[class*="loadmore" i]',
      'a[class*="loadmore" i]',
      'button[class*="show-more" i]',
      'a[class*="show-more" i]',
      '[data-action*="load-more" i]',
      '.btn-load-more',
      '.loadMoreBtn',
    ];

    for (const sel of selectors) {
      try {
        const el = doc.querySelector(sel) as HTMLElement;
        if (el && !this.isDisabled(el)) return el;
      } catch {}
    }

    // B. Text matching
    const buttons = Array.from(doc.querySelectorAll('button, a, [role="button"]')) as HTMLElement[];
    for (const b of buttons) {
      if (this.isDisabled(b)) continue;
      const text = b.textContent?.trim() || '';
      const isMatch = this.LOAD_MORE_PATTERNS.some((rx) => rx.test(text));
      if (isMatch) return b;
    }

    return null;
  }

  /**
   * Finds the next numbered pagination link (e.g. active is 1 -> returns link for 2)
   */
  static findNumberedNextElement(doc: Document = document, currentUrl: string = ''): HTMLElement | null {
    const activeIndicators = [
      '.pagination .active',
      '.pagination li.active',
      '.pager .current',
      '[aria-current="page"]',
      '.pagination-item--active',
      '.page-item.active',
    ];

    for (const sel of activeIndicators) {
      const activeEl = doc.querySelector(sel);
      if (!activeEl) continue;

      // Look at sibling item
      const nextSibling = activeEl.nextElementSibling;
      if (nextSibling) {
        const link = (nextSibling.tagName === 'A' ? nextSibling : nextSibling.querySelector('a, button')) as HTMLElement;
        if (link && !this.isDisabled(link)) {
          return link;
        }
      }
    }

    return null;
  }

  /**
   * Dispatches trusted mouse click events to simulate real user click
   */
  static clickElement(el: HTMLElement): boolean {
    if (!el || this.isDisabled(el)) return false;

    try {
      // 1. Scroll into view so viewport triggers event listeners correctly
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 2. Dispatch sequence of events
      const mouseOver = new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window });
      const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
      const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });

      el.dispatchEvent(mouseOver);
      el.dispatchEvent(mouseDown);
      el.dispatchEvent(mouseUp);

      // 3. Native click
      el.click();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Determines whether an element is disabled or has disabled styling
   */
  static isDisabled(el: HTMLElement): boolean {
    if ((el as any).disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;

    const classStr = typeof el.className === 'string' ? el.className.toLowerCase() : '';
    if (classStr.includes('disabled') || classStr.includes('inactive')) return true;

    return false;
  }

  private static resolveUrl(href: string, base: string): string {
    try {
      return new URL(href, base || (typeof window !== 'undefined' ? window.location?.href : 'http://localhost')).href;
    } catch {
      return href;
    }
  }
}
