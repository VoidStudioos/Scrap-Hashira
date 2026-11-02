// Multi-stage Automatic Data Detection Engine
import type { ExtractedTable } from '../../types';

export interface DetectedField {
  name: string;
  cssSelector: string;
  xpathFallback: string;
  attribute: string;
  sampleValue: string;
  confidence: number;
}

export interface CandidateSchema {
  type: 'catalog' | 'table' | 'detail' | 'jsonld';
  title: string;
  recordSelector: string;
  confidence: number;
  sampleCount: number;
  fields: DetectedField[];
  previewRecords: Record<string, any>[];
  pagination?: {
    type: 'next_button' | 'numbered' | 'load_more' | 'infinite_scroll';
    selector?: string;
  };
}

export class AutoDetector {
  /**
   * Main detection entry point for a DOM document
   */
  static detect(doc: Document = document, currentUrl: string = window.location.href): {
    schemas: CandidateSchema[];
    tables: ExtractedTable[];
    jsonLdData: any[];
    paginationSelector?: string;
  } {
    const schemas: CandidateSchema[] = [];

    // Stage 1: Check JSON-LD / Schema.org
    const jsonLdData = this.detectJsonLd(doc);
    if (jsonLdData.length > 0) {
      const jsonLdSchema = this.convertJsonLdToSchema(jsonLdData);
      if (jsonLdSchema) schemas.push(jsonLdSchema);
    }

    // Stage 2: Repeated sibling elements (Product cards, catalogs, search results)
    const cardSchemas = this.detectRepeatedCards(doc);
    schemas.push(...cardSchemas);

    // Stage 3: Table detection (Standard and dynamic tables)
    const tables = this.detectTables(doc, currentUrl);

    // Stage 4: Pagination detection
    const pagination = this.detectPagination(doc);

    // Attach pagination to top schema if found
    if (pagination && schemas.length > 0) {
      schemas[0].pagination = pagination;
    }

    // Sort schemas by confidence descending
    schemas.sort((a, b) => b.confidence - a.confidence);

    return {
      schemas,
      tables,
      jsonLdData,
      paginationSelector: pagination?.selector,
    };
  }

