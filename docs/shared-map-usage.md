# Use and release the shared BMR map

## Build and validate a local package

Run these commands in the map repository:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm build:package
pnpm check:package
node tools/check-map-browser.mjs
pnpm pack --pack-destination /tmp
```

`pnpm build` creates the standalone site in `dist/`. `pnpm build:package` replaces that directory with the library. Run the build for the artifact you intend to inspect last. Do not publish standalone website output as a package.

Install the tarball into a clean consumer outside this repository. Do not use a workspace link. Copy the runtime assets explicitly:

```sh
pnpm add /absolute/path/to/protium-bmr-map-0.1.0.tgz
pnpm exec bmr-map-copy-assets public
```

The copy command replaces `public/maps/bmr/0.1.0/`, so files from an older build of that version cannot remain. Set `assetBaseUrl` to that URL, including any host base path. Import `@protium/bmr-map/style.css` once. Both the browser entry and optional React entry support server import. The React entry requires its optional React peer. Mounting requires a browser with WebGL.

## Mount the map

```ts
import { mountMap } from "@protium/bmr-map";
import "@protium/bmr-map/style.css";

const map = mountMap(host, {
  variant: "page",
  assetBaseUrl: "/maps/bmr/0.1.0/",
  initialLocationId: "lake",
  onLocationChange: id => updateHostAddress(id),
});
await map.ready;
map.setActive(false);
map.selectLocation("grandstand-a");
map.destroy();
```

Give `host` an explicit height. The map sizes and switches compact layout from its container, including when that container sits below other content. Selection accepts packaged location IDs; unknown IDs clear selection. Programmatic selection does not call `onLocationChange`. The callback reports visitor changes only.

The handle is available during startup. Destroying it is idempotent. Late resources are disposed after their load or construction finishes. The `ready` promise rejects on startup failure and resolves harmlessly after destruction. Catch startup rejection even if the local error presentation is sufficient.

`active` combines with intersection, document visibility and nonzero container size to stop the render loop and controls. Tours use a paused clock. Section maps require an explicit interaction click and provide a stop-interacting button so surrounding page scrolling remains available.

## Use React

```tsx
import { BmrMap } from "@protium/bmr-map/react";

<div style={{ height: 560 }}>
  <BmrMap variant="page" assetBaseUrl="/maps/bmr/0.1.0/"
    active={pageIsActive} locationId={locationFromUrl}
    onLocationChange={updateHostAddress} />
</div>
```

Import through the host's browser-only boundary when its framework requires one. React 19.3 is the tested peer. Changing `variant` or `assetBaseUrl` remounts the map. Changing activity, selection or callback does not. React Strict Mode cleans up the first mount before starting another.

## Integrate and validate PitchDecks

The PitchDecks repository was unavailable during package extraction. Complete the consumer work under `apps/web-base/src/clients/blue-mountain-racing/` after this package is available there:

- Install a packed tarball for local validation, then pin the released package version and commit the PitchDecks lockfile.
- Add the lazy browser-only `variant="section"` placement and its "Explore full map" link.
- Add the `variant="page"` detail page, register `pages.map`, and add `/map` to the client navigation behind the existing password gate.
- Connect `active` to retained-page and section visibility. Synchronize `?location=` on the page without losing other query parameters.
- Use `dist/assets/map-preview.png` for print, loading failure, and unavailable WebGL. Keep the concept notice visible.
- Copy assets only for BMR builds. Clear only `public/maps/bmr/`, and confirm that `prepare-standalone` includes the copied files.

Run these commands from PitchDecks after the integration:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm build blue-mountain-racing
pnpm --filter web-base prepare-standalone
pnpm build demo
```

Also build an unrelated client and confirm that its output contains no BMR map code or assets. Test the logged-out `/map` gate, both placements after login, navigation away and back, browser history, print preview, and unavailable WebGL. Static assets remain publicly addressable even though `/map` requires login, like other deck images.

## Release and roll back

This repository does not identify a private registry or confirm an authorized `@protium` scope. Confirm both in the PitchDecks environment before a release. Keep credentials in the existing secret manager, not this repository. Nothing in the extraction publishes a package or deploys a website.

For an authorized release:

1. Confirm the package name and configure the private registry through the secret-management process.
2. Set a new immutable version and update the map preview if the layout changed.
3. Run the map checks and package build, then pack and validate the artifact in a clean consumer.
4. Publish that exact artifact to the confirmed registry only when publishing is requested.
5. Replace the development tarball dependency in PitchDecks with that exact registry version and commit its lockfile.
6. Update the versioned asset URL in the PitchDecks map integration with the same version. Run both client builds and check actual asset requests before a separately authorized deployment.

To roll back, revert the dependency, lockfile and matching asset URL together, then rebuild. The consumer copies runtime files from its installed package, so the old code and assets return together.
