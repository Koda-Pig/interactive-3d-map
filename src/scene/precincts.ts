import type { Object3D } from "three";
import { Color, Material, MathUtils, Mesh } from "three";
import type { SiteMaterial } from "../draw/materials.ts";
import { refreshHighlights, setBaseMaterial } from "../draw/materials.ts";
import type { Category, Location } from "../layout/locations.ts";
import { CATEGORIES, layout } from "../layout/locations.ts";

const FADE_DURATION = 300;

/** How long muted locations take to change colour, each way. */
const MUTE_DURATION = 220;
const MUTED_COLOR = new Color("#D9D4C4");
const MUTED_AMOUNT = 0.74;
/** How far the rest of the site mutes around a selection, where 1 is an event mode's muting. */
const FOCUS_MUTE = 0.6;

interface Fade {
  readonly from: number;
  readonly duration: number;
  startedAt: number | null;
}

/** A copy of a mesh's material that eases towards the muted colour. */
interface MutedTwin {
  readonly material: SiteMaterial;
  readonly full: Color;
  readonly muted: Color;
}

interface Precinct {
  readonly objects: Object3D[];
  /** Drawn whether the precinct is on or off, but only pickable while it's on. */
  readonly fixed: Object3D[];
  /** Added to `objects` for fading, but left out of picking. */
  readonly dressing: Object3D[];
  /** Each precinct's own copies, so that fading one leaves the others alone. */
  readonly materials: Map<Material, Material>;
  readonly twins: SiteMaterial[];
  shown: boolean;
  opacity: number;
  fade: Fade | null;
}

interface LocationMesh {
  readonly mesh: Mesh;
  readonly own: SiteMaterial;
  readonly twin: MutedTwin;
}

/** A location's meshes and how muted they are, from 0 to 1. */
interface LocationMuting {
  readonly meshes: readonly LocationMesh[];
  amount: number;
}

function ownMaterials(object: Object3D, precinct: Precinct): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh) || !(child.material instanceof Material)) {
      return;
    }
    let own = precinct.materials.get(child.material);
    if (!own) {
      own = child.material.clone();
      precinct.materials.set(child.material, own);
    }
    child.material = own;
  });
}

/** Each mesh has its own twin, so locations can mute by different amounts at once. */
function createTwin(own: SiteMaterial, precinct: Precinct): MutedTwin {
  const material = own.clone();
  precinct.twins.push(material);
  return {
    material,
    full: own.color.clone(),
    muted: own.color.clone().lerp(MUTED_COLOR, MUTED_AMOUNT),
  };
}

function emptyPrecinct(): Precinct {
  return {
    objects: [],
    fixed: [],
    dressing: [],
    materials: new Map(),
    twins: [],
    shown: true,
    opacity: 1,
    fade: null,
  };
}

/**
 * The road network belongs to "Parking and transport", but the other
 * precincts make no sense without it, so it stays when that one is off.
 */
function isAlwaysDrawn(location: Location): boolean {
  return location.type === "road" && location.category === "transport";
}

function setOpacity(material: Material, opacity: number): void {
  const transparent = opacity < 1;
  material.opacity = opacity;
  // Opaque and transparent materials compile to different shaders.
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
}

function applyOpacity(precinct: Precinct, opacity: number): void {
  precinct.opacity = opacity;
  for (const material of precinct.materials.values()) {
    setOpacity(material, opacity);
  }
  for (const twin of precinct.twins) {
    setOpacity(twin, opacity);
  }
  for (const object of [...precinct.objects, ...precinct.dressing]) {
    object.visible = opacity > 0;
  }
}

/** Fades whole precincts of the site in and out, and mutes individual locations. */
export class Precincts {
  /** The drawn objects of every precinct that's on, for picking. */
  shownObjects: Object3D[];

  private readonly precincts = new Map<Category, Precinct>();
  private readonly muting = new Map<Location, LocationMuting>();

  /** What the current event mode leaves out. */
  private eventMuted: ReadonlySet<Location> = new Set();
  /** The selected location, which everything else steps back from. */
  private focus: Location | null = null;
  private lastUpdate: number | null = null;

