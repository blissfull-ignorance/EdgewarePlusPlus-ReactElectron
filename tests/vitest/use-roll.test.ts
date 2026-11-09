import { describe, expect, it, beforeEach } from "vitest";
import { duePopups } from "../../src/hooks/useRoll";
import { useSettingsStore } from "../../src/stores/settingsStore";

/**
 * The user-reported defect: with video set to 100% nothing ever spawned because
 * the old roll picked only the FIRST passing type (image at 100% shadowed it).
 * duePopups must evaluate every type independently.
 */
describe("duePopups (independent per-type rolls)", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      popupMod: 0,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      capPopChance: 0,
      webMod: 0,
      notificationChance: 0,
    });
  });

  const settings = () => useSettingsStore.getState();

  it("never schedules subliminal as a standalone spawn (it is an overlay now)", () => {
    useSettingsStore.setState({
      popupMod: 100,
      vidMod: 100,
      audioMod: 100,
      promptMod: 100,
      capPopChance: 100,
      webMod: 100,
      notificationChance: 100,
    });
    const due = duePopups(settings(), (chance) => chance > 0);
    expect(due).toContain("image");
    expect(due).toContain("video");
    expect(due).toContain("audio");
    expect(due).toContain("prompt");
    expect(due).toContain("notification");
    expect(due).not.toContain("subliminal");
  });

  it("fires a 100% type even when every other type is also 100% (no shadowing)", () => {
    useSettingsStore.setState({ popupMod: 100, vidMod: 100, audioMod: 100 });
    const due = duePopups(settings(), (chance) => chance >= 100);
    expect(due).toEqual(["image", "video", "audio"]);
  });

  it("returns nothing when no chance is set", () => {
    const due = duePopups(settings(), (chance) => chance > 0);
    expect(due).toEqual([]);
  });

  it("honours a strict pass-at-100 roll function", () => {
    useSettingsStore.setState({ popupMod: 100, vidMod: 50, promptMod: 100 });
    const due = duePopups(settings(), (chance) => chance >= 100);
    expect(due).toEqual(["image", "prompt"]);
  });

  it("is deterministic for a given roll function (no hidden Math.random)", () => {
    useSettingsStore.setState({ popupMod: 33, vidMod: 67 });
    const a = duePopups(settings(), (chance) => chance >= 67);
    const b = duePopups(settings(), (chance) => chance >= 67);
    expect(a).toEqual(b);
    expect(a).toEqual(["video"]);
  });
});

describe("duePopups (legacy single_mode: one weighted pick per tick)", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      popupMod: 0,
      vidMod: 0,
      audioMod: 0,
      promptMod: 0,
      capPopChance: 0,
      webMod: 0,
      notificationChance: 0,
      singleMode: 0,
    });
  });

  it("emits exactly one type per tick when enabled", () => {
    useSettingsStore.setState({ popupMod: 100, vidMod: 50, audioMod: 25, promptMod: 5, singleMode: 1 });
    for (let i = 0; i < 50; i++) {
      const due = duePopups(useSettingsStore.getState());
      expect(due.length).toBe(1);
    }
  });

  it("never picks a zero-chance type", () => {
    useSettingsStore.setState({ popupMod: 0, vidMod: 100, audioMod: 0, singleMode: 1 });
    for (let i = 0; i < 50; i++) {
      expect(duePopups(useSettingsStore.getState())).toEqual(["video"]);
    }
  });

  it("returns nothing when all chances are zero", () => {
    useSettingsStore.setState({ singleMode: 1 });
    expect(duePopups(useSettingsStore.getState())).toEqual([]);
  });

  it("respects the weight: a much higher chance dominates the picks", () => {
    useSettingsStore.setState({ popupMod: 10, vidMod: 90, singleMode: 1 });
    const due = duePopups(useSettingsStore.getState());
    expect(["image", "video"]).toContain(due[0]);
  });

  it("falls back to independent rolls when disabled", () => {
    useSettingsStore.setState({ popupMod: 100, vidMod: 100, singleMode: 0 });
    const due = duePopups(useSettingsStore.getState(), (chance) => chance > 0);
    expect(due).toContain("image");
    expect(due).toContain("video");
  });
});
