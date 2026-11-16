# Share the map with PitchDecks

## Outcome and scope

Keep this repository as the source of truth for the Blue Mountain Racing map. Produce a versioned package that PitchDecks can import without an iframe. Keep this repository's standalone website working from the same map implementation.

Use the package in two places in the BMR pitch:

- A contained section in the overview deck, with an option to open the full map.
- A `/map` detail page behind the deck's existing password gate.

This document is an implementation plan. It does not authorize publishing a package or deploying either website. Do not change the circuit, scenery, or location content as part of the extraction. Work on `main` as required by this repository.

## Current constraints

The relevant implementation is spread across these files:

| Area | Current behavior | Required change |
| --- | --- | --- |
| `index.html`, `src/main.ts` | One fixed page shell; startup runs at module evaluation; selectors find global IDs. | Create the shell inside a supplied element and start explicitly. |
| `src/style.css` | Styles `html`, `body`, `:root`, and `#app`; map height is `100dvh`. | Scope styles and state to each map root. Let the host set dimensions. |
| `src/main.ts`, `src/ui/sidebar.ts`, `src/ui/bottom-sheet.ts` | Some measurements and responsive behavior use the window or document root. | Base map layout on container size and coordinates. |
| `src/draw/kit.ts`, `src/ui/dom.ts` | Public asset URLs depend on `import.meta.env.BASE_URL`. | Supply an asset base URL independent of Vite. |
| `src/ui/address.ts` | Selection reads and writes the browser URL. | Move address synchronization into each application's integration. |
| `src/draw/materials.ts` | Mutable material caches and highlight state live at module scope. | Give mutable resources explicit ownership so instances cannot affect each other. |
| `src/main.ts`, UI and interaction modules | Listeners, observers, timers, and rendering assume a page lifetime. | Provide complete teardown and handle interrupted startup. |
| PitchDecks BMR `index.ts`, `nav.ts` | Client-specific detail pages are exported through `pages`; visited pages can remain mounted while hidden. | Register the map there and suspend hidden instances. |

Read `docs/overview.md` before implementation. Follow PitchDecks' `AGENTS.md`, README, and client conventions when integrating. If a proposed fix touches spatial layout, first read `ai/track-layout.md` and retain its acceptance criteria.

## Package structure

Use one publishable package with a framework-neutral entry point and an optional React entry point. The package name `@protium/bmr-map` is provisional until the available registry scope is checked.

Keep source in the existing repository rather than creating a monorepo just for this extraction:

```text
src/
  map/
    index.ts           # Public browser mount API and types
    mount.ts           # Owns one complete map instance
    shell.ts           # Creates the map's DOM within its root
    resources.ts       # Owns instance resources and their disposal
  react/
    index.ts
    bmr-map.tsx        # React lifecycle and loading/error presentation
  main.ts             # Thin standalone-site integration
  style.css           # Scoped shared map stylesheet
  draw/, scene/, ...  # Existing implementation, adapted as needed
tools/
  copy-assets.mjs      # Explicit consumer build step
dist/
  index.js, index.d.ts
  react/index.js, react/index.d.ts
  style.css
  assets/             # Models, location images, and required runtime assets
```

Keep drawing, layout, asset loading, controls, and tours private. Export no Three.js scene objects or renderer internals. Preserve development inspection hooks only in the standalone development entry point.

### Consumer usage and contract

The intended React call sites are:

```tsx
// Imported through a browser-only boundary in PitchDecks.
import { BmrMap } from "@protium/bmr-map/react";

<BmrMap
  variant="section"
  assetBaseUrl={mapAssetsUrl}
  active={sectionIsVisible}
/>

<BmrMap
  variant="page"
  assetBaseUrl={mapAssetsUrl}
  active={mapPageIsVisible}
  locationId={locationFromUrl}
  onLocationChange={updateLocationInUrl}
/>
```

Import the exported stylesheet once through the host's supported CSS entry point. The host owns the wrapper height and the link between the section and `/map`.

Derive the browser API from those call sites:

```ts
type MapVariant = "section" | "page";

interface MapOptions {
  assetBaseUrl: string;
  variant: MapVariant;
  active?: boolean;
  initialLocationId?: string;
  onLocationChange?: (locationId: string | null) => void;
}

interface MapHandle {
  readonly ready: Promise<void>;
  setActive(active: boolean): void;
  selectLocation(locationId: string | null): void;
  destroy(): void;
}

declare function mountMap(host: HTMLElement, options: MapOptions): MapHandle;
```

Return the handle synchronously so callers can destroy an instance while assets are still loading. Make `destroy()` safe to call repeatedly. After destruction, ignore late async results and release any resources they created. Handle startup failure through `ready` and a local error state, without a global error handler.

