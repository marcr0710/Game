import { Badge } from "@/components/ui/badge";
import type { MatchState, PlayerState } from "@/game/types";
import { DEFUSE_TIME, PLANT_TIME } from "@/game/types";
import { WEAPONS } from "@/game/weapons";

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function PlayerPanel({ p, side }: { p: PlayerState; side: "left" | "right" }) {
  const w = WEAPONS[p.weapon];
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-0.5 ${side === "right" ? "items-end text-right" : ""}`}>
      <div className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className={p.team === "T" ? "text-[var(--t-col)]" : "text-[var(--ct-col)]"}>
          {p.team === "T" ? "Terrorist" : "Counter-Terrorist"}
        </span>
        <span className="font-mono text-foreground">P{p.id + 1}</span>
      </div>
      <div className="flex items-baseline gap-3 font-mono tabular-nums">
        <span className="text-lg font-medium text-foreground">{p.alive ? p.hp : "DOWN"}</span>
        <span className="text-xs text-muted-foreground">HP</span>
        <span className="text-sm text-foreground/80">{p.armor}</span>
        <span className="text-xs text-muted-foreground">AR</span>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {w.name} · {p.weapon === "knife" ? "—" : `${p.ammo}/${p.reserve}`} · ${p.money}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/80">{weaponBlurb(p.weapon)}</div>
    </div>
  );
}

export function GameHud({ state, localId = 0 }: { state: MatchState; localId?: 0 | 1 }) {
  const t = state.players.find((p) => p.team === "T") ?? state.players[0];
  const ct = state.players.find((p) => p.team === "CT") ?? state.players[1];
  const me = state.players[localId];
  const clock =
    state.phase === "buy"
      ? `BUY ${Math.ceil(state.buyTimer)}`
      : state.phase === "live"
        ? state.bomb.planted
          ? `BOMB ${Math.max(0, state.bomb.fuse).toFixed(1)}`
          : `${Math.max(0, Math.ceil(state.timer))}`
        : state.phase === "round_end"
          ? "ROUND"
          : "—";

  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-border bg-card px-3 py-1.5">
      <div className="flex items-start justify-between gap-4">
        <PlayerPanel p={me.team === "T" ? t : ct} side="left" />
        <div className="flex flex-col items-center rounded-md border border-border bg-background px-4 py-1.5">
          <div className="font-display text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Round {Math.max(1, state.round)} · First to {state.rules.winScore}
          </div>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-xl tabular-nums">
            <span className="text-foreground">{state.pScores[0]}</span>
            <span className="text-muted-foreground">:</span>
            <span className="text-foreground">{state.pScores[1]}</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">P1 · P2</div>
          <Badge variant="secondary" className="mt-1 font-mono text-[10px] tracking-widest">
            {clock}
          </Badge>
        </div>
        <PlayerPanel p={me.team === "T" ? ct : t} side="right" />
      </div>
      {t.plantProgress > 0 && (
        <div className="mx-auto w-64">
          <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--t-col)]">
            Planting
          </p>
          <Bar value={(t.plantProgress / PLANT_TIME) * 100} />
        </div>
      )}
      {ct.defuseProgress > 0 && (
        <div className="mx-auto w-64">
          <p className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--ct-col)]">
            Defusing
          </p>
          <Bar value={(ct.defuseProgress / DEFUSE_TIME) * 100} />
        </div>
      )}
    </div>
  );
}
