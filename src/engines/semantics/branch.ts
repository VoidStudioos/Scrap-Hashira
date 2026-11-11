import { safeFilename } from '../../security/policy';
import type { CategoryNode, Detection } from '../../types';
import { hashText } from '../../utils/core';
import { normalizeText } from '../normalization';

export function branchPath(value: string) {
  return value
    .split('/')
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

export function assignBranch(data: Detection, origin: string, path: string[]) {
  const categories: CategoryNode[] = path.map((label, i) => {
    const prefix = path.slice(0, i + 1);
    return {
      id: 'manual_' + hashText(JSON.stringify([origin, prefix])),
      label,
      path: prefix,
      source: 'manual',
      sourceUrl: data.url,
      confidence: 1,
    };
  });
  categories.forEach((node, i) => {
    node.parentId = categories[i - 1]?.id;
  });
  const branch = categories.at(-1)!;
  const evidence = data.semantic;
  const detected = (evidence?.categories || []).filter(
    (node) =>
      node.source === 'tree' &&
      node.path.length > path.length &&
      path.every((part, i) => part === node.path[i]),
  );
  const detectedIds = new Map(
    detected.map((node) => [
      node.id,
      'manual_' + hashText(JSON.stringify([origin, path, node.id])),
    ]),
  );
  const localCategory = (id: string) => detectedIds.get(id) || branch.id;
  for (const node of detected) {
    categories.push({
      ...node,
      id: localCategory(node.id),
      parentId: localCategory(node.parentId || ''),
      path: node.path,
    });
  }
  data.semantic = {
    categories,
    fields: (evidence?.fields || []).map((field) => ({
      ...field,
      id: hashText(branch.id + ':' + field.id),
      categoryId: localCategory(field.categoryId),
    })),
    imageLinks: (evidence?.imageLinks || []).map((link) => ({
      ...link,
      id: hashText(branch.id + ':' + link.id),
      categoryId: localCategory(link.categoryId),
    })),
    warnings: evidence?.warnings || [],
  };
  for (const record of data.records) {
    record.categoryIds = [
      ...new Set([branch.id, ...(record.categoryIds || []).map(localCategory)]),
    ];
  }
  return branch;
}

export function branchFolder(path: string[]) {
  return path
    .map(
      (label, i) =>
        safeFilename(label.slice(0, 30)) +
        '_' +
        hashText(JSON.stringify(path.slice(0, i + 1))).slice(0, 8),
    )
    .join('/');
}
