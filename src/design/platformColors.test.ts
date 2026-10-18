import { getPlatformBadgeStyle, isPlatformTag, PLATFORM_COLOR_MAP } from './platformColors';

describe('platformColors', () => {
  it('maps behance to blue', () => {
    const style = getPlatformBadgeStyle('behance');
    expect(style).not.toBeNull();
    expect(style?.backgroundColor).toBe('#0057FF');
    expect(style?.textColor).toBe('#FFFFFF');
  });

  it('maps dribble and dribbble to pink', () => {
    const styleDribble = getPlatformBadgeStyle('dribble');
    const styleDribbble = getPlatformBadgeStyle('dribbble');
    expect(styleDribble?.backgroundColor).toBe('#EA4C89');
    expect(styleDribbble?.backgroundColor).toBe('#EA4C89');
    expect(styleDribble?.textColor).toBe('#FFFFFF');
  });

  it('maps pinterest to red', () => {
    const style = getPlatformBadgeStyle('pinterest');
    expect(style?.backgroundColor).toBe('#E60023');
    expect(style?.textColor).toBe('#FFFFFF');
  });

  it('maps instagram to light purple', () => {
    const style = getPlatformBadgeStyle('instagram');
    expect(style?.backgroundColor).toBe('#C084FC');
    expect(style?.textColor).toBe('#000000');
  });

  it('maps tiktok to cyan', () => {
    const style = getPlatformBadgeStyle('tiktok');
    expect(style?.backgroundColor).toBe('#00F2FE');
    expect(style?.textColor).toBe('#000000');
  });

  it('maps youtube to maroon', () => {
    const style = getPlatformBadgeStyle('youtube');
    expect(style?.backgroundColor).toBe('#800000');
    expect(style?.textColor).toBe('#FFFFFF');
  });

  it('handles case-insensitivity, leading symbols, and count suffixes', () => {
    expect(getPlatformBadgeStyle('INSTAGRAM')?.backgroundColor).toBe('#C084FC');
    expect(getPlatformBadgeStyle('#instagram')?.backgroundColor).toBe('#C084FC');
    expect(getPlatformBadgeStyle('instagram ✕')?.backgroundColor).toBe('#C084FC');
    expect(getPlatformBadgeStyle('INSTAGRAM (5)')?.backgroundColor).toBe('#C084FC');
    expect(getPlatformBadgeStyle('BEHANCE')?.backgroundColor).toBe('#0057FF');
    expect(getPlatformBadgeStyle('#behance')?.backgroundColor).toBe('#0057FF');
    expect(getPlatformBadgeStyle('TIKTOK (12)')?.backgroundColor).toBe('#00F2FE');
    expect(getPlatformBadgeStyle('YOUTUBE')?.backgroundColor).toBe('#800000');
    expect(getPlatformBadgeStyle('PINTEREST')?.backgroundColor).toBe('#E60023');
    expect(getPlatformBadgeStyle('#pinterest')?.backgroundColor).toBe('#E60023');
    expect(getPlatformBadgeStyle('DRIBBLE')?.backgroundColor).toBe('#EA4C89');
  });

  it('correctly identifies platform tags to remove duplication', () => {
    expect(isPlatformTag('instagram')).toBe(true);
    expect(isPlatformTag('#instagram')).toBe(true);
    expect(isPlatformTag('pinterest')).toBe(true);
    expect(isPlatformTag('behance')).toBe(true);
    expect(isPlatformTag('dribbble')).toBe(true);
    expect(isPlatformTag('dribble')).toBe(true);
    expect(isPlatformTag('tiktok')).toBe(true);
    expect(isPlatformTag('youtube')).toBe(true);
    expect(isPlatformTag('x')).toBe(true);
    expect(isPlatformTag('web')).toBe(true);
    expect(isPlatformTag('custom-brand-tag', 'custom-brand-tag')).toBe(true);

    // Non-platform content tags
    expect(isPlatformTag('typography')).toBe(false);
    expect(isPlatformTag('architecture')).toBe(false);
    expect(isPlatformTag('branding')).toBe(false);
    expect(isPlatformTag('minimalism')).toBe(false);
    expect(isPlatformTag(null)).toBe(false);
    expect(isPlatformTag(undefined)).toBe(false);
  });

  it('returns null for unknown platforms', () => {
    expect(getPlatformBadgeStyle('unknown')).toBeNull();
    expect(getPlatformBadgeStyle(null)).toBeNull();
    expect(getPlatformBadgeStyle(undefined)).toBeNull();
  });
});
