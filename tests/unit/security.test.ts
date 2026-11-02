import { describe, it, expect } from 'vitest';
import { SecuritySanitizer } from '../../src/security/sanitizer';

describe('SecuritySanitizer Utilities', () => {
  it('prevents spreadsheet formula injection (DDE attacks)', () => {
    // Cells starting with =, +, -, @, \t, \r must be prefixed with single quote
    expect(SecuritySanitizer.sanitizeForSpreadsheet('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(SecuritySanitizer.sanitizeForSpreadsheet('+cmd|/c calc')).toBe("'+cmd|/c calc");
    expect(SecuritySanitizer.sanitizeForSpreadsheet('-100')).toBe("'-100");
    expect(SecuritySanitizer.sanitizeForSpreadsheet('@danger')).toBe("'@danger");
    expect(SecuritySanitizer.sanitizeForSpreadsheet('Normal Product')).toBe('Normal Product');
  });

  it('sanitizes unsafe filenames across OS filesystems', () => {
    const invalidName = 'product:large*image?/version\\1.jpg';
    const clean = SecuritySanitizer.sanitizeFilename(invalidName);
    expect(clean).not.toContain(':');
    expect(clean).not.toContain('*');
    expect(clean).not.toContain('?');
    expect(clean).not.toContain('/');
    expect(clean).not.toContain('\\');
    expect(clean.endsWith('.jpg')).toBe(true);
  });

  it('sanitizes HTML previews by stripping dangerous script and iframe elements', () => {
    const dirty = '<div class="product"><h3>Title</h3><script>alert("hack")</script><iframe src="evil.com"></iframe><img src="x" onerror="alert(1)"></div>';
    const clean = SecuritySanitizer.sanitizeHtmlPreview(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('onerror=');
    expect(clean).toContain('<h3>Title</h3>');
  });

  it('validates URLs correctly', () => {
    expect(SecuritySanitizer.isValidWebUrl('https://example.com/item')).toBe(true);
    expect(SecuritySanitizer.isValidWebUrl('http://localhost:3000')).toBe(true);
    expect(SecuritySanitizer.isValidWebUrl('javascript:alert(1)')).toBe(false);
    expect(SecuritySanitizer.isValidWebUrl('invalid-url')).toBe(false);
  });
});
