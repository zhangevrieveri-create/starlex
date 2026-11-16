export type SheetId =
  | "ship"
  | "survivor"
  | "z-walker"
  | "z-runner"
  | "z-brute"
  | "z-boss"
  | "e-grunt"
  | "e-dart"
  | "e-tank"
  | "e-boss"
  | "boss-king"
  | "boss-flag";

const SRC: Record<SheetId, string> = {
  ship: "/sprites/ship.png",
  survivor: "/sprites/survivor.png",
  "z-walker": "/sprites/z-walker.png",
  "z-runner": "/sprites/z-runner.png",
  "z-brute": "/sprites/z-brute.png",
  "z-boss": "/sprites/z-boss.png",
  "e-grunt": "/sprites/e-grunt.png",
  "e-dart": "/sprites/e-dart.png",
  "e-tank": "/sprites/e-tank.png",
  "e-boss": "/sprites/e-boss.png",
  "boss-king": "/sprites/boss-king.png",
  "boss-flag": "/sprites/boss-flag.png",
};

export class SpriteBook {
  private images = new Map<SheetId, HTMLImageElement>();

  constructor() {
    (Object.keys(SRC) as SheetId[]).forEach((id) => {
      const img = new Image();
      img.decoding = "async";
      img.src = SRC[id];
      this.images.set(id, img);
    });
  }

  draw(
    ctx: CanvasRenderingContext2D,
    id: SheetId,
    frame: number,
    x: number,
    y: number,
    size: number,
  ) {
    const img = this.images.get(id);
    if (!img || !img.complete || img.naturalWidth < 8) return false;
    const col = ((frame % 4) + 4) % 4;
    const sw = img.naturalWidth / 2;
    const sh = img.naturalHeight / 2;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      img,
      (col % 2) * sw,
      Math.floor(col / 2) * sh,
      sw,
      sh,
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  drawWhole(ctx: CanvasRenderingContext2D, id: SheetId, x: number, y: number, w: number, h: number) {
    const img = this.images.get(id);
    if (!img || !img.complete || img.naturalWidth < 8) return false;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }
}
