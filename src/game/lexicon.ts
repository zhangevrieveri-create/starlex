import type { QuizKind, Word } from "@/game/types";

export const DEFAULT_WORDS: Word[] = [
  { id: "orbit", term: "orbit", meaning: "軌道" },
  { id: "gravity", term: "gravity", meaning: "重力" },
  { id: "comet", term: "comet", meaning: "彗星" },
  { id: "nebula", term: "nebula", meaning: "星雲" },
  { id: "galaxy", term: "galaxy", meaning: "星系" },
  { id: "meteor", term: "meteor", meaning: "流星" },
  { id: "astronaut", term: "astronaut", meaning: "太空人" },
  { id: "satellite", term: "satellite", meaning: "衛星" },
  { id: "asteroid", term: "asteroid", meaning: "小行星" },
  { id: "rocket", term: "rocket", meaning: "火箭" },
  { id: "planet", term: "planet", meaning: "行星" },
  { id: "telescope", term: "telescope", meaning: "望遠鏡" },
  { id: "constellation", term: "constellation", meaning: "星座" },
  { id: "vacuum", term: "vacuum", meaning: "真空" },
  { id: "oxygen", term: "oxygen", meaning: "氧氣" },
  { id: "velocity", term: "velocity", meaning: "速度" },
  { id: "horizon", term: "horizon", meaning: "地平線" },
  { id: "eclipse", term: "eclipse", meaning: "日蝕" },
  { id: "shield", term: "shield", meaning: "護盾" },
  { id: "thrust", term: "thrust", meaning: "推力" },
  { id: "brave", term: "brave", meaning: "勇敢的" },
  { id: "river", term: "river", meaning: "河流" },
  { id: "bridge", term: "bridge", meaning: "橋" },
  { id: "forest", term: "forest", meaning: "森林" },
  { id: "quiet", term: "quiet", meaning: "安靜的" },
  { id: "clever", term: "clever", meaning: "聰明的" },
  { id: "journey", term: "journey", meaning: "旅程" },
  { id: "lantern", term: "lantern", meaning: "燈籠" },
  { id: "apple", term: "apple", meaning: "蘋果" },
  { id: "bread", term: "bread", meaning: "麵包" },
  { id: "water", term: "water", meaning: "水" },
  { id: "school", term: "school", meaning: "學校" },
  { id: "friend", term: "friend", meaning: "朋友" },
  { id: "music", term: "music", meaning: "音樂" },
  { id: "window", term: "window", meaning: "窗戶" },
  { id: "garden", term: "garden", meaning: "花園" },
  { id: "island", term: "island", meaning: "島嶼" },
  { id: "storm", term: "storm", meaning: "暴風雨" },
  { id: "shadow", term: "shadow", meaning: "影子" },
  { id: "mirror", term: "mirror", meaning: "鏡子" },
  { id: "candle", term: "candle", meaning: "蠟燭" },
  { id: "ocean", term: "ocean", meaning: "海洋" },
  { id: "mountain", term: "mountain", meaning: "山" },
  { id: "clock", term: "clock", meaning: "時鐘" },
  { id: "letter", term: "letter", meaning: "信" },
  { id: "dream", term: "dream", meaning: "夢" },
  { id: "winter", term: "winter", meaning: "冬天" },
  { id: "summer", term: "summer", meaning: "夏天" },
  { id: "silver", term: "silver", meaning: "銀" },
  { id: "golden", term: "golden", meaning: "金的" },
  { id: "secret", term: "secret", meaning: "秘密" },
];

const FILLERS = ["星塵", "光年", "船塢", "信標", "潮汐", "地圖", "時間", "城市", "風", "書"];

export function bossName(kind: QuizKind): string {
  if (kind === "word") return "詞核哨衛";
  if (kind === "quick") return "題標";
  return "算式巨像";
}

export function newWordId(): string {
  return `w_${Math.random().toString(36).slice(2, 10)}`;
}

export type BuiltQuestion = {
  kind: QuizKind;
  prompt: string;
  hint: string;
  choices: string[];
  answer: number;
};

