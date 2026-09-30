import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/AppError.ts';
import { assetKindFor, jobTypesFor, storageKeyFor } from '../asset-kind.ts';

describe('telling what kind of file it is', () => {
  it('recognises pictures', () => {
    expect(assetKindFor('image/png')).toBe('image');
  });

  it('recognises videos', () => {
    expect(assetKindFor('video/mp4')).toBe('video');
  });

  it('recognises PDFs as documents', () => {
    expect(assetKindFor('application/pdf')).toBe('document');
  });

  it('turns away anything else', () => {
    expect(() => assetKindFor('application/zip')).toThrow(ValidationError);
    expect(() => assetKindFor('text/html')).toThrow(ValidationError);
  });
});

describe('deciding what work a new file needs', () => {
  it('makes a thumbnail for a picture', () => {
    expect(jobTypesFor('image')).toEqual(['thumbnail.generate']);
  });

  it('converts a video and also makes its poster', () => {
    expect(jobTypesFor('video')).toEqual([
      'video.process',
      'thumbnail.generate',
    ]);
  });

  it('leaves a document alone', () => {
    expect(jobTypesFor('document')).toEqual([]);
  });
});

describe('choosing where a file is kept', () => {
  it('puts each kind in its own folder and keeps the extension', () => {
    expect(storageKeyFor('image', 'a.JPG')).toMatch(
      /^images\/[0-9a-f-]{36}\.JPG$/,
    );
    expect(storageKeyFor('video', 'a.mp4')).toMatch(/^videos\//);
    expect(storageKeyFor('document', 'a.pdf')).toMatch(/^documents\//);
  });

  it('never gives two files the same place, even with the same name', () => {
    expect(storageKeyFor('image', 'a.jpg')).not.toBe(
      storageKeyFor('image', 'a.jpg'),
    );
  });

  it('does not let the filename choose the folder', () => {
    const key = storageKeyFor('image', '../../etc/passwd');
    expect(key.startsWith('images/')).toBe(true);
    expect(key).not.toContain('..');
  });
});
