import type { TableData } from '../../types';
import { normalizeText } from '../normalization';
import { hashText } from '../../utils/core';
export function extractTables(document: Document, url: string): TableData[] {
  return [...document.querySelectorAll('table')].slice(0, 100).map((table, index) => {
    const grid: string[][] = [];
    const rows = [...table.querySelectorAll('tr')]
      .filter((row) => row.closest('table') === table)
      .slice(0, 10000);
    let headerRows = 0;
    rows.forEach((row, y) => {
      grid[y] ??= [];
      let x = 0;
      const cells = [...row.children].filter((c) => ['TD', 'TH'].includes(c.tagName));
      if (cells.some((c) => c.tagName === 'TH') && y === headerRows) headerRows++;
      for (const c of cells) {
        while (grid[y]![x] !== undefined) x++;
        const cell = c as HTMLTableCellElement;
        const clone = cell.cloneNode(true) as Element;
        clone.querySelectorAll('table,script,style').forEach((n) => n.remove());
        const text = normalizeText(clone.textContent || '');
        const rs =
          cell.rowSpan === 0 ? rows.length - y : Math.max(1, Math.min(cell.rowSpan || 1, 100));
        const cs = Math.max(1, Math.min(cell.colSpan || 1, 100));
        for (let dy = 0; dy < rs && y + dy < rows.length; dy++) {
          grid[y + dy] ??= [];
          for (let dx = 0; dx < cs; dx++) grid[y + dy]![x + dx] = text;
        }
        x += cs;
      }
    });
    const width = Math.max(0, ...grid.map((r) => r.length));
    const normalized = grid.map((r) => Array.from({ length: width }, (_, i) => r[i] || ''));
    const keys = new Map<string, number>();
    const headers = Array.from({ length: width }, (_, i) => {
      const text = headerRows
        ? [
            ...new Set(
              normalized
                .slice(0, headerRows)
                .map((r) => r[i])
                .filter(Boolean),
            ),
          ].join(' / ')
        : `column_${i + 1}`;
      const key = text || `column_${i + 1}`;
      const occurrence = (keys.get(key) || 0) + 1;
      keys.set(key, occurrence);
      return occurrence > 1 ? `${key}_${occurrence}` : key;
    });
    return {
      id: 't_' + hashText(url + '|' + index),
      caption: table.caption?.textContent?.trim() || `Table ${index + 1}`,
      headers,
      rows: normalized.slice(headerRows),
      raw: table.outerHTML,
      normalized,
      sourceUrl: url,
    };
  });
}
