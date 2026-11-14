const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/**
 * Strip the ~55 Chromium locale packs Electron ships but this app never
 * uses (the UI is English-only). electron-builder's electronLanguages
 * option does not reach the framework Resources, so the locales are
 * removed directly after packing. en.lproj stays as the fallback.
 *
 * Removing files from inside the signed framework invalidates its code
 * signature, which macOS reports as "app is damaged" the moment the
 * bundle is quarantined (i.e. downloaded). The bundle is therefore
 * re-signed ad-hoc after the strip so the seal matches the contents.
 */
exports.default = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const app = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  const resources = path.join(
    app,
    "Contents",
    "Frameworks",
    "Electron Framework.framework",
    "Versions",
    "A",
    "Resources"
  );
  if (!fs.existsSync(resources)) return;
  let removed = 0;
  for (const entry of fs.readdirSync(resources)) {
    if (entry.endsWith(".lproj") && entry !== "en.lproj") {
      fs.rmSync(path.join(resources, entry), { recursive: true, force: true });
      removed++;
    }
  }
  console.log(`[afterPack] removed ${removed} unused Electron locale pack(s)`);
  if (removed === 0) return;
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], {
    stdio: "pipe",
  });
  console.log("[afterPack] re-signed the bundle ad-hoc after locale stripping");
};
