import {
  extractUrlFromText,
  normalizeUrl,
  detectPlatform,
  extractDomain,
  generateContentHash,
  extractInstagramUrl
} from './url';
import { redirectSystemPath } from '../../app/+native-intent';

describe('URL Utilities', () => {
  test('extracts valid HTTP/HTTPS URLs from mixed text', () => {
    const text = 'Check out this post https://instagram.com/p/C_12345678/ it is cool';
    expect(extractUrlFromText(text)).toBe('https://instagram.com/p/C_12345678/');

    const withTrailingPunctuation = 'Check this out: https://www.instagram.com/p/abc123/.';
    expect(extractUrlFromText(withTrailingPunctuation)).toBe('https://www.instagram.com/p/abc123/');

    expect(extractUrlFromText('No link here')).toBeNull();
    expect(extractUrlFromText('ftp://invalid.com/file')).toBeNull();
  });

  test('normalizes URLs and strips tracking parameters including Instagram igsh and igshid', () => {
    const raw = 'https://example.com/article?utm_source=twitter&utm_medium=social&igshid=abc1234&id=42';
    const normalized = normalizeUrl(raw);
    expect(normalized).toBe('https://example.com/article?id=42');

    const igRaw = 'https://www.instagram.com/reel/C_xyz123/?igsh=MWF5eGR1OG1xM3RjNA==&utm_source=ig_web_copy_link';
    expect(normalizeUrl(igRaw)).toBe('https://www.instagram.com/reel/C_xyz123/');

    const rootUrl = 'https://example.com/';
    expect(normalizeUrl(rootUrl)).toBe('https://example.com');
  });

  test('extracts and normalizes Instagram URLs from share text or links', () => {
    const shareText = 'Studio Koto on Instagram: "Brutalist identity system" https://www.instagram.com/reel/C-xyz123/?igsh=abc1234';
    expect(extractInstagramUrl(shareText)).toBe('https://www.instagram.com/reel/C-xyz123/');

    const rawIgNoProto = 'instagram.com/p/C-abc987/?igsh=123';
    expect(extractInstagramUrl(rawIgNoProto)).toBe('https://instagram.com/p/C-abc987/');
  });

  test('redirectSystemPath routes mobile Instagram and deep links to /share-target', () => {
    // Standard query intent
    const res1 = redirectSystemPath({ path: 'rut://share?url=https://www.instagram.com/reel/123/', initial: true });
    expect(res1).toContain('/share-target?');
    expect(res1).toContain('https%3A%2F%2Fwww.instagram.com%2Freel%2F123%2F');

    // Instagram link directly in scheme
    const res2 = redirectSystemPath({ path: 'rut://https://www.instagram.com/p/abc123/?igsh=test', initial: true });
    expect(res2).toContain('/share-target?url=');
    expect(res2).toContain('https%3A%2F%2Fwww.instagram.com%2Fp%2Fabc123%2F');

    // Instagram shared text with reel
    const res3 = redirectSystemPath({
      path: 'rut://share?text=Check out this reel on Instagram: https://www.instagram.com/reel/123/',
      initial: false
    });
    expect(res3).toContain('/share-target?');

    // Standard internal routes remain untouched
    expect(redirectSystemPath({ path: '/(app)/(tabs)/bank', initial: false })).toBe('/(app)/(tabs)/bank');
    expect(redirectSystemPath({ path: '/(app)/project/p-1', initial: false })).toBe('/(app)/project/p-1');
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
