/**
 * Levenshtein edit distance algorithm — used for PromptDialog validation.
 * Ported from legacy features/prompt.py.
 *
 * Computes the minimum number of single-character edits
 * (insertions, deletions, substitutions) to transform one string into another.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Subliminal alpha inversion — preserved from legacy exactly.
 *
 * Legacy uses: int((1 - opacity) * 255)
 * Higher opacity value = MORE transparent (inverted).
 *
 * @param opacity — 0.0 (fully opaque) to 1.0 (fully transparent)
 * @returns integer 0-255 alpha value
 */
export function computeSubliminalAlpha(opacity: number): number {
  return Math.floor((1 - opacity) * 255);
}
