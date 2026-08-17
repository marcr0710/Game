import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BuyMenu, tryBuyHotkeys } from "@/components/BuyMenu";
import { GameHud } from "@/components/GameHud";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BlurFade } from "@/components/ui/blur-fade";
import {
  buyArmor,
  buyWeapon,
  createMatch,
  EMPTY_INPUT,
  inputFromKeys,
  startMatch,
  tick,
  type KeySet,
  type PlayerInput,
} from "@/game/engine";
import { canvasToWorld, renderFor } from "@/game/render";
import type { MatchState, WeaponId } from "@/game/types";
import { makeCode, NetSession, type NetMsg } from "@/net/session";

type Role = "host" | "guest" | "solo" | null;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MatchState>(createMatch());
  const keysRef = useRef<KeySet>(new Set());
  const netRef = useRef(new NetSession());
  const remoteInputRef = useRef<PlayerInput>({ ...EMPTY_INPUT });
  const localIdRef = useRef<0 | 1>(0);
  const roleSoloRef = useRef(false);
  const mouseRef = useRef({ fire: false, aimAngle: null as number | null });
  const [ui, setUi] = useState(0);
  const [status, setStatus] = useState("idle");
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState<Role>(null);
  const [copied, setCopied] = useState(false);
  const [maxRounds, setMaxRounds] = useState(6);
  const [winScore, setWinScore] = useState(4);
  const [fuse, setFuse] = useState(35);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const net = netRef.current;
    net.onStatus = (s) => {
      setStatus(s);
      if (s === "opponent connected" || s === "connected") setConnected(true);
      if (s === "disconnected") setConnected(false);
    };
    net.onMessage = (msg: NetMsg) => {
      const s = stateRef.current;
      if (msg.t === "hello" && net.role === "host") {
        setConnected(true);
        net.send({ t: "ready" });
      }
      if (msg.t === "ready") setConnected(true);
      if (msg.t === "input" && net.role === "host") {
        remoteInputRef.current = msg.input;
      }
      if (msg.t === "buy" && net.role === "host") {
        buyWeapon(s.players[1], msg.weapon);
      }
      if (msg.t === "armor" && net.role === "host") {
        buyArmor(s.players[1]);
      }
      if (msg.t === "state" && net.role === "guest") {
        stateRef.current = msg.state;
      }
      if (msg.t === "start" && net.role === "guest") {
        startMatch(stateRef.current);
      }
    };
    return () => net.destroy();
  }, []);

  useEffect(() => {
    const keys = keysRef.current;
    const down = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      const s = stateRef.current;
      const id = localIdRef.current;
      if (s.phase === "buy") {
        const kind = tryBuyHotkeys(s.players[id], e.code);
        if (kind && netRef.current.role === "guest") {
          if (kind === "armor") netRef.current.send({ t: "armor" });
          else {
            const map: Record<string, WeaponId> = {
              Digit1: "glock",
              Digit2: "usp",
              Digit3: "ak47",
              Digit4: "m4",
              Digit5: "awp",
            };
            if (map[e.code]) netRef.current.send({ t: "buy", weapon: map[e.code] });
          }
        }
        setUi((n) => n + 1);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const world = canvasToWorld(canvas, e.clientX, e.clientY);
      const me = stateRef.current.players[localIdRef.current];
      const ang = Math.atan2(world.y - me.y, world.x - me.x);
      mouseRef.current.aimAngle = ang;
      me.angle = ang;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      mouseRef.current.fire = true;
    };
    const onUp = () => {
      mouseRef.current.fire = false;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    const blockMenu = (ev: Event) => ev.preventDefault();
    canvas.addEventListener("contextmenu", blockMenu);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("contextmenu", blockMenu);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let uiAcc = 0;
    let sendAcc = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      const net = netRef.current;
      const local = inputFromKeys(keysRef.current, mouseRef.current);
      const s = stateRef.current;
      if ((net.role === "host" || roleSoloRef.current) && s.phase !== "menu") {
        tick(s, [local, remoteInputRef.current], dt, t / 1000);
        sendAcc += dt;
        if (net.role === "host" && sendAcc > 1 / 20) {
          sendAcc = 0;
          net.send({ t: "state", state: s });
        }
      } else if (net.role === "guest") {
        sendAcc += dt;
        if (sendAcc > 1 / 20) {
          sendAcc = 0;
          net.send({ t: "input", input: local });
        }
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const parent = canvas.parentElement;
        const w = parent?.clientWidth ?? 960;
        const h = parent?.clientHeight ?? 540;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (ctx && s.phase !== "menu") renderFor(ctx, s, localIdRef.current, canvas.width, canvas.height);
      }
      uiAcc += dt;
      if (s.phase !== "menu" && uiAcc > 0.08) {
        uiAcc = 0;
        setUi((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = stateRef.current;
  const localId = localIdRef.current;
  void ui;

  const beginHost = async () => {
    roleSoloRef.current = false;
    const c = makeCode();
    setCode(c);
    localIdRef.current = 0;
    setRole("host");
    try {
      await netRef.current.host(c);
    } catch {
      /* status already set */
    }
  };

  const beginJoin = async () => {
    roleSoloRef.current = false;
    const c = joinCode.trim();
    if (!c) return;
    localIdRef.current = 1;
    setRole("guest");
    setCode(c);
    try {
      await netRef.current.join(c);
    } catch {
      /* status already set */
    }
  };

  const applyRules = () => {
    const match = stateRef.current;
    match.rules = {
      maxRounds: Math.max(1, Math.min(30, Math.round(maxRounds) || 6)),
      winScore: Math.max(1, Math.min(20, Math.round(winScore) || 4)),
      fuse: Math.max(8, Math.min(90, Math.round(fuse) || 35)),
    };
  };

  const launch = () => {
    applyRules();
    startMatch(stateRef.current);
    netRef.current.send({ t: "start" });
    netRef.current.send({ t: "state", state: stateRef.current });
    setUi((n) => n + 1);
  };

  const launchSolo = () => {
    roleSoloRef.current = true;
    localIdRef.current = 0;
    setRole("solo");
    setStatus("solo practice");
    applyRules();
    startMatch(stateRef.current);
    setUi((n) => n + 1);
  };

  const shareUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}${window.location.pathname}?room=${code}`
      : "";

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("room");
    if (q) setJoinCode(q);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <img src="https://appdirect.com/shortcut-icon.ico" alt="" className="size-6 rounded-sm" />
          <div>
            <p className="font-display text-sm tracking-[0.2em] uppercase">Dustline</p>
            <p className="font-mono text-[10px] text-muted-foreground">online 1v1 · line of sight</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {role === "host" ? "T host" : role === "solo" ? "T solo" : "CT guest"} · {status}
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-[#070b10]">
          <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair touch-none" />
          {s.phase !== "menu" && <GameHud state={s} localId={localId} />}
          {s.phase === "buy" && (
            <BuyMenu
              player={s.players[localId]}
              seconds={s.buyTimer}
              onBuy={(id) => {
                if (role === "host" || role === "solo") buyWeapon(s.players[localId], id);
                else netRef.current.send({ t: "buy", weapon: id });
                setUi((n) => n + 1);
              }}
              onArmor={() => {
                if (role === "host" || role === "solo") buyArmor(s.players[localId]);
                else netRef.current.send({ t: "armor" });
                setUi((n) => n + 1);
              }}
            />
          )}
          {s.phase === "round_end" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
              <BlurFade>
                <Card className="min-w-72 text-center">
                  <CardContent className="pt-6">
                    <p className="font-display text-xl">{s.endReason}</p>
                    <p className="mt-2 font-mono text-sm text-muted-foreground">
                      {s.winner ? `${s.winner === "T" ? "Terrorists" : "CTs"} take the map` : "Next round shortly"}
                    </p>
                  </CardContent>
                </Card>
              </BlurFade>
            </div>
          )}
          {s.phase === "menu" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
              <BlurFade className="w-full max-w-xl">
                <Card className="overflow-hidden">
                  <CardContent className="space-y-5 pt-6">
                    <div>
                      <p className="font-display text-[11px] uppercase tracking-[0.3em] text-primary">Two machines</p>
                      <h1 className="mt-1 font-display text-3xl tracking-tight">Host a room. Peek mid. Plant.</h1>
                      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                        Host-authoritative WebRTC. You only see the other operator inside your facing cone with a
                        clear ray. Works on a static Vercel deploy — no game server.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <RuleField
                        label="Rounds"
                        value={maxRounds}
                        min={1}
                        max={30}
                        onChange={setMaxRounds}
                        disabled={role === "guest"}
                      />
                      <RuleField
                        label="Win score"
                        value={winScore}
                        min={1}
                        max={20}
                        onChange={setWinScore}
                        disabled={role === "guest"}
                      />
                      <RuleField
                        label="Fuse"
                        value={fuse}
                        min={8}
                        max={90}
                        suffix="s"
                        onChange={setFuse}
                        disabled={role === "guest"}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      {!role && (
                        <div className="grid gap-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button size="lg" onClick={beginHost}>
                              Create room (T)
                            </Button>
                            <div className="flex gap-2">
                              <Input
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                placeholder="Room code"
                                className="font-mono uppercase"
                                maxLength={8}
                              />
                              <Button variant="outline" size="lg" onClick={beginJoin}>
                                Join CT
                              </Button>
                            </div>
                          </div>
                          <Button variant="secondary" onClick={launchSolo}>
                            Practice solo (no opponent)
                          </Button>
                        </div>
                      )}
                      {role === "host" && (
                        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                          <p className="font-mono text-xs text-muted-foreground">Share this code or link</p>
                          <p className="font-display text-3xl tracking-[0.3em] uppercase">{code}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(code);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1200);
                              }}
                            >
                              {copied ? "Copied" : "Copy code"}
                            </Button>
                            {shareUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigator.clipboard.writeText(shareUrl)}
                              >
                                Copy join link
                              </Button>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground">{status}</p>
                          <Button className="w-full" disabled={!connected} onClick={launch}>
                            {connected ? "Start match" : "Waiting for CT…"}
                          </Button>
                        </div>
                      )}
                      {role === "guest" && (
                        <p className="font-mono text-sm text-muted-foreground">
                          {connected ? "Connected — host will start the match." : status}
                        </p>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      WASD move · mouse aim · click fire · R reload · E plant / defuse · 1–6 buy
                      <br />
                      Bomb carrier alternates each round (odd: P1 plants, even: P2 plants).
                    </div>
                  </CardContent>
                </Card>
              </BlurFade>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function RuleField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <label className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <Input
          type="number"
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 font-mono tabular-nums"
        />
        {suffix && <span className="font-mono text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