  /**
   * Stage 1: Detect JSON-LD structured data (Product, ItemList, Offer, etc.)
   */
  static detectJsonLd(doc: Document): any[] {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const results: any[] = [];

    scripts.forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '');
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
            results.push(...parsed['@graph']);
          } else {
            results.push(parsed);
          }
        }
      } catch {
        // Ignore malformed JSON-LD scripts
      }
    });

    return results;
  }

  private static convertJsonLdToSchema(items: any[]): CandidateSchema | null {
    // Look for Product or ItemList
    const products = items.filter(
      (item) => item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))
    );

    const itemLists = items.filter(
      (item) => item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)
    );

    if (products.length > 0) {
      const sample = products[0];
      const fields: DetectedField[] = [
        { name: 'name', cssSelector: 'schema-product-name', xpathFallback: '', attribute: 'text', sampleValue: String(sample.name || ''), confidence: 0.95 },
        { name: 'description', cssSelector: 'schema-product-desc', xpathFallback: '', attribute: 'text', sampleValue: String(sample.description || '').substring(0, 100), confidence: 0.9 },
      ];

      if (sample.sku || sample.productID) {
        fields.push({ name: 'product_code', cssSelector: 'schema-sku', xpathFallback: '', attribute: 'text', sampleValue: String(sample.sku || sample.productID), confidence: 0.95 });
      }

      if (sample.offers) {
        const offer = Array.isArray(sample.offers) ? sample.offers[0] : sample.offers;
        if (offer && offer.price) {
          fields.push({ name: 'price', cssSelector: 'schema-price', xpathFallback: '', attribute: 'text', sampleValue: `${offer.price} ${offer.priceCurrency || ''}`, confidence: 0.95 });
        }
      }

      if (sample.image) {
        const imgUrl = Array.isArray(sample.image) ? sample.image[0] : (typeof sample.image === 'object' ? sample.image.url : sample.image);
        fields.push({ name: 'image', cssSelector: 'schema-image', xpathFallback: '', attribute: 'src', sampleValue: String(imgUrl || ''), confidence: 0.9 });
      }

      return {
        type: 'jsonld',
        title: 'Structured Schema.org Products',
        recordSelector: 'script[type="application/ld+json"]',
        confidence: 0.95,
        sampleCount: products.length,
        fields,
        previewRecords: products.slice(0, 5).map((p) => ({
          name: p.name,
          sku: p.sku || p.productID,
          price: p.offers ? (Array.isArray(p.offers) ? p.offers[0]?.price : p.offers.price) : undefined,
          image: Array.isArray(p.image) ? p.image[0] : p.image,
        })),
      };
    }

    if (itemLists.length > 0) {
      const list = itemLists[0];
      const elements = list.itemListElement;
      return {
        type: 'jsonld',
        title: `Structured ItemList (${elements.length} items)`,
        recordSelector: 'script[type="application/ld+json"]',
        confidence: 0.9,
        sampleCount: elements.length,
        fields: [
          { name: 'name', cssSelector: '', xpathFallback: '', attribute: 'text', sampleValue: String(elements[0]?.name || ''), confidence: 0.9 },
          { name: 'url', cssSelector: '', xpathFallback: '', attribute: 'href', sampleValue: String(elements[0]?.url || ''), confidence: 0.9 },
        ],
        previewRecords: elements.slice(0, 5),
      };
    }

    return null;
  }

  /**
   * Stage 2: Detect repeated card clusters using DOM structural similarity
   */
  static detectRepeatedCards(doc: Document): CandidateSchema[] {
    const candidateSchemas: CandidateSchema[] = [];

    // Potential card containers
    const commonSelectors = [
      '[class*="product"]',
      '[class*="item"]',
      '[class*="card"]',
      '[class*="listing"]',
      '[class*="grid"] > div',
      'ul > li',
      'article',
      '.goods-item',
      '.c-product-box',
    ];

    const testedSelectors = new Set<string>();

    for (const selector of commonSelectors) {
      try {
        const elements = Array.from(doc.querySelectorAll(selector));
        // Filter out non-card small or invisible elements
        const validCards = elements.filter((el) => {
          if (el.children.length === 0) return false;
          const text = el.textContent?.trim() || '';
          if (text.length < 5 || text.length > 3000) return false;
          // Must have at least a link or image or title
          const hasImg = el.querySelector('img, [style*="background-image"]');
          const hasLink = el.querySelector('a');
          const hasHeading = el.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"]');
          return Boolean(hasImg || hasLink || hasHeading);
        });

        if (validCards.length >= 3) {
          const specificSelector = this.deriveOptimalSelector(validCards[0], selector);
          if (testedSelectors.has(specificSelector)) continue;
          testedSelectors.add(specificSelector);

          const fields = this.extractFieldsFromCards(validCards.slice(0, 5));
          if (fields.length > 0) {
            const previewRecords = this.buildPreviewRecords(validCards.slice(0, 5), fields);
            const confidence = this.computeConfidence(validCards.length, fields);

            candidateSchemas.push({
              type: 'catalog',
              title: `Product/Item Cards (${validCards.length} items)`,
              recordSelector: specificSelector,
              confidence,
              sampleCount: validCards.length,
              fields,
              previewRecords,
            });
          }
        }
      } catch {
        // Ignore invalid DOM query errors
      }
    }

    return candidateSchemas;
  }

  private static deriveOptimalSelector(el: Element, fallback: string): string {
    const parent = el.parentElement;
    if (parent && parent.className && typeof parent.className === 'string') {
      const parentClass = parent.className.trim().split(/\s+/)[0];
      if (parentClass && !parentClass.match(/\d{4,}/)) {
        return `.${parentClass} > ${el.tagName.toLowerCase()}`;
      }
    }

    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/).filter((c) => !c.match(/\d{4,}/) && c.length > 2);
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }

    return fallback;
  }

  private static extractFieldsFromCards(cards: Element[]): DetectedField[] {
    const fields: DetectedField[] = [];
    const firstCard = cards[0];

    // 1. Title/Name
    const titleEl = firstCard.querySelector('h1, h2, h3, h4, h5, [class*="title"], [class*="name"], a[title]');
    if (titleEl) {
      const titleSelector = this.getRelativeSelector(firstCard, titleEl);
      fields.push({
        name: 'product_name',
        cssSelector: titleSelector,
        xpathFallback: `.//${titleEl.tagName.toLowerCase()}`,
        attribute: 'text',
        sampleValue: titleEl.textContent?.trim() || '',
        confidence: 0.9,
      });
    }

    // 2. Price
    const priceEl = firstCard.querySelector('[class*="price"], [class*="cost"], [class*="amount"], [class*="قیمت"], [id*="price"]');
    if (priceEl) {
      const priceSelector = this.getRelativeSelector(firstCard, priceEl);
      fields.push({
        name: 'price',
        cssSelector: priceSelector,
        xpathFallback: `.//*[contains(@class, 'price')]`,
        attribute: 'text',
        sampleValue: priceEl.textContent?.trim() || '',
        confidence: 0.88,
      });
    }

    // 3. Image
    const imgEl = firstCard.querySelector('img, [style*="background-image"]');
    if (imgEl) {
      const imgSelector = this.getRelativeSelector(firstCard, imgEl);
      const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-original') || '';
      fields.push({
        name: 'image',
        cssSelector: imgSelector,
        xpathFallback: './/img',
        attribute: 'src',
        sampleValue: src,
        confidence: 0.92,
      });
    }

    // 4. Product Link
    const linkEl = firstCard.querySelector('a[href]');
    if (linkEl) {
      const linkSelector = this.getRelativeSelector(firstCard, linkEl);
      fields.push({
        name: 'url',
        cssSelector: linkSelector,
        xpathFallback: './/a[@href]',
        attribute: 'href',
        sampleValue: linkEl.getAttribute('href') || '',
        confidence: 0.85,
      });
    }

    // 5. SKU / Product Code
    const codeEl = firstCard.querySelector('[class*="sku"], [class*="code"], [class*="id"], [data-sku]');
    if (codeEl) {
      const codeSelector = this.getRelativeSelector(firstCard, codeEl);
      fields.push({
        name: 'product_code',
        cssSelector: codeSelector,
        xpathFallback: `.//*[contains(@class, 'sku')]`,
        attribute: 'text',
        sampleValue: codeEl.textContent?.trim() || '',
        confidence: 0.8,
      });
    }

    return fields;
  }

  private static getRelativeSelector(parent: Element, target: Element): string {
    if (parent === target) return '';

    const targetClass = typeof target.className === 'string' ? target.className.trim().split(/\s+/)[0] : '';
    if (targetClass && !targetClass.match(/\d{4,}/)) {
      return `.${targetClass}`;
    }

    return target.tagName.toLowerCase();
  }

  private static buildPreviewRecords(cards: Element[], fields: DetectedField[]): Record<string, any>[] {
    return cards.map((card) => {
      const record: Record<string, any> = {};
      for (const field of fields) {
        const target = field.cssSelector ? card.querySelector(field.cssSelector) : card;
        if (target) {
          if (field.attribute === 'src') {
            record[field.name] = target.getAttribute('src') || target.getAttribute('data-src') || '';
          } else if (field.attribute === 'href') {
            record[field.name] = target.getAttribute('href') || '';
          } else {
            record[field.name] = target.textContent?.trim() || '';
          }
        } else {
          record[field.name] = '';
        }
      }
      return record;
    });
  }

  private static computeConfidence(itemCount: number, fields: DetectedField[]): number {
    let score = 0.5;
    if (itemCount >= 5) score += 0.15;
    if (fields.some((f) => f.name === 'product_name')) score += 0.15;
    if (fields.some((f) => f.name === 'price')) score += 0.1;
    if (fields.some((f) => f.name === 'image')) score += 0.1;
    return Math.min(0.98, score);
  }

  /**
   * Stage 3: Table detection (Nested, rowspan, colspan, dynamic headers)
   */
  static detectTables(doc: Document, currentUrl: string): ExtractedTable[] {
    const extractedTables: ExtractedTable[] = [];
    const tableElements = Array.from(doc.querySelectorAll('table'));

    tableElements.forEach((tableEl, idx) => {
      const rows = Array.from(tableEl.querySelectorAll('tr'));
      if (rows.length < 2) return;

      const hasNested = tableEl.querySelectorAll('table').length > 0;

      // Extract Headers
      let headers: string[] = [];
      const thElements = Array.from(rows[0].querySelectorAll('th, td'));
      if (thElements.length > 0) {
        headers = thElements.map((th, colIdx) => th.textContent?.trim() || `Column_${colIdx + 1}`);
      }

      // Extract Rows (handling colspan & rowspan)
      const dataRows: (string | number)[][] = [];
      const startIdx = rows[0].querySelector('th') ? 1 : 0;

      for (let r = startIdx; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td, th'));
        if (cells.length === 0) continue;

        const rowData = cells.map((cell) => cell.textContent?.trim() || '');
        dataRows.push(rowData);
      }

      if (dataRows.length > 0) {
        extractedTables.push({
          jobId: '',
          sourceUrl: currentUrl,
          tableIndex: idx,
          title: tableEl.getAttribute('aria-label') || tableEl.querySelector('caption')?.textContent?.trim() || `Table #${idx + 1}`,
          headers,
          rows: dataRows,
          hasNestedTables: hasNested,
          extractedAt: Date.now(),
        });
      }
    });

    return extractedTables;
  }

  /**
   * Stage 4: Pagination detection
   */
  static detectPagination(doc: Document): CandidateSchema['pagination'] | undefined {
    // 1. Next button
    const nextBtn = doc.querySelector(
      'a[rel="next"], [aria-label*="next" i], [class*="pagination-next" i], [class*="btn-next" i], a:contains("Next"), a:contains("بعدی")'
    );
    if (nextBtn) {
      return {
        type: 'next_button',
        selector: this.deriveOptimalSelector(nextBtn, 'a[rel="next"]'),
      };
    }

    // 2. Load more button
    const loadMoreBtn = doc.querySelector(
      'button[class*="load-more" i], a[class*="load-more" i], button:contains("Load More"), button:contains("بارگذاری بیشتر")'
    );
    if (loadMoreBtn) {
      return {
        type: 'load_more',
        selector: this.deriveOptimalSelector(loadMoreBtn, 'button.load-more'),
      };
    }

    // 3. Numbered pagination
    const numbered = doc.querySelector('ul[class*="pagination" i], nav[class*="pagination" i], .pager');
    if (numbered) {
      return {
        type: 'numbered',
        selector: this.deriveOptimalSelector(numbered, 'ul.pagination'),
      };
    }

    return undefined;
  }
}
