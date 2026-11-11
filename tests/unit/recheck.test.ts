import { describe, it, expect } from 'vitest';
import { validateConfig, inScope } from '../../src/security/policy';
import { DEFAULT_CONFIG, type Profile } from '../../src/types';
import { useUI, selectPage } from '../../src/sidepanel/store';
import { validateProfile } from '../../src/engines/learning';
import { detect } from '../../src/engines/detection';
import { verifyImageBlob } from '../../src/engines/images/verify';
const profile: Profile = {
  id: 'p',
  name: 'P',
  origin: 'https://s.test',
  patterns: ['https://s.test/*'],
  pageType: 'list',
  record: { css: '.card' },
  fields: { name: { css: 'h2' } },
  successes: 0,
  failures: 0,
  confidence: 0.5,
  updatedAt: 0,
  history: [],
};
describe('Scope/configuration recheck', () => {
  it('keeps query categories separate while allowing pagination in the same category', () => {
    const cfg = { ...DEFAULT_CONFIG, branches: ['https://s.test/catalog?id=1'] };
    expect(inScope('https://s.test/catalog?id=2', 'https://s.test', cfg)).toBe(false);
    expect(inScope('https://s.test/catalog?id=1&page=2', 'https://s.test', cfg)).toBe(true);
    expect(inScope('https://s.test/catalog', 'https://s.test', cfg)).toBe(false);
    expect(
      inScope('https://s.test/catalog?id=1', 'https://s.test', {
        ...cfg,
        branches: ['https://evil.test/catalog?id=1'],
      }),
    ).toBe(false);
  });
  it('normalizes discrete limits to integers', () => {
    const cfg = validateConfig({
      maxPages: 2.9,
      pageConcurrency: 1.7,
      retries: 2.8,
      scrollSteps: 1.5,
    });
    expect(cfg.maxPages).toBe(2);
    expect(cfg.pageConcurrency).toBe(1);
    expect(cfg.retries).toBe(2);
    expect(cfg.scrollSteps).toBe(1);
  });
  it('rejects malformed selections and flag values from saved/imported configuration', () => {
    expect(() =>
      validateConfig({ profileIds: [null] } as unknown as typeof DEFAULT_CONFIG),
    ).toThrow();
    expect(() =>
      validateConfig({ selectedImageUrls: [1] } as unknown as typeof DEFAULT_CONFIG),
    ).toThrow();
    expect(() =>
      validateConfig({ downloadImages: 'false' } as unknown as typeof DEFAULT_CONFIG),
    ).toThrow();
    expect(() =>
      validateConfig({ traverse: 'outside' } as unknown as typeof DEFAULT_CONFIG),
    ).toThrow();
  });
  it('invalidates stale preview and site-specific selections on origin switch', () => {
    useUI.setState({
      url: 'https://s.test/catalog',
      tabId: 1,
      config: {
        ...DEFAULT_CONFIG,
        profileId: 'p',
        profileIds: ['p'],
        candidateId: 'g',
        selectedImageUrls: ['https://s.test/a.jpg'],
        branches: ['https://s.test/catalog'],
      },
      detection: { url: 'https://s.test/catalog' } as ReturnType<typeof detect>,
    });
    selectPage(2, 'https://other.test/');
    const state = useUI.getState();
    expect(state.detection).toBeUndefined();
    expect(state.config.profileIds).toEqual([]);
    expect(state.config.branches).toEqual([]);
    expect(state.config.selectedImageUrls).toBeUndefined();
    expect(state.config.candidateId).toBeUndefined();
  });
  it('preserves same-origin learned rules but resets page-specific candidate/image selections', () => {
    useUI.setState({
      url: 'https://s.test/a',
      tabId: 1,
      config: { ...DEFAULT_CONFIG, profileId: 'p', candidateId: 'g', selectedImageUrls: [] },
    });
    selectPage(1, 'https://s.test/b');
    expect(useUI.getState().config.profileId).toBe('p');
    expect(useUI.getState().config.candidateId).toBeUndefined();
    expect(useUI.getState().config.selectedImageUrls).toBeUndefined();
  });
});
describe('Profile and resource recheck', () => {
  it('rejects null imported fields and malformed fallback attributes', () => {
    expect(() => validateProfile({ ...profile, fields: { name: null } })).toThrow();
    expect(() =>
      validateProfile({ ...profile, fields: { name: { css: 'h2', xpath: 3 } } }),
    ).toThrow();
    expect(() =>
      validateProfile({
        ...profile,
        fields: { name: { css: 'h2', semantic: { attribute: 2, value: 'x' } } },
      }),
    ).toThrow();
    expect(() => validateProfile({ ...profile, fields: {} })).toThrow();
  });
  it('retains generic detection if an old persisted profile is corrupt', () => {
    document.body.innerHTML =
      '<main><article><h2>One</h2><a href="/p/1">Link</a></article><article><h2>Two</h2><a href="/p/2">Link</a></article></main>';
    const data = detect(document, 'https://s.test/', {
      profiles: [{ ...profile, record: null } as unknown as Profile],
    });
    expect(data.records.length).toBeGreaterThan(0);
    expect(data.profileValid).toBe(false);
    expect(data.warnings.some((w) => w.includes('invalid rules'))).toBe(true);
  });
  it('rejects SVG external URLs hidden in style attributes and SMIL actions', async () => {
    const blob = (text: string) => new Blob([text], { type: 'image/svg+xml' });
    Object.defineProperty(Blob.prototype, 'text', {
      configurable: true,
      value: async function (this: Blob) {
        return new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.readAsText(this);
        });
      },
    });
    await expect(
      verifyImageBlob(
        blob(
          '<svg xmlns="http://www.w3.org/2000/svg"><rect style="filter:url(https://evil.test/f.svg)"/></svg>',
        ),
        'image/svg+xml',
      ),
    ).rejects.toThrow('active SVG');
    await expect(
      verifyImageBlob(
        blob(
          '<svg xmlns="http://www.w3.org/2000/svg"><set attributeName="href" to="https://evil.test/"/></svg>',
        ),
        'image/svg+xml',
      ),
    ).rejects.toThrow('active SVG');
  });
});
