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

export class Game {
  w = 390;
  h = 700;
}
