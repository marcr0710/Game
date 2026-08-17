export type Team = "T" | "CT";
export type Phase = "menu" | "buy" | "live" | "round_end";
export type WeaponId = "glock" | "usp" | "ak47" | "m4" | "awp" | "knife";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vec {
  x: number;
  y: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cost: number;
  damage: number;
  fireDelay: number;
  mag: number;
  reserve: number;
  spread: number;
  speed: number;
  range: number;
  automatic: boolean;
  team?: Team;
}

export interface PlayerState {
  id: 0 | 1;
  team: Team;
  x: number;
  y: number;
  angle: number;
  hp: number;
  armor: number;
  money: number;
  weapon: WeaponId;
  ammo: number;
  reserve: number;
  lastShot: number;
  alive: boolean;
  plantProgress: number;
  defuseProgress: number;
  reloadUntil: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 0 | 1;
  damage: number;
  life: number;
}

export interface Bomb {
  planted: boolean;
  x: number;
  y: number;
  fuse: number;
  defused: boolean;
}

export interface MatchRules {
  maxRounds: number;
  winScore: number;
  fuse: number;
}

export interface MatchState {
  phase: Phase;
  round: number;
  tScore: number;
  ctScore: number;
  timer: number;
  buyTimer: number;
  endTimer: number;
  endReason: string;
  bomb: Bomb;
  players: [PlayerState, PlayerState];
  bullets: Bullet[];
  winner: Team | null;
  rules: MatchRules;
}

export const TILE = 28;
export const MAP_W = 48;
export const MAP_H = 28;
export const PLAYER_R = 10;
/** Total field of view in radians (50°). */
export const FOV = (50 * Math.PI) / 180;
export const VIEW_RANGE = 560;
export const ROUND_TIME = 90;
export const BUY_TIME = 12;
export const PLANT_TIME = 3.2;
export const DEFUSE_TIME = 5;
export const BOMB_FUSE = 35;
export const MAX_ROUNDS = 6;
export const START_MONEY = 800;
export const WIN_MONEY = 2700;
export const LOSS_MONEY = 1900;
export const KILL_MONEY = 300;
