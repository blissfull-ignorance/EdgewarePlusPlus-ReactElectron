import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "../../src/stores/appStore";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("Integration: Popup spawn, close, and mitosis flow", () => {
  beforeEach(() => {
    useAppStore.getState().stop();
    useCorruptionStore.getState().reset();
    useSettingsStore.setState({
      mitosisMode: 0,
      mitosisStrength: 0,
      corruptionMode: 0,
      hibernateMode: 0,
      delay: 5000,
      popupMod: 100,
      vidMod: 0,
    });
  });

  it("popup count increments on spawn and decrements on close", () => {
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);
    useAppStore.getState().incrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(2);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(1);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("popup count does not go below zero", () => {
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
    useAppStore.getState().decrementPopups();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("stop resets popup count and hibernate state", () => {
    useAppStore.getState().start();
    useAppStore.getState().incrementPopups();
    useAppStore.getState().setHibernateActive(true);
    expect(useAppStore.getState().isRunning).toBe(true);
    expect(useAppStore.getState().popupsCount).toBe(1);
    expect(useAppStore.getState().hibernateActive).toBe(true);

    useAppStore.getState().stop();
    expect(useAppStore.getState().isRunning).toBe(false);
    expect(useAppStore.getState().popupsCount).toBe(0);
    expect(useAppStore.getState().hibernateActive).toBe(false);
  });

  it("mitosis triggers when popups reach zero and mitosisMode is active", () => {
    useSettingsStore.setState({ mitosisMode: 1, mitosisStrength: 3 });

    let mitosisTriggered = false;
    let prevCount = 0;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (
        state.popupsCount === 0 &&
        prevCount > 0 &&
        useSettingsStore.getState().mitosisMode === 1
      ) {
        mitosisTriggered = true;
      }
      prevCount = state.popupsCount;
    });

    useAppStore.getState().incrementPopups();
    useAppStore.getState().decrementPopups();

    unsubscribe();
    expect(mitosisTriggered).toBe(true);
  });

  it("mitosis does not trigger when mitosisMode is off", () => {
    useSettingsStore.setState({ mitosisMode: 0, mitosisStrength: 0 });

    let mitosisTriggered = false;
    let prevCount = 0;

    const unsubscribe = useAppStore.subscribe((state) => {
      if (
        state.popupsCount === 0 &&
        prevCount > 0 &&
        useSettingsStore.getState().mitosisMode === 1
      ) {
        mitosisTriggered = true;
      }
      prevCount = state.popupsCount;
    });

    useAppStore.getState().incrementPopups();
    useAppStore.getState().decrementPopups();

    unsubscribe();
    expect(mitosisTriggered).toBe(false);
  });
});

describe("Integration: Corruption mode transitions with mood changes", () => {
  beforeEach(() => {
    useCorruptionStore.getState().reset();
    useSettingsStore.setState({ corruptionMode: 0 });
  });

  it("loads corruption data and transitions correctly", () => {
    const rawData = {
      moods: {
        "1": { add: ["submissive", "beginner"], remove: [] },
        "2": { add: ["dominant"], remove: ["submissive"] },
        "3": { add: ["intense"], remove: ["beginner"] },
      },
      config: {
        "1": { popupMod: 40 },
        "2": { popupMod: 50, audioMod: 50 },
        "3": { popupMod: 80 },
      },
    };

    useCorruptionStore.getState().loadCorruptionData(rawData);
    expect(Object.keys(useCorruptionStore.getState().levels)).toHaveLength(3);

    const overrides1 = useCorruptionStore.getState().transitionTo(1);
    expect(useCorruptionStore.getState().currentLevel).toBe(1);
    expect(useCorruptionStore.getState().activeMoods).toContain("submissive");
    expect(useCorruptionStore.getState().activeMoods).toContain("beginner");
    expect(overrides1).toEqual({ popupMod: 40 });

    const overrides2 = useCorruptionStore.getState().transitionTo(2);
    expect(useCorruptionStore.getState().currentLevel).toBe(2);
    expect(useCorruptionStore.getState().activeMoods).not.toContain("submissive");
    expect(useCorruptionStore.getState().activeMoods).toContain("beginner");
    expect(useCorruptionStore.getState().activeMoods).toContain("dominant");
    expect(overrides2).toEqual({ popupMod: 50, audioMod: 50 });
  });

  it("transition log records level changes", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: {
        "1": { add: ["a"], remove: [] },
        "2": { add: ["b"], remove: ["a"] },
      },
    });

    useCorruptionStore.getState().transitionTo(1);
    useCorruptionStore.getState().transitionTo(2);

    const transitions = useCorruptionStore.getState().transitions;
    expect(transitions).toContain("0→1");
    expect(transitions).toContain("1→2");
  });

  it("reset clears corruption state", () => {
    useCorruptionStore.getState().loadCorruptionData({
      moods: { "1": { add: ["test"], remove: [] } },
    });
    useCorruptionStore.getState().transitionTo(1);
    useCorruptionStore.getState().setDriverType("audio");
    useCorruptionStore.getState().setNextLevelTime(Date.now() + 60000);

    useCorruptionStore.getState().reset();

    expect(useCorruptionStore.getState().currentLevel).toBe(0);
    expect(useCorruptionStore.getState().activeMoods).toEqual([]);
    expect(useCorruptionStore.getState().nextLevelTime).toBeNull();
    expect(useCorruptionStore.getState().driverType).toBe("timer");
    expect(useCorruptionStore.getState().transitions).toEqual([]);
    expect(Object.keys(useCorruptionStore.getState().levels)).toHaveLength(0);
  });
});

describe("Integration: Settings persistence round-trip", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      mitosisMode: 0,
      mitosisStrength: 0,
      corruptionMode: 0,
      hibernateMode: 0,
      delay: 5000,
      popupMod: 100,
      vidMod: 100,
      packPath: null,
    });
  });

  it("setRaw updates settings and they are readable via getState", () => {
    useSettingsStore.getState().setRaw({
      popupMod: 75,
      vidMod: 25,
      delay: 2000,
      mitosisMode: 1,
      mitosisStrength: 5,
      corruptionMode: 1,
    });

    const state = useSettingsStore.getState();
    expect(state.popupMod).toBe(75);
    expect(state.vidMod).toBe(25);
    expect(state.delay).toBe(2000);
    expect(state.mitosisMode).toBe(1);
    expect(state.mitosisStrength).toBe(5);
    expect(state.corruptionMode).toBe(1);
  });

  it("save serializes settings correctly", () => {
    useSettingsStore.getState().setRaw({
      popupMod: 50,
      corruptionMode: 1,
    });

    const state = useSettingsStore.getState();
    const serialized: Record<string, unknown> = {};
    for (const key of Object.keys(state)) {
      if (typeof state[key as keyof typeof state] !== "function") {
        serialized[key] = state[key as keyof typeof state];
      }
    }

    expect(serialized.popupMod).toBe(50);
    expect(serialized.corruptionMode).toBe(1);
    expect(serialized.delay).toBe(5000);
    expect(typeof serialized.load).toBe("undefined");
    expect(typeof serialized.save).toBe("undefined");
    expect(typeof serialized.setRaw).toBe("undefined");
  });
});
