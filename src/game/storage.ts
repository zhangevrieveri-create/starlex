import { DEFAULT_WORDS, newWordId } from "@/game/lexicon";
import type { ChallengeMode, Save, ScoreRow, Theater, Word } from "@/game/types";

const KEY = "starlex.v1";

export function freshSave(): Save {
  return {
    v: 1,
    words: DEFAULT_WORDS.map((w) => ({ ...w })),
    scores: [],
    mode: "mix",
    theater: "space",
    muted: false,
  };
}

function asMode(v: unknown): ChallengeMode {
  return v === "words" || v === "math" || v === "mix" ? v : "mix";
}

function asTheater(v: unknown): Theater {
  return v === "night" ? "night" : "space";
}

export function sanitizeWords(input: unknown): Word[] {
  if (!Array.isArray(input)) return [];
  const out: Word[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const term = String(rec.term ?? "").trim().slice(0, 32);
    const meaning = String(rec.meaning ?? "").trim().slice(0, 32);
    if (!term || !meaning) continue;
    const id = typeof rec.id === "string" && rec.id ? rec.id.slice(0, 40) : newWordId();
    out.push({ id, term, meaning });
    if (out.length >= 200) break;
  }
  return out;
}

function sanitizeScores(input: unknown): ScoreRow[] {
  if (!Array.isArray(input)) return [];
  const out: ScoreRow[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const score = Number(rec.score);
    const wave = Number(rec.wave);
    const at = Number(rec.at);
    if (!Number.isFinite(score) || !Number.isFinite(wave)) continue;
    out.push({
      name: String(rec.name ?? "艦長").trim().slice(0, 8) || "艦長",
      score: Math.max(0, Math.floor(score)),
      wave: Math.max(1, Math.floor(wave)),
      at: Number.isFinite(at) ? at : 0,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 1) return freshSave();
    const words = sanitizeWords(parsed.words);
    return {
      v: 1,
      words: words.length > 0 ? words : freshSave().words,
      scores: sanitizeScores(parsed.scores),
      mode: asMode(parsed.mode),
      theater: asTheater(parsed.theater),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return freshSave();
  }
}

export function writeSave(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode / full storage */
  }
}

export function pushScore(scores: ScoreRow[], row: ScoreRow): ScoreRow[] {
  return sanitizeScores([...scores, row]);
}

export function formatScore(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
