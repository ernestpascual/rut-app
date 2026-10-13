import { lightColors, darkColors, colors } from './tokens';

describe('Design Tokens - Light & Dark Modes', () => {
  it('has identical color token keys across light and dark palettes', () => {
    const lightKeys = Object.keys(lightColors).sort();
    const darkKeys = Object.keys(darkColors).sort();
    expect(lightKeys).toEqual(darkKeys);
  });

  it('maintains strict high-contrast editorial monochrome canvas and ink in light mode', () => {
    expect(lightColors.canvas).toBe('#ffffff');
    expect(lightColors.ink).toBe('#000000');
    expect(lightColors.onInk).toBe('#ffffff');
    expect(lightColors.hairline).toBe('#000000');
  });

  it('maintains strict high-contrast editorial monochrome canvas and ink in dark mode', () => {
    expect(darkColors.canvas).toBe('#000000');
    expect(darkColors.surfaceContent).toBe('#000000');
    expect(darkColors.surfaceGrade).toBe('#000000');
    expect(darkColors.ink).toBe('#ffffff');
    expect(darkColors.onInk).toBe('#000000');
    expect(darkColors.hairline).toBe('#ffffff');
  });

  it('preserves backwards compatibility default colors pointing to lightColors', () => {
    expect(colors).toEqual(lightColors);
  });

  it('keeps error red scoped strictly to validation token statusError', () => {
    expect(lightColors.statusError).toBe('#db1215');
    expect(darkColors.statusError).toBe('#ff453a');
  });

  it('guarantees pure black background and white text/elements in dark mode, and pure white background and black text/elements in light mode', () => {
    // Dark mode: all background black, all text/elements white
    expect(darkColors.canvas).toBe('#000000');
    expect(darkColors.surfaceGrade).toBe('#000000');
    expect(darkColors.surfaceContent).toBe('#000000');
    expect(darkColors.ink).toBe('#ffffff');
    expect(darkColors.hairline).toBe('#ffffff');

    // Light mode: all background white, all text/elements black
    expect(lightColors.canvas).toBe('#ffffff');
    expect(lightColors.surfaceGrade).toBe('#ffffff');
    expect(lightColors.surfaceContent).toBe('#ffffff');
    expect(lightColors.ink).toBe('#000000');
    expect(lightColors.hairline).toBe('#000000');
  });
});
