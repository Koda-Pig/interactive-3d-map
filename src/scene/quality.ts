/** How much the map asks of the device it's running on. */
export interface Quality {
  readonly tier: "high" | "low";
  readonly maxPixelRatio: number;
  readonly shadowMapSize: number;
  /** The most the shadow edges are blurred, in shadow map texels. */
  readonly shadowRadius: number;
  readonly fieldTextureSize: number;
  /** The share of the optional scenery that's drawn. */
  readonly sceneryDensity: number;
  /** Whether catch fences are drawn along the spectator stretches of the circuit. */
  readonly catchFences: boolean;
  /** Whether the finish in `finish.ts` is drawn over the scene: glow, cloud shadows and blur. */
  readonly finish: boolean;
  /**
   * While only the everyday movement needs drawing (the water, shuttles and
   * N7 traffic), one frame in this many is drawn.
   */
  readonly ambientFrames: number;
}

const HIGH: Quality = {
  tier: "high",
  maxPixelRatio: 2,
  shadowMapSize: 4096,
  shadowRadius: 3,
  fieldTextureSize: 2048,
  sceneryDensity: 1,
  catchFences: true,
  finish: true,
  ambientFrames: 1,
};

const LOW: Quality = {
  tier: "low",
  maxPixelRatio: 1.5,
  shadowMapSize: 2048,
  shadowRadius: 2,
  fieldTextureSize: 1024,
  sceneryDensity: 0.45,
  catchFences: false,
  finish: false,
  ambientFrames: 2,
};

const PHONE_MAX_SCREEN_SIDE = 820;

/** Picks a tier from the device, unless the address says `?quality=low` or `high`. */
export function detectQuality(): Quality {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low") {
    return LOW;
  }
  if (forced === "high") {
    return HIGH;
  }
  const phone =
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.screen.width, window.screen.height) < PHONE_MAX_SCREEN_SIDE;
  return phone ? LOW : HIGH;
}
