import { computeNextPosition, Position, Direction } from "../../utils/movement";

export interface MovementState {
  popupId: string;
  position: Position;
  direction: Direction;
  popupWidth: number;
  popupHeight: number;
  screenWidth: number;
  screenHeight: number;
  speed: number;
}

export interface CreateMovementOptions {
  popupId: string;
  popupWidth: number;
  popupHeight: number;
  screenWidth: number;
  screenHeight: number;
  speed: number;
}

/**
 * Determine whether a popup should move based on chance (0-100) and a seed.
 */
export function shouldMove(chance: number, seed: number): boolean {
  if (chance === 0) return false;
  if (chance >= 100) return true;
  const hash = ((seed * 1103515245 + 12345) & 0x7fffffff) % 100;
  return hash < chance;
}

/**
 * Create initial movement state for a popup.
 * Position starts at a random location within bounds.
 */
export function createMovementState({
  popupId,
  popupWidth,
  popupHeight,
  screenWidth,
  screenHeight,
  speed,
}: CreateMovementOptions): MovementState {
  const maxX = Math.max(0, screenWidth - popupWidth);
  const maxY = Math.max(0, screenHeight - popupHeight);

  return {
    popupId,
    position: {
      x: Math.floor(Math.random() * maxX),
      y: Math.floor(Math.random() * maxY),
    },
    direction: {
      dx: Math.random() > 0.5 ? 1 : -1,
      dy: Math.random() > 0.5 ? 1 : -1,
    },
    popupWidth,
    popupHeight,
    screenWidth,
    screenHeight,
    speed,
  };
}

/**
 * Advance the movement state by one tick.
 * Returns updated state with new position and direction.
 */
export function tickMovement(state: MovementState): MovementState {
  const result = computeNextPosition(
    state.position,
    state.direction,
    state.speed,
    state.popupWidth,
    state.popupHeight,
    state.screenWidth,
    state.screenHeight
  );

  return {
    ...state,
    position: result.position,
    direction: result.direction,
  };
}

/**
 * Manage a collection of moving popups.
 * Returns an object keyed by popupId with their current movement state.
 */
export class PopupMovementManager {
  private states: Map<string, MovementState> = new Map();

  register(options: CreateMovementOptions): MovementState {
    const state = createMovementState(options);
    this.states.set(options.popupId, state);
    return state;
  }

  unregister(popupId: string): void {
    this.states.delete(popupId);
  }

  tick(popupId: string): MovementState | null {
    const state = this.states.get(popupId);
    if (!state) return null;

    const updated = tickMovement(state);
    this.states.set(popupId, updated);
    return updated;
  }

  getAllStates(): MovementState[] {
    return Array.from(this.states.values());
  }

  clear(): void {
    this.states.clear();
  }
}
