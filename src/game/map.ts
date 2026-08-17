import { MAP_H, MAP_W, TILE, type Rect } from "./types";

// 0 floor  1 wall  2 T spawn  3 CT spawn  4 site A  5 site B
// 48 x 28 — A lane (north), mid, B lane (south) with ramps, boxes, and connectors.
export const RAW = `
111111111111111111111111111111111111111111111111
122200000111000000000000000000000000111000000331
120000000111000111111000000011111100111000000031
120000000000000111111000440011111100000000000031
111110000000000000000000440000000000000000011111
111110001111000000000000440000000000111100011111
100000001111000111000000000000011100111100000001
100000000000000111001110000011100111000000000001
100011100000000000001110000011100000000000111001
100011111111110000000000000000000000111111111001
100000000000000000111111111111110000000000000001
111111000011100000111111111111110000111000111111
111111000011100000000000000000000000111000111111
100000000000000000000000000000000000000000000001
100000111000111111100000000001111111000111000001
100000111000111111100000000001111111000111000001
100000000000000000000000000000000000000000000001
111111000011100000000000000000000000111000111111
111111000011100000111111111111110000111000111111
100000000000000000111111111111110000000000000001
100011111111110000000000000000000000111111111001
100011100000000000001110000011100000000000111001
100000000000000111001110000011100111000000000001
100000001111000111000000000000011100111100000001
111110001111000000000000550000000000111100011111
111110000000000000000000550000000000000000011111
100000000000000111111000550011111100000000000001
111111111111111111111111111111111111111111111111
`.trim();

export const grid: number[][] = RAW.split("\n").map((row) =>
  row.trim().split("").map(Number),
);

if (grid.length !== MAP_H || grid.some((r) => r.length !== MAP_W)) {
  console.warn("Dustline map size mismatch", grid.length, grid[0]?.length, MAP_H, MAP_W);
}

export function tileAt(px: number, py: number): number {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 1;
  return grid[ty]?.[tx] ?? 1;
}

export function isWall(px: number, py: number): boolean {
  return tileAt(px, py) === 1;
}

export function wallRects(): Rect[] {
  const out: Rect[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (grid[y]?.[x] === 1) out.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
    }
  }
  return out;
}

export function sitesOf(kind: 4 | 5): Rect[] {
  const out: Rect[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (grid[y]?.[x] === kind) out.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE });
    }
  }
  return out;
}

export function spawnPoints(kind: 2 | 3): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (grid[y]?.[x] === kind) {
        out.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
      }
    }
  }
  return out;
}

export function inSite(px: number, py: number): boolean {
  const t = tileAt(px, py);
  return t === 4 || t === 5;
}

export function raycast(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { hit: boolean; x: number; y: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(dist / 4);
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    px = x0 + dx * t;
    py = y0 + dy * t;
    if (isWall(px, py)) return { hit: true, x: px, y: py };
  }
  return { hit: false, x: x1, y: y1 };
}

export function hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
  return !raycast(ax, ay, bx, by).hit;
}

export function inCone(
  ox: number,
  oy: number,
  angle: number,
  fov: number,
  tx: number,
  ty: number,
  range: number,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (d < 28) return true;
  const a = Math.atan2(dy, dx);
  let diff = a - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= fov / 2;
}