  /**
   * Takes over the materials of `site` and of the `dressing` for each
   * precinct, so call it before anything else uses them.
   */
  constructor(site: Object3D, dressing: ReadonlyMap<Category, Object3D>) {
    for (const category of CATEGORIES) {
      this.precincts.set(category, emptyPrecinct());
    }
    // Holds the materials of everything that never fades, so no precinct's fade reaches them.
    const alwaysDrawn = emptyPrecinct();
    for (const location of layout.locations) {
      const object = site.getObjectByName(location.id);
      if (!object) {
        throw new Error(`Nothing was drawn for "${location.id}"`);
      }
      const precinct = this.precinct(location.category);
      const fixed = isAlwaysDrawn(location);
      const owner = fixed ? alwaysDrawn : precinct;
      (fixed ? precinct.fixed : precinct.objects).push(object);
      ownMaterials(object, owner);

      const meshes: LocationMesh[] = [];
      object.traverse((child) => {
        if (child instanceof Mesh) {
          const own = child.material as SiteMaterial;
          meshes.push({ mesh: child, own, twin: createTwin(own, owner) });
        }
      });
      this.muting.set(location, { meshes, amount: 0 });
    }
    for (const [category, object] of dressing) {
      const precinct = this.precinct(category);
      precinct.dressing.push(object);
      ownMaterials(object, precinct);
    }
    this.shownObjects = this.collectShown();
  }

  isShown(category: Category): boolean {
    return this.precinct(category).shown;
  }

  /** Whether the event mode leaves this location out. A selection doesn't count. */
  isMuted(location: Location): boolean {
    return this.eventMuted.has(location);
  }

  /** Starts a precinct fading. It stops being pickable as soon as it's turned off. */
  setShown(category: Category, shown: boolean): void {
    const precinct = this.precinct(category);
    if (precinct.shown === shown) {
      return;
    }
    precinct.shown = shown;
    precinct.fade = {
      from: precinct.opacity,
      duration: prefersReducedMotion() ? 0 : FADE_DURATION,
      startedAt: null,
    };
    this.shownObjects = this.collectShown();
  }

  /** Sets the locations the event mode leaves out. */
  setMuted(locations: ReadonlySet<Location>): void {
    this.eventMuted = locations;
  }

  /** Mutes everything around this location, or returns to the event mode's muting. */
  setFocus(location: Location | null): void {
    this.focus = location;
  }

  /**
   * Advances any changes to `now`, and says what needs drawing again. Shadows
   * are all or nothing, so they're redrawn when a precinct's objects appear
   * or go and not on every frame of a fade.
   */
  update(now: number): { readonly redraw: boolean; readonly shadows: boolean } {
    const recoloured = this.updateMuting(now);
    let faded = false;
    let shadows = false;
    for (const precinct of this.precincts.values()) {
      const { fade } = precinct;
      if (!fade) {
        continue;
      }
      const wasDrawn = precinct.opacity > 0;
      fade.startedAt ??= now;
      const elapsed = now - fade.startedAt;
      const progress = fade.duration === 0 ? 1 : Math.min(1, elapsed / fade.duration);
      applyOpacity(precinct, MathUtils.lerp(fade.from, precinct.shown ? 1 : 0, progress));
      if (progress === 1) {
        precinct.fade = null;
      }
      faded = true;
      shadows ||= wasDrawn !== precinct.opacity > 0;
    }
    return { redraw: recoloured || faded, shadows };
  }

  private muteTarget(location: Location): number {
    // Muted water turns grey and reads as paving.
    if (location === this.focus || location.type === "water") {
      return 0;
    }
    if (this.eventMuted.has(location)) {
      return 1;
    }
    return this.focus ? FOCUS_MUTE : 0;
  }

  /**
   * Eases each location towards its target. A location only uses its twin
   * materials while it's muted, where they can't be told from the originals
   * at either end of the change, so nothing jumps.
   */
  private updateMuting(now: number): boolean {
    const elapsed = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    const step = prefersReducedMotion() ? 1 : Math.min(1, elapsed / MUTE_DURATION);

    let changed = false;
    for (const [location, muting] of this.muting) {
      const target = this.muteTarget(location);
      if (muting.amount === target) {
        continue;
      }
      const wasFullColour = muting.amount === 0;
      muting.amount =
        muting.amount < target
          ? Math.min(target, muting.amount + step)
          : Math.max(target, muting.amount - step);
      this.applyMuting(muting, wasFullColour);
      changed = true;
    }
    return changed;
  }

  private applyMuting(muting: LocationMuting, wasFullColour: boolean): void {
    const eased = MathUtils.smoothstep(muting.amount, 0, 1);
    for (const { mesh, own, twin } of muting.meshes) {
      twin.material.color.lerpColors(twin.full, twin.muted, eased);
      refreshHighlights(twin.material);
      if (wasFullColour || muting.amount === 0) {
        setBaseMaterial(mesh, muting.amount === 0 ? own : twin.material);
      }
    }
  }

  private precinct(category: Category): Precinct {
    const precinct = this.precincts.get(category);
    if (!precinct) {
      throw new Error(`Unknown precinct "${category}"`);
    }
    return precinct;
  }

  private collectShown(): Object3D[] {
    return [...this.precincts.values()].flatMap(({ shown, objects, fixed }) =>
      shown ? [...objects, ...fixed] : [],
    );
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
