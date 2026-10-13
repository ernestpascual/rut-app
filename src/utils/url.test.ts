import {
  extractUrlFromText,
  normalizeUrl,
  detectPlatform,
  extractDomain,
  generateContentHash
} from './url';

describe('URL Utilities', () => {
  test('extracts valid HTTP/HTTPS URLs from mixed text', () => {
    const text = 'Check out this post https://instagram.com/p/C_12345678/ it is cool';
    expect(extractUrlFromText(text)).toBe('https://instagram.com/p/C_12345678/');

    expect(extractUrlFromText('No link here')).toBeNull();
    expect(extractUrlFromText('ftp://invalid.com/file')).toBeNull();
  });

  test('normalizes URLs and strips tracking parameters', () => {
    const raw = 'https://example.com/article?utm_source=twitter&utm_medium=social&igshid=abc1234&id=42';
    const normalized = normalizeUrl(raw);
    expect(normalized).toBe('https://example.com/article?id=42');

    const rootUrl = 'https://example.com/';
    expect(normalizeUrl(rootUrl)).toBe('https://example.com');
  });

  test('detects social platforms accurately', () => {
    expect(detectPlatform('https://www.instagram.com/p/123')).toBe('instagram');
    expect(detectPlatform('https://www.pinterest.com/pin/12345/')).toBe('pinterest');
    expect(detectPlatform('https://pin.it/abcd123')).toBe('pinterest');
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    expect(detectPlatform('https://x.com/username/status/123')).toBe('x');
    expect(detectPlatform('https://t.co/abc')).toBe('x');
    expect(detectPlatform('https://www.threads.net/@user/post/123')).toBe('threads');
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectPlatform('https://news.ycombinator.com')).toBe('web');
    expect(detectPlatform('not-a-url')).toBe('other');
  });

  test('extracts domain correctly', () => {
    expect(extractDomain('https://www.nytimes.com/section/world')).toBe('nytimes.com');
    expect(extractDomain('https://sub.domain.co.uk/page')).toBe('sub.domain.co.uk');
  });

  test('generates deterministic content hash', () => {
    const hash1 = generateContentHash('https://example.com/test');
    const hash2 = generateContentHash('https://example.com/test');
    const hash3 = generateContentHash('https://example.com/different');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(typeof hash1).toBe('string');
  });
});
