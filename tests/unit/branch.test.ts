import { describe, expect, it } from 'vitest';
import { detect } from '../../src/engines/detection';
import { assignBranch, branchPath } from '../../src/engines/semantics/branch';
import { extensionFor, sniffMime } from '../../src/engines/images/verify';
import { semanticFiles } from '../../src/exports/semantic';
import type { Detection, PageSnapshot, ResourceTask } from '../../src/types';

const url = 'https://example.test/epc';
const source = 'data:image/jpg;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
function fixture() {
  document.body.innerHTML =
    '<header><img id="company-logo" src="/logo.svg"></header><main>' +
    '<ul><li><div><img id="imgEgrp2" style="cursor:pointer" src="' +
    source +
    '"><span>محصولات دنا</span></div></li>' +
    '<li><div><img src="/asset?id=2"><span>محصولات رانا</span></div></li></ul></main>';
}
const snapshot = (id: string, data: Detection): PageSnapshot => ({
  id,
  jobId: 'job',
  url,
  title: '',
  at: 0,
  fingerprint: data.fingerprint,
  metadata: {},
  structured: [],
  embedded: [],
  tables: data.tables,
  links: data.links,
  warnings: [],
  semantic: data.semantic,
});

describe('Live catalog branch capture', () => {
  it('finds a GIF mislabeled as JPG and associates extensionless pictures with cards', () => {
    fixture();
    const data = detect(document, url, {});
    expect(data.records.map((r) => r.fields.name)).toEqual(['محصولات دنا', 'محصولات رانا']);
    expect(data.images.find((i) => i.url === source)?.recordIds).toHaveLength(1);
    expect(data.images.find((i) => i.url.endsWith('/asset?id=2'))?.recordIds).toHaveLength(1);
    const link = data.semantic?.imageLinks.find((l) => l.thumbnailUrl === source);
    expect(link?.recordIds).toHaveLength(1);
    expect(link?.relation).toBe('interaction-required');
    const bytes = Uint8Array.from(atob(source.split(',')[1]!), (c) => c.charCodeAt(0));
    expect(extensionFor(sniffMime(bytes, 'image/jpg')!)).toBe('gif');
  });

  it('keeps two paths for the same URL and links stored files from nested folders', () => {
    fixture();
    const first = detect(document, url, {});
    const second = detect(document, url, {});
    const a = assignBranch(first, new URL(url).origin, branchPath('خودرو / دنا / موتور'));
    const b = assignBranch(second, new URL(url).origin, branchPath('خودرو / رانا / موتور'));
    expect(a.id).not.toBe(b.id);
    const resource = {
      id: 'image',
      jobId: 'job',
      url: source,
      kind: 'image',
      recordIds: [],
      state: 'COMPLETED',
      attempts: 1,
      nextAt: 0,
      hash: 'gif',
      mime: 'image/gif',
    } satisfies ResourceTask;
    const files = semanticFiles(
      [snapshot('a', first), snapshot('b', second)],
      [...first.records, ...second.records],
      [resource],
      new Map([['gif', 'images/product/asset.gif']]),
    );
    const index = JSON.parse(files.get('categories/index.json')!) as {
      id: string;
      folder: string;
      path: string[];
    }[];
    const category = index.find((c) => c.id === a.id)!;
    expect(category.path).toEqual(['خودرو', 'دنا', 'موتور']);
    expect(category.folder.split('/')).toHaveLength(4);
    expect(files.get(category.folder + '/index.html')).toContain(
      '../../../../images/product/asset.gif',
    );
    expect(index.find((c) => c.id === b.id)?.folder).not.toBe(category.folder);
  });
});
