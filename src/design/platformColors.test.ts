import { getPlatformBadgeStyle, PLATFORM_COLOR_MAP } from './platformColors';

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

  it('handles case-insensitivity and uppercase labels', () => {
    expect(getPlatformBadgeStyle('INSTAGRAM')?.backgroundColor).toBe('#C084FC');
    expect(getPlatformBadgeStyle('BEHANCE')?.backgroundColor).toBe('#0057FF');
    expect(getPlatformBadgeStyle('TIKTOK')?.backgroundColor).toBe('#00F2FE');
    expect(getPlatformBadgeStyle('YOUTUBE')?.backgroundColor).toBe('#800000');
    expect(getPlatformBadgeStyle('PINTEREST')?.backgroundColor).toBe('#E60023');
    expect(getPlatformBadgeStyle('DRIBBLE')?.backgroundColor).toBe('#EA4C89');
  });

  it('returns null for unknown platforms', () => {
    expect(getPlatformBadgeStyle('web')).toBeNull();
    expect(getPlatformBadgeStyle('unknown')).toBeNull();
    expect(getPlatformBadgeStyle(null)).toBeNull();
    expect(getPlatformBadgeStyle(undefined)).toBeNull();
  });
});
