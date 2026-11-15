export type ChallengeMode = "mix" | "words" | "math";
export type QuizKind = "word" | "math";

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
};

export type Save = {
  v: 1;
  words: Word[];
  scores: ScoreRow[];
  mode: ChallengeMode;
  muted: boolean;
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
  boss: null | {
    name: string;
    hp: number;
    max: number;
    quiz: QuizKind;
    locked: boolean;
  };
  powers: { spread: number; speed: number; shield: number; shieldHits: number };
  question: PublicQuestion | null;
  muted: boolean;
};
