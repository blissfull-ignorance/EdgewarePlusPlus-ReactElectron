# Edgeware++

Edgeware++ is a fetish-designed program (so 18+ only!!!) that essentially spawns popups over your screen in many different ways. These popups can include images, videos, audio, prompts, etc. It's also highly customizable, with the ability to download "packs" people have made and use them yourself. It can be ended at any time and also scheduled in ways to be used more passively.

**Edgeware++ is not a virus, nor does it install itself onto your computer**. Edgeware **can** potentially modify files on your computer or be configured to start delayed. The most dangerous settings (deleting or replacing files) have not been included in this fork.

## What Is This Fork?

Stumbling over a great Edgeware++ community pack, I was disheartened to see the software was not macOS compatible. So I made it compatible! And in doing so, I got increasingly invested making it a React-Electron cross-platform implementation instead of just a macOS port. I have no idea how much time I spent on this at this point.

## Confirmed OS Compatibility

- [x] macOS (27.2.1)
- [ ] Windows 11
- [ ] Linux

Currently only macOS has been confirmed to work. Feel free to send me a confirmation for Windows or Linux and I will update this list.

## Usage Instructions

You can grab a ReactElectron build from the Releases tab. For Windows and Linux these are installers, for macOS it ships the built executable. You can of course also download the GitHub project and build the executable yourself.

In the app, you can import a pack, adjust the settings and run it! Most fun is with scripted packs. I added features to tag moods across the gallery and moved the script designer right next to it. Old hand-written scripts can be converted into designs editable in this version.

**Any damage you do to your computer with Edgeware is your own responsibility! The most dangerous settings are disabled in this fork, but there remains a risk of misuse or malicious packs I cannot properly assess.**

## Installing a Release

Download the artifact for your platform from the
[releases page](https://github.com/blissfull-ignorance/EdgewarePlusPlus-ReactElectron/releases):

| Platform | Artifact |
|---|---|
| macOS (Apple Silicon / Intel) | `*-mac-*.dmg` (or `.zip`) |
| Windows | `*-win-*.exe` (NSIS installer) |
| Linux | `*-linux-*.AppImage` (or `.deb`) |

Unsigned builds: macOS shows a Gatekeeper prompt (right-click → Open the
first time) and Windows SmartScreen a "More info → Run anyway" step.

Place content packs (directories or zips) in the `packs/` folder of the app's
user-data directory, or import them from the config window:

- macOS: `~/Library/Application Support/Edgeware++/`
- Windows: `%APPDATA%/Edgeware++/`
- Linux: `~/.config/Edgeware++/`

## Running From Source

Requires Node.js 20+.

```bash
npm ci
npm run electron:dev   # run the app in development mode
```

## Development

```bash
npm run check          # TypeScript type checking
npm run lint           # ESLint
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests (browser + real Electron)
npm run build          # type-check, bundle, and package with electron-builder
```

The end-to-end suite runs in two layers: a browser layer against a mocked
bridge for UI logic, and an Electron layer that launches the real app with
the real main process, preload bridge and filesystem. Anything crossing the
IPC boundary is verified in the Electron layer.

Release artifacts (dmg / zip / nsis / AppImage / deb) are written to
`release/`; `.github/workflows/release.yml` builds all platforms on a `v*`
tag and attaches the artifacts to the GitHub release.

## Frequently Asked Questions

**Q: Where do I download more packs?**

Please refer to the [original project](https://github.com/araten10/EdgewarePlusPlus).

**Q: I found a bug!**

Please open an issue here on the fork! Do not raise bugs concerning the fork in the original project, as this fork is not associated with the original project's maintainers.

**Q: Will there be further development on this?**

I do not plan further development at this moment.

**Q: How was this fork made? (AI Disclosure)**

This fork was built with local coding agents (OpenCode running Qwen3.6/8-27B, DeepSeek-V4-Flash and Qwen3.8-Flash-Next). It doubles as an exercise in software architecture and agentic development. The following development process was used:

- Analyzed the Python version's features and config options to derive catalogs of what to port.
- Defined the tech stack.
- Defined project structure, design, flow diagrams and test plans before any coding. This produced a lot of software architecture documentation, which is intentionally not part of the repo history.
- Split the work into feature-sized slices: rough UI, limited backend, automated tests, then the next feature, same procedure.
- The coding agents worked through the tasks one by one, including overnight runs. This only worked well when steps were precisely scoped and success was mechanically testable, so every task was written that way.
- Human review: mostly UI-driven, plus targeted code reviews.

This project accompanied me for ~5 months. I restarted multiple times with different approaches and ended up learning a lot about local LLM models, Python quirks on macOS, test-driven software design, React and Electron, as well as app bundling. It was most intriguing to see the capability jumps of the tested local models within just a few months.

## License

As of April 28 2025 all future versions of Edgeware++ are licensed under the GNU General Public License version 3 or any later version. Contributions prior to the specified date are licensed under the MIT License.

---

Thank you to araten10, marigold, PetitTournesol and the creators making packs for this!