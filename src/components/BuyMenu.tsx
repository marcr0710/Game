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
    <div className="p-2.5">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <h3 className="font-display text-xs tracking-wide">
            Buy · {p.team === "T" ? "T" : "CT"}
          </h3>
          <span className="font-mono text-xs tabular-nums text-primary">${p.money}</span>
        </div>
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          B close · 1–5 guns · 6 kevlar · {Math.ceil(seconds)}s
        </p>
        <div className="grid grid-cols-2 gap-1">
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
                className="h-auto flex-col items-start gap-0 px-2 py-1"
              >
                <span className="text-xs">
                  {w.name} ${w.cost}
                </span>
                <span className="font-mono text-[8px] font-normal opacity-70">{weaponBlurb(id)}</span>
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