Keep module imports safe during server rendering. Browser and WebGL work begins only when mounting. The React adapter owns effect cleanup, startup errors, and updates to `active` and callbacks. Its optional controlled `locationId` prop replaces `initialLocationId`: when supplied, forward changes through `selectLocation()` so browser back/forward updates an existing map. Prevent selection callbacks from creating URL-update loops. Document which initial options require a remount. Validate requested location IDs against the packaged layout.

### Ownership decisions

- Bundle Three.js into the browser implementation initially; expose no Three.js types. Keep React as an optional peer used only by the `/react` export. Confirm final peer ranges against tested consumers.
- Bundle the layout JSON with the package so code and location data stay together.
- Put fonts, imported team logos, and other runtime files through the library build or asset manifest. Do not assume copying `public/` captures every dependency.
- Give each mounted map its own mutable state. Start with instance-owned caches; add shared immutable caches only if measurement warrants them and their lifetime is explicit.
- Keep URL ownership in the host. The deck section does not update the address. The full page and standalone site can preserve `?location=...` through their own adapters.
- Keep BMR identity and the concept-layout notice in both variants. Do not generalize this into a configurable venue-map platform.

## Implementation sequence

### 1. Record the baseline and build inputs

- Capture the current standalone desktop and phone views, selection, filters, event modes, and guided tours.
- Inventory startup dependencies, asset paths, mutable caches, global DOM access, timers, listeners, and disposal requirements across the modules called by `src/main.ts`.
- Record current production build sizes and relevant browser performance measurements for comparison.
- Preserve unrelated working-tree changes. The repository already has in-progress map and tour changes when this plan is written.

Exit when the extraction has a repeatable behavior baseline and a resource ownership inventory.

### 2. Extract one mountable map and preserve the standalone site

- Move startup into `mountMap()` and create the existing UI shell inside its host.
- Scope queries, IDs, CSS variables, sidebar state, and overlays to that root. Use unique IDs where accessible control relationships require them.
- Replace viewport-sized map layout with container sizing. Recalculate overlays relative to the host, including a map positioned below other deck content.
- Use container width for compact layouts. Keep window media queries only for actual device or user preferences.
- Stop keyboard shortcuts, wheel zoom, and touch gestures from interfering with the surrounding deck. Let ordinary page scrolling work until the visitor intentionally interacts with the section map.
- Replace implicit asset paths with the supplied base URL. Keep bundler-specific environment reads in the standalone adapter.
- Make `src/main.ts` mount the shared implementation, preserve standalone URL behavior, and apply its full-window wrapper styles separately.

Exit when the standalone site uses the extracted map and matches the baseline without spatial changes.

### 3. Complete lifecycle and instance isolation

- Disconnect resize and intersection observers, media-query listeners, document listeners, repeating controls, hint timers, and touch handlers on destruction.
- Stop tours and animation loops; dispose controls, geometries, materials, textures, render targets, and the renderer with clear ownership rules.
- Ensure destroying one instance cannot invalidate another instance's resources or highlights.
- Handle partial startup failures and destruction during model or font loading. Remove only DOM owned by the instance.
- Make inactive maps stop animation and interaction. Freeze elapsed animation time so resuming does not jump a tour forward.
- Combine host activity, visibility, and document visibility so retained hidden pages consume no ongoing animation work. Handle zero-sized containers and resize correctly on return.
- Keep React Strict Mode's setup/cleanup/setup cycle safe.

Exit when repeated mounting, interrupted startup, two concurrent instances, and hidden-page transitions work without accumulating canvases, listeners, or GPU resources.

### 4. Build a portable package and asset distribution step

- Add a library build alongside the Vite website build. Emit ESM JavaScript, declarations, scoped CSS, a React entry point, and runtime assets.
- Configure package exports and CSS side-effect metadata. Exclude source-only tools, reference images, development hooks, and website output from the package. Include required dependency and asset license notices.
- Replace assumptions from `noEmit`, `.ts` import extensions, and Vite environment typing with a declaration/build setup that supports the emitted package.
- Add an explicit CLI that copies packaged runtime assets into a caller-supplied public directory. Avoid an install hook that mutates the consuming application.
- Copy assets to a versioned destination such as `public/maps/bmr/<package-version>/`. Resolve `assetBaseUrl` to the same version and include any host base path.
- Fail the build for missing required assets. Preserve the current model fallback behavior where appropriate and report failures locally.
- Keep assets on the consumer's origin initially. Document that static asset URLs may be public even when `/map` is password protected, as with existing deck images.
- Verify `pnpm pack` by installing its tarball into a clean consumer outside this repository. Do not rely on a sibling checkout or workspace symlink.

Exit when the packed artifact contains everything a consumer needs and runs without this repository's Vite server.

### 5. Add both PitchDecks placements

Work in `Protium.PitchDecks/apps/web-base/src/clients/blue-mountain-racing/`:

