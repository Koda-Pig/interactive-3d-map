/** Finds an element the page's HTML is expected to contain. */
export function requirePart<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`The page is missing ${selector}`);
  }
  return element;
}
