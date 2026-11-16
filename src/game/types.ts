export type ChallengeMode = "mix" | "words" | "math" | "drill";
export type RunMode = "campaign" | "endless";
export type Theater = "space" | "night";
export type QuizKind = "word" | "math" | "quick";

export const TROPHIES = [
  { id: "first", name: "起步", detail: "闖關打完第 1 關", points: 40 },
  { id: "picky", name: "挑門", detail: "一整關有紅門，但你没碰", points: 80 },
  { id: "crowd", name: "成軍", detail: "人數到 20", points: 60 },
  { id: "army", name: "軍團", detail: "人數到 50", points: 120 },
  { id: "scholar", name: "學霸", detail: "單局答對 8 題", points: 80 },
  { id: "score", name: "高分", detail: "單局分數到 20000", points: 100 },
  { id: "ten", name: "十陣", detail: "無限模式打完第 10 陣", points: 100 },
  { id: "march", name: "長征", detail: "無限模式打完第 25 陣", points: 200 },
  { id: "clear", name: "通關", detail: "闖關 8 關全部打完", points: 300 },
  { id: "night", name: "夜行", detail: "喪屍夜闖關通關", points: 200 },
] as const;

export type TrophyId = (typeof TROPHIES)[number]["id"];

export type Word = {
  id: string;
  term: string;
  meaning: string;
};

export type ScoreRow = {
  name: string;
  score: number;
  wave: number;
  at: number;
  run?: RunMode;
};

export type Save = {
  v: 1;
  words: Word[];
  scores: ScoreRow[];
  mode: ChallengeMode;
  run: RunMode;
  theater: Theater;
  muted: boolean;
  points: number;
  trophies: TrophyId[];
};

export type PublicQuestion = {
  kind: QuizKind;
  prompt: string;
  hint: string;
  choices: string[];
  phase: number;
  phases: number;
  bossName: string;
  wrong: boolean;
};

export type Snap = {
  status: "attract" | "play" | "over";
  paused: boolean;
  score: number;
  lives: number;
  wave: number;
  waveName: string;
  theater: Theater;
  boss: null | {
    name: string;
    hp: number;
    max: number;
    quiz: QuizKind;
    locked: boolean;
  };
  powers: {
    spread: number;
    speed: number;
    shield: number;
    shieldHits: number;
    spreadStock: number;
    speedStock: number;
    shieldStock: number;
  };
  graze: number;
  grazeReady: boolean;
  pierce: number;
  mark: boolean;
  shot: string;
  crew: number;
  levels: number;
  cleared: boolean;
  run: RunMode;
  runPoints: number;
  question: PublicQuestion | null;
  muted: boolean;
};