- Add a browser-only React integration and a deck section in `deck.tsx`. Follow existing section and navigation conventions.
- Lazy-load the map as its section approaches view. Reserve its height to avoid layout shifts.
- Use `variant="section"` for a compact control arrangement. Include an explicit interaction affordance and an "Explore full map" link.
- Add a client-specific `map.tsx` detail page and register it in `index.ts` as `pages.map`. Add `/map` to the existing page navigation in `nav.ts`.
- Use `variant="page"` for the complete controls, search, details, event modes, and tours. Fit the map around the deck's navigation and phone safe areas.
- Keep the existing password gate and other-client isolation intact. Do not add a parallel public Next route.
- Connect `active` to actual page activity, not just mount state. Inspect the retained-page router before choosing the activity signal.
- Synchronize the full-page selection with `?location=` through the host router. Preserve other query parameters and handle browser navigation.
- Add a static, legible map image and `/map` link for printing, loading failure, and unavailable WebGL. Keep the concept notice visible. Hide interactive UI in print output.
- Run the asset-copy step only for BMR builds. Remove stale files only within the generated BMR asset directory before building another client, so reused CI workspaces cannot ship them accidentally. Verify the existing `prepare-standalone` process includes the BMR files in its Azure upload bundle.

Exit when the section and `/map` work together in a production Next build, including navigation away and back.

### 6. Release and document the update workflow

- Use a private package registry for normal releases; confirm the available registry and scope during implementation. Use local packed tarballs for development validation.
- Add an explicit release procedure that builds, checks, packs, and then publishes an immutable version. Keep credentials in the existing secret-management system.
- Pin an exact package version in PitchDecks and commit its lockfile. Do not install a moving Git branch or depend on another local checkout in CI.
- Build and copy assets from the same installed package version. Avoid floating CDN paths that can mismatch the JavaScript.
- Document local tarball testing, release steps, updating the dependency, and rolling back both code and assets by reverting the dependency update and rebuilding.
- Publish or deploy only when separately requested. The extraction and integration can be reviewed through local production builds first.

Exit when a developer can release a map update, adopt it in PitchDecks, and revert it without copying source files between repositories.

## Verification and acceptance

Run the map repository's layout check, typecheck, tests, lint, and production build. For PitchDecks, run `pnpm lint` and `pnpm build blue-mountain-racing` from its root. Also build an unrelated client to verify the map does not enter that client's output.

Add focused lifecycle and packaging tests for the new boundaries. Use real browser checks for WebGL behavior rather than testing through mocked rendering.

- [ ] The standalone map, deck section, and `/map` use the same packaged implementation.
- [ ] Installing the packed artifact works from a clean consumer; importing it on the server causes no browser-global errors.
- [ ] No map styles, IDs, keyboard handlers, or URL changes leak into the surrounding deck or another map.
- [ ] Two instances work independently; destroying either leaves the other usable.
- [ ] Navigating away during loading is safe. Repeated navigation and Strict Mode do not accumulate resources.
- [ ] Hidden pages and offscreen maps stop animation; resuming preserves a usable view and tour state.
- [ ] Section scrolling, deliberate map interaction, keyboard focus, touch gestures, and reduced-motion preferences work on desktop and phone.
- [ ] Expected model, image, logo, and font requests succeed in the production deployment, including a non-root asset base. Verify those requests explicitly, because model fallback shapes can conceal missing files. Missing assets and WebGL failure show a useful local fallback.
- [ ] `/map` requires the existing login. Other client builds contain no BMR map or copied map assets.
- [ ] Print-to-PDF shows the static map within the existing landscape section layout, with a readable notice and link.
- [ ] Production performance and visual checks show no material regression against the baseline.

## Design rationale

Use a framework-neutral mount API with a small React adapter because the standalone app already uses direct DOM and Three.js code. This keeps one implementation without making the standalone website depend on React.

A React-first rewrite would make the PitchDecks call site familiar, but would expand the extraction into a UI rewrite. A Web Component would add a custom-element lifecycle and styling boundary that these two consumers do not need. A separately hosted script would add deployment and version coordination without simplifying resource cleanup.

Two independent design sketches compared the framework-neutral and React-first approaches. Use the framework-neutral sketch as the base, with the React sketch's single-component consumer contract, retained-page visibility handling, and print fallback. Keep shell ownership in the core to avoid maintaining two UI implementations.

An independent review confirmed that choice and added controlled selection for browser navigation, client-specific asset cleanup, and explicit asset-request verification. The final plan includes those checks.

Accept explicit consumer asset copying in exchange for self-contained, version-matched deployments. Accept an initial bundled Three.js dependency in exchange for a smaller public contract and fewer consumer configuration requirements.

The first implementation step is the startup/resource inventory and standalone baseline. Complete those before moving code or choosing package build tooling.
