import { describe, expect, it } from "vitest";
import { simulatePopupMovement } from "../../src/utils/movement";

describe("simulatePopupMovement", () => {
  const SCREEN_WIDTH = 1920;
  const SCREEN_HEIGHT = 1080;
  const POPUP_WIDTH = 400;
  const POPUP_HEIGHT = 300;

  it("moves at configured speed", () => {
    const positions = simulatePopupMovement(
      { x: 100, y: 100 },
      { dx: 5, dy: 3 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      10,
      100
    );

    expect(positions.length).toBe(100);
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      const movedX = Math.abs(curr.x - prev.x);
      const movedY = Math.abs(curr.y - prev.y);
      expect(movedX + movedY).toBeGreaterThan(0);
    }
  });

  it("bounces off right edge", () => {
    const startX = SCREEN_WIDTH - POPUP_WIDTH - 10;
    const positions = simulatePopupMovement(
      { x: startX, y: 500 },
      { dx: 10, dy: 0 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      5,
      50
    );

    // Verify that the popup reached the right edge and bounced back
    let bouncedBack = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].x < positions[i - 1].x && positions[i].x >= 0) {
        bouncedBack = true;
      }
    }
    expect(bouncedBack).toBe(true);
  });

  it("bounces off left edge", () => {
    const positions = simulatePopupMovement(
      { x: 0, y: 500 },
      { dx: -5, dy: 0 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      5,
      50
    );

    let bouncedBack = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].x > positions[i - 1].x && positions[i].x >= 0) {
        bouncedBack = true;
      }
    }
    expect(bouncedBack).toBe(true);
  });

  it("bounces off top edge", () => {
    const positions = simulatePopupMovement(
      { x: 500, y: 0 },
      { dx: 0, dy: -5 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      5,
      50
    );

    let bouncedBack = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].y > positions[i - 1].y && positions[i].y >= 0) {
        bouncedBack = true;
      }
    }
    expect(bouncedBack).toBe(true);
  });

  it("bounces off bottom edge", () => {
    const startY = SCREEN_HEIGHT - POPUP_HEIGHT - 10;
    const positions = simulatePopupMovement(
      { x: 500, y: startY },
      { dx: 0, dy: 5 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      5,
      50
    );

    let bouncedBack = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].y < positions[i - 1].y && positions[i].y >= 0) {
        bouncedBack = true;
      }
    }
    expect(bouncedBack).toBe(true);
  });

  it("stays within screen boundaries", () => {
    const positions = simulatePopupMovement(
      { x: 960, y: 540 },
      { dx: 8, dy: 6 },
      POPUP_WIDTH,
      POPUP_HEIGHT,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      10,
      200
    );

    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.x + POPUP_WIDTH).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(pos.y + POPUP_HEIGHT).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  it("never produces negative offsets when the popup is bigger than its bounds", () => {
    // Electron popup windows are small (400x300) while media defaults are larger;
    // with naive clamp math the position oscillated into negative space, pushing
    // all content out of view. It must stay pinned within [0, max(0, bound-size)].
    const positions = simulatePopupMovement(
      { x: 0, y: 0 },
      { dx: 10, dy: 10 },
      640,
      480,
      400,
      300,
      10,
      500
    );

    for (const pos of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(Math.max(0, 400 - 640));
      expect(pos.y).toBeLessThanOrEqual(Math.max(0, 300 - 480));
    }
  });
});
