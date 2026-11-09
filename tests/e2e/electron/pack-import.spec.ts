import { expect, test } from "@playwright/test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { buildZip, buildRawZip } from "../../zipFixtures";
import {
  cleanupTempState,
  createTempState,
  ensureElectronBuild,
  launchApp,
  listPacksViaBridge,
  quitApp,
  type RunningApp,
  type TempState,
} from "./launch";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_SEED = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "E2E Seed Pack");
const REPO_PACKS = path.join(REPO_ROOT, "packs");

interface Fixtures {
  flatZip: string;
  nestedZip: string;
  evilZip: string;
  garbageZip: string;
  folderPack: string;
  flatDest: string;
  nestedDest: string;
}

let state: TempState | null = null;
let running: RunningApp | null = null;
let fixtures: Fixtures | null = null;

function setSeam(key: string, value: string): Promise<void> {
  return running!.app.evaluate(({ app }, [k, v]: [string, string]) => {
    void app;
    process.env[k] = v;
  }, [key, value]);
}

async function clearSeams(): Promise<void> {
  await running!.app.evaluate(() => {
    delete process.env.EDGWARE_IMPORT_TEST_PATH;
    delete process.env.EDGWARE_PACK_FOLDER_TEST_PATH;
  });
}

async function openPackManagement(): Promise<void> {
  const { window } = running!;
  await window.locator("[data-testid='main-tab-config']").click();
  await window.getByRole("tab", { name: "Pack Management" }).click();
}

async function selectPackByName(optionName: string): Promise<void> {
  const { window } = running!;
  const select = window.getByRole("textbox", { name: "Available Packs" });
  await select.click();
  await window.getByRole("option", { name: optionName }).click();
}

async function showStatusTab(): Promise<void> {
  const { window } = running!;
  await window.locator("[data-testid='main-tabs']").getByRole("button", { name: "Status" }).click();
}

function readConfigPackPath(): string | undefined {
  const configPath = path.join(state!.dir, "data", "config.json");
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as { packPath?: string };
    return cfg.packPath;
  } catch {
    return undefined;
  }
}

function readConfigPackFolders(): string[] {
  const configPath = path.join(state!.dir, "data", "config.json");
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8")) as { packFolders?: string[] };
    return Array.isArray(cfg.packFolders) ? cfg.packFolders : [];
  } catch {
    return [];
  }
}

test.beforeAll(async () => {
  ensureElectronBuild();
  state = createTempState();
  const fix = path.join(state!.dir, "fix");
  mkdirSync(fix, { recursive: true });

  const seedBytes = readFileSync(path.join(FIXTURE_SEED, "img", "seed.png"));
  const flatZip = path.join(fix, "flat-pack.zip");
  await buildZip(flatZip, {
    "info.json": JSON.stringify({ name: "Flat Import Pack", version: "3.1", creator: "E2E" }),
    "img/seed.png": seedBytes,
  });

  const nestedZip = path.join(fix, "nested-pack.zip");
  await buildZip(nestedZip, {
    "Nested Content/info.json": JSON.stringify({ name: "Nested Import Pack", version: "4.2" }),
    "Nested Content/img/seed.png": seedBytes,
    "Nested Content/vid/clip.mp4": Buffer.from("MP4-BYTES"),
  });

  const evilZip = path.join(fix, "evil-pack.zip");
  buildRawZip(evilZip, [
    { name: "../../escape.txt", data: Buffer.from("escaped") },
    { name: "inner.txt", data: Buffer.from("inner") },
  ]);

  const garbageZip = path.join(fix, "garbage.zip");
  writeFileSync(garbageZip, "this is not a zip archive at all");

  const folderPack = path.join(state!.dir, "elsewhere", "folder-pack");
  mkdirSync(folderPack, { recursive: true });
  writeFileSync(
    path.join(folderPack, "info.json"),
    JSON.stringify({ name: "Folder Pack", version: "9.9", creator: "E2E" })
  );

  fixtures = {
    flatZip,
    nestedZip,
    evilZip,
    garbageZip,
    folderPack,
    flatDest: path.join(state!.packsDir, "flat-pack"),
    nestedDest: path.join(state!.packsDir, "nested-pack"),
  };

  running = await launchApp(state!);
});

test.afterAll(async () => {
  if (running) await quitApp(running);
  cleanupTempState(state);
});

