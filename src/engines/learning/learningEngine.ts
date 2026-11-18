// Smart Learning Engine: Persistent Site Profiles & Selector Resilience
import type { SiteProfile, SelectorRule } from '../../types';
import { DataNormalizer } from '../normalization/dataNormalizer';

export interface ProfileValidationResult {
  profile: SiteProfile;
  isValid: boolean;
  matchedRecordsCount: number;
  fieldMatchRates: Record<string, number>;
  confidenceScore: number;
  structuralChangeDetected: boolean;
}

export interface ResilientSelectorResult {
  cssSelector: string;
  exactSelector: string;
  repeatedSelector: string;
  xpathFallback: string;
  semanticTag: string;
  repeatedMatchCount: number;
}

export class LearningEngine {
  /**
   * Generates a structural DOM fingerprint of the page for resilient matching
   */
  static generateDomFingerprint(doc: Document = document): string {
    const mainContainers = Array.from(doc.querySelectorAll('main, [role="main"], article, #content, .container, body > div'));
    const tagStructure: string[] = [];

    mainContainers.slice(0, 10).forEach((el) => {
      const children = Array.from(el.children).map((c) => c.tagName.toLowerCase()).join('>');
      tagStructure.push(`${el.tagName.toLowerCase()}[${children}]`);
    });

    return tagStructure.join('|');
  }

  /**
   * Generates robust selectors (both exact single-element and generalized repeated elements)
   */
  static createResilientSelector(el: Element, root: Element | Document = document): ResilientSelectorResult {
    const tag = el.tagName.toLowerCase();
    let exactSelector = tag;
    let xpathFallback = `//${tag}`;

    // 1. Exact ID
    if (el.id) {
      exactSelector = `#${el.id}`;
      xpathFallback = `//*[@id='${el.id}']`;
    } else if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter((c) => c.length > 2 && !c.includes(':'));
      if (classes.length > 0) {
        exactSelector = `${tag}.${classes.slice(0, 2).join('.')}`;
        xpathFallback = `//*[contains(@class, '${classes[0]}')]`;
      }
    }

    // 2. Derive Repeated Selector (Matching all similar siblings/items on page)
    const repeated = this.deriveRepeatedSelector(el, root);

    // If a valid repeated selector matching >= 2 elements was found, make it default!
    const defaultCss = repeated.count > 1 ? repeated.selector : exactSelector;

