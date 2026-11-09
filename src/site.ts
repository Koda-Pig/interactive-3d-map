// World units are metres. X runs east, Y up, Z south, with the origin at the
// centre of the site.

/** Side of a square with the site's published 600 hectares. */
export const SITE_SIZE = 2450;

/** Half the width of the area the camera can centre on. */
export const MAP_HALF_SIZE = SITE_SIZE / 2 + 800;

/** Half the width of the ground mesh, including the surrounding farmland. */
export const GROUND_HALF_SIZE = 12000;
