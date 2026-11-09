/**
 * @file panicLockout — Pure rules for the panic lockout window.
 *
 * With `timerMode` on, panic is blocked until the configured deadline passes.
 * During the window, panic only succeeds with the exact safeword (legacy
 * prompt is case-sensitive). An unset safeword matches nothing, so the user
 * must wait out the timer.
 */

export interface LockoutInput {
  enabled: boolean;
  /** Epoch ms when the lockout ends; 0 means no lockout was started. */
  until: number;
  now: number;
}

export function isLockoutActive({ enabled, until, now }: LockoutInput): boolean {
  return enabled && until > 0 && now < until;
}

export function safewordMatches(input: string, stored: string): boolean {
  if (!stored) return false;
  return input === stored;
}
