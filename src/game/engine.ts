import {
  BOMB_FUSE,
  BUY_TIME,
  DEFUSE_TIME,
  FOV,
  KILL_MONEY,
  LOSS_MONEY,
  PLAYER_R,
  PLANT_TIME,
  ROUND_TIME,
  START_MONEY,
  VIEW_RANGE,
  WIN_MONEY,
  type MatchState,
  type PlayerState,
  type Team,
  type WeaponId,
} from "./types";
import { defaultWeapon, WEAPONS } from "./weapons";
import { hasLineOfSight, inCone, inSite, isWall, spawnPoints } from "./map";

export type KeySet = Set<string>;

export type PlayerInput = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  use: boolean;
  reload: boolean;
  /** World-space facing; null keeps last angle (remote idle). */
  aimAngle: number | null;
};

export const EMPTY_INPUT: PlayerInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  use: false,
  reload: false,
  aimAngle: null,
};

const heldFire = new Set<0 | 1>();

export function inputFromKeys(
  keys: KeySet,
  extras?: { fire?: boolean; aimAngle?: number | null },
): PlayerInput {
  return {
    up: keys.has("KeyW") || keys.has("ArrowUp"),
    down: keys.has("KeyS") || keys.has("ArrowDown"),
    left: keys.has("KeyA") || keys.has("ArrowLeft"),
    right: keys.has("KeyD") || keys.has("ArrowRight"),
    fire: extras?.fire ?? false,
    use: keys.has("KeyE"),
    reload: keys.has("KeyR"),
    aimAngle: extras?.aimAngle ?? null,
  };
}

function clampMove(p: PlayerState, nx: number, ny: number) {
  if (!isWall(nx, p.y) && !circleHitsWall(nx, p.y, PLAYER_R)) p.x = nx;
  if (!isWall(p.x, ny) && !circleHitsWall(p.x, ny, PLAYER_R)) p.y = ny;
}

function circleHitsWall(x: number, y: number, r: number) {
  return (
    isWall(x - r, y) ||
    isWall(x + r, y) ||
    isWall(x, y - r) ||
    isWall(x, y + r) ||
    isWall(x - r * 0.7, y - r * 0.7) ||
    isWall(x + r * 0.7, y - r * 0.7) ||
    isWall(x - r * 0.7, y + r * 0.7) ||
    isWall(x + r * 0.7, y + r * 0.7)
  );
}

function freshPlayer(id: 0 | 1, team: Team, money: number): PlayerState {
  const spawns = spawnPoints(team === "T" ? 2 : 3);
  const s = spawns[id % spawns.length] ?? { x: 80, y: 80 };
  const w = defaultWeapon(team);
  const def = WEAPONS[w];
  return {
    id,
    team,
    x: s.x + (id === 0 ? 0 : 18),
    y: s.y,
    angle: team === "T" ? 0.2 : Math.PI,
    hp: 100,
    armor: 0,
    money,
    weapon: w,
    ammo: def.mag,
    reserve: def.reserve,
    lastShot: 0,
    alive: true,
    plantProgress: 0,
    defuseProgress: 0,
    reloadUntil: 0,
  };
}

export const DEFAULT_RULES = {
  maxRounds: 6,
  winScore: 4,
  fuse: BOMB_FUSE,
};

export function createMatch(): MatchState {
  return {
    phase: "menu",
    round: 0,
    tScore: 0,
    ctScore: 0,
    timer: ROUND_TIME,
    buyTimer: BUY_TIME,
    endTimer: 0,
    endReason: "",
    bomb: { planted: false, x: 0, y: 0, fuse: BOMB_FUSE, defused: false },
    players: [freshPlayer(0, "T", START_MONEY), freshPlayer(1, "CT", START_MONEY)],
    bullets: [],
    winner: null,
    rules: { ...DEFAULT_RULES },
  };
}

export function startMatch(s: MatchState) {
  s.tScore = 0;
  s.ctScore = 0;
  s.round = 0;
  s.winner = null;
  s.players[0].money = START_MONEY;
  s.players[1].money = START_MONEY;
  beginRound(s);
}

