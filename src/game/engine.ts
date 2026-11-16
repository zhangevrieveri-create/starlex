import { Sfx } from "@/game/audio";
import { bossName, DEFAULT_WORDS, makeQuestion, type BuiltQuestion } from "@/game/lexicon";
import { SpriteBook, type SheetId } from "@/game/sprites";
import type { ChallengeMode, PublicQuestion, QuizKind, Snap, Theater, Word } from "@/game/types";

const PHASES = [2 / 3, 1 / 3];
const FONT = '"PingFang TC", "Microsoft JhengHei", "WenQuanYi Zen Hei", sans-serif';

const PAL = {
  bg0: "#070b14",
  bg1: "#10182a",
  cyan: "#3ee0c5",
  cyanDeep: "#0f6e68",
  amber: "#f0a202",
  rose: "#ff4d6d",
  fg: "#e7f0f7",
  muted: "#8ea3b8",
  hull: "#d9fff6",
};

type Kind = "grunt" | "dart" | "tank" | "boss";

type Enemy = {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  t: number;
  phase: number;
  cool: number;
  flash: number;
  locked: boolean;
  quiz: QuizKind;
  seed: number;
  alive: boolean;
  entered: boolean;
  hold: number;
  mark: boolean;
  guard: number;
  wind: number;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  r: number;
  friendly: boolean;
  life: number;
  dmg: number;
  grazeCd?: number;
  pierce?: boolean;
  hurt?: Set<Enemy>;
  look?: "needle" | "orb" | "beam" | "shard" | "blob";
};

type PickupKind = "spread" | "shield" | "speed";

type Craft = {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gap: number;
  mark?: boolean;
};

type Pickup = { kind: PickupKind; x: number; y: number; life: number; r: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};

type Floater = { x: number; y: number; text: string; life: number; color: string };

