import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BmrMap } from "../src/react/index.ts";
export function mountStrict(host) {
  const root = createRoot(host);
  root.render(
    createElement(StrictMode, null, createElement(BmrMap, { variant: "page", assetBaseUrl: "/" })),
  );
  return () => root.unmount();
}
