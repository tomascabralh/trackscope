import type {
  BandDescriptor,
  EnergyDescriptor,
  SectionDescriptors,
} from "../breakdown/descriptors";

export type Role =
  | "Kick"
  | "Sub"
  | "Bass"
  | "Lead"
  | "Pad"
  | "Perc"
  | "FX/Atmosphere";

const ROLE_ORDER: Role[] = [
  "Kick",
  "Sub",
  "Bass",
  "Lead",
  "Pad",
  "Perc",
  "FX/Atmosphere",
];
const STRONG: BandDescriptor[] = ["dominant", "forward"];
const ENERGETIC: EnergyDescriptor[] = ["peak", "high"];

export function sectionRoles(s: SectionDescriptors): Role[] {
  const strong = (b: BandDescriptor) => STRONG.includes(b);
  const energetic = ENERGETIC.includes(s.energy);
  const roles = new Set<Role>();

  if (energetic && (strong(s.bands.sub) || strong(s.bands.low))) {
    roles.add("Kick");
  }
  if (strong(s.bands.sub)) roles.add("Sub");
  if (strong(s.bands.low)) roles.add("Bass");
  if (strong(s.bands.mid) || strong(s.bands.highMid)) roles.add("Lead");
  if (strong(s.bands.high)) roles.add("Perc");
  if (
    !energetic &&
    (strong(s.bands.highMid) || strong(s.bands.high) || s.bands.sub === "absent")
  ) {
    roles.add("Pad");
  }
  if (roles.size === 0) {
    roles.add("Pad");
    roles.add("FX/Atmosphere");
  }

  return ROLE_ORDER.filter((r) => roles.has(r));
}