type Star = { x: number; y: number; s: number };

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
      setSteer: (v: number) => void;
    };
    __starlex?: {
      skipToBoss: () => void;
      hurtBoss: (n: number) => void;
      answerCorrect: () => void;
      answerWrong: () => void;
      answer: (i: number) => void;
      locked: () => boolean;
      question: () => string | null;
      hp: () => number;
      maxHp: () => number;
      bossAlive: () => boolean;
      wave: () => number;
      hostile: () => number;
      music: () => boolean;
      bed: () => string | null;
      waveName: () => string;
      phase: () => number;
      foes: () => string;
    };
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class Game {
  w = 390;
  h = 700;
  status: Snap["status"] = "attract";
  paused = false;
  score = 0;
  lives = 3;
  wave = 1;
  words: Word[] = DEFAULT_WORDS.map((w) => ({ ...w }));
  mode: ChallengeMode = "mix";
  theater: Theater = "space";
  question: PublicQuestion | null = null;

  private art = new SpriteBook();

  private sfx = new Sfx();
  private listeners = new Set<(s: Snap) => void>();
  private keys = new Set<string>();
  private injected: Set<string> | null = null;
  private steerOverride = 0;
  private pointerOn = false;
  private px = 0;
  private py = 0;
  private player = { x: 195, y: 540, r: 12, tilt: 0 };
  private vx = 0;
  private vy = 0;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private layers: { speed: number; stars: Star[] }[] = [];
  private built: BuiltQuestion | null = null;
  private fireCd = 0;
  private muzzle = 0;
  private invuln = 0;
  private powSpread = 0;
  private powSpeed = 0;
  private powShield = 0;
  private shieldHits = 0;
  private stockSpread = 0;
  private stockSpeed = 0;
  private stockShield = 0;
  private graze = 0;
  private grazeReady = false;
  private grazeHot = false;
  private pierceCd = 0;
  private kick = 0;
  private shot: "needle" | "orb" | "beam" = "needle";
  private gateAt = 0;
  private waveName = "";
  private queue: Craft[] = [];
  private shake = 0;
  private hurtFlash = 0;
  private banner = "";
  private bannerT = 0;
  private road = 0;
  private hitStop = 0;
  private leftToSpawn = 0;
  private spawnGap = 0;
  private spawningBoss = false;
  private clearHold = 0;
  private inputLock = 0;
  private time = 0;
  private uiAcc = 0;
  private reduce = false;
  private disposed = false;

  constructor() {
    this.layers = [
      { speed: 24, stars: this.makeStars(50, 1.1) },
      { speed: 62, stars: this.makeStars(30, 1.7) },
      { speed: 128, stars: this.makeStars(16, 2.5) },
    ];
    if (typeof window !== "undefined") {
      this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.attachProbe();
    }
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    if (this.status === "play") {
      this.player.x = clamp(this.player.x, 22, w - 22);
      this.player.y = clamp(this.player.y, 22, h - 22);
    }
  }

  subscribe(fn: (s: Snap) => void) {
    this.listeners.add(fn);
    fn(this.snap());
    return () => this.listeners.delete(fn);
  }

  setWords(words: Word[]) {
    this.words = words.length > 0 ? words.map((w) => ({ ...w })) : DEFAULT_WORDS.map((w) => ({ ...w }));
  }

  setMode(mode: ChallengeMode) {
    this.mode = mode;
  }

  setTheater(theater: Theater) {
    this.theater = theater;
    this.emit();
  }

  setMuted(muted: boolean) {
    this.sfx.muted = muted;
    this.syncMusic();
    this.emit();
  }

  toggleMuted() {
    this.sfx.muted = !this.sfx.muted;
    this.syncMusic();
    this.emit();
    return this.sfx.muted;
  }

  unlock() {
    this.sfx.unlock();
  }

  start() {
    this.unlock();
    this.status = "play";
    this.paused = false;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.built = null;
    this.question = null;
    this.fireCd = 0.2;
    this.muzzle = 0;
    this.invuln = 1.2;
    this.powSpread = 0;
    this.powSpeed = 0;
    this.powShield = 0;
    this.shieldHits = 0;
    this.stockSpread = 1;
    this.stockSpeed = 1;
    this.stockShield = 1;
    this.graze = 0;
    this.grazeReady = false;
    this.pierceCd = 0;
    this.kick = 0;
    this.shot = "needle";
    this.gateAt = 0;
    this.waveName = "";
    this.queue = [];
    this.shake = 0;
    this.hurtFlash = 0;
    this.hitStop = 0;
    this.clearHold = 0;
    this.inputLock = 0;
    this.player.x = this.w / 2;
    this.player.y = this.h * 0.78;
    this.player.tilt = 0;
    this.vx = 0;
    this.vy = 0;
    this.beginWave();
    this.syncMusic();
    this.emit();
  }

  attract() {
    this.status = "attract";
    this.paused = false;
    this.question = null;
    this.built = null;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.sfx.stopMusic();
    this.emit();
  }

  pause(v?: boolean) {
    if (this.status !== "play") return;
    this.paused = v ?? !this.paused;
    this.syncMusic();
    this.emit();
  }

  answer(i: number) {
    if (!this.built || this.paused || this.inputLock > 0 || this.status !== "play") return;
    if (i !== this.built.answer) {
      this.inputLock = 0.28;
      this.failGate();
      return;
    }
    this.solveGate();
  }

  setPointer(x: number, y: number, on: boolean) {
    this.px = x;
    this.py = y;
    this.pointerOn = on && this.status === "play" && !this.paused;
  }

  onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.code === "Escape") {
      e.preventDefault();
      this.pause();
      return;
    }
    if (this.question && !this.paused && /^Digit[1-4]$/.test(e.code) && !e.repeat) {
      this.answer(Number(e.code.slice(5)) - 1);
      return;
    }
    if (!e.repeat && this.status === "play" && !this.paused && !this.question) {
      if (e.code === "KeyZ") {
        this.usePower("spread");
        return;
      }
      if (e.code === "KeyX") {
        this.usePower("shield");
        return;
      }
      if (e.code === "KeyC") {
        this.usePower("speed");
        return;
      }
      if (e.code === "KeyQ") {
        this.cycleShot();
        return;
      }
    }
    if (e.code === "Space" && !e.repeat && !this.question) {
      e.preventDefault();
      this.usePierce();
      return;
    }
    this.keys.add(e.code);
    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight" ||
      e.code === "Space"
    ) {
      e.preventDefault();
    }
  }

  onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  clearKeys() {
    this.keys.clear();
  }

  frame(ctx: CanvasRenderingContext2D, dt: number) {
    if (this.disposed || this.w < 2 || this.h < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.time += dt;
    this.driftStars(dt);
    this.decayJuice(dt);
    if (this.status === "play" && !this.paused) {
      const scale = this.question ? 0.5 : 1;
      if (this.hitStop > 0) this.hitStop -= dt * scale;
      else this.step(dt * scale);
    }
    if (this.status === "play") this.syncMusic();
    this.draw(ctx);
    if (this.status === "play") {
      this.uiAcc += dt;
      if (this.uiAcc >= 0.2) {
        this.uiAcc = 0;
        this.emit();
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
    if (typeof window !== "undefined") {
      delete window.__controlsTest;
      delete window.__starlex;
    }
  }

  private beginWave() {
    this.queue = [];
    this.spawningBoss = this.wave % 3 === 0;
    if (this.spawningBoss) {
      this.leftToSpawn = 1;
      this.spawnGap = 0.65;
      this.waveName = this.theater === "night" ? "屍王" : "旗艦";
      this.banner = this.theater === "night" ? "屍王進場" : "首領進場";
    } else {
      const plan = this.formationPlan();
      this.queue = plan.crafts;
      this.leftToSpawn = plan.crafts.length;
      this.spawnGap = 0.12;
    this.waveName = `${plan.title} · 信標`;
    this.banner = "打缺口，別讓它溜走";
    }
    this.bannerT = 1.6;
    this.clearHold = 0;
  }

  private step(dt: number) {
    this.movePlayer(dt);
    this.fireCd -= dt;
    if (this.fireCd <= 0) this.fire();
    this.spawnGap -= dt;
    if (this.leftToSpawn > 0 && this.spawnGap <= 0) {
      const alive = this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      if (this.spawningBoss) {
        this.spawnBoss();
        this.leftToSpawn = 0;
        this.spawnGap = 0;
      } else if (this.queue.length > 0 && alive < 10) {
        const craft = this.queue.shift()!;
        this.spawnCraft(craft, 0.9);
        this.leftToSpawn = this.queue.length;
        this.spawnGap = craft.gap;
      } else this.spawnGap = 0.18;
    }
    for (const e of this.enemies) if (e.alive) this.tickEnemy(e, dt);
    this.separate();
    this.grazeHot = false;
    for (const b of this.bullets) {
      if (b.grazeCd) b.grazeCd = Math.max(0, b.grazeCd - dt);
      b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (!b.friendly) this.noteGraze(b);
    }
    for (const p of this.pickups) {
      p.y += 38 * dt;
      p.life -= dt;
    }
    this.collide();
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.powSpread > 0) this.powSpread -= dt;
    if (this.powSpeed > 0) this.powSpeed -= dt;
    if (this.pierceCd > 0) this.pierceCd -= dt;
    this.kick = Math.max(0, this.kick - dt * 7);
    if (this.particles.length < 150 && Math.random() < 0.7) {
      this.particles.push({
        x: this.player.x - 4,
        y: this.player.y + 12,
        vx: (Math.random() - 0.5) * 16,
        vy: 50,
        life: 0.28,
        max: 0.28,
        color: PAL.cyan,
        size: 2.2,
      });
    }
    const any = this.enemies.some((e) => e.alive);
    if (!any && this.leftToSpawn <= 0) {
      this.clearHold += dt;
      if (this.clearHold >= 1.35) {
        const bonus = 100 * this.wave;
        this.score += bonus;
        this.float(this.w / 2, this.h * 0.32, `+${bonus}`, PAL.amber);
        this.wave += 1;
        this.drop(this.w / 2, this.h * 0.42);
        this.beginWave();
        this.emit();
      }
    } else this.clearHold = 0;
    this.compact();
  }

  private movePlayer(dt: number) {
    const p = this.player;
    let mx = 0;
    let my = 0;
    if (this.held("KeyA") || this.held("ArrowLeft")) mx -= 1;
    if (this.held("KeyD") || this.held("ArrowRight")) mx += 1;
    if (this.held("KeyW") || this.held("ArrowUp")) my -= 1;
    if (this.held("KeyS") || this.held("ArrowDown")) my += 1;
    if (this.steerOverride) mx -= this.steerOverride;
    const speed = 290 * (this.powSpeed > 0 ? 1.55 : 1);
    let vx = 0;
    let vy = 0;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      vx = (mx / len) * speed;
      vy = (my / len) * speed;
      p.x += vx * dt;
      p.y += vy * dt;
    } else if (this.pointerOn) {
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const k = 1 - Math.exp(-12 * dt);
      let sx = dx * k;
      let sy = dy * k;
      const mag = Math.hypot(sx, sy);
      const cap = speed * 1.5 * dt;
      if (mag > cap && mag > 0) {
        sx *= cap / mag;
        sy *= cap / mag;
      }
      vx = dt > 0 ? sx / dt : 0;
      vy = dt > 0 ? sy / dt : 0;
      p.x += sx;
      p.y += sy;
    }
    p.x = clamp(p.x, 20, this.w - 20);
    p.y = clamp(p.y, 20, this.h - 20);
    const target = clamp(vx / 720, -0.45, 0.45);
    p.tilt += (target - p.tilt) * (1 - Math.exp(-10 * dt));
    this.vx = vx;
    this.vy = vy;
  }

  private fire() {
    const spread = this.powSpread > 0;
    const wide = this.graze > 0.7 ? 1.28 : 1;
    let cd = 0.14;
    let angles = [0];
    let speed = 700;
    let dmg = 1;
    let r = 2.6;
    let life = 0.85;
    let look: Bullet["look"] = "needle";
    if (this.shot === "orb") {
      cd = spread ? 0.18 : 0.26;
      angles = spread ? [-0.28, 0, 0.28].map((a) => a * wide) : [0];
      speed = 430;
      dmg = 3;
      r = 8;
      life = 1.35;
      look = "orb";
    } else if (this.shot === "beam") {
      cd = spread ? 0.07 : 0.09;
      angles = spread ? [-0.1, 0.1] : [0];
      speed = 980;
      dmg = 1;
      r = 5;
      life = 0.42;
      look = "beam";
    } else {
      cd = spread ? 0.08 : 0.12;
      angles = spread ? [-0.34, -0.17, 0, 0.17, 0.34].map((a) => a * wide) : [0];
      speed = 760;
      look = "needle";
    }
    this.fireCd = cd;
    const noseY = this.player.y - 18;
    for (const a of angles) {
      if (this.bullets.length > 96) break;
      const ang = -Math.PI / 2 + a;
      this.bullets.push({
        x: this.player.x + Math.sin(a) * 8,
        y: noseY,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        ay: 0,
        r,
        friendly: true,
        life,
        dmg,
        look,
      });
    }
    this.muzzle = 0.08;
    this.kick = 1;
    this.sfx.shoot();
  }

  cycleShot() {
    if (this.status !== "play" || this.paused || this.question) return;
    this.shot = this.shot === "needle" ? "orb" : this.shot === "orb" ? "beam" : "needle";
    this.banner = this.shotLabel();
    this.bannerT = 0.7;
    this.sfx.pickup();
    this.emit();
  }

  private shotLabel() {
    return this.shot === "orb" ? "重彈" : this.shot === "beam" ? "光束" : "光針";
  }

  private formationPlan(): { title: string; crafts: Craft[] } {
    const tier = Math.floor((this.wave - 1) / 3);
    const slot = (this.wave % 3) - 1;
    const pattern = (tier * 2 + slot) % 5;
    const n = 4 + Math.min(3, tier);
    const titles = ["橫列推進", "兩翼夾擊", "後排封路", "慢隊帶路", "尖刃插入"];
    const crafts: Craft[] = [];
    const lane = (i: number, count: number) => {
      const pad = 34;
      return pad + ((this.w - pad * 2) * (i + 0.5)) / count;
    };
    if (pattern === 0) {
      for (let i = 0; i < n; i++) {
        crafts.push({ kind: "grunt", x: lane(i, n), y: -24 - (i % 2) * 18, vx: 0, vy: 62, gap: 0.16 });
      }
    } else if (pattern === 1) {
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        crafts.push({
          kind: "dart",
          x: left ? -20 : this.w + 20,
          y: 36 + (i % 3) * 28,
          vx: left ? 130 : -130,
          vy: 36,
          gap: 0.2,
        });
      }
    } else if (pattern === 2) {
      crafts.push({ kind: "tank", x: this.w * 0.32, y: -70, vx: 0, vy: 34, gap: 0.28 });
      crafts.push({ kind: "tank", x: this.w * 0.68, y: -78, vx: 0, vy: 34, gap: 0.2 });
      for (let i = 0; i < n - 1; i++) {
        crafts.push({ kind: "grunt", x: lane(i, n - 1), y: -22, vx: 0, vy: 70, gap: 0.14 });
      }
    } else if (pattern === 3) {
      const lead = Math.max(3, n - 2);
      for (let i = 0; i < lead; i++) {
        crafts.push({ kind: "grunt", x: lane(i, lead), y: -20, vx: 0, vy: 48, gap: 0.16 });
      }
      crafts.push({ kind: "dart", x: -20, y: 70, vx: 150, vy: 20, gap: 0.35 });
      crafts.push({ kind: "dart", x: this.w + 20, y: 96, vx: -150, vy: 20, gap: 0.2 });
    } else {
      crafts.push({ kind: "dart", x: this.w / 2, y: -28, vx: 0, vy: 110, gap: 0.22 });
      const wings = Math.max(2, n - 1);
      for (let i = 0; i < wings; i++) {
        const left = i % 2 === 0;
        crafts.push({
          kind: i > 2 ? "tank" : "grunt",
          x: left ? this.w * 0.28 : this.w * 0.72,
          y: -36 - Math.floor(i / 2) * 22,
          vx: left ? 24 : -24,
          vy: 64,
          gap: 0.16,
        });
      }
    }
    const markAt = Math.floor((crafts.length - 1) / 2);
    if (crafts[markAt]) crafts[markAt]!.mark = true;
    return { title: titles[pattern] ?? "橫列推進", crafts };
  }

  private spawnCraft(craft: Craft, hold: number) {
    const night = this.theater === "night";
    const kind = craft.kind;
    const hp = night
      ? kind === "tank"
        ? 8 + Math.floor(this.wave / 2)
        : kind === "dart"
          ? 2
          : 2 + Math.floor((this.wave - 1) / 4)
      : kind === "tank"
        ? 4 + Math.floor(this.wave / 3)
        : 1 + Math.floor((this.wave - 1) / 5);
    const enemy: Enemy = {
      kind,
      x: craft.x,
      y: craft.y,
      vx: craft.vx,
      vy: craft.vy,
      hp,
      maxHp: hp,
      r: night ? (kind === "tank" ? 26 : kind === "dart" ? 16 : 18) : kind === "tank" ? 22 : kind === "dart" ? 13 : 15,
      t: 0,
      phase: 0,
      cool: 0.55 + Math.random() * 0.4,
      flash: 0,
      locked: false,
      quiz: "word",
      seed: Math.random() * 6,
      alive: true,
      entered: true,
      hold,
      mark: Boolean(craft.mark),
      guard: Math.PI / 2,
      wind: 0,
    };
    this.enemies.push(enemy);
  }

  private quizForWave(): QuizKind {
    if (this.mode === "words") return "word";
    if (this.mode === "math") return "math";
    return this.wave / 3 % 2 === 1 ? "word" : "math";
  }

  private spawnBoss() {
    const quiz = this.quizForWave();
    const ord = Math.max(1, this.wave / 3);
    const maxHp = Math.round(110 + (ord - 1) * 48);
    this.enemies.push({
      kind: "boss",
      x: this.w / 2,
      y: -70,
      vx: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      r: this.theater === "night" ? 58 : 52,
      t: 0,
      phase: 0,
      cool: 1.4,
      flash: 0,
      locked: false,
      quiz,
      seed: 0,
      alive: true,
      entered: false,
      hold: 0,
      mark: false,
      guard: 0,
      wind: 0,
    });
    this.banner = `${this.bossTitle(quiz)} · 血線鎖盾`;
    this.bannerT = 1.8;
    this.emit();
  }

  private tickEnemy(e: Enemy, dt: number) {
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.kind === "boss") {
      if (!e.entered) {
        e.y += 86 * dt;
        if (e.y >= 112) e.entered = true;
      } else {
        const night = this.theater === "night";
        if (e.wind !== 0) {
          this.tickLunge(e, dt);
          return;
        }
        const ord = Math.max(1, this.wave / 3);
        if (night) {
          const side = Math.sin(e.t * 0.5) > 0 ? 1 : -1;
          const dest = this.w / 2 + side * this.w * 0.22;
          e.x += (dest - e.x) * Math.min(1, dt * 1.5);
          e.y = 176 + Math.sin(e.t * 2.4) * 5;
        } else {
          e.x = this.w / 2 + Math.sin(e.t * (0.55 + ord * 0.03)) * this.w * 0.3;
          e.y = 108 + Math.sin(e.t * 0.9) * 12;
        }
        e.cool -= dt;
        if (e.locked || e.cool > 0) return;
        this.bossVolley(e);
      }
      return;
    }
    if (e.hold > 0) {
      e.hold -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.mark) e.guard += dt * 0.6;
      return;
    }
    if (e.mark) {
      this.tickMark(e, dt);
      return;
    }
    if (this.theater === "night") {
      this.tickHorde(e, dt);
      return;
    }
    if (e.kind === "grunt") {
      e.y += e.vy * dt;
      e.x += Math.sin(e.t * 2 + e.seed) * 36 * dt;
    } else if (e.kind === "dart") {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else {
      e.y += e.vy * dt;
      e.x += Math.sin(e.t * 1.2 + e.seed) * 20 * dt;
    }
    e.cool -= dt;
    if (e.cool <= 0 && e.y > 10 && e.y < this.h * 0.78) {
      e.cool = e.kind === "tank" ? 1.5 : 1.7 + Math.random();
      if (e.kind === "tank") this.shootFan(e.x, e.y + e.r, 3, 0.4, 200);
      else if (e.kind === "dart") this.shootAim(e.x, e.y, 210);
      else {
        this.bullets.push({
          x: e.x,
          y: e.y + e.r,
          vx: 0,
          vy: 200 + this.wave * 4,
          ay: 0,
          r: 4,
          friendly: false,
          life: 4,
          dmg: 1,
        });
      }
    }
    const off =
      e.y > this.h + 48 ||
      (e.kind === "dart" && (e.x < -60 || e.x > this.w + 60) && e.t > 0.4);
    if (off) e.alive = false;
  }

  private tickHorde(e: Enemy, dt: number) {
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const prefer = e.kind === "dart" ? 148 : e.kind === "tank" ? 248 : 198;
    const slack = e.kind === "dart" ? 34 : e.kind === "tank" ? 58 : 46;
    const speed = e.kind === "dart" ? 156 + this.wave * 4 : e.kind === "tank" ? 46 : 68 + this.wave * 2;
    let nx = (e.x - this.player.x) / dist;
    let ny = (e.y - this.player.y) / dist;
    if (ny > -0.35) {
      ny = -0.75;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }
    const goalX = clamp(this.player.x + nx * prefer, 28, this.w - 28);
    const goalY = clamp(this.player.y + ny * prefer, 36, this.h * 0.56);
    const gx = goalX - e.x;
    const gy = goalY - e.y;
    const gd = Math.hypot(gx, gy) || 1;
    if (dist < prefer - slack) {
      e.x -= (dx / dist) * speed * dt;
      e.y -= (dy / dist) * speed * dt;
    } else if (gd > 18 && dist > prefer + slack) {
      e.x += (gx / gd) * speed * dt;
      e.y += (gy / gd) * speed * dt;
    } else {
      const side = Math.sin(e.t * 1.35 + e.seed) >= 0 ? 1 : -1;
      e.x += (-dy / dist) * side * speed * 0.72 * dt;
      e.y += (dx / dist) * side * speed * 0.28 * dt;
      e.x += (gx / gd) * speed * 0.22 * dt;
      e.y += (gy / gd) * speed * 0.22 * dt;
    }
    e.x = clamp(e.x, 20, this.w - 20);
    e.y = clamp(e.y, 28, this.h * 0.7);
    this.rangedAttack(e, dt, dist);
  }

  private rangedAttack(e: Enemy, dt: number, dist: number) {
    e.cool -= dt;
    if (e.cool > 0 || e.y < 12 || dist > 460) return;
    if (e.kind === "tank") {
      e.cool = 1.9;
      this.launchAt(e.x, e.y, 268, 460, 0.14, 3, 5.4);
      return;
    }
    if (e.kind === "dart") {
      e.cool = 0.82;
      this.launchAt(e.x, e.y, 390, 0, 0, 1, 3.3);
      return;
    }
    e.cool = 1.28;
    this.launchAt(e.x, e.y, 310, 220, 0, 1, 4.2);
  }

  private syncMusic() {
    if (this.sfx.muted || this.status !== "play" || this.paused) {
      this.sfx.playBed(null, false);
      return;
    }
    const bed = this.liveBoss() ? "boss" : this.theater === "night" ? "night" : "space";
    this.sfx.playBed(bed, Boolean(this.question));
  }

  private tickMark(e: Enemy, dt: number) {
    e.guard += dt * 1.15;
    const dest = this.w * (e.seed > 3 ? 0.22 : 0.78);
    e.x += (dest - e.x) * Math.min(1, dt * 1.15);
    e.y += 76 * dt;
    if (e.y > this.h + 40) {
      e.alive = false;
      this.score = Math.max(0, this.score - 120);
      this.banner = "信標溜走了";
      this.bannerT = 1.2;
      this.float(clamp(e.x, 40, this.w - 40), this.h - 48, "溜走 -120", PAL.rose);
      this.sfx.bad();
    }
  }

  private gapOpen(e: Enemy, x: number, y: number) {
    let d = Math.atan2(y - e.y, x - e.x) - e.guard;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) < 1.05;
  }

  private tickLunge(e: Enemy, dt: number) {
    if (e.wind > 0) {
      e.wind -= dt;
      e.y += 340 * dt;
      e.x += (this.player.x - e.x) * Math.min(1, dt * 2.2);
      if (e.wind <= 0) e.wind = -0.55;
      return;
    }
    e.wind += dt;
    e.y += (176 - e.y) * Math.min(1, dt * 3);
    if (e.wind >= 0) {
      e.wind = 0;
      e.cool = 1.15;
    }
  }

  private cast(
    x: number,
    y: number,
    vx: number,
    vy: number,
    look: Bullet["look"],
    r: number,
    ay = 0,
  ) {
    if (this.bullets.length > 120) return;
    this.bullets.push({
      x,
      y,
      vx,
      vy,
      ay,
      r,
      friendly: false,
      life: 4.4,
      dmg: 1,
      look,
    });
  }

  private bossVolley(e: Enemy) {
    const ord = Math.max(1, this.wave / 3);
    const night = this.theater === "night";
    if (night && e.phase === 1) {
      e.wind = 0.42;
      e.cool = 2;
      for (let i = -2; i <= 2; i++) {
        const ang = Math.PI / 2 + i * 0.32;
        this.cast(e.x, e.y + e.r * 0.4, Math.cos(ang) * 160, Math.sin(ang) * 150, "blob", 7, 160);
      }
      return;
    }
    if (e.phase <= 0) {
      e.cool = night ? 1.2 : 1.05;
      if (night) this.launchAt(e.x, e.y + 10, 230 + ord * 8, 120, 0.16, 5, 5.2);
      else {
        for (const s of [-1, 1]) {
          const ang = Math.PI / 2 + s * 0.42;
          this.cast(e.x + s * e.r * 1.3, e.y + 8, Math.cos(ang) * 230, Math.sin(ang) * 230, "shard", 4.2);
        }
        this.cast(e.x, e.y + e.r * 0.4, 0, 250, "shard", 4.2);
      }
      return;
    }
    if (e.phase === 1) {
      e.cool = 1.45;
      for (let i = 0; i < 7; i++) this.cast(e.x, e.y + e.r * 0.2 + i * 6, 0, 520, "beam", 5.5);
      return;
    }
    if (night) {
      e.cool = 1.05;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.t;
        this.cast(e.x, e.y, Math.cos(a) * 70, Math.sin(a) * 40 + 30, "blob", 6, 90);
      }
      return;
    }
    e.cool = 0.38;
    e.guard += 0.62;
    this.cast(e.x, e.y, Math.cos(e.guard) * 210, Math.sin(e.guard) * 210, "shard", 4);
    this.cast(e.x, e.y, Math.cos(e.guard + Math.PI) * 210, Math.sin(e.guard + Math.PI) * 210, "shard", 4);
  }

  private summonRing() {
    const boss = this.liveBoss();
    if (!boss) return;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.2 + (i / (n - 1)) * Math.PI * 0.6;
      const kind: Kind = i % 3 === 0 ? "dart" : "grunt";
      this.spawnCraft(
        {
          kind,
          x: clamp(boss.x + Math.cos(a) * 86, 28, this.w - 28),
          y: boss.y + 28 + Math.sin(a) * 18,
          vx: Math.cos(a) * 36,
          vy: 46,
          gap: 0,
        },
        0.45,
      );
    }
  }

  private bossTitle(kind: QuizKind) {
    return this.theater === "night" ? "屍王" : bossName(kind);
  }

  private solveShot(sx: number, sy: number, speed: number, gravity: number, lob: boolean) {
    let guess = Math.hypot(this.player.x - sx, this.player.y - sy) / Math.max(speed, 40);
    let best: { vx: number; vy: number; t: number } | null = null;
    for (let n = 0; n < 3; n++) {
      const tx = clamp(this.player.x + this.vx * guess, 22, this.w - 22);
      const ty = clamp(this.player.y + this.vy * guess, 22, this.h - 22);
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      if (gravity < 8) {
        guess = dist / speed;
        best = { vx: (dx / dist) * speed, vy: (dy / dist) * speed, t: guess };
        continue;
      }
      const a = 0.25 * gravity * gravity;
      const b = -(gravity * dy + speed * speed);
      const c = dx * dx + dy * dy;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        guess = dist / speed;
        best = { vx: (dx / dist) * speed, vy: (dy / dist) * speed, t: guess };
        continue;
      }
      const root = Math.sqrt(disc);
      const lo = (-b - root) / (2 * a);
      const hi = (-b + root) / (2 * a);
      const picks = [lo, hi].filter((u) => u > 0.04 * 0.04);
      if (picks.length === 0) {
        guess = dist / speed;
        best = { vx: (dx / dist) * speed, vy: (dy / dist) * speed, t: guess };
        continue;
      }
      const flight = Math.sqrt(lob ? Math.max(...picks) : Math.min(...picks));
      guess = flight;
      best = { vx: dx / flight, vy: dy / flight - 0.5 * gravity * flight, t: flight };
    }
    return best;
  }

  private launchAt(
    x: number,
    y: number,
    speed: number,
    gravity: number,
    spread: number,
    count: number,
    radius: number,
  ) {
    const solved = this.solveShot(x, y, speed, gravity, gravity > 300);
    if (!solved) return;
    const base = Math.atan2(solved.vy, solved.vx);
    for (let i = 0; i < count; i++) {
      if (this.bullets.length > 110) return;
      const off = count <= 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = base + off;
      this.bullets.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ay: gravity,
        r: radius,
        friendly: false,
        life: 4.4,
        dmg: 1,
      });
    }
  }

  private shootFan(x: number, y: number, count: number, spread: number, speed: number) {
    const mid = Math.PI / 2;
    for (let i = 0; i < count; i++) {
      if (this.bullets.length > 110) return;
      const a = mid + (i - (count - 1) / 2) * spread;
      this.bullets.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ay: 0,
        r: 4.2,
        friendly: false,
        life: 4.5,
        dmg: 1,
      });
    }
  }

  private shootAim(x: number, y: number, speed: number) {
    if (this.bullets.length > 110) return;
    const ang = Math.atan2(this.player.y - y, this.player.x - x);
    this.bullets.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ay: 0,
      r: 4.2,
      friendly: false,
      life: 4.5,
      dmg: 1,
    });
  }

  private separate() {
    const list = this.enemies.filter((e) => e.alive && e.kind !== "boss");
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const need = a.r + b.r;
        if (dist < need) {
          const push = (need - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  private collide() {
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      if (b.friendly) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (this.hit(b.x, b.y, b.r, e.x, e.y, e.r * (e.mark ? 0.92 : 1))) {
            if (b.pierce) {
              if (!b.hurt) b.hurt = new Set();
              if (b.hurt.has(e)) continue;
              b.hurt.add(e);
              this.damageEnemy(e, b.dmg, true, b.x, b.y);
            } else {
              b.life = 0;
              this.damageEnemy(e, b.dmg, false, b.x, b.y);
              break;
            }
          }
        }
      } else if (this.invuln <= 0 && this.hit(b.x, b.y, b.r, this.player.x, this.player.y, this.player.r)) {
        b.life = 0;
        this.hurtPlayer();
      }
    }
    if (this.invuln <= 0) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const ram = e.kind === "boss" ? e.r * 0.72 : e.r * 0.7;
        if (this.hit(e.x, e.y, ram, this.player.x, this.player.y, this.player.r)) {
          this.hurtPlayer();
          if (e.kind !== "boss") this.damageEnemy(e, 2);
          break;
        }
      }
    }
    for (const p of this.pickups) {
      if (p.life <= 0) continue;
      if (this.hit(p.x, p.y, p.r, this.player.x, this.player.y, this.player.r + 4)) {
        p.life = 0;
        this.takePickup(p);
      }
    }
  }

  private noteGraze(b: Bullet) {
    if (this.question || b.life <= 0 || (b.grazeCd ?? 0) > 0) return;
    const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
    const touch = this.player.r + b.r + 2;
    const near = this.player.r + 58;
    if (dist < touch || dist > near) return;
    b.grazeCd = 0.09;
    this.grazeHot = true;
    this.score += 6;
    this.graze = Math.min(1, this.graze + 0.16);
    if (this.graze >= 1) this.grazeBurst();
  }

  private grazeBurst() {
    this.graze = 0;
    this.grazeReady = false;
    for (const b of this.bullets) if (!b.friendly) b.life = 0;
    this.powSpread = Math.max(this.powSpread, 3.6);
    this.score += 80;
    this.banner = "擦彈爆發";
    this.bannerT = 1.05;
    this.float(this.player.x, this.player.y - 30, "清彈 +散彈", PAL.amber);
    this.burst(this.player.x, this.player.y, PAL.amber, 16);
    this.sfx.good();
  }

  private hit(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const rr = r1 + r2;
    return dx * dx + dy * dy <= rr * rr;
  }

  private damageEnemy(e: Enemy, dmg: number, pierce = false, x = this.player.x, y = this.player.y) {
    if (!e.alive) return;
    if (e.kind === "boss" && e.locked) {
      this.burst(e.x, e.y - e.r, PAL.fg, 4);
      return;
    }
    if (e.mark && !pierce && !this.gapOpen(e, x, y)) {
      if (e.flash <= 0) {
        e.flash = 0.12;
        this.burst(x, y, PAL.fg, 4);
      }
      return;
    }
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.kind === "boss" && e.phase < PHASES.length) {
      const line = e.maxHp * PHASES[e.phase]!;
      if (e.hp <= line) {
        e.hp = line;
        e.locked = true;
        this.openGate(e);
        return;
      }
    }
    if (e.hp <= 0) {
      e.hp = 0;
      this.killEnemy(e);
    }
  }

  private openGate(e: Enemy) {
    const built = makeQuestion(e.quiz, this.words);
    this.built = built;
    this.question = {
      kind: built.kind,
      prompt: built.prompt,
      hint: built.hint,
      choices: built.choices,
      phase: e.phase + 1,
      phases: PHASES.length,
      bossName: this.bossTitle(e.quiz),
      wrong: false,
    };
    this.pointerOn = false;
    this.gateAt = this.time;
    this.sfx.shield();
    this.emit();
  }

  private failGate() {
    const boss = this.liveBoss();
    const kind = boss?.quiz ?? this.built?.kind ?? "word";
    const built = makeQuestion(kind, this.words);
    this.built = built;
    this.question = {
      kind: built.kind,
      prompt: built.prompt,
      hint: built.hint,
      choices: built.choices,
      phase: (boss?.phase ?? 0) + 1,
      phases: PHASES.length,
      bossName: this.bossTitle(kind),
      wrong: true,
    };
    this.gateAt = this.time;
    this.shake = this.reduce ? 0 : 0.7;
    this.sfx.bad();
    this.emit();
  }

  private solveGate() {
    const boss = this.liveBoss();
    const fast = this.time - this.gateAt < 4.2;
    this.built = null;
    this.question = null;
    this.score += 480;
    if (boss) {
      boss.locked = false;
      boss.phase += 1;
      let note = boss.phase === 1 ? "預判連射" : "外環壓上";
      if (fast) {
        const chunk = Math.max(8, Math.round(boss.maxHp * 0.08));
        const nextLine = boss.phase < PHASES.length ? boss.maxHp * PHASES[boss.phase]! : 1;
        boss.hp = Math.max(nextLine, boss.hp - chunk);
        this.score += 220;
        note = `手快 · ${note}`;
        this.float(boss.x, boss.y - 48, `-${chunk}`, PAL.amber);
      }
      if (boss.phase >= 2) this.summonRing();
      if (boss.hp <= 1 && boss.phase >= PHASES.length) {
        boss.hp = 0;
        this.killEnemy(boss);
        return;
      }
      this.float(boss.x, boss.y - 28, "解鎖 +480", PAL.amber);
      this.burst(boss.x, boss.y, PAL.amber, 16);
      this.banner = note;
    } else this.banner = "護盾解開";
    this.bannerT = 1.35;
    this.sfx.good();
    this.emit();
  }

  private killEnemy(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    e.locked = false;
    const pts = e.kind === "boss" ? 2000 : e.mark ? 460 : e.kind === "tank" ? 220 : e.kind === "dart" ? 140 : 100;
    this.score += pts;
    this.float(e.x, e.y, e.mark ? `信標 +${pts}` : `+${pts}`, e.kind === "boss" || e.mark ? PAL.amber : PAL.fg);
    this.burst(e.x, e.y, e.kind === "boss" ? PAL.amber : PAL.rose, e.kind === "boss" ? 30 : 11);
    this.sfx.boom(e.kind === "boss");
    this.hitStop = e.kind === "boss" ? 0.1 : 0.03;
    this.shake = this.reduce ? 0 : e.kind === "boss" ? 1.15 : 0.4;
    if (e.kind === "boss") {
      this.question = null;
      this.built = null;
      this.banner = "航道開啟";
      this.bannerT = 1.3;
      this.drop(e.x, e.y);
    } else if (e.mark) {
      this.grantStock();
      this.banner = "缺口打穿";
      this.bannerT = 1.15;
      this.drop(e.x, e.y);
    } else if (Math.random() < 0.55) this.drop(e.x, e.y);
    this.emit();
  }

  private hurtPlayer() {
    if (this.invuln > 0 || this.status !== "play") return;
    if (this.shieldHits > 0) {
      this.shieldHits -= 1;
      this.invuln = 0.35;
      this.sfx.shield();
      this.burst(this.player.x, this.player.y, PAL.cyan, 10);
      this.emit();
      return;
    }
    this.lives -= 1;
    this.invuln = 1.55;
    this.hurtFlash = 0.35;
    this.shake = this.reduce ? 0 : 1;
    this.sfx.hurt();
    this.burst(this.player.x, this.player.y, PAL.rose, 14);
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = "over";
      this.question = null;
      this.built = null;
      this.sfx.stopMusic();
      this.sfx.boom(true);
    }
    this.emit();
  }

  private grantStock() {
    const roll = Math.random();
    const kind: PickupKind = roll < 0.34 ? "spread" : roll < 0.67 ? "shield" : "speed";
    if (kind === "spread") this.stockSpread = Math.min(3, this.stockSpread + 1);
    if (kind === "speed") this.stockSpeed = Math.min(3, this.stockSpeed + 1);
    if (kind === "shield") this.stockShield = Math.min(3, this.stockShield + 1);
    const label = kind === "spread" ? "散彈 +1" : kind === "speed" ? "加速 +1" : "護盾 +1";
    this.float(this.player.x, this.player.y - 26, label, PAL.amber);
  }

  usePierce() {
    if (this.status !== "play" || this.paused || this.question || this.pierceCd > 0) return;
    this.pierceCd = 8;
    this.bullets.push({
      x: this.player.x,
      y: this.player.y - 18,
      vx: 0,
      vy: -820,
      ay: 0,
      r: 8,
      friendly: true,
      life: 1.05,
      dmg: 5,
      pierce: true,
    });
    this.muzzle = 0.12;
    this.banner = "貫穿";
    this.bannerT = 0.7;
    this.sfx.shoot();
    this.emit();
  }

  private takePickup(p: Pickup) {
    if (p.kind === "spread") this.stockSpread = Math.min(3, this.stockSpread + 1);
    if (p.kind === "speed") this.stockSpeed = Math.min(3, this.stockSpeed + 1);
    if (p.kind === "shield") this.stockShield = Math.min(3, this.stockShield + 1);
    this.sfx.pickup();
    const label = p.kind === "spread" ? "散彈入庫" : p.kind === "speed" ? "加速入庫" : "護盾入庫";
    this.float(p.x, p.y - 10, label, PAL.amber);
    this.emit();
  }

  usePower(kind: PickupKind) {
    if (this.status !== "play" || this.paused || this.question) return;
    if (kind === "spread" && this.stockSpread > 0) {
      this.stockSpread -= 1;
      this.powSpread = 8;
      this.float(this.player.x, this.player.y - 28, "散彈", PAL.amber);
    } else if (kind === "speed" && this.stockSpeed > 0) {
      this.stockSpeed -= 1;
      this.powSpeed = 8;
      this.float(this.player.x, this.player.y - 28, "加速", PAL.cyan);
    } else if (kind === "shield" && this.stockShield > 0 && this.shieldHits <= 0) {
      this.stockShield -= 1;
      this.shieldHits = 2;
      this.float(this.player.x, this.player.y - 28, "護盾", PAL.cyan);
      this.sfx.shield();
    } else return;
    if (kind !== "shield") this.sfx.pickup();
    this.emit();
  }

  private clearField() {
    for (const b of this.bullets) if (!b.friendly) b.life = 0;
    for (const e of this.enemies) {
      if (e.alive && e.kind !== "boss") this.damageEnemy(e, 3);
    }
    this.burst(this.player.x, this.player.y, PAL.amber, 18);
    this.score += 120;
    this.banner = "擦彈清屏";
    this.bannerT = 1.1;
    this.float(this.player.x, this.player.y - 36, "清屏", PAL.amber);
  }

  private drop(x: number, y: number) {
    const kind: PickupKind = Math.random() < 0.34 ? "spread" : Math.random() < 0.5 ? "shield" : "speed";
    this.pickups.push({ kind, x, y, life: 9, r: 16 });
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 180) break;
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        size: 1.5 + Math.random() * 2.4,
      });
    }
  }

  private float(x: number, y: number, text: string, color: string) {
    this.floaters.push({ x, y, text, life: 0.8, color });
    if (this.floaters.length > 8) this.floaters.shift();
  }

  private decayJuice(dt: number) {
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.inputLock = Math.max(0, this.inputLock - dt);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    for (const f of this.floaters) {
      f.y -= 26 * dt;
      f.life -= dt;
    }
    if (this.question || this.paused || this.status !== "play") this.compact();
  }

  private compact() {
    this.enemies = this.enemies.filter((e) => e.alive);
    this.bullets = this.bullets.filter(
      (b) => b.life > 0 && b.x > -40 && b.x < this.w + 40 && b.y > -40 && b.y < this.h + 40,
    );
    this.pickups = this.pickups.filter((p) => p.life > 0 && p.y < this.h + 30);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  private liveBoss() {
    return this.enemies.find((e) => e.kind === "boss" && e.alive);
  }

  private held(code: string) {
    return (this.injected ?? this.keys).has(code);
  }

  private makeStars(n: number, size: number): Star[] {
    return Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: size * (0.6 + Math.random() * 0.8),
    }));
  }

  private driftStars(dt: number) {
    this.road += (this.theater === "night" ? 110 : 70) * dt;
    for (const layer of this.layers) {
      for (const star of layer.stars) {
        star.y += (layer.speed * dt) / Math.max(1, this.h);
        if (star.y > 1) star.y -= 1;
      }
    }
  }

  private draw(ctx: CanvasRenderingContext2D) {
    const shift = this.status === "play" ? (this.player.x - this.w / 2) / this.w : 0;
    const sx = this.reduce ? 0 : (Math.random() - 0.5) * this.shake * 10;
    const sy = this.reduce ? 0 : (Math.random() - 0.5) * this.shake * 10;
    ctx.save();
    ctx.translate(sx, sy);
    const night = this.theater === "night";
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    if (night) {
      sky.addColorStop(0, "#12100e");
      sky.addColorStop(0.4, "#1a1714");
      sky.addColorStop(1, "#0d1412");
    } else {
      sky.addColorStop(0, PAL.bg0);
      sky.addColorStop(1, PAL.bg1);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(-8, -8, this.w + 16, this.h + 16);
    if (night) this.drawStreet(ctx);
    else this.drawVoid(ctx, shift);
    for (const p of this.pickups) this.drawPickup(ctx, p);
    if (this.status === "play") {
      const glow = night ? "rgba(243,226,182,0.13)" : "rgba(62,224,197,0.16)";
      this.blob(ctx, this.player.x, this.player.y + 6, 78, glow);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        this.blob(
          ctx,
          e.x,
          e.y,
          e.mark ? e.r * 3.1 : e.r * 2.2,
          e.mark ? "rgba(240,162,2,0.28)" : e.kind === "boss" ? "rgba(62,224,197,0.18)" : "rgba(255,90,110,0.1)",
        );
      }
    }
    for (const b of this.bullets) if (b.friendly) this.drawBullet(ctx, b);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    if (this.status === "attract") this.drawShowcase(ctx);
    else this.drawPlayer(ctx);
    for (const b of this.bullets) if (!b.friendly) this.drawBullet(ctx, b);
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.font = `600 16px ${FONT}`;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / 0.8);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (this.bannerT > 0 && this.banner) {
      ctx.globalAlpha = Math.min(1, this.bannerT * 2);
      ctx.fillStyle = PAL.fg;
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(this.banner, this.w / 2, this.h * 0.4);
      ctx.globalAlpha = 1;
    }
    const vig = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.2,
      this.w / 2,
      this.h / 2,
      this.h * 0.72,
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!this.reduce) {
      ctx.globalCompositeOperation = "soft-light";
      const grade = ctx.createLinearGradient(0, 0, 0, this.h);
      grade.addColorStop(0, night ? "rgba(70,90,130,0.45)" : "rgba(50,110,150,0.4)");
      grade.addColorStop(1, night ? "rgba(120,70,40,0.35)" : "rgba(40,20,70,0.35)");
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,77,109,${this.hurtFlash * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();
  }

  private drawVoid(ctx: CanvasRenderingContext2D, shift: number) {
    this.blob(ctx, this.w * 0.18 + Math.sin(this.time * 0.12) * 18, this.h * 0.3, 260, "rgba(62,224,197,0.16)");
    this.blob(ctx, this.w * 0.8, this.h * 0.55 + Math.cos(this.time * 0.1) * 20, 300, "rgba(240,162,2,0.1)");
    this.blob(ctx, this.w * 0.45, this.h * 0.12, 180, "rgba(120,90,220,0.14)");
    const px = this.w * 0.74 + Math.sin(this.time * 0.05) * 10;
    const py = this.h * 0.2;
    this.blob(ctx, px, py, 120, "rgba(140,210,230,0.2)");
    ctx.beginPath();
    ctx.arc(px, py, 58, 0, Math.PI * 2);
    ctx.fillStyle = "#1a4558";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 22, py - 10, 50, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(7,16,28,0.72)";
    ctx.fill();
    this.layers.forEach((layer, i) => {
      const depth = (i + 1) / this.layers.length;
      ctx.globalAlpha = 0.35 + depth * 0.55;
      ctx.fillStyle = i === 2 ? "#f4f7fb" : i === 1 ? "#9ec9ff" : "#6d7d90";
      ctx.strokeStyle = "rgba(244,247,251,0.8)";
      ctx.lineWidth = 1;
      for (const star of layer.stars) {
        const x = ((star.x - shift * depth * 0.18) % 1 + 1) % 1 * this.w;
        const y = star.y * this.h;
        if (i === 2 && !this.reduce) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 10 + star.s * 3);
          ctx.stroke();
        } else ctx.fillRect(x, y, star.s, star.s);
      }
    });
    ctx.globalAlpha = 1;
  }

  private blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStreet(ctx: CanvasRenderingContext2D) {
    const curb = Math.max(36, this.w * 0.12);
    this.blob(ctx, this.w * 0.8, 78, 90, "rgba(230,220,190,0.28)");
    ctx.beginPath();
    ctx.arc(this.w * 0.8, 72, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#efe6cf";
    ctx.fill();
    const scrollB = this.road * 0.85;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 7; i++) {
        const bh = 78 + (i % 3) * 18;
        const y = ((i * 128 - scrollB) % (this.h + bh + 40)) - bh;
        const bw = curb - 10;
        const x = side < 0 ? 4 : this.w - 4 - bw;
        ctx.fillStyle = i % 2 === 0 ? "#16141c" : "#221c28";
        ctx.fillRect(x, y, bw, bh);
        for (let wy = 0; wy < 3; wy++) {
          for (let wx = 0; wx < 2; wx++) {
            const lit = (i * 5 + wy * 2 + wx + (side > 0 ? 1 : 0)) % 4 !== 0;
            ctx.fillStyle = lit ? "rgba(255, 186, 96, 0.8)" : "rgba(30, 34, 48, 0.7)";
            ctx.fillRect(x + 5 + wx * (bw * 0.42), y + 10 + wy * 20, 6, 8);
          }
        }
      }
    }
    ctx.fillStyle = "#121418";
    ctx.fillRect(curb, 0, this.w - curb * 2, this.h);
    ctx.fillStyle = "#3a3428";
    ctx.fillRect(curb - 4, 0, 4, this.h);
    ctx.fillRect(this.w - curb, 0, 4, this.h);
    const scroll = this.road % 72;
    ctx.fillStyle = "rgba(214, 196, 120, 0.4)";
    for (let y = -72 + scroll; y < this.h; y += 72) ctx.fillRect(this.w / 2 - 2, y, 4, 28);
    ctx.fillStyle = "rgba(180, 210, 200, 0.05)";
    ctx.fillRect(curb, this.h * 0.55, this.w - curb * 2, this.h * 0.45);
    if (!this.reduce) {
      ctx.strokeStyle = "rgba(190, 210, 220, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 48; i++) {
        const x = (i * 89 + this.road * 2.4) % this.w;
        const y = (i * 47 + this.road * 5.5) % this.h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 16);
      }
      ctx.stroke();
    }
    this.blob(ctx, this.w * 0.5, this.h * 0.2, 200, "rgba(125, 206, 106, 0.06)");
  }

  private drawShowcase(ctx: CanvasRenderingContext2D) {
    const y = this.h * 0.72 + Math.sin(this.time * 1.6) * 6;
    const night = this.theater === "night";
    const frame = Math.floor(this.time * 8) % 4;
    ctx.save();
    ctx.translate(this.w / 2, y);
    this.art.draw(ctx, night ? "survivor" : "ship", frame, 0, 0, night ? 92 : 110);
    ctx.restore();
  }

  private enemyArt(e: Enemy): { id: SheetId; size: number } {
    if (this.theater === "night") {
      if (e.kind === "boss") return { id: "z-boss", size: e.r * 2.8 };
      if (e.kind === "tank") return { id: "z-brute", size: e.r * 2.55 };
      if (e.kind === "dart") return { id: "z-runner", size: e.r * 2.7 };
      return { id: "z-walker", size: e.r * 2.7 };
    }
    if (e.kind === "boss") return { id: "e-boss", size: e.r * 2.45 };
    if (e.kind === "tank") return { id: "e-tank", size: e.r * 2.35 };
    if (e.kind === "dart") return { id: "e-dart", size: e.r * 2.7 };
    return { id: "e-grunt", size: e.r * 2.55 };
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const night = this.theater === "night";
    const frame = Math.floor(this.time * 8) % 4;
    if (!this.reduce && this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    ctx.translate(0, this.kick * 7);
    if (this.powSpeed > 0 && !this.reduce) {
      ctx.globalAlpha = 0.28;
      this.art.draw(ctx, night ? "survivor" : "ship", frame, 0, 14, night ? 74 : 92);
      ctx.globalAlpha = 1;
    }
    const painted = this.art.draw(ctx, night ? "survivor" : "ship", frame, 0, 0, night ? 74 : 92);
    if (!painted) {
    const flick = 0.75 + Math.sin(this.time * 28) * 0.25;
    ctx.fillStyle = PAL.amber;
    ctx.beginPath();
    ctx.moveTo(-4, 10);
    ctx.lineTo(0, 12 + 12 * flick);
    ctx.lineTo(4, 10);
    ctx.fill();
    ctx.fillStyle = PAL.fg;
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(0, 12 + 6 * flick);
    ctx.lineTo(2, 10);
    ctx.fill();
    const hull = ctx.createLinearGradient(0, -18, 0, 14);
    hull.addColorStop(0, PAL.hull);
    hull.addColorStop(0.45, PAL.cyan);
    hull.addColorStop(1, PAL.cyanDeep);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(13, 12);
    ctx.lineTo(5, 7);
    ctx.lineTo(0, 14);
    ctx.lineTo(-5, 7);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PAL.fg;
    ctx.stroke();
    ctx.fillStyle = "#07141c";
    ctx.beginPath();
    ctx.ellipse(0, -2, 3.2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.cyan;
    ctx.beginPath();
    ctx.ellipse(-0.4, -3, 1.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    }
    if (this.muzzle > 0) {
      const a = Math.min(1, this.muzzle / 0.08);
      const flash = this.shot === "orb" ? PAL.amber : this.shot === "beam" ? "#ffffff" : PAL.cyan;
      ctx.globalAlpha = 0.9 * a;
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(10, -16);
      ctx.lineTo(0, -24);
      ctx.lineTo(-10, -16);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, -38);
      ctx.lineTo(4, -18);
      ctx.lineTo(0, -22);
      ctx.lineTo(-4, -18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (this.shieldHits > 0 && this.status === "play") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = PAL.cyan;
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 8) * 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (this.status === "play") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = this.grazeHot ? PAL.amber : "rgba(240,162,2,0.45)";
      ctx.globalAlpha = this.grazeHot ? 0.95 : 0.55;
      ctx.lineWidth = this.grazeHot ? 2.4 : 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 34 + this.graze * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.kind === "boss") {
      this.drawBoss(ctx, e);
      return;
    }
    const spec = this.enemyArt(e);
    const frame = Math.floor((this.time + e.seed) * (e.kind === "dart" ? 10 : 7)) % 4;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.flash > 0) ctx.filter = "brightness(2.5)";
    const painted = this.art.draw(ctx, spec.id, frame, 0, 0, spec.size);
    ctx.filter = "none";
    this.drawTell(ctx, e);
    ctx.restore();
    if (painted) return;
    ctx.save();
    ctx.translate(e.x, e.y);
    const color = PAL.rose;
    if (e.kind === "tank") {
      ctx.rotate(e.t * 0.4);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.cos(a) * e.r;
        const y = Math.sin(a) * e.r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#2a1218";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r * 0.8, e.r * 0.7);
      ctx.lineTo(0, e.r * 0.3);
      ctx.lineTo(-e.r * 0.8, e.r * 0.7);
      ctx.closePath();
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#2a1218";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoss(ctx: CanvasRenderingContext2D, e: Enemy) {
    const night = this.theater === "night";
    const lock = e.locked || !!this.question;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.flash > 0) ctx.filter = "brightness(1.7)";
    if (night) this.drawKing(ctx, e);
    else this.drawFlagship(ctx, e);
    ctx.filter = "none";
    if (lock) {
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 7) * 0.2;
      ctx.strokeStyle = night ? "#d6ff9a" : PAL.fg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (night) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.time;
          const x = Math.cos(a) * (e.r + 18);
          const y = Math.sin(a) * (e.r + 14);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else ctx.arc(0, 0, e.r + 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = night ? "#d6ff9a" : PAL.cyan;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(night ? "屍王" : "旗艦", 0, e.r + 28);
    ctx.restore();
  }

  private drawFlagship(ctx: CanvasRenderingContext2D, e: Enemy) {
    const wing = e.r * 2.35;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, e.r * 0.7, wing * 0.7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c1824";
    ctx.strokeStyle = "#7ef6ff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 0.95);
    ctx.lineTo(wing, e.r * 0.08);
    ctx.lineTo(wing * 0.62, e.r * 0.5);
    ctx.lineTo(0, e.r * 0.12);
    ctx.lineTo(-wing * 0.62, e.r * 0.5);
    ctx.lineTo(-wing, e.r * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#1a4a55";
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 0.55);
    ctx.lineTo(wing * 0.45, e.r * 0.05);
    ctx.lineTo(0, e.r * 0.02);
    ctx.lineTo(-wing * 0.45, e.r * 0.05);
    ctx.closePath();
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#071018";
      ctx.fillRect(s * wing * 0.58 - 9, e.r * 0.12, 18, 20);
      const flick = 0.55 + Math.sin(this.time * 28 + s) * 0.45;
      ctx.fillStyle = `rgba(126,246,255,${0.35 + flick * 0.65})`;
      ctx.beginPath();
      ctx.moveTo(s * wing * 0.58 - 6, e.r * 0.32);
      ctx.lineTo(s * wing * 0.58, e.r * 0.32 + 18 * flick);
      ctx.lineTo(s * wing * 0.58 + 6, e.r * 0.32);
      ctx.fill();
    }
    ctx.fillStyle = "#e9fff8";
    ctx.beginPath();
    ctx.ellipse(0, -e.r * 0.18, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.cyan;
    ctx.beginPath();
    ctx.ellipse(0, -e.r * 0.22, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 8, e.t * 1.5, e.t * 1.5 + Math.PI * 1.15);
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      const a = e.t * 1.5 + i * Math.PI;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (e.r + 8), Math.sin(a) * (e.r + 8), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.phase === 1 && !e.locked && !this.question && e.cool < 0.55 && e.cool > 0) {
      ctx.globalAlpha = 0.25 + (0.55 - e.cool) * 0.9;
      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(-7, e.r * 0.2, 14, this.h);
      ctx.globalAlpha = 1;
    }
  }

  private drawKing(ctx: CanvasRenderingContext2D, e: Enemy) {
    const lean = e.wind > 0 ? 0.22 : 0;
    ctx.rotate(lean);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, e.r * 0.95, e.r * 0.9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(e.t * 2.4) * 0.45;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * e.r * 0.62, -e.r * 0.05);
      ctx.rotate(s * (0.9 + swing));
      ctx.fillStyle = "#12180e";
      ctx.strokeStyle = "#9be06a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 6, e.r);
      ctx.lineTo(s * 24, e.r * 1.15);
      ctx.lineTo(s * 8, e.r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = e.flash > 0 ? "#f4ffe4" : "#141c10";
    ctx.strokeStyle = "#b6f56a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.05);
    ctx.quadraticCurveTo(e.r * 1.05, -e.r * 0.2, e.r * 0.72, e.r * 0.9);
    ctx.lineTo(-e.r * 0.72, e.r * 0.9);
    ctx.quadraticCurveTo(-e.r * 1.05, -e.r * 0.2, 0, -e.r * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#243018";
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.62, e.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eaff9a";
    ctx.fillRect(-12, -e.r * 0.7, 7, 3);
    ctx.fillRect(5, -e.r * 0.7, 7, 3);
    ctx.strokeStyle = "#6d8f38";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -e.r * 0.48, 11, 0.15, Math.PI - 0.15);
    ctx.stroke();
    const pulse = 6 + Math.sin(this.time * 6) * 1.6;
    ctx.fillStyle = "rgba(190,255,90,0.9)";
    ctx.beginPath();
    ctx.arc(0, e.r * 0.18, pulse, 0, Math.PI * 2);
    ctx.fill();
    if (e.wind > 0) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "#d6ff9a";
      ctx.beginPath();
      ctx.moveTo(-e.r, -e.r);
      ctx.lineTo(-e.r - 18, -e.r - 28);
      ctx.moveTo(e.r, -e.r);
      ctx.lineTo(e.r + 18, -e.r - 28);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawTell(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.mark) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = PAL.amber;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 16, e.guard + 1.05, e.guard + Math.PI * 2 - 1.05);
      ctx.stroke();
      ctx.fillStyle = "#fff4c8";
      ctx.beginPath();
      ctx.arc(Math.cos(e.guard) * (e.r + 16), Math.sin(e.guard) * (e.r + 16), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.amber;
      ctx.font = `600 14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("信標", 0, e.y < 86 ? e.r + 24 : -e.r - 22);
      return;
    }
    if (e.kind === "boss" || e.hold > 0 || e.cool > 0.34 || e.cool <= 0) return;
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = this.theater === "night" ? "#b6f59a" : PAL.rose;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo((dx / len) * e.r * 0.4, (dy / len) * e.r * 0.4);
    ctx.lineTo((dx / len) * 46, (dy / len) * 46);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
    const mag = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / mag;
    const uy = b.vy / mag;
    const look = b.pierce ? "beam" : (b.look ?? (b.friendly ? "needle" : b.ay > 8 ? "blob" : "shard"));
    const palette =
      look === "orb"
        ? ["#ffe08a", "#6a3200", "#fff7d6"]
        : look === "beam"
          ? ["#d7f4ff", "#1248c8", "#ffffff"]
          : look === "blob"
            ? ["#c6f56a", "#1c3d08", "#f4ffd8"]
            : look === "shard"
              ? ["#ff5d7a", "#4a0618", "#ffd0d8"]
              : ["#7ef6ff", "#06343c", "#ffffff"];
    const [fill, edge, core] = palette;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
    if (look === "orb" || look === "blob") {
      const rad = look === "orb" ? 8 : 7;
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.arc(0, 0, rad + 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(-1.2, -1.4, rad * 0.38, 0, Math.PI * 2);
      ctx.fill();
      if (look === "blob") {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, 12, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (look === "shard") {
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(4.5, 0);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-4.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = core;
      ctx.fillRect(-1.1, -3, 2.2, 5);
    } else {
      const len = look === "beam" ? 34 : 20;
      const rad = look === "beam" ? 4.4 : 2.3;
      ctx.lineCap = "round";
      ctx.strokeStyle = edge;
      ctx.lineWidth = rad * 2 + 3.2;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -len);
      ctx.stroke();
      ctx.strokeStyle = fill;
      ctx.lineWidth = rad * 2;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -len);
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = Math.max(1.3, rad * 0.7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -len * 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: Pickup) {
    const bob = Math.sin(this.time * 4 + p.x) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalAlpha = p.life < 2 ? Math.max(0.25, p.life / 2) : 1;
    ctx.strokeStyle = p.kind === "speed" ? PAL.amber : PAL.cyan;
    ctx.fillStyle = "rgba(7,11,20,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.kind === "speed" ? PAL.amber : PAL.cyan;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.kind === "spread" ? "散" : p.kind === "shield" ? "盾" : "速", 0, 1);
    ctx.restore();
  }

  private snap(): Snap {
    const boss = this.liveBoss();
    return {
      status: this.status,
      paused: this.paused,
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      waveName: this.waveName,
      theater: this.theater,
      boss: boss
        ? {
            name: this.bossTitle(boss.quiz),
            hp: boss.hp,
            max: boss.maxHp,
            quiz: boss.quiz,
            locked: boss.locked || Boolean(this.question),
          }
        : null,
      powers: {
        spread: Math.max(0, this.powSpread),
        speed: Math.max(0, this.powSpeed),
        shield: Math.max(0, this.powShield),
        shieldHits: this.shieldHits,
        spreadStock: this.stockSpread,
        speedStock: this.stockSpeed,
        shieldStock: this.stockShield,
      },
      graze: this.graze,
      grazeReady: this.grazeReady,
      pierce: Math.max(0, this.pierceCd),
      mark: this.enemies.some((e) => e.alive && e.mark),
      shot: this.shotLabel(),
      question: this.question,
      muted: this.sfx.muted,
    };
  }

  private emit() {
    const snap = this.snap();
    for (const fn of this.listeners) fn(snap);
  }

  private attachProbe() {
    const dev = import.meta.env.DEV || new URLSearchParams(window.location.search).has("qa");
    if (!dev) return;
    window.__controlsTest = {
      getYaw: () => this.player.tilt,
      getSpeed: () => Math.hypot(this.vx, this.vy),
      getX: () => this.player.x,
      getY: () => this.player.y,
      setKeys: (codes) => {
        this.injected = codes.length > 0 ? new Set(codes) : null;
        this.steerOverride = 0;
      },
      setSteer: (v) => {
        this.steerOverride = v;
      },
    };
    window.__starlex = {
      skipToBoss: () => {
        if (this.status !== "play") this.start();
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.question = null;
        this.built = null;
        this.paused = false;
        this.leftToSpawn = 0;
        this.spawningBoss = false;
        this.wave = 3;
        this.spawnBoss();
        this.emit();
      },
      hurtBoss: (n) => {
        const boss = this.liveBoss();
        if (boss) this.damageEnemy(boss, n);
      },
      answerCorrect: () => {
        if (!this.built) return;
        this.inputLock = 0;
        this.answer(this.built.answer);
      },
      answerWrong: () => {
        if (!this.built) return;
        const wrong = this.built.choices.findIndex((_, idx) => idx !== this.built?.answer);
        this.answer(wrong < 0 ? 0 : wrong);
      },
      answer: (i) => this.answer(i),
      locked: () => Boolean(this.liveBoss()?.locked || this.question),
      question: () => this.question?.prompt ?? null,
      hp: () => this.liveBoss()?.hp ?? 0,
      maxHp: () => this.liveBoss()?.maxHp ?? 0,
      bossAlive: () => Boolean(this.liveBoss()),
      wave: () => this.wave,
      hostile: () => this.bullets.filter((b) => !b.friendly).length,
      music: () => this.sfx.playing(),
      bed: () => this.sfx.bed(),
      waveName: () => this.waveName,
      phase: () => this.liveBoss()?.phase ?? -1,
      foes: () =>
        this.enemies
          .filter((e) => e.alive)
          .map((e) => `${e.mark ? "M" : ""}${e.kind}:${Math.round(e.x)},${Math.round(e.y)}`)
          .join(" "),
    };
  }
}
