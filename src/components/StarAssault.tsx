import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Heart,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Smartphone,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { Game } from "@/game/engine";
import { DEFAULT_WORDS, newWordId } from "@/game/lexicon";
import { formatScore, freshSave, loadSave, pushScore, sanitizeWords, writeSave } from "@/game/storage";
import type { ChallengeMode, Save, Snap, Theater } from "@/game/types";

type Screen = "menu" | "play" | "lexicon" | "scores" | "install";

const THEATERS: { id: Theater; label: string; copy: string }[] = [
  { id: "space", label: "星域", copy: "駕駛新的攔截機。敵艦會開火，首領掉到血線就鎖盾。" },
  { id: "night", label: "喪屍夜", copy: "屍群會停在遠處瞄準你。普通屍吐一口，跑尸連射，壯屍撒酸。答對才能打屍王。" },
];

const MODES: { id: ChallengeMode; label: string; copy: string }[] = [
  { id: "mix", label: "混合", copy: "第 1、3、5… 隻首領考單詞，雙數考百以內加減。" },
  { id: "words", label: "單詞", copy: "每隻首領都從你的詞庫抽題。" },
  { id: "math", label: "數學", copy: "每隻首領都出 100 以內的加法或減法。" },
];

export function StarAssault() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [save, setSave] = useState<Save>(() => freshSave());
  const [snap, setSnap] = useState<Snap | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [lexBack, setLexBack] = useState<Screen>("menu");
  const [name, setName] = useState("艦長");
  const [savedScore, setSavedScore] = useState(false);
  const [hint, setHint] = useState(false);
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [dump, setDump] = useState("");
  const [lexErr, setLexErr] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const game = new Game();
    gameRef.current = game;
    const loaded = loadSave();
    setSave(loaded);
    game.setWords(loaded.words);
    game.setMode(loaded.mode);
    game.setTheater(loaded.theater);
    game.setMuted(loaded.muted);
    const unsub = game.subscribe(setSnap);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.frame(ctx, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const fit = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      game.resize(w, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const down = (e: KeyboardEvent) => game.onKeyDown(e);
    const up = (e: KeyboardEvent) => game.onKeyUp(e);
    const blur = () => game.clearKeys();
    const vis = () => {
      if (document.hidden) game.pause(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    setHint(true);
    const timer = window.setTimeout(() => setHint(false), 4200);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== "lexicon") return;
    setDump(JSON.stringify(save.words.map(({ term: t, meaning: m }) => ({ term: t, meaning: m })), null, 2));
    setLexErr("");
  }, [screen, save.words]);

  function commit(next: Save) {
    setSave(next);
    writeSave(next);
    gameRef.current?.setWords(next.words);
    gameRef.current?.setMode(next.mode);
    gameRef.current?.setTheater(next.theater);
    gameRef.current?.setMuted(next.muted);
  }

  function launch() {
    const game = gameRef.current;
    if (!game) return;
    game.setWords(save.words);
    game.setMode(save.mode);
    game.setTheater(save.theater);
    game.setMuted(save.muted);
    game.start();
    setSavedScore(false);
    setScreen("play");
  }

  function remember() {
    if (savedScore || !snap) return;
    const row = {
      name: name.trim().slice(0, 8) || "艦長",
      score: snap.score,
      wave: snap.wave,
      at: Date.now(),
    };
    commit({ ...save, scores: pushScore(save.scores, row) });
    setSavedScore(true);
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>, on: boolean) {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const rect = canvas.getBoundingClientRect();
    game.setPointer(e.clientX - rect.left, e.clientY - rect.top, on);
  }

  const mode = MODES.find((m) => m.id === save.mode) ?? MODES[0]!;
  const theater = THEATERS.find((t) => t.id === save.theater) ?? THEATERS[0]!;
  const over = screen === "play" && snap?.status === "over";
  const paused = screen === "play" && Boolean(snap?.paused) && !over;
  const question = screen === "play" && snap?.question && !paused && !over ? snap.question : null;
  const best = save.scores[0];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg select-none touch-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          point(e, true);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse") point(e, true);
          else if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e, true);
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") point(e, false);
        }}
        onPointerCancel={(e) => point(e, false)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") point(e, false);
        }}
      />

      {screen === "menu" && (
        <section className="absolute inset-0 z-10 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-6 px-5 py-6 safe-top safe-bottom">
            <div className="rounded-2xl border border-border bg-surface/90 p-6">
              <p className="font-display text-sm tracking-widest text-primary">俯視答題射擊</p>
              <h1 className="mt-2 font-display text-5xl font-bold text-fg">星詞突擊</h1>
              <div
                className="mx-auto mt-4 h-28 w-28 bg-no-repeat"
                style={{
                  backgroundImage: `url(${save.theater === "night" ? "/sprites/survivor.png" : "/sprites/ship.png"})`,
                  backgroundSize: "200% 200%",
                  backgroundPosition: "0% 0%",
                }}
                aria-hidden="true"
              />
              <p className="mt-3 text-base leading-relaxed text-muted">
                {save.theater === "night"
                  ? "屍群會停在遠處開火。小兵直接打。屍王血量掉到鎖點會升起護盾，答對單詞或 100 以內加減，才能繼續扣血。"
                  : "小兵直接打掉。首領血量掉到鎖點會升起護盾，答對單詞或 100 以內加減，才能繼續扣血、開往下一波。"}
              </p>
              {best && (
                <p className="mt-4 text-sm text-accent">
                  本機最高 {formatScore(best.score)} · {best.name}
                </p>
              )}
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="戰場">
                {THEATERS.map((item) => {
                  const on = save.theater === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={
                        on
                          ? "min-h-11 rounded-xl bg-primary px-2 font-display text-base font-semibold text-bg"
                          : "min-h-11 rounded-xl border border-border bg-surface px-2 font-display text-base text-muted"
                      }
                      onClick={() => commit({ ...save, theater: item.id })}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted">{theater.copy}</p>
            </div>

            <div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="首領題型">
                {MODES.map((item) => {
                  const on = save.mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={
                        on
                          ? "min-h-11 rounded-xl bg-primary px-2 font-display text-base font-semibold text-bg"
                          : "min-h-11 rounded-xl border border-border bg-surface px-2 font-display text-base text-muted"
                      }
                      onClick={() => commit({ ...save, mode: item.id })}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm text-muted">{mode.copy}</p>
            </div>

            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display text-lg font-semibold text-bg"
              onClick={launch}
            >
              <Play className="size-5" aria-hidden="true" />
              出擊
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Ghost
                onClick={() => {
                  setLexBack("menu");
                  setScreen("lexicon");
                }}
              >
                <BookOpen className="size-5" aria-hidden="true" />
                詞庫
              </Ghost>
              <Ghost onClick={() => setScreen("scores")}>
                <Trophy className="size-5" aria-hidden="true" />
                本機高分
              </Ghost>
            </div>
            <Ghost onClick={() => setScreen("install")}>
              <Smartphone className="size-5" aria-hidden="true" />
              裝到手機 / 分享
            </Ghost>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 text-sm text-muted"
              onClick={() => commit({ ...save, muted: !save.muted })}
            >
              {save.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              {save.muted ? "音效已關" : "音效已開"}
            </button>
          </div>
        </section>
      )}

      {screen === "play" && snap && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 safe-top">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex gap-1" aria-label={`生命 ${snap.lives}`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <Heart
                    key={i}
                    className={i < snap.lives ? "size-5 text-danger" : "size-5 text-border"}
                    fill={i < snap.lives ? "currentColor" : "none"}
                  />
                ))}
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-fg">{formatScore(snap.score)}</p>
              <p className="text-sm text-muted">
                第 {snap.wave} 波 · {snap.boss ? snap.boss.name : snap.waveName}
              </p>
            </div>
            <button
              type="button"
              className="pointer-events-auto grid size-11 place-items-center rounded-xl border border-border bg-surface/90 text-fg"
              onClick={() => gameRef.current?.pause(true)}
              aria-label="暫停"
            >
              <Pause className="size-5" />
            </button>
          </div>
          {snap.boss && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm">
                <span className={snap.boss.locked ? "text-accent" : "text-muted"}>
                  {snap.boss.locked ? "護盾鎖定 · 先答題" : snap.boss.quiz === "word" ? "單詞首領" : "算式首領"}
                </span>
                <span className="text-fg">
                  {Math.ceil(snap.boss.hp)} / {snap.boss.max}
                </span>
              </div>
              <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 bg-danger"
                  style={{ width: `${Math.max(0, Math.min(100, (snap.boss.hp / snap.boss.max) * 100))}%` }}
                />
                <span className="absolute inset-y-0 w-px bg-accent" style={{ left: "66.6%" }} />
                <span className="absolute inset-y-0 w-px bg-accent" style={{ left: "33.3%" }} />
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-label="擦彈">
              <div className="h-full bg-accent" style={{ width: `${Math.round(snap.graze * 100)}%` }} />
            </div>
            <span className="text-xs text-muted">{snap.grazeReady ? "擦彈就緒" : "擦彈"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {snap.powers.spread > 0 && (
              <Chip>
                <Zap className="size-3.5" /> 散彈 {Math.ceil(snap.powers.spread)}s
              </Chip>
            )}
            {snap.powers.speed > 0 && (
              <Chip>
                <Zap className="size-3.5" /> 加速 {Math.ceil(snap.powers.speed)}s
              </Chip>
            )}
            {snap.powers.shieldHits > 0 && (
              <Chip>
                <Shield className="size-3.5" /> 護盾 ×{snap.powers.shieldHits}
              </Chip>
            )}
          </div>
        </div>
      )}

      {screen === "play" && hint && !question && !paused && !over && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-6 text-center text-sm text-muted safe-bottom">
          {save.theater === "night"
            ? "WASD 移動。這一波的陣型會寫在上面。Z 散彈、X 護盾、C 加速，撿到先存著，自己決定何時按。"
            : "WASD 移動。敵艦按陣型進來。Z 散彈、X 護盾、C 加速，撿到不會自己倒數。"}
        </p>
      )}

      {question && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-20 flex justify-center px-3">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quiz-prompt"
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-border bg-surface/95 p-4"
          >
            <p className="font-display text-sm text-accent">
              {question.kind === "word" ? "單詞鎖" : "算式鎖"} · {question.bossName} · 第 {question.phase}/
              {question.phases} 道
            </p>
            <h2 id="quiz-prompt" className="mt-2 break-words text-center font-display text-3xl font-bold text-fg">
              {question.prompt}
            </h2>
            <p className="mt-1 text-center text-sm text-muted">場面還在慢速走。答得快，解開時多扣一截。</p>
            {question.wrong && <p className="mt-1 text-center text-sm text-danger">這題換新的。答對才繼續扣血。</p>}
            <div className="mt-3 grid gap-2">
              {question.choices.map((choice, index) => (
                <button
                  key={`${question.prompt}-${choice}-${index}`}
                  type="button"
                  className="min-h-11 rounded-xl border border-border bg-bg px-4 text-left text-base text-fg"
                  onClick={() => gameRef.current?.answer(index)}
                >
                  <span className="mr-3 font-display text-primary">{index + 1}</span>
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {screen === "play" && snap && !paused && !over && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-start gap-2 px-3 pb-3 safe-bottom">
          {(
            [
              ["spread", "散", "KeyZ"],
              ["shield", "盾", "KeyX"],
              ["speed", "速", "KeyC"],
            ] as const
          ).map(([kind, label]) => {
            const stock =
              kind === "spread"
                ? snap.powers.spreadStock
                : kind === "shield"
                  ? snap.powers.shieldStock
                  : snap.powers.speedStock;
            const on =
              kind === "spread"
                ? snap.powers.spread > 0
                : kind === "shield"
                  ? snap.powers.shieldHits > 0
                  : snap.powers.speed > 0;
            return (
              <button
                key={kind}
                type="button"
                className={`pointer-events-auto min-h-11 min-w-14 rounded-xl border px-3 text-sm ${on ? "border-primary text-fg" : "border-border text-muted"} bg-surface/90`}
                onClick={() => gameRef.current?.usePower(kind)}
              >
                {label} {stock}
              </button>
            );
          })}
        </div>
      )}

      {paused && (
        <Overlay title="暫停" lede="航道先停著。詞庫改完再回來，下一道鎖會用新的單詞。">
          <Primary onClick={() => gameRef.current?.pause(false)}>繼續遊戲</Primary>
          <Ghost
            onClick={() => {
              setSavedScore(false);
              gameRef.current?.start();
            }}
          >
            <RotateCcw className="size-5" />
            重新開始
          </Ghost>
          <Ghost
            onClick={() => {
              setLexBack("play");
              setScreen("lexicon");
            }}
          >
            <BookOpen className="size-5" />
            詞庫
          </Ghost>
          <Ghost
            onClick={() => {
              gameRef.current?.attract();
              setScreen("menu");
            }}
          >
            回主畫面
          </Ghost>
          <Ghost onClick={() => commit({ ...save, muted: !save.muted })}>
            {save.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            {save.muted ? "打開音效" : "關閉音效"}
          </Ghost>
        </Overlay>
      )}

      {over && snap && (
        <Overlay title={snap.theater === "night" ? "被屍群淹沒" : "艦體損毀"} lede={`到達第 ${snap.wave} 波 · ${formatScore(snap.score)} 分`}>
          <label className="block text-sm text-muted" htmlFor="pilot-name">
            記入本機排行的名字
          </label>
          <input
            id="pilot-name"
            value={name}
            maxLength={8}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base text-fg select-text"
          />
          <p className="text-sm text-muted">
            {savedScore ? "已記入這台裝置。" : `記入後約第 ${rankAmong(save.scores, snap.score)} 名`}
          </p>
          <Primary
            onClick={() => {
              remember();
              setSavedScore(false);
              gameRef.current?.start();
            }}
          >
            記入並再戰
          </Primary>
          <Ghost
            onClick={() => {
              remember();
              gameRef.current?.attract();
              setScreen("menu");
            }}
          >
            記入並回主畫面
          </Ghost>
        </Overlay>
      )}

      {screen === "scores" && (
        <Panel
          title="本機高分"
          onBack={() => setScreen("menu")}
          lede="只存在這台裝置，不會上傳。清掉瀏覽器資料就會一起消失。"
        >
          {save.scores.length === 0 ? (
            <p className="text-muted">還沒有紀錄。打一場就會留在這裡。</p>
          ) : (
            <ol className="grid gap-2">
              {save.scores.map((row, index) => (
                <li
                  key={`${row.at}-${row.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-bg px-4 py-3"
                >
                  <span className="text-fg">
                    <span className="mr-3 font-display text-primary">{index + 1}</span>
                    {row.name}
                  </span>
                  <span className="text-right text-sm text-muted">
                    <span className="block font-display text-base text-fg">{formatScore(row.score)}</span>
                    第 {row.wave} 波
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}

      {screen === "install" && (
        <Panel
          title="裝到手機"
          onBack={() => setScreen("menu")}
          lede="這是網頁 App，不是 App Store 安裝檔。發布後拿到網址，就能裝進主畫面，也能把同一個連結傳給朋友。"
        >
          <ol className="grid gap-3 text-base leading-relaxed text-fg">
            <li>1. 在建置畫面按發布，得到你的網址。</li>
            <li>2. 用 iPhone 的 Safari 打開那個網址。</li>
            <li>3. 點下方的分享按鈕。</li>
            <li>4. 選「加入主畫面」，再按加入。</li>
            <li>5. 之後從主畫面圖示打開，就是全螢幕。</li>
          </ol>
          <p className="text-sm leading-relaxed text-muted">
            Android 用 Chrome 選「安裝應用程式」或「加到主畫面」即可。詞庫和高分都留在該台裝置裡，換手機要在詞庫頁把
            JSON 複製過去。
          </p>
        </Panel>
      )}

      {screen === "lexicon" && (
        <Panel
          title="單詞詞庫"
          onBack={() => setScreen(lexBack)}
          lede="首領的單詞鎖會從這裡抽。正面是題目，反面是答案，也會反過來考。建議至少留 4 個。空著就暫時用預設宇宙詞。"
        >
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = term.trim();
              const m = meaning.trim();
              if (!t || !m) {
                setLexErr("單詞和意思都要填。");
                return;
              }
              commit({ ...save, words: [...save.words, { id: newWordId(), term: t.slice(0, 32), meaning: m.slice(0, 32) }] });
              setTerm("");
              setMeaning("");
              setLexErr("");
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="單詞，例如 orbit"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base text-fg select-text"
              />
              <input
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="意思，例如 軌道"
                className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base text-fg select-text"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display font-semibold text-bg"
            >
              <Plus className="size-5" />
              加入詞庫
            </button>
          </form>
          {lexErr && <p className="text-sm text-danger">{lexErr}</p>}
          <ul className="grid gap-2">
            {save.words.length === 0 && <li className="text-sm text-muted">詞庫是空的，出題時會用預設單詞。</li>}
            {save.words.map((word) => (
              <li
                key={word.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-base text-fg">{word.term}</span>
                  <span className="block truncate text-sm text-muted">{word.meaning}</span>
                </span>
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-muted"
                  aria-label={`刪除 ${word.term}`}
                  onClick={() => commit({ ...save, words: save.words.filter((w) => w.id !== word.id) })}
                >
                  <Trash2 className="size-5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-2">
            <label className="text-sm text-muted" htmlFor="lex-json">
              匯出或貼上 JSON 再套用。格式是 term 與 meaning。
            </label>
            <textarea
              id="lex-json"
              value={dump}
              onChange={(e) => setDump(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-border bg-bg px-3 py-3 font-display text-sm text-fg select-text"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl bg-primary px-3 font-display font-semibold text-bg"
                onClick={() => {
                  try {
                    const words = sanitizeWords(JSON.parse(dump));
                    if (words.length === 0) {
                      setLexErr("沒讀到任何單詞。");
                      return;
                    }
                    commit({ ...save, words });
                    setLexErr("");
                  } catch {
                    setLexErr("JSON 格式不對。");
                  }
                }}
              >
                套用匯入
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-border bg-surface px-3 font-display text-fg"
                onClick={() => commit({ ...save, words: DEFAULT_WORDS.map((w) => ({ ...w })) })}
              >
                恢復預設
              </button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function rankAmong(scores: Save["scores"], score: number) {
  return scores.filter((row) => row.score > score).length + 1;
}

function Primary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-display text-lg font-semibold text-bg"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 font-display text-base text-fg"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/90 px-3 py-1 text-sm text-primary">
      {children}
    </span>
  );
}

function Overlay({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-bg/80 p-5 safe-top safe-bottom">
      <div className="grid w-full max-w-md gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-3xl font-bold text-fg">{title}</h2>
        <p className="text-sm leading-relaxed text-muted">{lede}</p>
        {children}
      </div>
    </div>
  );
}

function Panel({
  title,
  lede,
  onBack,
  children,
}: {
  title: string;
  lede: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-bg/90">
      <div className="mx-auto grid w-full max-w-md gap-4 px-5 py-6 safe-top safe-bottom">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-muted"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          返回
        </button>
        <div>
          <h2 className="font-display text-3xl font-bold text-fg">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{lede}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
