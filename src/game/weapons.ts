import type { WeaponDef, WeaponId } from "./types";

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  knife: {
    id: "knife",
    name: "Knife",
    cost: 0,
    damage: 50,
    fireDelay: 0.55,
    mag: 1,
    reserve: 0,
    spread: 0,
    speed: 520,
    range: 28,
    automatic: false,
  },
  glock: {
    id: "glock",
    name: "Glock-18",
    cost: 200,
    damage: 34,
    fireDelay: 0.12,
    mag: 20,
    reserve: 120,
    spread: 0.11,
    speed: 680,
    range: 480,
    automatic: false,
    team: "T",
  },
  usp: {
    id: "usp",
    name: "USP-S",
    cost: 200,
    damage: 34,
    fireDelay: 0.28,
    mag: 12,
    reserve: 24,
    spread: 0.025,
    speed: 820,
    range: 620,
    automatic: false,
    team: "CT",
  },
  ak47: {
    id: "ak47",
    name: "AK-47",
    cost: 2700,
    damage: 34,
    fireDelay: 0.11,
    mag: 30,
    reserve: 90,
    spread: 0.085,
    speed: 860,
    range: 700,
    automatic: true,
    team: "T",
  },
  m4: {
    id: "m4",
    name: "M4A4",
    cost: 3100,
    damage: 34,
    fireDelay: 0.075,
    mag: 30,
    reserve: 90,
    spread: 0.038,
    speed: 920,
    range: 740,
    automatic: true,
    team: "CT",
  },
  awp: {
    id: "awp",
    name: "AWP",
    cost: 4750,
    damage: 100,
    fireDelay: 1.45,
    mag: 5,
    reserve: 10,
    spread: 0.002,
    speed: 1500,
    range: 1200,
    automatic: false,
  },
};

export function defaultWeapon(team: "T" | "CT"): WeaponId {
  return team === "T" ? "glock" : "usp";
}

export function weaponBlurb(id: WeaponId): string {
  switch (id) {
    case "glock":
      return "Fast semi · wide spray · 3-tap";
    case "usp":
      return "Slow precise · long range · 3-tap";
    case "ak47":
      return "Auto · heavy kick · 3-tap";
    case "m4":
      return "Auto · tight spray · 3-tap";
    case "awp":
      return "Bolt · one shot · slow";
    default:
      return "Melee · two hits";
  }
}