    return {
      cssSelector: defaultCss,
      exactSelector,
      repeatedSelector: repeated.selector,
      xpathFallback,
      semanticTag: tag,
      repeatedMatchCount: repeated.count,
    };
  }

  /**
   * Derives a generalized selector to match all similar repeated elements in a list/catalog
   */
  static deriveRepeatedSelector(el: Element, root: Element | Document = document): { selector: string; count: number } {
    const tag = el.tagName.toLowerCase();
    const doc = el.ownerDocument || document;

    // Pattern A: ID with number prefix/suffix/words (e.g. imgEgrp2, product_1, item-12, row3, ctl00_imgEgrp2)
    if (el.id) {
      // 1. Check for word tokens inside ID (matches ASP.NET controls, repeaters, etc.)
      const words = el.id.match(/[a-zA-Z_\-]{3,}/g);
      if (words) {
        for (const w of words) {
          if (!w.match(/^(ctl|div|span|lbl|txt|btn)$/i)) {
            const candidateStar = `${tag}[id*="${w}"]`;
            try {
              const matches = doc.querySelectorAll(candidateStar);
              if (matches.length > 1) {
                return { selector: candidateStar, count: matches.length };
              }
            } catch {}
          }
        }
      }

      const idPrefixMatch = el.id.match(/^([a-zA-Z_\-]+?)\d+/);
      if (idPrefixMatch && idPrefixMatch[1] && idPrefixMatch[1].length >= 2) {
        const candidate = `${tag}[id^="${idPrefixMatch[1]}"]`;
        try {
          const matches = doc.querySelectorAll(candidate);
          if (matches.length > 1) {
            return { selector: candidate, count: matches.length };
          }
        } catch {}
      }

      const idSuffixMatch = el.id.match(/\d+([a-zA-Z_\-]+)$/);
      if (idSuffixMatch && idSuffixMatch[1] && idSuffixMatch[1].length >= 2) {
        const candidate = `${tag}[id$="${idSuffixMatch[1]}"]`;
        try {
          const matches = doc.querySelectorAll(candidate);
          if (matches.length > 1) {
            return { selector: candidate, count: matches.length };
          }
        } catch {}
      }
    }

    // Pattern B: Table Columns / Cells (If inside a table td/th)
    const tdAncestor = el.closest ? el.closest('td, th') : null;
    if (tdAncestor && tdAncestor.parentElement) {
      const row = tdAncestor.parentElement;
      const cells = Array.from(row.children);
      const colIndex = cells.indexOf(tdAncestor) + 1;
      if (colIndex > 0) {
        const table = el.closest ? el.closest('table') : null;
        const tablePrefix = table && table.id ? `table#${table.id}` : (table && table.className && typeof table.className === 'string' && table.className.trim() ? `table.${table.className.trim().split(/\s+/)[0]}` : 'table');
        const tableCandidate = el === tdAncestor 
          ? `${tablePrefix} tr td:nth-child(${colIndex})`
          : `${tablePrefix} tr td:nth-child(${colIndex}) ${tag}`;
        try {
          const queryRoot = root instanceof Document || root instanceof Element ? root : doc;
          const matches = queryRoot.querySelectorAll(tableCandidate);
          if (matches.length > 1) {
            return { selector: tableCandidate, count: matches.length };
          }
        } catch {}
      }
    }

    // Pattern C: Class names on element itself
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter((c) => !c.match(/\d{3,}/) && c.length > 2 && !c.includes(':'));
      for (const cls of classes) {
        const candidate = `${tag}.${cls}`;
        try {
          const matches = doc.querySelectorAll(candidate);
          if (matches.length > 1) {
            return { selector: candidate, count: matches.length };
          }
        } catch {}
      }
    }

    // Pattern D: Ancestor Repeated Cards / Containers (Climb up to 5 levels)
    let current: Element | null = el.parentElement;
    let depth = 0;
    while (current && depth < 5 && current !== doc.body) {
      const cTag = current.tagName.toLowerCase();
      const candidatesToTest: string[] = [];

      if (cTag === 'li' || cTag === 'tr' || cTag === 'article') {
        candidatesToTest.push(cTag);
      }

      if (current.className && typeof current.className === 'string') {
        const cClasses = current.className.trim().split(/\s+/).filter((c) => !c.match(/\d{3,}/) && c.length > 2 && !c.includes(':'));
        for (const cls of cClasses.slice(0, 2)) {
          candidatesToTest.push(`.${cls}`);
          candidatesToTest.push(`${cTag}.${cls}`);
        }
      }

      for (const parentSel of candidatesToTest) {
        try {
          const parentMatches = doc.querySelectorAll(parentSel);
          if (parentMatches.length > 1) {
            const elFirstClass = el.className && typeof el.className === 'string' && el.className.trim()
              ? el.className.trim().split(/\s+/)[0]
              : '';
            const fullCandidate = elFirstClass && !elFirstClass.includes(':')
              ? `${parentSel} .${elFirstClass}`
              : `${parentSel} ${tag}`;
            const subMatches = doc.querySelectorAll(fullCandidate);
            if (subMatches.length > 1) {
              return { selector: fullCandidate, count: subMatches.length };
            }
          }
        } catch {}
      }

      current = current.parentElement;
      depth++;
    }

    // Pattern E: Parent container repeated children (e.g. .grid > div, ul > li, tr > td)
    if (el.parentElement) {
      const parent = el.parentElement;
      const parentTag = parent.tagName.toLowerCase();
      const parentClass = typeof parent.className === 'string' && parent.className.trim() ? parent.className.trim().split(/\s+/)[0] : '';
      
      const parentPrefix = parentClass && !parentClass.match(/\d{3,}/) ? `.${parentClass}` : parentTag;
      const candidate = `${parentPrefix} > ${tag}`;
      try {
        const matches = doc.querySelectorAll(candidate);
        if (matches.length > 1) {
          return { selector: candidate, count: matches.length };
        }
      } catch {}

      // Grandparent check (e.g. .catalog-list .item img, table tr td)
      if (parent.parentElement) {
        const gParent = parent.parentElement;
        const gClass = typeof gParent.className === 'string' && gParent.className.trim() ? gParent.className.trim().split(/\s+/)[0] : '';
        if (gClass && !gClass.match(/\d{3,}/)) {
          const gCandidate = `.${gClass} ${tag}`;
          try {
            const matches = doc.querySelectorAll(gCandidate);
            if (matches.length > 1) {
              return { selector: gCandidate, count: matches.length };
            }
          } catch {}
        }
      }
    }

    // Fallback: tag name
    try {
      const tagMatches = doc.querySelectorAll(tag);
      return { selector: tag, count: tagMatches.length };
    } catch {
      return { selector: tag, count: 1 };
    }
  }

  /**
   * Resolves a field using CSS first, then XPath fallback, then semantic attributes
   */
  static extractFieldValue(root: Element, rule: SelectorRule): string {
    // If no selector or self, extract directly from root
    if (!rule.cssSelector || rule.cssSelector === 'self' || rule.cssSelector === '.') {
      return this.getElementValue(root, rule.attribute);
    }

    // 1. Try CSS Selector
    if (rule.cssSelector) {
      try {
        const el = root.querySelector(rule.cssSelector);
        if (el) {
          return this.getElementValue(el, rule.attribute);
        }
      } catch {
        // Ignore invalid CSS selector
      }
    }

    // 2. Try XPath Fallback
    if (rule.xpathFallback && typeof document.evaluate === 'function') {
      try {
        const xpathResult = document.evaluate(
          rule.xpathFallback,
          root,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (xpathResult.singleNodeValue && xpathResult.singleNodeValue instanceof Element) {
          return this.getElementValue(xpathResult.singleNodeValue, rule.attribute);
        }
      } catch {
        // Ignore XPath failure
      }
    }

    // 3. Fallback: Search by field name in class/aria
    try {
      const fallbackEl = root.querySelector(`[class*="${rule.field}" i], [id*="${rule.field}" i], [aria-label*="${rule.field}" i]`);
      if (fallbackEl) {
        return this.getElementValue(fallbackEl, rule.attribute);
      }
    } catch {
      // Ignore
    }

    return '';
  }

  static getElementValue(el: Element, attribute?: string): string {
    if (!el) return '';

    // If element is an Image
    if (el instanceof HTMLImageElement || el.tagName.toLowerCase() === 'img') {
      return (
        el.getAttribute('src') ||
        el.getAttribute('data-src') ||
        el.getAttribute('data-original') ||
        el.getAttribute('data-lazy-src') ||
        (el as any).currentSrc ||
        el.getAttribute('alt') ||
        ''
      );
    }

    if (attribute === 'html') {
      return el.innerHTML?.trim() || '';
    }

    if (attribute === 'src') {
      return (
        el.getAttribute('src') ||
        el.getAttribute('data-src') ||
        el.getAttribute('data-original') ||
        el.getAttribute('data-lazy-src') ||
        (el as any).currentSrc ||
        ''
      );
    }

    if (attribute === 'href') {
      return el.getAttribute('href') || (el as any).href || '';
    }

    // Text extraction
    // If element contains child elements, use DataNormalizer.cleanHtmlToText to ensure block tags
    // (p, div, li, h1-h6, tr, td, br) don't fuse adjacent words together (e.g. "TitleDescription" or "ایسیودارای")
    if (el.children && el.children.length > 0) {
      const clean = DataNormalizer.cleanHtmlToText(el.innerHTML);
      if (clean) return clean;
    }

    const text = el.textContent?.trim();
    if (text) return DataNormalizer.decodeHtmlEntities(text);

    // Fallbacks if textContent is empty (e.g. icon or image inside link)
    const imgInside = el.querySelector('img');
    if (imgInside) {
      return this.getElementValue(imgInside, 'src');
    }

    if (el instanceof HTMLAnchorElement || el.tagName.toLowerCase() === 'a') {
      return el.getAttribute('href') || (el as any).href || '';
    }

    return el.getAttribute(attribute || '') || '';
  }

  /**
   * Finds the best matching saved profile for a given URL and validates against current DOM
   */
  static async findAndValidateProfile(url: string, doc: Document = document): Promise<ProfileValidationResult | null> {
    const { StorageService } = await import('../../storage/storageService');
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const profiles = await StorageService.getProfilesForDomain(domain);

    if (profiles.length === 0) return null;

    let bestResult: ProfileValidationResult | null = null;
    let highestConfidence = -1;

    for (const profile of profiles) {
      const validation = this.validateProfileAgainstDom(profile, doc);
      if (validation.confidenceScore > highestConfidence) {
        highestConfidence = validation.confidenceScore;
        bestResult = validation;
      }
    }

    return bestResult;
  }

  /**
   * Validates a profile against the current DOM and detects structural drift
   */
  static validateProfileAgainstDom(profile: SiteProfile, doc: Document = document): ProfileValidationResult {
    let matchedRecords: Element[] = [];
    try {
      matchedRecords = Array.from(doc.querySelectorAll(profile.recordSelector));
    } catch {
      matchedRecords = [];
    }

    const fieldMatchRates: Record<string, number> = {};
    let totalScore = 0;

    if (matchedRecords.length > 0) {
      const sampleRecords = matchedRecords.slice(0, 10);
      for (const rule of profile.fieldSelectors) {
        let matches = 0;
        for (const record of sampleRecords) {
          const val = this.extractFieldValue(record, rule);
          if (val && val.length > 0) {
            matches++;
          }
        }
        const rate = matches / sampleRecords.length;
        fieldMatchRates[rule.field] = rate;
        totalScore += rate;
      }
    }

    const avgFieldMatch = profile.fieldSelectors.length > 0 ? totalScore / profile.fieldSelectors.length : 0;
    const currentFingerprint = this.generateDomFingerprint(doc);
    const structuralChange = Boolean(profile.domFingerprint && profile.domFingerprint !== currentFingerprint);

    const confidenceScore = matchedRecords.length > 0 ? avgFieldMatch * (structuralChange ? 0.8 : 1.0) : 0;
    const isValid = matchedRecords.length > 0 && confidenceScore >= 0.5;

    return {
      profile,
      isValid,
      matchedRecordsCount: matchedRecords.length,
      fieldMatchRates,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      structuralChangeDetected: structuralChange,
    };
  }

  /**
   * Profile Import / Export utilities
   */
  static exportProfilesAsJson(profiles: SiteProfile[]): string {
    return JSON.stringify(profiles, null, 2);
  }

  static async importProfilesFromJson(jsonStr: string): Promise<{ importedCount: number; errors: string[] }> {
    const { StorageService } = await import('../../storage/storageService');
    const errors: string[] = [];
    let count = 0;

    try {
      const parsed = JSON.parse(jsonStr);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item.domain || !item.recordSelector || !Array.isArray(item.fieldSelectors)) {
          errors.push(`Skipped invalid profile: ${item.name || 'unnamed'}`);
          continue;
        }

        delete item.id; // Allow new auto-increment ID
        await StorageService.saveProfile(item);
        count++;
      }
    } catch (err: any) {
      errors.push(`Failed to parse JSON: ${err.message}`);
    }

    return { importedCount: count, errors };
  }
}
