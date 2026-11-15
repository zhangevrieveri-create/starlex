import { Sfx } from "@/game/audio";
import { bossName, DEFAULT_WORDS, makeQuestion, type BuiltQuestion } from "@/game/lexicon";
import type { ChallengeMode, PublicQuestion, QuizKind, Snap, Word } from "@/game/types";

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
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  friendly: boolean;
  life: number;
  dmg: number;
};

type PickupKind = "spread" | "shield" | "speed";

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
  question: PublicQuestion | null = null;

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
  private shake = 0;
  private hurtFlash = 0;
  private banner = "";
  private bannerT = 0;
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

  setMuted(muted: boolean) {
    this.sfx.muted = muted;
    this.emit();
  }

  toggleMuted() {
    this.sfx.muted = !this.sfx.muted;
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
    this.emit();
  }

  pause(v?: boolean) {
    if (this.status !== "play") return;
    this.paused = v ?? !this.paused;
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
    this.pointerOn = on && this.status === "play" && !this.paused && !this.question;
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
    if (this.status === "play" && !this.paused && !this.question) {
      if (this.hitStop > 0) this.hitStop -= dt;
      else this.step(dt);
    }
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
    this.spawningBoss = this.wave % 3 === 0;
    if (this.spawningBoss) {
      this.leftToSpawn = 1;
      this.spawnGap = 0.65;
      this.banner = "首領進場";
    } else {
      this.leftToSpawn = Math.min(12, 4 + this.wave);
      this.spawnGap = 0.15;
      this.banner = `第 ${this.wave} 波`;
    }
    this.bannerT = 1.5;
    this.clearHold = 0;
  }

  private step(dt: number) {
    this.movePlayer(dt);
    this.fireCd -= dt;
    if (this.fireCd <= 0) this.fire();
    this.spawnGap -= dt;
    if (this.leftToSpawn > 0 && this.spawnGap <= 0) {
      const alive = this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
      if (this.spawningBoss || alive < 7) {
        if (this.spawningBoss) this.spawnBoss();
        else this.spawnMinion();
        this.leftToSpawn -= 1;
        this.spawnGap = this.spawningBoss ? 0 : 0.46;
      } else this.spawnGap = 0.18;
    }
    for (const e of this.enemies) if (e.alive) this.tickEnemy(e, dt);
    this.separate();
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    for (const p of this.pickups) {
      p.y += 38 * dt;
      p.life -= dt;
    }
    this.collide();
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.powSpread > 0) this.powSpread -= dt;
    if (this.powSpeed > 0) this.powSpeed -= dt;
    if (this.powShield > 0) {
      this.powShield -= dt;
      if (this.powShield <= 0) this.shieldHits = 0;
    }
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
    this.fireCd = this.powSpread > 0 ? 0.11 : 0.16;
    const angles = this.powSpread > 0 ? [-0.36, -0.18, 0, 0.18, 0.36] : [0];
    const noseY = this.player.y - 16;
    for (const a of angles) {
      if (this.bullets.length > 90) break;
      const ang = -Math.PI / 2 + a;
      this.bullets.push({
        x: this.player.x + Math.sin(a) * 6,
        y: noseY,
        vx: Math.cos(ang) * 640,
        vy: Math.sin(ang) * 640,
        r: 3.2,
        friendly: true,
        life: 1.35,
        dmg: 1,
      });
    }
    this.muzzle = 0.07;
    this.sfx.shoot();
  }

  private spawnMinion() {
    const roll = Math.random();
    let kind: Kind = "grunt";
    if (this.wave >= 2 && roll > 0.6) kind = "dart";
    if (this.wave >= 4 && roll > 0.84) kind = "tank";
    const fromLeft = Math.random() < 0.5;
    const enemy: Enemy = {
      kind,
      x: kind === "dart" ? (fromLeft ? -24 : this.w + 24) : 36 + Math.random() * (this.w - 72),
      y: kind === "dart" ? 50 + Math.random() * this.h * 0.22 : -28,
      vx: kind === "dart" ? (fromLeft ? 150 : -150) : 0,
      vy: kind === "tank" ? 40 + this.wave * 3 : kind === "dart" ? 90 + this.wave * 6 : 58 + this.wave * 5,
      hp: kind === "tank" ? 4 + Math.floor(this.wave / 3) : 1 + Math.floor((this.wave - 1) / 5),
      maxHp: 1,
      r: kind === "tank" ? 22 : kind === "dart" ? 13 : 15,
      t: 0,
      phase: 0,
      cool: 0.8 + Math.random() * 1.2,
      flash: 0,
      locked: false,
      quiz: "word",
      seed: Math.random() * 6,
      alive: true,
      entered: true,
    };
    enemy.maxHp = enemy.hp;
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
      r: 46,
      t: 0,
      phase: 0,
      cool: 1.2,
      flash: 0,
      locked: false,
      quiz,
      seed: 0,
      alive: true,
      entered: false,
    });
    this.banner = `${bossName(quiz)} · 血線鎖盾`;
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
        const ord = Math.max(1, this.wave / 3);
        e.x = this.w / 2 + Math.sin(e.t * (0.65 + ord * 0.04)) * this.w * 0.28;
        e.y = 116 + Math.sin(e.t * 1.15) * 20;
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = Math.max(0.55, 1.2 - ord * 0.06);
          this.shootFan(e.x, e.y + e.r * 0.4, 3, 0.42, 200 + ord * 12);
          if (ord >= 2) this.shootAim(e.x, e.y, 230);
        }
      }
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
          if (this.hit(b.x, b.y, b.r, e.x, e.y, e.r)) {
            b.life = 0;
            this.damageEnemy(e, b.dmg);
            break;
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

  private hit(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const rr = r1 + r2;
    return dx * dx + dy * dy <= rr * rr;
  }

  private damageEnemy(e: Enemy, dmg: number) {
    if (!e.alive) return;
    if (e.kind === "boss" && e.locked) {
      this.burst(e.x, e.y - e.r, PAL.fg, 4);
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
      bossName: bossName(e.quiz),
      wrong: false,
    };
    this.pointerOn = false;
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
      bossName: bossName(kind),
      wrong: true,
    };
    this.shake = this.reduce ? 0 : 0.7;
    this.sfx.bad();
    this.emit();
  }

  private solveGate() {
    const boss = this.liveBoss();
    this.built = null;
    this.question = null;
    this.score += 480;
    if (boss) {
      boss.locked = false;
      boss.phase += 1;
      this.float(boss.x, boss.y - 30, "解鎖 +480", PAL.amber);
      this.burst(boss.x, boss.y, PAL.amber, 16);
    }
    this.banner = "護盾解開，繼續輸出";
    this.bannerT = 1.25;
    this.sfx.good();
    this.emit();
  }

  private killEnemy(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    e.locked = false;
    const pts = e.kind === "boss" ? 2000 : e.kind === "tank" ? 220 : e.kind === "dart" ? 140 : 100;
    this.score += pts;
    this.float(e.x, e.y, `+${pts}`, e.kind === "boss" ? PAL.amber : PAL.fg);
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
    } else if (Math.random() < 0.2) this.drop(e.x, e.y);
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
      this.sfx.boom(true);
    }
    this.emit();
  }

  private takePickup(p: Pickup) {
    if (p.kind === "spread") this.powSpread = 9;
    if (p.kind === "speed") this.powSpeed = 9;
    if (p.kind === "shield") {
      this.shieldHits = Math.min(2, this.shieldHits + 1);
      this.powShield = 10;
    }
    this.sfx.pickup();
    const label = p.kind === "spread" ? "散彈" : p.kind === "speed" ? "加速" : "護盾";
    this.float(p.x, p.y - 10, label, PAL.amber);
    this.emit();
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
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, PAL.bg0);
    sky.addColorStop(1, PAL.bg1);
    ctx.fillStyle = sky;
    ctx.fillRect(-8, -8, this.w + 16, this.h + 16);
    this.blob(ctx, this.w * 0.22 + Math.sin(this.time * 0.15) * 12, this.h * 0.28, 200, "rgba(62,224,197,0.09)");
    this.blob(ctx, this.w * 0.78, this.h * 0.62 + Math.cos(this.time * 0.12) * 16, 240, "rgba(240,162,2,0.06)");
    this.layers.forEach((layer, i) => {
      const depth = (i + 1) / this.layers.length;
      ctx.globalAlpha = 0.28 + depth * 0.62;
      ctx.fillStyle = i === 2 ? PAL.fg : "#9fb4c8";
      for (const star of layer.stars) {
        const x = ((star.x - shift * depth * 0.18) % 1 + 1) % 1;
        ctx.fillRect(x * this.w, star.y * this.h, star.s, star.s);
      }
    });
    ctx.globalAlpha = 1;
    for (const p of this.pickups) this.drawPickup(ctx, p);
    for (const b of this.bullets) this.drawBullet(ctx, b);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    if (this.status !== "attract") this.drawPlayer(ctx);
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
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,77,109,${this.hurtFlash * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.restore();
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

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    if (!this.reduce && this.invuln > 0 && Math.floor(this.invuln * 16) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    ctx.globalAlpha = this.reduce && this.invuln > 0 ? 0.65 : 1;
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
    if (this.muzzle > 0) {
      const a = this.muzzle / 0.07;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(7, -16);
      ctx.lineTo(0, -20);
      ctx.lineTo(-7, -16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -18, 8 * a + 2, 0, Math.PI * 2);
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
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const color = e.kind === "boss" ? (e.quiz === "word" ? PAL.cyan : PAL.amber) : PAL.rose;
    if (e.kind === "boss") {
      ctx.rotate(Math.sin(e.t * 0.45) * 0.06);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 8, e.t * 0.8, e.t * 0.8 + Math.PI * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r * 0.82, 0);
      ctx.lineTo(0, e.r * 0.9);
      ctx.lineTo(-e.r * 0.82, 0);
      ctx.closePath();
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : "#10161c";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      if (e.locked || this.question) {
        ctx.globalAlpha = 0.45 + Math.sin(this.time * 7) * 0.25;
        ctx.lineWidth = 2;
        ctx.strokeStyle = PAL.fg;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === "tank") {
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

  private drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
    const mag = Math.hypot(b.vx, b.vy) || 1;
    const len = b.friendly ? 14 : 11;
    ctx.strokeStyle = b.friendly ? PAL.cyan : PAL.rose;
    ctx.lineWidth = b.friendly ? 3 : 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - (b.vx / mag) * len, b.y - (b.vy / mag) * len);
    ctx.stroke();
    if (b.friendly) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
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
      boss: boss
        ? {
            name: bossName(boss.quiz),
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
      },
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
    };
  }
}
