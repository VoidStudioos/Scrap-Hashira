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
   * Generates a robust selector with XPath fallback and semantic resilience
   */
  static createResilientSelector(el: Element, root: Element | Document = document): {
    cssSelector: string;
    xpathFallback: string;
    semanticTag: string;
  } {
    // 1. Try id
    if (el.id && !el.id.match(/\d{4,}/)) {
      return {
        cssSelector: `#${el.id}`,
        xpathFallback: `//*[@id='${el.id}']`,
        semanticTag: el.tagName.toLowerCase(),
      };
    }

    // 2. Try unique attribute like data-testid, itemprop, role
    for (const attr of ['data-testid', 'data-qa', 'itemprop', 'aria-label']) {
      const val = el.getAttribute(attr);
      if (val) {
        return {
          cssSelector: `[${attr}="${val}"]`,
          xpathFallback: `//*[@${attr}='${val}']`,
          semanticTag: el.tagName.toLowerCase(),
        };
      }
    }

    // 3. Try class combination
    if (el.className && typeof el.className === 'string') {
      const classes = el.className
        .trim()
        .split(/\s+/)
        .filter((c) => !c.match(/\d{4,}/) && c.length > 2 && !c.includes(':'));
      if (classes.length > 0) {
        const clsSelector = `.${classes.slice(0, 2).join('.')}`;
        return {
          cssSelector: clsSelector,
          xpathFallback: `//*[contains(@class, '${classes[0]}')]`,
          semanticTag: el.tagName.toLowerCase(),
        };
      }
    }

    // 4. Hierarchical path
    const path: string[] = [];
    let curr: Element | null = el;
    while (curr && curr !== root && curr !== document.body) {
      let tag = curr.tagName.toLowerCase();
      if (curr.parentElement) {
        const siblings = Array.from(curr.parentElement.children).filter((c) => c.tagName === curr!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(curr) + 1;
          tag += `:nth-of-type(${index})`;
        }
      }
      path.unshift(tag);
      curr = curr.parentElement;
      if (path.length > 4) break;
    }

    const cssSelector = path.join(' > ');
    return {
      cssSelector,
      xpathFallback: `//${el.tagName.toLowerCase()}`,
      semanticTag: el.tagName.toLowerCase(),
    };
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
