import { describe, expect, it } from "vitest";
import {
  createMovementState,
  tickMovement,
  shouldMove,
} from "../../src/features/motion/PopupMovementManager";

describe("shouldMove", () => {
  it("never moves when chance is 0", () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(0, i)).toBe(false);
    }
  });

  it("always moves when chance is 100", () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(100, i)).toBe(true);
    }
  });

  it("moves approximately at the configured chance rate", () => {
    let moveCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldMove(50, i)) moveCount++;
    }
    const rate = moveCount / 1000;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.65);
  });
});

describe("createMovementState", () => {
  it("creates movement state with initial position and direction", () => {
    const state = createMovementState({
      popupId: "popup-1",
      popupWidth: 400,
      popupHeight: 300,
      screenWidth: 1920,
      screenHeight: 1080,
      speed: 10,
    });

    expect(state.popupId).toBe("popup-1");
    expect(state.position.x).toBeGreaterThanOrEqual(0);
    expect(state.position.y).toBeGreaterThanOrEqual(0);
    expect(state.direction.dx).not.toBe(0);
    expect(state.direction.dy).not.toBe(0);
  });
});

describe("tickMovement", () => {
  it("moves popup by speed amount in current direction", () => {
    let state = createMovementState({
      popupId: "popup-1",
      popupWidth: 400,
      popupHeight: 300,
      screenWidth: 1920,
      screenHeight: 1080,
      speed: 5,
    });

    const posBefore = { ...state.position };
    state = tickMovement(state);

    const dx = Math.abs(state.position.x - posBefore.x);
    const dy = Math.abs(state.position.y - posBefore.y);
    expect(dx + dy).toBeGreaterThan(0);
  });

  it("bounces off screen edges over multiple ticks", () => {
    let state = createMovementState({
      popupId: "popup-1",
      popupWidth: 400,
      popupHeight: 300,
      screenWidth: 800,
      screenHeight: 600,
      speed: 20,
    });

    const positions = [];
    for (let i = 0; i < 100; i++) {
      positions.push({ ...state.position });
      state = tickMovement(state);
    }

    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.x + 400).toBeLessThanOrEqual(800);
      expect(pos.y + 300).toBeLessThanOrEqual(600);
    }
  });

  it("position stays within bounds after many ticks", () => {
    let state = createMovementState({
      popupId: "popup-1",
      popupWidth: 200,
      popupHeight: 150,
      screenWidth: 1920,
      screenHeight: 1080,
      speed: 15,
    });

    for (let i = 0; i < 500; i++) {
      state = tickMovement(state);
      expect(state.position.x).toBeGreaterThanOrEqual(0);
      expect(state.position.y).toBeGreaterThanOrEqual(0);
      expect(state.position.x + 200).toBeLessThanOrEqual(1920);
      expect(state.position.y + 150).toBeLessThanOrEqual(1080);
    }
  });
});
