import { describe, expect, it } from "vitest";
import { parseDiscordDat } from "../../electron/utils/discordDat";

describe("parseDiscordDat", () => {
  it("reads text and artwork key", () => {
    expect(parseDiscordDat("training submissives\nbiglogo")).toEqual({
      text: "training submissives",
      image: "biglogo",
    });
  });

  it("image is null when the second line is missing or blank", () => {
    expect(parseDiscordDat("only text").image).toBeNull();
    expect(parseDiscordDat("only text\n  ").image).toBeNull();
  });

  it("returns null without a status line", () => {
    expect(parseDiscordDat("")).toBeNull();
    expect(parseDiscordDat("   \nartwork")).toBeNull();
  });
});