export function beginRound(s: MatchState) {
  s.round += 1;
  s.phase = "buy";
  s.buyTimer = BUY_TIME;
  s.timer = ROUND_TIME;
  s.endTimer = 0;
  s.endReason = "";
  s.bullets = [];
  s.bomb = { planted: false, x: 0, y: 0, fuse: s.rules.fuse, defused: false };
  const money0 = s.players[0].money;
  const money1 = s.players[1].money;
  const p0Team = s.round % 2 === 1 ? "T" : "CT";
  const p1Team = p0Team === "T" ? "CT" : "T";
  s.players[0] = freshPlayer(0, p0Team, Math.min(16000, money0));
  s.players[1] = freshPlayer(1, p1Team, Math.min(16000, money1));
}

export function buyWeapon(p: PlayerState, id: WeaponId) {
  const def = WEAPONS[id];
  if (def.team && def.team !== p.team) return;
  if (p.money < def.cost) return;
  p.money -= def.cost;
  p.weapon = id;
  p.ammo = def.mag;
  p.reserve = def.reserve;
}

export function buyArmor(p: PlayerState) {
  if (p.money < 650 || p.armor >= 100) return;
  p.money -= 650;
  p.armor = 100;
}

export function canSee(viewer: PlayerState, target: PlayerState): boolean {
  if (!viewer.alive) return false;
  if (!target.alive) {
    return (
      inCone(viewer.x, viewer.y, viewer.angle, FOV, target.x, target.y, VIEW_RANGE) &&
      hasLineOfSight(viewer.x, viewer.y, target.x, target.y)
    );
  }
  return (
    inCone(viewer.x, viewer.y, viewer.angle, FOV, target.x, target.y, VIEW_RANGE) &&
    hasLineOfSight(viewer.x, viewer.y, target.x, target.y)
  );
}

function tryShoot(s: MatchState, p: PlayerState, now: number) {
  if (!p.alive || s.phase !== "live") return;
  if (now < p.reloadUntil) return;
  const def = WEAPONS[p.weapon];
  if (now - p.lastShot < def.fireDelay) return;
  if (p.weapon !== "knife" && p.ammo <= 0) {
    startReload(p, now);
    return;
  }
  p.lastShot = now;
  if (p.weapon !== "knife") p.ammo -= 1;
  const ang = p.angle + (Math.random() - 0.5) * def.spread * 2;
  if (p.weapon === "knife") {
    const other = s.players[p.id === 0 ? 1 : 0];
    const d = Math.hypot(other.x - p.x, other.y - p.y);
    if (other.alive && d < def.range + PLAYER_R * 2) {
      applyDamage(s, other, p, def.damage);
    }
    return;
  }
  s.bullets.push({
    x: p.x + Math.cos(ang) * 14,
    y: p.y + Math.sin(ang) * 14,
    vx: Math.cos(ang) * def.speed,
    vy: Math.sin(ang) * def.speed,
    owner: p.id,
    damage: def.damage,
    life: def.range / def.speed,
  });
}

function startReload(p: PlayerState, now: number) {
  if (p.weapon === "knife") return;
  const def = WEAPONS[p.weapon];
  if (p.ammo >= def.mag || p.reserve <= 0) return;
  p.reloadUntil = now + 1.6;
}

function finishReload(p: PlayerState) {
  const def = WEAPONS[p.weapon];
  const need = def.mag - p.ammo;
  const take = Math.min(need, p.reserve);
  p.ammo += take;
  p.reserve -= take;
}

function applyDamage(s: MatchState, victim: PlayerState, attacker: PlayerState, dmg: number) {
  if (!victim.alive) return;
  if (victim.armor > 0) {
    victim.armor = Math.max(0, victim.armor - Math.floor(dmg * 0.35));
  }
  victim.hp -= dmg;
  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.alive = false;
    attacker.money = Math.min(16000, attacker.money + KILL_MONEY);
    checkElim(s);
  }
}

function checkElim(s: MatchState) {
  const t = s.players.find((p) => p.team === "T")!;
  const ct = s.players.find((p) => p.team === "CT")!;
  if (!t.alive && !s.bomb.planted) endRound(s, "CT", "Terrorist down — CTs hold the site");
  else if (!ct.alive && s.bomb.planted) {
    /* T can still wait for bomb */
  } else if (!ct.alive && !s.bomb.planted) endRound(s, "T", "CT down — bomb not needed");
}

