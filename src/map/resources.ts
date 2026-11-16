import { Light, type Material, Mesh, type Object3D, Texture } from "three";
import type { Kit } from "../draw/kit.ts";
import { disposeMaterialHighlights } from "../draw/materials.ts";

/** Cleanup is registered as soon as a resource exists, including during startup. */
export class MapResources {
  destroyed = false;
  private readonly cleanups: (() => void)[] = [];
  private readonly disposed = new WeakSet<object>();
  constructor(readonly root: HTMLElement) {}
  add(cleanup: () => void): void {
    if (this.destroyed) cleanup();
    else this.cleanups.push(cleanup);
  }
  check(): void {
    if (this.destroyed) throw new Error("Map destroyed during startup");
  }
  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const cleanup of this.cleanups.reverse()) cleanup();
    this.cleanups.length = 0;
  }
  timeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      if (!this.destroyed) callback();
    }, delay);
    this.add(() => window.clearTimeout(id));
    return id;
  }
  listen(target: EventTarget, event: string, callback: EventListener): void {
    const controller = new AbortController();
    target.addEventListener(event, callback, { signal: controller.signal });
    this.add(() => controller.abort());
  }
  observer(callback: ResizeObserverCallback): ResizeObserver {
    const observer = new ResizeObserver(callback);
    this.add(() => observer.disconnect());
    return observer;
  }
  observe(callback: ResizeObserverCallback, element: Element): void {
    this.observer(callback).observe(element);
  }
  private disposeMaterial(material: Material): void {
    if (this.disposed.has(material)) return;
    this.disposed.add(material);
    const textures = new Set<Texture>();
    const collect = (value: unknown): void => {
      if (value instanceof Texture) textures.add(value);
      else if (value && typeof value === "object" && "value" in value) collect(value.value);
    };
    for (const [key, value] of Object.entries(material)) {
      collect(value);
      if ((key === "uniforms" || key === "waterUniforms") && value && typeof value === "object")
        for (const uniform of Object.values(value)) collect(uniform);
    }
    for (const value of textures) {
      if (value instanceof Texture && !this.disposed.has(value)) {
        this.disposed.add(value);
        value.dispose();
      }
    }
    disposeMaterialHighlights(material);
    material.dispose();
  }
  disposeObject(object: Object3D): void {
    object.traverse((child) => {
      if (
        child instanceof Light &&
        "shadow" in child &&
        child.shadow &&
        typeof child.shadow === "object" &&
        "dispose" in child.shadow &&
        typeof child.shadow.dispose === "function"
      )
        child.shadow.dispose();
      if (child instanceof Mesh) {
        if (!this.disposed.has(child.geometry)) {
          this.disposed.add(child.geometry);
          child.geometry.dispose();
        }
        for (const material of Array.isArray(child.material) ? child.material : [child.material])
          this.disposeMaterial(material);
        if ("dispose" in child && typeof child.dispose === "function") child.dispose();
      }
    });
  }
  ownObject(object: Object3D): void {
    this.add(() => this.disposeObject(object));
  }
  ownKit(kit: Kit): void {
    this.add(() => {
      for (const model of kit.values())
        for (const piece of model.pieces) {
          if (!this.disposed.has(piece.geometry)) {
            this.disposed.add(piece.geometry);
            piece.geometry.dispose();
          }
          this.disposeMaterial(piece.material);
        }
    });
  }
}
