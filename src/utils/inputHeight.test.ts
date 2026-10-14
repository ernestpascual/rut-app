import { calculateDynamicInputHeight, MIN_INPUT_HEIGHT, MAX_INPUT_HEIGHT } from './inputHeight';

describe('calculateDynamicInputHeight', () => {
  it('defaults to 1 line (44px) when empty or whitespace', () => {
    expect(calculateDynamicInputHeight('')).toBe(MIN_INPUT_HEIGHT);
    expect(calculateDynamicInputHeight('   ')).toBe(MIN_INPUT_HEIGHT);
    // Even if measuredContentHeight is reported on mount, empty text stays at 1 line default
    expect(calculateDynamicInputHeight('', 120)).toBe(MIN_INPUT_HEIGHT);
    expect(calculateDynamicInputHeight('   ', 80)).toBe(MIN_INPUT_HEIGHT);
  });

  it('defaults to 1 line (44px) for single-line text without newlines', () => {
    expect(calculateDynamicInputHeight('Hello world')).toBe(44);
    expect(calculateDynamicInputHeight('A quick brown fox jumps over the lazy dog')).toBe(44);
  });

  it('expands to 2 lines when another line is added', () => {
    const twoLines = 'Line 1\nLine 2';
    expect(calculateDynamicInputHeight(twoLines)).toBe(64);
  });

  it('expands to 3 lines when third line is added', () => {
    const threeLines = 'Line 1\nLine 2\nLine 3';
    expect(calculateDynamicInputHeight(threeLines)).toBe(84);
  });

  it('expands to 4 lines when fourth line is added', () => {
    const fourLines = '1\n2\n3\n4';
    expect(calculateDynamicInputHeight(fourLines)).toBe(104);
  });

  it('expands to 5 lines maximum when fifth line is added', () => {
    const fiveLines = '1\n2\n3\n4\n5';
    expect(calculateDynamicInputHeight(fiveLines)).toBe(MAX_INPUT_HEIGHT);
  });

  it('caps at 5 lines (124px) for 6 or more lines', () => {
    const sevenLines = '1\n2\n3\n4\n5\n6\n7';
    expect(calculateDynamicInputHeight(sevenLines)).toBe(MAX_INPUT_HEIGHT);
  });

  it('contracts back to 1 line when text is cleared or reduced', () => {
    expect(calculateDynamicInputHeight('Line 1\nLine 2')).toBe(64);
    expect(calculateDynamicInputHeight('Line 1')).toBe(44);
    expect(calculateDynamicInputHeight('')).toBe(44);
  });
});
