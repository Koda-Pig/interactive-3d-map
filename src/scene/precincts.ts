import { Color, Material, MathUtils, Mesh } from "three";
import type { Object3D } from "three";
import { setBaseMaterial } from "../draw/materials.ts";
import type { SiteMaterial } from "../draw/materials.ts";
import { CATEGORIES, layout } from "../layout/locations.ts";
import type { Category, Location } from "../layout/locations.ts";

const FADE_DURATION = 300;

/** How long muted locations take to change colour, each way. */
const MUTE_DURATION = 220;
const MUTED_COLOR = new Color("#D9D4C4");
const MUTED_AMOUNT = 0.74;

interface Fade {
  readonly from: number;
  readonly duration: number;
  startedAt: number | null;
}

/** A material and the copy of it used by locations that aren't the focus. */
interface MutedTwin {
  readonly material: SiteMaterial;
  readonly full: Color;
  readonly muted: Color;
}

interface Precinct {
  readonly objects: Object3D[];
  /** Added to `objects` for fading, but left out of picking. */
  readonly dressing: Object3D[];
  /** Each precinct's own copies, so that fading one leaves the others alone. */
  readonly materials: Map<Material, Material>;
  readonly twins: Map<Material, MutedTwin>;
  shown: boolean;
  opacity: number;
  fade: Fade | null;
}

interface LocationMesh {
  readonly mesh: Mesh;
  readonly own: SiteMaterial;
  readonly twin: SiteMaterial;
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

function twinOf(own: SiteMaterial, precinct: Precinct): SiteMaterial {
  let twin = precinct.twins.get(own);
  if (!twin) {
    twin = {
      material: own.clone(),
      full: own.color.clone(),
      muted: own.color.clone().lerp(MUTED_COLOR, MUTED_AMOUNT),
    };
    precinct.twins.set(own, twin);
  }
  return twin.material;
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
  for (const { material } of precinct.twins.values()) {
    setOpacity(material, opacity);
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
  private readonly meshes = new Map<Location, LocationMesh[]>();

  /** What should be muted, once any change that's under way has finished. */
  private wantedMuted: ReadonlySet<Location> = new Set();
  /** What the twin materials are currently on. */
  private appliedMuted: ReadonlySet<Location> = new Set();
  private muteAmount = 0;
  private lastUpdate: number | null = null;

  /**
   * Takes over the materials of `site` and of the `dressing` for each
   * precinct, so call it before anything else uses them.
   */
  constructor(site: Object3D, dressing: ReadonlyMap<Category, Object3D>) {
    for (const category of CATEGORIES) {
      this.precincts.set(category, {
        objects: [],
        dressing: [],
        materials: new Map(),
        twins: new Map(),
        shown: true,
        opacity: 1,
        fade: null,
      });
    }
    for (const location of layout.locations) {
      const object = site.getObjectByName(location.id);
      if (!object) {
        throw new Error(`Nothing was drawn for "${location.id}"`);
      }
      const precinct = this.precinct(location.category);
      precinct.objects.push(object);
      ownMaterials(object, precinct);

      const meshes: LocationMesh[] = [];
      object.traverse((child) => {
        if (child instanceof Mesh) {
          const own = child.material as SiteMaterial;
          meshes.push({ mesh: child, own, twin: twinOf(own, precinct) });
        }
      });
      this.meshes.set(location, meshes);
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

  isMuted(location: Location): boolean {
    return this.wantedMuted.has(location);
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

  /** Mutes exactly these locations, leaving every other one in full colour. */
  setMuted(locations: ReadonlySet<Location>): void {
    this.wantedMuted = locations;
  }

  /** Advances any changes to `now`, and says what needs drawing again. */
  update(now: number): { readonly redraw: boolean; readonly shadows: boolean } {
    const recoloured = this.updateMuting(now);
    let faded = false;
    for (const precinct of this.precincts.values()) {
      const { fade } = precinct;
      if (!fade) {
        continue;
      }
      fade.startedAt ??= now;
      const elapsed = now - fade.startedAt;
      const progress = fade.duration === 0 ? 1 : Math.min(1, elapsed / fade.duration);
      applyOpacity(precinct, MathUtils.lerp(fade.from, precinct.shown ? 1 : 0, progress));
      if (progress === 1) {
        precinct.fade = null;
      }
      faded = true;
    }
    return { redraw: recoloured || faded, shadows: faded };
  }

  /**
   * A change of muted locations first eases the old ones back to full colour,
   * where the twin materials look the same as the originals. Only then are
   * the meshes switched over, so nothing jumps.
   */
  private updateMuting(now: number): boolean {
    const elapsed = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;

    const changing = this.wantedMuted !== this.appliedMuted;
    const target = changing || this.appliedMuted.size === 0 ? 0 : 1;
    if (this.muteAmount === target && !changing) {
      return false;
    }

    const step = prefersReducedMotion() ? 1 : Math.min(1, elapsed / MUTE_DURATION);
    const amount =
      this.muteAmount < target
        ? Math.min(target, this.muteAmount + step)
        : Math.max(target, this.muteAmount - step);
    this.setMuteAmount(amount);

    if (changing && amount === 0) {
      this.switchMutedMeshes();
    }
    return true;
  }

  private setMuteAmount(amount: number): void {
    this.muteAmount = amount;
    const eased = MathUtils.smoothstep(amount, 0, 1);
    for (const precinct of this.precincts.values()) {
      for (const { material, full, muted } of precinct.twins.values()) {
        material.color.lerpColors(full, muted, eased);
      }
    }
  }

  private switchMutedMeshes(): void {
    this.appliedMuted = this.wantedMuted;
    for (const [location, meshes] of this.meshes) {
      const muted = this.appliedMuted.has(location);
      for (const { mesh, own, twin } of meshes) {
        setBaseMaterial(mesh, muted ? twin : own);
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
    return [...this.precincts.values()].flatMap(({ shown, objects }) => (shown ? objects : []));
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
