/**
 * Calculates dynamic input height starting at 1 line (44px)
 * and expanding up to 5 lines (~124px) as lines are added.
 */
export const MIN_INPUT_HEIGHT = 44; // 1 line default
export const MAX_INPUT_HEIGHT = 124; // 5 lines maximum
export const LINE_HEIGHT = 20;

export function calculateDynamicInputHeight(text: string, measuredContentHeight?: number): number {
  if (!text || text.trim().length === 0) {
    return MIN_INPUT_HEIGHT;
  }

  // Count explicit newlines
  const lineCount = text.split('\n').length;

  if (lineCount === 1) {
    // Only 1 line: stay at 1 line default (44px) unless text wrapped heavily
    if (measuredContentHeight && measuredContentHeight > 48) {
      return Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, Math.round(measuredContentHeight + 8)));
    }
    return MIN_INPUT_HEIGHT;
  }

  // Explicit multiple lines: calculate height based on lines
  const lineBasedHeight = 24 + lineCount * LINE_HEIGHT;

  if (measuredContentHeight && measuredContentHeight > 40) {
    return Math.min(
      MAX_INPUT_HEIGHT,
      Math.max(MIN_INPUT_HEIGHT, Math.max(lineBasedHeight, Math.round(measuredContentHeight + 8)))
    );
  }

  return Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, lineBasedHeight));
}
