import type { ActionAudience, Layout, Location, LocationAction } from "./locations.ts";
import { layout } from "./locations.ts";

/** A heading in the details card and the actions listed under it. */
export interface ActionGroup {
  readonly audience: ActionAudience;
  readonly heading: string;
  readonly actions: readonly LocationAction[];
}

const HEADINGS: Record<ActionAudience, string> = {
  visitors: "Fans and visitors",
  business: "Business and partners",
};

/**
 * The actions a location links to, grouped by audience, fans first. With an
 * event mode, actions tied to another mode are left out. On the whole site
 * (`null`) every action shows.
 */
export function locationActions(
  location: Location,
  mode: string | null,
  actions: Layout["actions"] = layout.actions,
): readonly ActionGroup[] {
  const shown = (location.links ?? [])
    .map((id) => actions[id])
    .filter((action): action is LocationAction => action !== undefined)
    .filter((action) => mode === null || action.event === undefined || action.event === mode);
  return (Object.keys(HEADINGS) as ActionAudience[])
    .map((audience) => ({
      audience,
      heading: HEADINGS[audience],
      actions: shown.filter((action) => action.audience === audience),
    }))
    .filter((group) => group.actions.length > 0);
}