test("A20.1 importing a real zip via Import from file extracts it into the temp library", async () => {
  const { window } = running!;
  await setSeam("EDGWARE_IMPORT_TEST_PATH", fixtures!.flatZip);
  await openPackManagement();

  await window.locator("[data-testid='pack-import-zip-button']").click();

  await expect(
    window.locator(".mantine-Notification-root", { hasText: "Imported Flat Import Pack" }).last()
  ).toBeVisible({ timeout: 60000 });

  const dest = fixtures!.flatDest;
  expect(existsSync(path.join(dest, "info.json"))).toBe(true);
  expect(existsSync(path.join(dest, "img/seed.png"))).toBe(true);
  expect(readFileSync(path.join(dest, "img/seed.png"))).toEqual(
    readFileSync(path.join(FIXTURE_SEED, "img", "seed.png"))
  );

  const listed = await listPacksViaBridge(window);
  const imported = listed!.find((p) => p.path === dest);
  expect(imported).toBeTruthy();
  expect(imported!.name).toBe("Flat Import Pack");
  expect(imported!.version).toBe("3.1");

  await selectPackByName("Flat Import Pack (v3.1)");
  await showStatusTab();

  await expect(window.locator("[data-testid='pack-info']")).toContainText("Flat Import Pack");
  await expect(window.getByText("v3.1").first()).toBeVisible();
  expect(readConfigPackPath()).toBe(dest);

  const loaded = await window.evaluate(async () => {
    const api = (
      window as unknown as {
        api?: { pack?: { loadInfo?: () => Promise<Record<string, unknown> | null> } };
      }
    ).api;
    if (!api?.pack?.loadInfo) return null;
    return (await api.pack.loadInfo()) as Record<string, unknown> | null;
  });
  expect(loaded?.name).toBe("Flat Import Pack");

  await clearSeams();
});

test("A20.1b picker-selected file resolves a real path and collision imports as (2)", async () => {
  const { window } = running!;
  const secondDest = path.join(state!.packsDir, "flat-pack (2)");

  await openPackManagement();
  await window
    .locator("[data-testid='pack-dropzone'] input[type='file']")
    .setInputFiles(fixtures!.flatZip);

  await expect
    .poll(
      () =>
        existsSync(path.join(secondDest, "info.json")) &&
        existsSync(path.join(secondDest, "img/seed.png")),
      { timeout: 60000 }
    )
    .toBe(true);

  await expect(
    window.locator(".mantine-Notification-root", { hasText: "Imported Flat Import Pack" }).last()
  ).toBeVisible();
  expect(existsSync(path.join(secondDest, "img/seed.png"))).toBe(true);

  const listed = await listPacksViaBridge(window);
  const sameName = listed!.filter(
    (p) => p.name === "Flat Import Pack" && p.path.startsWith(state!.dir)
  );
  expect(sameName.length).toBe(2);
});

test("A20.2 a zip nested one directory deep unwraps into an equally usable pack", async () => {
  const { window } = running!;
  await setSeam("EDGWARE_IMPORT_TEST_PATH", fixtures!.nestedZip);
  await openPackManagement();

  await window.locator("[data-testid='pack-import-zip-button']").click();

  await expect(
    window.locator(".mantine-Notification-root", { hasText: "Imported Nested Import Pack" }).last()
  ).toBeVisible({ timeout: 60000 });

  const dest = fixtures!.nestedDest;
  expect(existsSync(path.join(dest, "info.json"))).toBe(true);
  expect(existsSync(path.join(dest, "img/seed.png"))).toBe(true);
  expect(existsSync(path.join(dest, "vid/clip.mp4"))).toBe(true);
  expect(existsSync(path.join(dest, "Nested Content"))).toBe(false);

  const listed = await listPacksViaBridge(window);
  const nested = listed!.find((p) => p.path === dest);
  expect(nested).toBeTruthy();
  expect(nested!.name).toBe("Nested Import Pack");
  expect(nested!.version).toBe("4.2");

  await selectPackByName("Nested Import Pack (v4.2)");
  await showStatusTab();
  await expect(window.locator("[data-testid='pack-info']")).toContainText("Nested Import Pack");
  expect(readConfigPackPath()).toBe(dest);

  await clearSeams();
});

test("A20.3 a traversal entry is rejected with a visible failure and writes nothing outside", async () => {
  const { window } = running!;
  await setSeam("EDGWARE_IMPORT_TEST_PATH", fixtures!.evilZip);
  await openPackManagement();

  await window.locator("[data-testid='pack-import-zip-button']").click();

  const failureToast = window
    .locator(".mantine-Notification-root")
    .filter({ hasText: "unsafe archive entry" });
  await expect(failureToast.last()).toBeVisible({ timeout: 60000 });
  await expect(failureToast.last()).toContainText("Import failed");

  await expect(window.locator("[data-testid='pack-import-error']")).toBeVisible();
  await expect(window.locator("[data-testid='pack-import-error']")).toContainText(
    "unsafe archive entry"
  );

  expect(existsSync(path.join(state!.dir, "escape.txt"))).toBe(false);
  expect(existsSync(path.join(state!.dir, "data", "escape.txt"))).toBe(false);
  expect(existsSync(path.join(state!.packsDir, "escape.txt"))).toBe(false);
  expect(existsSync(path.join(state!.packsDir, "evil-pack"))).toBe(false);

  await clearSeams();
});

