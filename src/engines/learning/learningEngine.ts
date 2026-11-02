// Smart Learning Engine: Persistent Site Profiles & Selector Resilience
import type { SiteProfile, SelectorRule } from '../../types';

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

    // Pattern A: ID with number prefix/suffix (e.g. imgEgrp2, product_1, item-12, row3)
    if (el.id) {
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

    // Pattern B: Class names
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

    // Pattern C: Parent container repeated children (e.g. .grid > div, ul > li, tr > td)
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

  private static getElementValue(el: Element, attribute?: string): string {
    if (!attribute || attribute === 'text') {
      return el.textContent?.trim() || '';
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
        ''
      );
    }
    if (attribute === 'href') {
      return el.getAttribute('href') || '';
    }
    return el.getAttribute(attribute) || el.textContent?.trim() || '';
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
