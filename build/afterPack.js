const fs = require("node:fs");
const path = require("node:path");

/**
 * Strip the ~55 Chromium locale packs Electron ships but this app never
 * uses (the UI is English-only). electron-builder's electronLanguages
 * option does not reach the framework Resources, so the locales are
 * removed directly after packing. en.lproj stays as the fallback.
 */
exports.default = async (context) => {
  if (context.electronPlatformName !== "darwin") return;
  const resources = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
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
};
