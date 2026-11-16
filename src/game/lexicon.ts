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
  letter?: string;
};

type Letter = { letter: string; say: string; hear: string[] };

export const LETTERS: Letter[] = [
  { letter: "A", say: "ei", hear: ["a", "ay", "ei", "hey", "诶", "哎"] },
  { letter: "B", say: "bi", hear: ["b", "be", "bee", "bi", "比", "必"] },
  { letter: "C", say: "si", hear: ["c", "see", "sea", "si", "西", "息"] },
  { letter: "D", say: "di", hear: ["d", "dee", "di", "迪", "地"] },
  { letter: "E", say: "yi", hear: ["e", "ee", "yi", "伊", "衣"] },
  { letter: "F", say: "ef", hear: ["f", "ef", "eff", "艾弗", "爱福"] },
  { letter: "G", say: "ji", hear: ["g", "gee", "jee", "ji", "吉"] },
  { letter: "H", say: "eich", hear: ["h", "aitch", "eich", "诶吃", "爱吃"] },
  { letter: "I", say: "ai", hear: ["i", "eye", "ai", "爱", "艾"] },
  { letter: "J", say: "jei", hear: ["j", "jay", "jei", "杰", "界"] },
  { letter: "K", say: "kei", hear: ["k", "kay", "kei", "克", "开"] },
  { letter: "L", say: "el", hear: ["l", "el", "ell", "艾欧", "哎哦"] },
  { letter: "M", say: "em", hear: ["m", "em", "艾姆", "哎母"] },
  { letter: "N", say: "en", hear: ["n", "en", "恩"] },
  { letter: "O", say: "ou", hear: ["o", "oh", "ou", "欧"] },
  { letter: "P", say: "pi", hear: ["p", "pee", "pi", "皮", "批"] },
  { letter: "Q", say: "kiu", hear: ["q", "cue", "queue", "kiu", "kyu", "克由", "丘"] },
  { letter: "R", say: "ar", hear: ["r", "are", "ar", "阿", "啊"] },
  { letter: "S", say: "es", hear: ["s", "es", "ess", "艾斯", "爱思"] },
  { letter: "T", say: "ti", hear: ["t", "tee", "ti", "提", "踢"] },
  { letter: "U", say: "you", hear: ["u", "you", "yu", "由", "优"] },
  { letter: "V", say: "vi", hear: ["v", "vee", "vi", "维", "薇"] },
  { letter: "W", say: "dabliu", hear: ["w", "double u", "doubleyou", "dabliu", "达不溜", "达不留"] },
  { letter: "X", say: "eks", hear: ["x", "ex", "eks", "艾克斯"] },
  { letter: "Y", say: "wai", hear: ["y", "why", "wai", "外", "歪"] },
  { letter: "Z", say: "zi", hear: ["z", "zee", "zi", "zed", "贼", "兹"] },
];

export function letterHeard(letter: string, transcript: string): boolean {
  const row = LETTERS.find((item) => item.letter === letter.toUpperCase());
  if (!row) return false;
  const raw = transcript.toLowerCase().trim();
  if (!raw) return false;
  const compact = raw.replace(/[^a-z]/g, "");
  const words = compact ? raw.split(/[^a-z]+/).filter(Boolean) : [];
  if (words.includes(row.letter.toLowerCase()) || compact === row.say) return true;
  if (raw.includes(row.say)) return true;
  return row.hear.some((alias) => {
    const text = alias.toLowerCase();
    if (/[^\x00-\x7f]/.test(text) || text.includes(" ")) return raw.includes(text);
    if (text.length <= 2) return words.includes(text) || compact === text;
    return compact === text || compact.includes(text) || words.includes(text);
  });
}

export function makeQuestion(
  kind: QuizKind,
  words: Word[],
  rng: () => number = Math.random,
  known = "",
): BuiltQuestion {
  if (kind === "math") return makeMath(rng);
  if (kind === "quick") return makeQuick(words, rng, known);
  return makeWord(words, rng, known);
}

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

