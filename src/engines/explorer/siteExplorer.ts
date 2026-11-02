// Smart Site Explorer: Navigable Site Map & URL Classification
import type { DiscoveredUrlNode } from '../../types';

export interface ExplorerConfig {
  maxDepth: number;
  maxPages: number;
  includePatterns: string[];
  excludePatterns: string[];
  stayOnDomain: boolean;
}

export class SiteExplorer {
  /**
   * Explores current document DOM and builds a classified hierarchical URL tree
   */
  static explorePage(doc: Document = document, currentUrl: string = window.location.href, config: Partial<ExplorerConfig> = {}): DiscoveredUrlNode {
    const baseUri = new URL(currentUrl);
    const domain = baseUri.hostname;

    const rootNode: DiscoveredUrlNode = {
      url: currentUrl,
      label: doc.title || domain,
      type: 'internal',
      depth: 0,
      selected: true,
      children: [],
    };

    const linkElements = Array.from(doc.querySelectorAll('a[href]'));
    const discoveredUrls = new Map<string, DiscoveredUrlNode>();

    for (const link of linkElements) {
      const rawHref = link.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(rawHref, currentUrl).href;
      } catch {
        continue;
      }

      const linkUrl = new URL(absoluteUrl);
      const isInternal = linkUrl.hostname === domain;

      if (config.stayOnDomain && !isInternal) continue;

      // Inclusion / exclusion filtering
      if (config.excludePatterns && config.excludePatterns.some((pat) => absoluteUrl.includes(pat))) {
        continue;
      }
      if (config.includePatterns && config.includePatterns.length > 0) {
        if (!config.includePatterns.some((pat) => absoluteUrl.includes(pat))) continue;
      }

      if (discoveredUrls.has(absoluteUrl)) continue;

      const label = link.textContent?.trim() || link.getAttribute('title') || linkUrl.pathname;
      const type = this.classifyUrl(absoluteUrl, link, isInternal);

      const node: DiscoveredUrlNode = {
        url: absoluteUrl,
        label: label.substring(0, 80),
        type,
        depth: 1,
        selected: true,
      };

      discoveredUrls.set(absoluteUrl, node);
      if (discoveredUrls.size >= (config.maxPages || 200)) break;
    }

    // Organize into categorized groups
    const categories: DiscoveredUrlNode = {
      url: `${currentUrl}#categories`,
      label: 'Categories & Navigation',
      type: 'category',
      depth: 1,
      selected: true,
      children: [],
    };

    const listings: DiscoveredUrlNode = {
      url: `${currentUrl}#listings`,
      label: 'Catalogs & Listings',
      type: 'listing',
      depth: 1,
      selected: true,
      children: [],
    };

    const details: DiscoveredUrlNode = {
      url: `${currentUrl}#details`,
      label: 'Product Detail Pages',
      type: 'detail',
      depth: 1,
      selected: true,
      children: [],
    };

    const documents: DiscoveredUrlNode = {
      url: `${currentUrl}#documents`,
      label: 'Documents & Files',
      type: 'document',
      depth: 1,
      selected: false,
      children: [],
    };

    const otherLinks: DiscoveredUrlNode = {
      url: `${currentUrl}#other`,
      label: 'Other Internal Pages',
      type: 'internal',
      depth: 1,
      selected: false,
      children: [],
    };

    for (const node of discoveredUrls.values()) {
      if (node.type === 'category' || node.type === 'subcategory') {
        categories.children!.push(node);
      } else if (node.type === 'listing' || node.type === 'pagination') {
        listings.children!.push(node);
      } else if (node.type === 'detail') {
        details.children!.push(node);
      } else if (node.type === 'document') {
        documents.children!.push(node);
      } else {
        otherLinks.children!.push(node);
      }
    }

    if (categories.children!.length > 0) rootNode.children!.push(categories);
    if (listings.children!.length > 0) rootNode.children!.push(listings);
    if (details.children!.length > 0) rootNode.children!.push(details);
    if (documents.children!.length > 0) rootNode.children!.push(documents);
    if (otherLinks.children!.length > 0) rootNode.children!.push(otherLinks);

    return rootNode;
  }

  /**
   * Classifies URL based on URL patterns, element location, and MIME/extensions
   */
  static classifyUrl(url: string, el: Element, isInternal: boolean): DiscoveredUrlNode['type'] {
    if (!isInternal) return 'external';

    const lower = url.toLowerCase();

    // Document links
    if (/\.(pdf|docx?|xlsx?|csv|zip|rar|txt)(\?.*)?$/i.test(lower)) {
      return 'document';
    }

    // Pagination
    if (/page[=/]\d+|\bp=\d+|\bpg=\d+/i.test(lower) || el.getAttribute('rel') === 'next') {
      return 'pagination';
    }

    // Check if located in navigation menus
    const isInNav = Boolean(el.closest('nav, [role="navigation"], header, [class*="menu"], [class*="nav"]'));
    if (isInNav) {
      if (/category|cat|group|دسته/i.test(lower)) {
        return 'category';
      }
      return 'subcategory';
    }

    // Product detail page patterns
    if (
      /\/product\/|\/item\/|\/p\/|\/goods\/|\/dp\/|[?&]id=\d+|[?&]pid=\d+/i.test(lower) ||
      /\bproduct-\d+\b|\bp-\d+\b/i.test(lower)
    ) {
      return 'detail';
    }

    // Listing / catalog patterns
    if (/shop|catalog|category|collection|search|محصولات|فروشگاه/i.test(lower)) {
      return 'listing';
    }

    return 'internal';
  }

  /**
   * Flatten selected nodes into a list of URLs to scrape
   */
  static getSelectedUrls(node: DiscoveredUrlNode): string[] {
    const urls: string[] = [];

    function traverse(curr: DiscoveredUrlNode) {
      if (curr.selected && !curr.url.includes('#') && curr.type !== 'document' && curr.type !== 'external') {
        urls.push(curr.url);
      }
      if (curr.children) {
        for (const child of curr.children) {
          traverse(child);
        }
      }
    }

    traverse(node);
    return Array.from(new Set(urls));
  }
}
