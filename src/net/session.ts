import Peer, { type DataConnection } from "peerjs";
import type { MatchState, WeaponId } from "@/game/types";
import type { PlayerInput } from "@/game/engine";

export type NetMsg =
  | { t: "hello"; name: string }
  | { t: "ready" }
  | { t: "input"; input: PlayerInput }
  | { t: "buy"; weapon: WeaponId }
  | { t: "armor" }
  | { t: "state"; state: MatchState }
  | { t: "start" };

export type Role = "host" | "guest" | null;

function roomId(code: string) {
  return `dustline-${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export function makeCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

export class NetSession {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  role: Role = null;
  code = "";
  status = "idle";
  onMessage: ((msg: NetMsg) => void) | null = null;
  onStatus: ((s: string) => void) | null = null;

  private setStatus(s: string) {
    this.status = s;
    this.onStatus?.(s);
  }

  send(msg: NetMsg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  async host(code: string): Promise<void> {
    this.destroy();
    this.role = "host";
    this.code = code;
    this.setStatus("opening room…");
    this.peer = new Peer(roomId(code), { debug: 0 });
    await new Promise<void>((resolve, reject) => {
      this.peer!.on("open", () => {
        this.setStatus("waiting for opponent");
        resolve();
      });
      this.peer!.on("error", (e) => {
        this.setStatus(e.message);
        reject(e);
      });
    });
    this.peer.on("connection", (c) => {
      this.attach(c);
      this.setStatus("opponent connected");
    });
  }

  async join(code: string): Promise<void> {
    this.destroy();
    this.role = "guest";
    this.code = code;
    this.setStatus("joining…");
    this.peer = new Peer({ debug: 0 });
    await new Promise<void>((resolve, reject) => {
      this.peer!.on("open", () => resolve());
      this.peer!.on("error", (e) => {
        this.setStatus(e.message);
        reject(e);
      });
    });
    const c = this.peer.connect(roomId(code), { reliable: true });
    await new Promise<void>((resolve, reject) => {
      c.on("open", () => {
        this.attach(c);
        this.setStatus("connected");
        this.send({ t: "hello", name: "guest" });
        resolve();
      });
      c.on("error", (e) => {
        this.setStatus(e.message);
        reject(e);
      });
    });
  }

  private attach(c: DataConnection) {
    this.conn = c;
    c.on("data", (raw) => {
      this.onMessage?.(raw as NetMsg);
    });
    c.on("close", () => this.setStatus("disconnected"));
    c.on("error", (e) => this.setStatus(e.message));
  }

  destroy() {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this.role = null;
  }
}
