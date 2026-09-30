import { describe, expect, it } from 'vitest';
import { normalizeTag, tagsForUpload } from '../tags.ts';

describe('cleaning up a tag', () => {
  it('makes it lowercase', () => {
    expect(normalizeTag('Sunset')).toBe('sunset');
  });

  it('turns spaces and symbols into a single dash', () => {
    expect(normalizeTag('Big  Red & Shiny!')).toBe('big-red-shiny');
  });

  it('drops dashes left dangling at the ends', () => {
    expect(normalizeTag('--hello--')).toBe('hello');
  });

  it('cuts very long tags to 32 characters', () => {
    expect(normalizeTag('a'.repeat(100))).toHaveLength(32);
  });

  it('gives nothing back when there is nothing usable left', () => {
    expect(normalizeTag('!!!')).toBeNull();
    expect(normalizeTag('')).toBeNull();
  });
});

describe('tags made when a file is uploaded', () => {
  it('uses the words in the filename plus the kind of file', () => {
    expect(tagsForUpload('Beach_Sunset-2024_FINAL.jpg', 'image/jpeg')).toEqual([
      'beach',
      'sunset',
      'image',
      'jpeg',
    ]);
  });

  it('splits words that are stuck together by capital letters', () => {
    expect(tagsForUpload('MountainLake.png', 'image/png')).toEqual([
      'mountain',
      'lake',
      'image',
      'png',
    ]);
  });

  it('ignores camera junk such as IMG_20240115_0001', () => {
    expect(tagsForUpload('IMG_20240115_0001.jpg', 'image/jpeg')).toEqual([
      'image',
      'jpeg',
    ]);
  });

  it('ignores filler words like copy and final', () => {
    expect(tagsForUpload('holiday copy final.mp4', 'video/mp4')).toEqual([
      'holiday',
      'video',
      'mp4',
    ]);
  });

  it('ignores very short words', () => {
    expect(tagsForUpload('a to my cat.jpg', 'image/jpeg')).toEqual([
      'cat',
      'image',
      'jpeg',
    ]);
  });

  it('never repeats a tag', () => {
    const tags = tagsForUpload('image image photo photo.png', 'image/png');
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('takes at most 8 words from the filename', () => {
    const name = 'one two three four five six seven eight nine ten.jpg';
    const tags = tagsForUpload(name, 'image/jpeg');
    expect(tags).not.toContain('nine');
    expect(tags).not.toContain('ten');
    expect(tags).toContain('eight');
  });

  it('tags a PDF as a document', () => {
    expect(tagsForUpload('Annual Report.pdf', 'application/pdf')).toEqual([
      'annual',
      'report',
      'document',
      'pdf',
    ]);
  });

  it('refuses a file type we do not support', () => {
    expect(() => tagsForUpload('notes.txt', 'text/plain')).toThrow(
      /Only image, video and PDF/,
    );
  });
});