function makeLetter(rng: () => number, known: string, kind: QuizKind): BuiltQuestion {
  const fresh = LETTERS.filter((item) => !known.includes(item.letter));
  const pool = fresh.length > 0 ? fresh : LETTERS;
  const correct = pool[Math.floor(rng() * pool.length)] ?? LETTERS[0]!;
  const wrongs: string[] = [];
  const rest = shuffle(
    LETTERS.filter((item) => item.say !== correct.say),
    rng,
  );
  for (const item of rest) {
    if (!wrongs.includes(item.say)) wrongs.push(item.say);
    if (wrongs.length >= 3) break;
  }
  const choices = shuffle([correct.say, ...wrongs], rng);
  return {
    kind,
    prompt: correct.letter,
    hint: fresh.length > 0 ? "大声读出这个字母，或选出正确读音" : "26 个都会了，复习读音",
    choices,
    answer: Math.max(0, choices.indexOf(correct.say)),
    letter: correct.letter,
  };
}

function makeWord(words: Word[], rng: () => number, known: string): BuiltQuestion {
  if (known.length < LETTERS.length) return makeLetter(rng, known, "word");
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
  if (rng() < 0.25) {
    const pairs: [number, number][] = [];
    for (let a = 2; a <= 10; a++) {
      for (let b = 2; b <= 10; b++) if (a * b <= 20) pairs.push([a, b]);
    }
    const pair = pairs[Math.floor(rng() * pairs.length)] ?? [2, 2];
    return numberQuestion(`${pair[0]} × ${pair[1]}`, pair[0] * pair[1], "20 以內，選出得數", rng, 20, "math");
  }
  const sum = addSub(20, rng);
  return numberQuestion(sum.prompt, sum.ans, "20 以內，選出得數", rng, 20, "math");
}

function addSub(cap: number, rng: () => number) {
  const add = rng() < 0.6;
  if (add) {
    const a = 1 + Math.floor(rng() * (cap - 1));
    const b = 1 + Math.floor(rng() * (cap - a));
    return { prompt: `${a} + ${b}`, ans: a + b };
  }
  const a = 1 + Math.floor(rng() * cap);
  const b = 1 + Math.floor(rng() * a);
  return { prompt: `${a} − ${b}`, ans: a - b };
}

function makeQuick(words: Word[], rng: () => number, known: string): BuiltQuestion {
  const roll = rng();
  if (roll < 0.62) {
    const sum = addSub(10, rng);
    return numberQuestion(sum.prompt, sum.ans, "10 以內，選出得數", rng, 10, "quick");
  }
  if (roll < 0.78) return makeCompare(rng, 10);
  if (roll < 0.9) return makeNext(rng, 10);
  const word = makeWord(words, rng, known);
  return { ...word, kind: "quick" };
}

function makeCompare(rng: () => number, cap: number): BuiltQuestion {
  const same = rng() < 0.22;
  const a = Math.floor(rng() * (cap + 1));
  let b = Math.floor(rng() * (cap + 1));
  if (same) b = a;
  else if (b === a) b = (a + 1) % (cap + 1);
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

function makeNext(rng: () => number, cap: number): BuiltQuestion {
  const steps = [1, 2, 3].filter((step) => step * 3 <= cap);
  const step = steps[Math.floor(rng() * steps.length)] ?? 1;
  const room = Math.max(0, cap - step * 3);
  const start = Math.floor(rng() * (room + 1));
  const seq = [start, start + step, start + step * 2];
  const ans = start + step * 3;
  return numberQuestion(`${seq.join("，")}，？`, ans, "找出下一個數", rng, cap, "quick");
}

function numberQuestion(
  prompt: string,
  ans: number,
  hint: string,
  rng: () => number,
  cap: number,
  kind: QuizKind,
): BuiltQuestion {
  const wrongs = new Set<number>();
  const deltas = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
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
    kind,
    prompt,
    hint,
    choices: ordered,
    answer: Math.max(0, ordered.indexOf(String(ans))),
  };
}
