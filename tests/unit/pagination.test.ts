import { describe, it, expect } from 'vitest';
import { PaginationController } from '../../src/engines/crawler/paginationController';

describe('PaginationController & Auto-Clicker', () => {
  it('detects Persian Next button (صفحه بعد)', () => {
    const html = `
      <div class="pagination-wrapper">
        <a href="/products?page=1">1</a>
        <a href="/products?page=2" class="btn-next">صفحه بعد</a>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc, 'https://example.com/products?page=1');
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('next_button');
    expect(result.targetElement?.textContent?.trim()).toBe('صفحه بعد');
    expect(result.targetUrl).toBe('https://example.com/products?page=2');
  });

  it('detects Persian Next button variant (بعدی)', () => {
    const html = `
      <div>
        <button class="nav-btn">بعدی</button>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc);
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('next_button');
    expect(result.targetElement?.textContent?.trim()).toBe('بعدی');
  });

  it('detects rel="next" attribute on links', () => {
    const html = `
      <nav>
        <a href="/catalog?p=3" rel="next">Next Page</a>
      </nav>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc, 'https://example.com/catalog?p=2');
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('next_button');
    expect(result.targetUrl).toBe('https://example.com/catalog?p=3');
  });

  it('detects Persian Load More button (مشاهده بیشتر)', () => {
    const html = `
      <div class="product-grid">
        <div class="item">Product 1</div>
        <button class="btn-show-more">مشاهده بیشتر محصولات</button>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc);
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('load_more');
    expect(result.targetElement?.textContent).toContain('مشاهده بیشتر');
  });

  it('detects English Load More button', () => {
    const html = `
      <div>
        <button class="load-more">Load More</button>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc);
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('load_more');
  });

  it('detects numbered pagination next sibling', () => {
    const html = `
      <ul class="pagination">
        <li class="page-item"><a href="/p/1">1</a></li>
        <li class="page-item active"><a href="/p/2">2</a></li>
        <li class="page-item"><a href="/p/3" class="target-page">3</a></li>
      </ul>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc, 'https://example.com/p/2');
    expect(result.hasMorePages).toBe(true);
    expect(result.type).toBe('numbered');
    expect(result.targetUrl).toBe('https://example.com/p/3');
  });

  it('ignores disabled Next buttons', () => {
    const html = `
      <div class="pagination">
        <button class="next disabled" disabled>صفحه بعد</button>
      </div>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = PaginationController.detectPagination(doc);
    expect(result.hasMorePages).toBe(false);
    expect(result.type).toBe('none');
  });

  it('successfully simulates trusted click on an element', () => {
    const html = `<button id="test-btn">Click Me</button>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const btn = doc.getElementById('test-btn') as HTMLElement;
    
    // Provide scrollIntoView mock if environment doesn't have it
    if (!btn.scrollIntoView) {
      btn.scrollIntoView = () => {};
    }

    let clicked = false;
    btn.addEventListener('click', () => {
      clicked = true;
    });

    const success = PaginationController.clickElement(btn);
    expect(success).toBe(true);
    expect(clicked).toBe(true);
  });
});
