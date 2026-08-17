import { Button } from "@/components/ui/button";
import type { PlayerState, WeaponId } from "@/game/types";
import { WEAPONS, weaponBlurb } from "@/game/weapons";
import { buyArmor, buyWeapon } from "@/game/engine";

const ORDER: WeaponId[] = ["glock", "usp", "ak47", "m4", "awp"];

export function BuyMenu({
  player,
  seconds,
  onBuy,
  onArmor,
}: {
  player: PlayerState;
  seconds: number;
  onBuy: (id: WeaponId) => void;
  onArmor: () => void;
}) {
  const p = player;
  return (
    <div className="pointer-events-auto shrink-0 border-t border-border bg-card p-3">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-display text-sm tracking-wide">
            Buy · {p.team === "T" ? "Terrorist" : "Counter-Terrorist"}
          </h3>
          <span className="font-mono text-sm tabular-nums text-primary">${p.money}</span>
        </div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Keys 1–5 weapons · 6 kevlar · {Math.ceil(seconds)}s
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((id) => {
            const w = WEAPONS[id];
            const locked = !!(w.team && w.team !== p.team);
            const poor = p.money < w.cost;
            return (
              <Button
                key={id}
                size="sm"
                variant={p.weapon === id ? "default" : "outline"}
                disabled={locked || poor}
                onClick={() => onBuy(id)}
                className="h-auto flex-col items-start gap-0 px-3 py-1.5"
              >
                <span>
                  {w.name} ${w.cost}
                </span>
                <span className="font-mono text-[9px] font-normal opacity-70">{weaponBlurb(id)}</span>
              </Button>
            );
          })}
          <Button size="sm" variant="secondary" disabled={p.money < 650 || p.armor >= 100} onClick={onArmor}>
            Kevlar $650
          </Button>
        </div>
      </div>
    </div>
  );
}

export function tryBuyHotkeys(p: PlayerState, code: string): "weapon" | "armor" | null {
  const map: Record<string, WeaponId> = {
    Digit1: "glock",
    Digit2: "usp",
    Digit3: "ak47",
    Digit4: "m4",
    Digit5: "awp",
  };
  if (map[code]) {
    buyWeapon(p, map[code]);
    return "weapon";
  }
  if (code === "Digit6") {
    buyArmor(p);
    return "armor";
  }
  return null;
}
