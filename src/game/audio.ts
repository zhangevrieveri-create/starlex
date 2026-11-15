export type MusicId = "space" | "night";

const TRACKS: Record<MusicId, string> = {
  space: "/music/space.mp3",
  night: "/music/night.mp3",
};

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  private lastShot = 0;
  private music: HTMLAudioElement | null = null;
  private track: MusicId | null = null;

  unlock() {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!this.ctx) this.ctx = new Ctor();
    void this.ctx.resume();
  }

  playTrack(id: MusicId) {
    if (this.muted) return;
    this.unlock();
    if (this.track === id && this.music) {
      if (this.music.paused) void this.music.play().catch(() => {});
      return;
    }
    this.stopMusic();
    const audio = new Audio(TRACKS[id]);
    audio.loop = true;
    audio.volume = 0.32;
    this.music = audio;
    this.track = id;
    void audio.play().catch(() => {});
  }

  pauseMusic() {
    this.music?.pause();
  }

  playing() {
    return Boolean(this.music && !this.music.paused && this.track);
  }

  stopMusic() {
    if (!this.music) return;
    this.music.pause();
    this.music.removeAttribute("src");
    this.music.load();
    this.music = null;
    this.track = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo && slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shoot() {
    const now = this.ctx?.currentTime ?? 0;
    if (now - this.lastShot < 0.07) return;
    this.lastShot = now;
    this.tone(640, 0.05, "square", 0.025, 240);
  }

  boom(big: boolean) {
    this.tone(big ? 180 : 320, big ? 0.28 : 0.12, "sawtooth", big ? 0.06 : 0.04, 50);
  }

  hurt() {
    this.tone(140, 0.22, "triangle", 0.07, 60);
  }

  pickup() {
    this.tone(520, 0.08, "square", 0.04);
    this.tone(780, 0.12, "square", 0.035);
  }

  good() {
    this.tone(523, 0.1, "triangle", 0.05);
    this.tone(659, 0.12, "triangle", 0.05);
    this.tone(784, 0.16, "triangle", 0.05);
  }

  bad() {
    this.tone(196, 0.18, "square", 0.05, 90);
  }

  shield() {
    this.tone(880, 0.1, "sine", 0.05, 440);
  }
}