test("A20.5 a non-zip import shows a visible error, never a silent no-op", async () => {
  const { window } = running!;
  await setSeam("EDGWARE_IMPORT_TEST_PATH", fixtures!.garbageZip);
  await openPackManagement();

  await window.locator("[data-testid='pack-import-zip-button']").click();

  const failureToast = window
    .locator(".mantine-Notification-root")
    .filter({ hasText: "Not a valid zip file" });
  await expect(failureToast.last()).toBeVisible({ timeout: 60000 });
  await expect(failureToast.last()).toContainText("Import failed");

  await expect(window.locator("[data-testid='pack-import-error']")).toBeVisible();
  await expect(window.locator("[data-testid='pack-import-error']")).toContainText(
    "Not a valid zip file"
  );

  const listed = await listPacksViaBridge(window);
  expect(listed!.some((p) => p.path.includes("garbage"))).toBe(false);

  await clearSeams();
});

test("adding an existing pack folder persists it and lists it like any discovered pack", async () => {
  const { window } = running!;
  await setSeam("EDGWARE_PACK_FOLDER_TEST_PATH", fixtures!.folderPack);
  await openPackManagement();

  await window.locator("[data-testid='pack-add-folder-button']").click();

  await expect(
    window.locator(".mantine-Notification-root", { hasText: "Added Folder Pack" }).last()
  ).toBeVisible({ timeout: 60000 });

  expect(readConfigPackFolders()).toContain(fixtures!.folderPack);

  const listed = await listPacksViaBridge(window);
  const added = listed!.find((p) => p.path === fixtures!.folderPack);
  expect(added).toBeTruthy();
  expect(added!.name).toBe("Folder Pack");
  expect(added!.version).toBe("9.9");

  await selectPackByName("Folder Pack (v9.9)");
  await showStatusTab();
  await expect(window.locator("[data-testid='pack-info']")).toContainText("Folder Pack");
  expect(readConfigPackPath()).toBe(fixtures!.folderPack);

  await clearSeams();
});

test("A20.4 pack selection persists across a real app restart", async () => {
  const { window } = running!;
  await openPackManagement();

  const seedVersion = JSON.parse(readFileSync(path.join(state!.seedPath, "info.json"), "utf-8")).version;
  const select = window.getByRole("textbox", { name: "Available Packs" });
  await select.click();
  const optionName = `${state!.seedDisplayName} (v${seedVersion})`;
  await window.getByRole("option", { name: optionName }).first().click();
  await showStatusTab();
  await expect(window.locator("[data-testid='pack-info']")).toContainText(state!.seedDisplayName);
  expect(readConfigPackPath()).toBe(state!.seedPath);

  await quitApp(running!);
  running = await launchApp(state!);
  const { window: relaunched } = running;

  await expect(relaunched.locator("[data-testid='pack-info']")).toContainText(state!.seedDisplayName);
  expect(readConfigPackPath()).toBe(state!.seedPath);

  const listed = await listPacksViaBridge(relaunched);
  const reloaded = listed!.find((p) => p.path === state!.seedPath);
  expect(reloaded).toBeTruthy();
  expect(reloaded!.name).toBe(state!.seedDisplayName);
});

test("A20.6 dev-mode repo packs/ directory is scanned alongside the temp library", async () => {
  test.skip(!existsSync(path.join(REPO_PACKS, "Edgeware++ Test Pack V2")), "repo packs/ absent on this checkout");
  const { window } = running!;
  const repoPackPath = path.join(REPO_PACKS, "Edgeware++ Test Pack V2");

  const listed = await listPacksViaBridge(window);
  const repoPack = listed!.find((p) => p.path === repoPackPath);
  expect(repoPack, "repo packs/ must be scanned in unpackaged (dev) mode").toBeTruthy();
  expect(repoPack!.name).toBe("EdgeWare++ Test Pack");

  const listedDirs = readdirSync(state!.packsDir, { withFileTypes: true });
  expect(listedDirs.some((d) => d.isDirectory() && d.name === state!.seedName)).toBe(true);
});
