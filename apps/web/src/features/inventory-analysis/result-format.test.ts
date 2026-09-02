import { describe, expect, it } from "vitest";

import { cleanInventoryResult, formatInventoryGroups } from "./result-format";

describe("inventory analysis result formatting", () => {
  it("groups title detections by their last word and removes frame duplicates", () => {
    const result = {
      items: [],
      frames: [
        { frame: 0, items: [
          { name: "ownership", text: "EQUIP" },
          { name: "title", text: "RECON GUARDIAN" },
        ] },
        { frame: 6, items: [
          { name: "title", text: "RECON GUARDIAN" },
          { name: "weapon", text: null },
        ] },
        { frame: 12, items: [{ name: "title", text: "JICSAW CUARDIAN" }] },
        { frame: 18, items: [{ name: "title", text: "REAVER VANDAL" }] },
        { frame: 24, items: [{ name: "title", text: "KURONAMI VANDAL" }] },
        { frame: 30, items: [{ name: "title", text: "REAVER VANDAL" }] },
      ],
    };

    expect(cleanInventoryResult(result)).toEqual([
      { weapon: "Guardian", skins: ["Recon", "Jicsaw"] },
      { weapon: "Vandal", skins: ["Reaver", "Kuronami"] },
    ]);
  });

  it("also accepts a full provider response and produces copyable text", () => {
    const groups = cleanInventoryResult({
      id: "inference-id",
      status: "completed",
      result: {
        frames: [
          { frame: 0, items: [{ name: "title", text: "REAVER GHOST" }] },
          { frame: 6, items: [{ name: "TITLE", text: "reaver ghost" }] },
        ],
      },
    });

    expect(formatInventoryGroups(groups)).toBe("Ghost:\n1. Reaver");
  });

  it("ignores metadata, null text and malformed titles", () => {
    expect(cleanInventoryResult({ frames: [{ items: [
      { name: "ownership", text: "EQUIP" },
      { name: "weapon", text: null },
      { name: "title", text: "VANDAL" },
    ] }] })).toEqual([]);
  });
});

