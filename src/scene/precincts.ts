import { Material, MathUtils, Mesh } from "three";
import type { Object3D } from "three";
import { CATEGORIES, layout } from "../layout/locations.ts";
import type { Category } from "../layout/locations.ts";

const FADE_DURATION = 300;

interface Fade {
  readonly from: number;
  readonly duration: number;
  startedAt: number | null;
}

interface Precinct {
  readonly objects: Object3D[];
  /** Each precinct's own copies, so that fading one leaves the others alone. */
  readonly materials: Map<Material, Material>;
  shown: boolean;
  opacity: number;
  fade: Fade | null;
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

function applyOpacity(precinct: Precinct, opacity: number): void {
  precinct.opacity = opacity;
  const transparent = opacity < 1;
  for (const material of precinct.materials.values()) {
    material.opacity = opacity;
    // Opaque and transparent materials compile to different shaders.
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
  }
  for (const object of precinct.objects) {
    object.visible = opacity > 0;
  }
}

/** Fades whole precincts of the site in and out. */
export class Precincts {
  /** The drawn objects of every precinct that's on, for picking. */
  shownObjects: Object3D[];

  private readonly precincts = new Map<Category, Precinct>();

  /** Takes over the materials of `site`, so call it before anything else uses them. */
  constructor(site: Object3D) {
    for (const category of CATEGORIES) {
      this.precincts.set(category, {
        objects: [],
        materials: new Map(),
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
    }
    this.shownObjects = this.collectShown();
  }

  isShown(category: Category): boolean {
    return this.precinct(category).shown;
  }

  /** Starts a precinct fading. It stops being pickable as soon as it's turned off. */
  setShown(category: Category, shown: boolean): void {
    const precinct = this.precinct(category);
    if (precinct.shown === shown) {
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    precinct.shown = shown;
    precinct.fade = {
      from: precinct.opacity,
      duration: reduceMotion ? 0 : FADE_DURATION,
      startedAt: null,
    };
    this.shownObjects = this.collectShown();
  }

  /** Advances any fades to `now`, and says whether anything changed. */
  update(now: number): boolean {
    let changed = false;
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
      changed = true;
    }
    return changed;
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
