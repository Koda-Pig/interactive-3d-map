import type { DirectionalLight, PerspectiveCamera } from "three";
import { MathUtils, Vector3 } from "three";

/** Half the width of the shadow area when it covers the whole site, in metres. */
const SITE_HALF_WIDTH = 1800;
/** How long the camera has to be still before the shadows sharpen, in milliseconds. */
const SETTLE_TIME = 180;
/** Room around the view for small moves, as a share of its size and in metres. */
const FIT_MARGIN_SHARE = 0.12;
const FIT_MARGIN = 30;
/** How far along a corner of the view to look when it doesn't reach the ground. */
const MAX_VIEW_REACH = SITE_HALF_WIDTH * 3;
/** Width of the soft edge of a shadow, in metres. */
const PENUMBRA = 0.4;

/** A rectangle facing the sun, in the shadow camera's coordinates. */
interface Extent {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

const WHOLE_SITE: Extent = {
  left: -SITE_HALF_WIDTH,
  right: SITE_HALF_WIDTH,
  bottom: -SITE_HALF_WIDTH,
  top: SITE_HALF_WIDTH,
};

const VIEW_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;

const corner = new Vector3();
const ray = new Vector3();
const sunSpace = new Vector3();

function contains(outer: Extent, inner: Extent): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.bottom >= outer.bottom &&
    inner.top <= outer.top
  );
}

/**
 * Keeps the sun's one shadow map on the part of the site in view. The shadow
 * pass is skipped while the camera moves, so the map is only fitted once the
 * camera is still. A move that leaves the fitted area falls back to the whole
 * site, because ground outside the area would have no shadows at all.
 */
export class SunShadow {
  private fit: Extent = WHOLE_SITE;
  private fitted = false;
  private refitDue = true;
  private lastMoved = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly sun: DirectionalLight,
    private readonly maxRadius: number,
  ) {
    const { camera } = sun.shadow;
    camera.position.copy(sun.position);
    camera.lookAt(sun.target.position);
    camera.updateMatrixWorld();
    this.apply(WHOLE_SITE);
  }

  /** Fits the shadows again the next time the camera is still. */
  refit(): void {
    this.refitDue = true;
  }

  /** Call every frame after the camera has moved. Returns whether the map is out of date. */
  update(now: number, camera: PerspectiveCamera, target: Vector3, moved: boolean): boolean {
    if (moved) {
      this.lastMoved = now;
      this.refitDue = true;
      if (this.fitted && !contains(this.fit, this.visibleExtent(camera, target))) {
        this.fitted = false;
        this.apply(WHOLE_SITE);
        return true;
      }
      return false;
    }

    if (!this.refitDue || now - this.lastMoved < SETTLE_TIME) {
      return false;
    }
    this.refitDue = false;
    this.fitted = true;
    this.apply(this.withMargin(this.visibleExtent(camera, target), target));
    return true;
  }

  /** The rectangle facing the sun that holds all the ground the camera can see. */
  private visibleExtent(camera: PerspectiveCamera, target: Vector3): Extent {
    camera.updateMatrixWorld();
    const toSun = this.sun.shadow.camera.matrixWorldInverse;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.POSITIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;

    for (const [x, y] of VIEW_CORNERS) {
      ray
        .copy(corner.set(x, y, 0.5).unproject(camera))
        .sub(camera.position)
        .normalize();
      const toGround = (target.y - camera.position.y) / ray.y;
      const reach = toGround > 0 ? Math.min(toGround, MAX_VIEW_REACH) : MAX_VIEW_REACH;
      sunSpace.copy(camera.position).addScaledVector(ray, reach).applyMatrix4(toSun);
      left = Math.min(left, sunSpace.x);
      right = Math.max(right, sunSpace.x);
      bottom = Math.min(bottom, sunSpace.y);
      top = Math.max(top, sunSpace.y);
    }

    return this.limited({ left, right, bottom, top }, target);
  }

  private withMargin(extent: Extent, target: Vector3): Extent {
    const { left, right, bottom, top } = extent;
    const margin = FIT_MARGIN + FIT_MARGIN_SHARE * Math.max(right - left, top - bottom);
    return this.limited(
      { left: left - margin, right: right + margin, bottom: bottom - margin, top: top + margin },
      target,
    );
  }

  /** Keeps a low view of the horizon from spreading the map thinner than the whole site. */
  private limited(extent: Extent, target: Vector3): Extent {
    sunSpace.copy(target).applyMatrix4(this.sun.shadow.camera.matrixWorldInverse);
    return {
      left: Math.max(extent.left, sunSpace.x - SITE_HALF_WIDTH),
      right: Math.min(extent.right, sunSpace.x + SITE_HALF_WIDTH),
      bottom: Math.max(extent.bottom, sunSpace.y - SITE_HALF_WIDTH),
      top: Math.min(extent.top, sunSpace.y + SITE_HALF_WIDTH),
    };
  }

  private apply(extent: Extent): void {
    this.fit = extent;
    const { shadow } = this.sun;
    const { camera } = shadow;
    camera.left = extent.left;
    camera.right = extent.right;
    camera.bottom = extent.bottom;
    camera.top = extent.top;
    camera.updateProjectionMatrix();

    const texel =
      Math.max(extent.right - extent.left, extent.top - extent.bottom) / shadow.mapSize.x;
    shadow.radius = MathUtils.clamp(PENUMBRA / texel, 1, this.maxRadius);
    // Under a low sun, level ground needs lifting by about the width of the
    // shadow filter to clear itself. Any more slides shadows off their bases.
    shadow.normalBias = texel * (shadow.radius + 1);
  }
}
