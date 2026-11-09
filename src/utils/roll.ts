/**
 * Legacy probability roll: randomInt(1..100) <= chance.
 * roll(0) always returns false, roll(100) always returns true.
 * Inclusive bounds on both ends, matching the legacy Python randint(1, 100).
 */
export function roll(chance: number): boolean {
  return Math.floor(Math.random() * 100) + 1 <= chance;
}
