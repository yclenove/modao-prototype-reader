import path from 'node:path';

export async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function toAbsolutePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

export function stripHtmlTags(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function groupBy(array, keyFn) {
  const grouped = new Map();
  for (const item of array) {
    const key = keyFn(item);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

export function uniqueBy(array, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of array) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function pickByKeyword(items, keyword, valueFn) {
  if (!keyword) {
    return null;
  }
  const normalized = keyword.toLowerCase();
  return (
    items.find((item) => String(valueFn(item) ?? '').toLowerCase().includes(normalized)) ?? null
  );
}

export function toJson(data) {
  return JSON.stringify(data, null, 2);
}