function shuffle<T>(list: T[], rng: () => number): T[] {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function makeQuestion(kind: QuizKind, words: Word[], rng: () => number = Math.random): BuiltQuestion {
  if (kind === "math") return makeMath(rng);
  if (kind === "quick") return makeQuick(words, rng);
  return makeWord(words, rng);
}

function makeWord(words: Word[], rng: () => number): BuiltQuestion {
  const custom = words.filter((w) => w.term.trim() && w.meaning.trim());
  const source = custom.length > 0 ? custom : DEFAULT_WORDS;
  const correct = source[Math.floor(rng() * source.length)] ?? DEFAULT_WORDS[0]!;
  const flip = rng() < 0.5;
  const prompt = flip ? correct.meaning : correct.term;
  const answerText = flip ? correct.term : correct.meaning;
  const choices = [answerText];
  const bank = source.filter((w) => w.id !== correct.id);
  let guard = 0;
  while (choices.length < 4 && guard++ < 40) {
    let text = "";
    if (bank.length > 0 && rng() < 0.8) {
      const idx = Math.floor(rng() * bank.length);
      const picked = bank.splice(idx, 1)[0];
      text = picked ? (flip ? picked.term : picked.meaning) : "";
    } else {
      text = FILLERS[Math.floor(rng() * FILLERS.length)] ?? "星塵";
    }
    if (text && !choices.includes(text)) choices.push(text);
  }
  while (choices.length < 4) choices.push(`選項${choices.length}`);
  const ordered = shuffle(choices, rng);
  return {
    kind: "word",
    prompt,
    hint: flip ? "選出對應的單詞" : "選出正確意思",
    choices: ordered,
    answer: Math.max(0, ordered.indexOf(answerText)),
  };
}

function makeMath(rng: () => number): BuiltQuestion {
  if (rng() < 0.3) {
    const a = 2 + Math.floor(rng() * 8);
    const b = 2 + Math.floor(rng() * 8);
    return numberQuestion(`${a} × ${b}`, a * b, "乘法表，選出得數", rng);
  }
  const add = rng() < 0.55;
  let a = 0;
  let b = 0;
  let ans = 0;
  let prompt = "";
  if (add) {
    a = Math.floor(rng() * 91);
    b = 1 + Math.floor(rng() * (100 - a));
    ans = a + b;
    prompt = `${a} + ${b}`;
  } else {
    a = 1 + Math.floor(rng() * 100);
    b = Math.floor(rng() * (a + 1));
    ans = a - b;
    prompt = `${a} − ${b}`;
  }
  return numberQuestion(prompt, ans, "100 以內，選出得數", rng);
}

function makeQuick(words: Word[], rng: () => number): BuiltQuestion {
  const roll = rng();
  if (roll < 0.4) {
    const add = rng() < 0.6;
    const a = Math.floor(rng() * 21);
    const b = add ? Math.floor(rng() * (21 - a)) : Math.floor(rng() * (a + 1));
    const ans = add ? a + b : a - b;
    return numberQuestion(`${a} ${add ? "+" : "−"} ${b}`, ans, "20 以內，選出得數", rng, 20);
  }
  if (roll < 0.65) return makeCompare(rng);
  if (roll < 0.85) return makeNext(rng);
  const word = makeWord(words, rng);
  return { ...word, kind: "quick" };
}

function makeCompare(rng: () => number): BuiltQuestion {
  const same = rng() < 0.22;
  const a = Math.floor(rng() * 31);
  const b = same ? a : Math.floor(rng() * 31);
  const ans = a === b ? "相等" : a > b ? "大於" : "小於";
  const choices = shuffle(["大於", "小於", "相等", "差不多"], rng);
  return {
    kind: "quick",
    prompt: `${a} ？ ${b}`,
    hint: "選出兩者的關係",
    choices,
    answer: Math.max(0, choices.indexOf(ans)),
  };
}

function makeNext(rng: () => number): BuiltQuestion {
  const step = [1, 2, 3, 5, 10][Math.floor(rng() * 5)] ?? 2;
  const start = Math.floor(rng() * 8);
  const seq = [start, start + step, start + step * 2];
  const ans = start + step * 3;
  return numberQuestion(`${seq.join("，")}，？`, ans, "找出下一個數", rng, 40);
}

function numberQuestion(
  prompt: string,
  ans: number,
  hint: string,
  rng: () => number,
  cap = 100,
): BuiltQuestion {
  const wrongs = new Set<number>();
  const deltas = [1, -1, 2, -2, 10, -10, 5, -5, 3, -3, 9, -9, 4];
  for (const d of deltas) {
    const v = ans + d;
    if (v >= 0 && v <= cap && v !== ans) wrongs.add(v);
    if (wrongs.size >= 3) break;
  }
  let guard = 0;
  while (wrongs.size < 3 && guard++ < 30) {
    const v = Math.floor(rng() * (cap + 1));
    if (v !== ans) wrongs.add(v);
  }
  const ordered = shuffle([String(ans), ...[...wrongs].slice(0, 3).map(String)], rng);
  return {
    kind: prompt.includes("×") || hint.includes("100") ? "math" : "quick",
    prompt,
    hint,
    choices: ordered,
    answer: Math.max(0, ordered.indexOf(String(ans))),
  };
}
