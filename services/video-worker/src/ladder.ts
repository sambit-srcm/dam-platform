export type Rung = {
  label: string;
  width: number;
  height: number;
  crf: number;
  maxrateKbps: number;
  bufsizeKbps: number;
};

// The sizes we offer, largest first. "Target" is the length of the shorter side,
// so a portrait phone video counts as 1080p at 1080 wide, like other platforms.
const LADDER = [
  { target: 1080, crf: 23, maxrateKbps: 6000 },
  { target: 720, crf: 23, maxrateKbps: 3500 },
];

// H.264 with yuv420p needs even dimensions
function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

// Decides which renditions a source of this size gets. Never upscales, and always
// returns at least one, so every video ends up with something playable.
export function planRenditions({
  width,
  height,
}: {
  width: number;
  height: number;
}): Rung[] {
  const shortSide = Math.min(width, height);
  const landscape = width >= height;

  const rungs = LADDER.filter(({ target }) => shortSide >= target).map(
    ({ target, crf, maxrateKbps }): Rung => ({
      label: `${target}p`,
      width: landscape ? even((width * target) / height) : target,
      height: landscape ? target : even((height * target) / width),
      crf,
      maxrateKbps,
      bufsizeKbps: maxrateKbps * 2,
    }),
  );
  if (rungs.length > 0) return rungs;

  // Smaller than the smallest rung: keep the original size
  const smallest = LADDER[LADDER.length - 1]!;
  return [
    {
      label: `${even(shortSide)}p`,
      width: even(width),
      height: even(height),
      crf: smallest.crf,
      maxrateKbps: smallest.maxrateKbps,
      bufsizeKbps: smallest.maxrateKbps * 2,
    },
  ];
}