function endRound(s: MatchState, team: Team, reason: string) {
  if (s.phase === "round_end") return;
  s.phase = "round_end";
  s.endReason = reason;
  s.endTimer = 4;
  if (team === "T") s.tScore += 1;
  else s.ctScore += 1;
  for (const p of s.players) {
    const win = p.team === team;
    p.money = Math.min(16000, p.money + (win ? WIN_MONEY : LOSS_MONEY));
  }
  const need = s.rules.winScore;
  if (s.tScore >= need || s.ctScore >= need || s.round >= s.rules.maxRounds) {
    if (s.tScore !== s.ctScore) s.winner = s.tScore > s.ctScore ? "T" : "CT";
  }
}

export function tick(s: MatchState, inputs: [PlayerInput, PlayerInput], dt: number, now: number) {
  if (s.phase === "menu") return;

  if (s.phase === "buy") {
    s.buyTimer -= dt;
    movePlayers(s, inputs, dt, false);
    if (s.buyTimer <= 0) s.phase = "live";
    return;
  }

  if (s.phase === "round_end") {
    s.endTimer -= dt;
    if (s.endTimer <= 0) {
      if (s.winner) s.phase = "menu";
      else beginRound(s);
    }
    return;
  }

  s.timer -= dt;
  movePlayers(s, inputs, dt, true);

  for (const p of s.players) {
    if (now >= p.reloadUntil && p.reloadUntil > 0) {
      finishReload(p);
      p.reloadUntil = 0;
    }
    const inp = inputs[p.id];
    if (inp.reload) startReload(p, now);
    const def = WEAPONS[p.weapon];
    if (inp.fire) {
      if (def.automatic || !heldFire.has(p.id)) tryShoot(s, p, now);
      heldFire.add(p.id);
    } else {
      heldFire.delete(p.id);
    }
    handleBomb(s, p, inp.use, dt);
  }

  updateBullets(s, dt);

  if (s.bomb.planted && !s.bomb.defused) {
    s.bomb.fuse -= dt;
    if (s.bomb.fuse <= 0) endRound(s, "T", "Bomb detonated");
  }

  if (!s.bomb.planted && s.timer <= 0) endRound(s, "CT", "Time — CTs win the round");
}

function movePlayers(s: MatchState, inputs: [PlayerInput, PlayerInput], dt: number, allowSprint: boolean) {
  for (const p of s.players) {
    if (!p.alive) continue;
    const inp = inputs[p.id];
    if (inp.aimAngle != null) p.angle = inp.aimAngle;
    let mx = 0;
    let my = 0;
    if (inp.up) my -= 1;
    if (inp.down) my += 1;
    if (inp.left) mx -= 1;
    if (inp.right) mx += 1;
    const len = Math.hypot(mx, my) || 1;
    const speed = allowSprint ? 155 : 90;
    clampMove(p, p.x + (mx / len) * speed * dt, p.y + (my / len) * speed * dt);
  }
}

function handleBomb(s: MatchState, p: PlayerState, using: boolean, dt: number) {
  if (!p.alive) return;
  if (p.team === "T" && !s.bomb.planted && inSite(p.x, p.y) && using) {
    p.plantProgress += dt;
    if (p.plantProgress >= PLANT_TIME) {
      s.bomb = { planted: true, x: p.x, y: p.y, fuse: s.rules.fuse, defused: false };
      p.plantProgress = 0;
    }
  } else {
    p.plantProgress = 0;
  }
  if (p.team === "CT" && s.bomb.planted && !s.bomb.defused) {
    const d = Math.hypot(p.x - s.bomb.x, p.y - s.bomb.y);
    if (d < 28 && using) {
      p.defuseProgress += dt;
      if (p.defuseProgress >= DEFUSE_TIME) {
        s.bomb.defused = true;
        endRound(s, "CT", "Bomb defused");
      }
    } else p.defuseProgress = 0;
  } else p.defuseProgress = 0;
}

function updateBullets(s: MatchState, dt: number) {
  const next = [];
  for (const b of s.bullets) {
    b.life -= dt;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (isWall(nx, ny) || b.life <= 0) continue;
    b.x = nx;
    b.y = ny;
    let hit = false;
    for (const p of s.players) {
      if (!p.alive || p.id === b.owner) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_R + 3) {
        applyDamage(s, p, s.players[b.owner], b.damage);
        hit = true;
        break;
      }
    }
    if (!hit) next.push(b);
  }
  s.bullets = next;
}
