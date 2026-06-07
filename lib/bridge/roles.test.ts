import { describe, it, expect } from "vitest";
import { sectionRoles } from "./roles";
import type { SectionDescriptors } from "../breakdown/descriptors";

const make = (
  energy: SectionDescriptors["energy"],
  bands: SectionDescriptors["bands"]
): SectionDescriptors => ({ label: "drop", startS: 0, endS: 1, energy, bands });

describe("sectionRoles", () => {
  it("maps a sub-led high-energy drop to kick/sub/bass", () => {
    const roles = sectionRoles(
      make("high", {
        sub: "forward",
        low: "forward",
        mid: "present",
        highMid: "present",
        high: "back",
      })
    );
    expect(roles).toEqual(["Kick", "Sub", "Bass"]);
  });

  it("maps a bright sparse intro to lead/perc/pad", () => {
    const roles = sectionRoles(
      make("sparse", {
        sub: "absent",
        low: "present",
        mid: "forward",
        highMid: "dominant",
        high: "forward",
      })
    );
    expect(roles).toEqual(["Lead", "Pad", "Perc"]);
  });

  it("always yields at least an atmospheric pad", () => {
    const roles = sectionRoles(
      make("low", {
        sub: "present",
        low: "present",
        mid: "present",
        highMid: "present",
        high: "present",
      })
    );
    expect(roles).toEqual(["Pad", "FX/Atmosphere"]);
  });
});
