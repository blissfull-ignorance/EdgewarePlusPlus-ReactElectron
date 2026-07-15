/**
 * Panic lockout pure functions — timer logic, safeword validation, and
 * lockout state transitions.
 *
 * FUTUREWORK: The Python version uses a simple `panic_lockout_active` boolean
 * with `root.after()` for the timer. The Electron version tracks an explicit
 * end timestamp so the renderer can compute remaining time for UI display.
 */

export interface LockoutState {
  lockoutEndTime: number | null
  isLockedOut: boolean
}

export function computeLockoutEndTime(lockoutMinutes: number): number {
  const ms = Math.max(1, lockoutMinutes) * 60 * 1000
  return Date.now() + ms
}

export function isLockoutActive(lockoutEndTime: number | null): boolean {
  if (lockoutEndTime === null) return false
  return Date.now() < lockoutEndTime
}

export function getRemainingMs(lockoutEndTime: number): number {
  return Math.max(0, lockoutEndTime - Date.now())
}

export function validateSafeword(input: string, safeword: string): boolean {
  if (!safeword) return true
  return input === safeword
}

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function shouldBlockPanic(
  inPanicMode: boolean,
  lockoutEndTime: number | null,
): boolean {
  if (inPanicMode) return false
  return isLockoutActive(lockoutEndTime)
}
