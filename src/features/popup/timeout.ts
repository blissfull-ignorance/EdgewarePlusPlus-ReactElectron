/**
 * Pure timeout functions for popup auto-close.
 *
 * All functions are pure and testable in isolation. The auto-close system
 * checks elapsed time since spawn against a configurable timeout in seconds.
 */

export interface TimeoutPopup {
  id: number
  type: 'image' | 'video' | 'audio'
  spawnTime: number
}

/**
 * Returns true when the popup has exceeded the timeout duration.
 *
 * @param spawnTime - Date.now() timestamp when the popup was created
 * @param timeoutSeconds - timeout duration in seconds (1–300)
 * @param now - current timestamp (Date.now()), injectable for testing
 * @returns true when elapsed time >= timeoutSeconds * 1000
 */
export function shouldAutoClose(
  spawnTime: number,
  timeoutSeconds: number,
  now: number,
): boolean {
  return now - spawnTime >= timeoutSeconds * 1000
}

/**
 * Filters popups that should be auto-closed, excluding audio popups
 * (no visual presence to close).
 *
 * @returns IDs of visual popups that have exceeded the timeout
 */
export function getExpiredPopupIds(
  popups: TimeoutPopup[],
  timeoutSeconds: number,
  now: number,
): number[] {
  const expired: number[] = []
  for (const p of popups) {
    if (p.type === 'audio') continue
    if (shouldAutoClose(p.spawnTime, timeoutSeconds, now)) {
      expired.push(p.id)
    }
  }
  return expired
}
