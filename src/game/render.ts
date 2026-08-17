import {
  FOV,
  MAP_H,
  MAP_W,
  PLAYER_R,
  TILE,
  VIEW_RANGE,
  type MatchState,
  type PlayerState,
} from "./types";
import { grid, hasLineOfSight, inCone, raycast } from "./map";
import { canSee } from "./engine";

const WALL = "#8a9bb0";
const WALL_EDGE = "#c5d0de";
const FLOOR = "#121820";
const SITE_A = "#2f4a32";
const SITE_B = "#3a3350";
const T_COL = "#d9772a";
const CT_COL = "#2f9bd8";

export function renderSplit(
  ctx: CanvasRenderingContext2D,
  s: MatchState,
  w: number,
  h: number,
) {
  renderView(ctx, s, s.players[0], 0, 0, w, h);
}

export function renderFor(
  ctx: CanvasRenderingContext2D,
  s: MatchState,
  viewerId: 0 | 1,
  w: number,
  h: number,
) {
  renderView(ctx, s, s.players[viewerId], 0, 0, w, h);
}

/** Map the same letterbox transform used by renderView. */
export function canvasToWorld(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const sx = ((clientX - rect.left) / rect.width) * canvas.width;
  const sy = ((clientY - rect.top) / rect.height) * canvas.height;
  const mapPxW = MAP_W * TILE;
  const mapPxH = MAP_H * TILE;
  const scale = Math.min(canvas.width / mapPxW, canvas.height / mapPxH);
  const offX = (canvas.width - mapPxW * scale) / 2;
  const offY = (canvas.height - mapPxH * scale) / 2;
  return {
    x: (sx - offX) / scale,
    y: (sy - offY) / scale,
  };
}

function renderView(
  ctx: CanvasRenderingContext2D,
  s: MatchState,
  viewer: PlayerState,
  ox: number,
  oy: number,
  vw: number,
  vh: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, vw, vh);
  ctx.clip();
  ctx.fillStyle = "#070b10";
  ctx.fillRect(ox, oy, vw, vh);

  const mapPxW = MAP_W * TILE;
  const mapPxH = MAP_H * TILE;
  const scale = Math.min(vw / mapPxW, vh / mapPxH);
  const offX = ox + (vw - mapPxW * scale) / 2;
  const offY = oy + (vh - mapPxH * scale) / 2;

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);

  drawMap(ctx, viewer);
  drawFov(ctx, viewer);

  if (s.bomb.planted) {
    const bombSeen =
      inCone(viewer.x, viewer.y, viewer.angle, FOV, s.bomb.x, s.bomb.y, VIEW_RANGE) &&
      hasLineOfSight(viewer.x, viewer.y, s.bomb.x, s.bomb.y);
    if (bombSeen || viewer.team === "T") {
      ctx.fillStyle = s.bomb.defused ? "#4ade80" : "#f43f5e";
      ctx.beginPath();
      ctx.arc(s.bomb.x, s.bomb.y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (!s.bomb.defused) {
        ctx.fillStyle = "#fff";
        ctx.font = "9px IBM Plex Mono, monospace";
        ctx.fillText(s.bomb.fuse.toFixed(1), s.bomb.x - 10, s.bomb.y - 10);
      }
    }
  }

  for (const b of s.bullets) {
    const seen =
      inCone(viewer.x, viewer.y, viewer.angle, FOV, b.x, b.y, VIEW_RANGE) &&
      hasLineOfSight(viewer.x, viewer.y, b.x, b.y);
    if (!seen && b.owner !== viewer.id) continue;
    ctx.fillStyle = "#f4d35e";
    ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
  }

  for (const p of s.players) {
    if (p.id === viewer.id) drawPlayer(ctx, p, true);
    else if (canSee(viewer, p)) drawPlayer(ctx, p, false);
  }

  ctx.restore();
  ctx.restore();
}

function drawMap(ctx: CanvasRenderingContext2D, viewer: PlayerState) {
  void viewer;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = grid[y][x];
      if (t === 1) {
        ctx.fillStyle = WALL;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = WALL_EDGE;
        ctx.lineWidth = 1;
        ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === 4) ctx.fillStyle = SITE_A;
      else if (t === 5) ctx.fillStyle = SITE_B;
      else ctx.fillStyle = FLOOR;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (t === 4 || t === 5) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.font = "10px IBM Plex Mono, monospace";
        ctx.fillText(t === 4 ? "A" : "B", x * TILE + 10, y * TILE + 20);
      }
    }
  }
}

function drawFov(ctx: CanvasRenderingContext2D, viewer: PlayerState) {
  if (!viewer.alive) return;
  ctx.save();
  const rays = 72;
  ctx.beginPath();
  ctx.moveTo(viewer.x, viewer.y);
  for (let i = 0; i <= rays; i++) {
    const a = viewer.angle - FOV / 2 + (FOV * i) / rays;
    const ex = viewer.x + Math.cos(a) * VIEW_RANGE;
    const ey = viewer.y + Math.sin(a) * VIEW_RANGE;
    const hit = raycast(viewer.x, viewer.y, ex, ey);
    ctx.lineTo(hit.x, hit.y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(90, 170, 220, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(180, 220, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState, self: boolean) {
  const col = p.team === "T" ? T_COL : CT_COL;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = p.alive ? col : "#4b5563";
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = self ? "#f8fafc" : "#0b1220";
  ctx.fillRect(PLAYER_R - 4, -2, 10, 4);
  ctx.restore();
  ctx.fillStyle = "#e8eef4";
  ctx.font = "8px IBM Plex Mono, monospace";
  ctx.fillText(p.team, p.x - 5, p.y - 14);
}
