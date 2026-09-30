import { extname } from 'node:path';
import { assetKindFor } from './asset-kind.ts';

const MAX_TAG_LENGTH = 32;
const MAX_FILENAME_TAGS = 8;

// Words that say nothing about what the file shows
const IGNORED_WORDS = new Set([
  'img',
  'image',
  'dsc',
  'dscn',
  'pxl',
  'mvi',
  'vid',
  'video',
  'copy',
  'final',
  'new',
  'untitled',
  'screenshot',
  'the',
  'and',
]);

export function normalizeTag(raw: string) {
  const tag = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH);

  return tag || null;
}

// "Beach_Sunset-2024_FINAL.jpg" gives ["beach", "sunset"]
function filenameWords(filename: string) {
  const name = filename.slice(0, filename.length - extname(filename).length);

  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.toLowerCase())
    .filter(
      (word) =>
        word.length >= 3 &&
        // Dates and camera counters, such as 2024 or 20240115
        (word.match(/\d/g)?.length ?? 0) <= 3 &&
        !IGNORED_WORDS.has(word),
    );
}

// What is known when the upload starts: the filename, and the file type
export function tagsForUpload(filename: string, mimeType: string) {
  const subtype = mimeType.split('/')[1] ?? '';
  const tags = [
    ...filenameWords(filename).slice(0, MAX_FILENAME_TAGS),
    assetKindFor(mimeType),
    subtype,
  ];

  const normalized = tags.map(normalizeTag).filter((tag) => tag !== null);
  return [...new Set(normalized)];
}
