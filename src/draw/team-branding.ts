import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  Mesh,
  MeshLambertMaterial,
  SRGBColorSpace,
} from "three";

/** A team's colours, simplified to a panel, a stripe and its lettering. */
interface Team {
  /** The logo's file name in `src/assets/teams/`, without its extension. */
  readonly slug: string;
  readonly name: string;
  readonly panel: string;
  readonly stripe: string;
  readonly text: string;
}

/**
 * The eleven teams on the 2026 grid, in the order of the 2025 constructors'
 * championship, with Cadillac joining last. A team's panel shows its logo
 * from `src/assets/teams/` where there is one, and its name otherwise.
 */
export const TEAMS: readonly Team[] = [
  { slug: "mclaren", name: "McLAREN", panel: "#FF8000", stripe: "#1C1C1C", text: "#1C1C1C" },
  { slug: "mercedes", name: "MERCEDES", panel: "#141A1F", stripe: "#00D7B6", text: "#E6E9EB" },
  {
    slug: "red-bull-racing",
    name: "RED BULL RACING",
    panel: "#1B2A55",
    stripe: "#E21B4D",
    text: "#FFCC00",
  },
  { slug: "ferrari", name: "FERRARI", panel: "#D40000", stripe: "#FFE800", text: "#FFFFFF" },
  { slug: "williams", name: "WILLIAMS", panel: "#041E42", stripe: "#00A0DE", text: "#FFFFFF" },
  {
    slug: "racing-bulls",
    name: "RACING BULLS",
    panel: "#F4F5F7",
    stripe: "#E30613",
    text: "#1534CC",
  },
  {
    slug: "aston-martin",
    name: "ASTON MARTIN",
    panel: "#00594F",
    stripe: "#CEDC00",
    text: "#FFFFFF",
  },
  { slug: "haas", name: "HAAS", panel: "#E9EAEC", stripe: "#E10600", text: "#1C1C1C" },
  { slug: "audi", name: "AUDI", panel: "#2A2C2E", stripe: "#F20F2E", text: "#FFFFFF" },
  { slug: "alpine", name: "ALPINE", panel: "#0078C1", stripe: "#FF87BC", text: "#FFFFFF" },
  { slug: "cadillac", name: "CADILLAC", panel: "#111111", stripe: "#B8BCC0", text: "#FFFFFF" },
];

/** Logo files by slug. Only the files that exist are bundled, so none is fetched in vain. */
const LOGO_URLS = new Map(
  Object.entries(
    import.meta.glob<string>("../assets/teams/*.{svg,png,webp}", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [path.replace(/^.*\/|\.[^.]+$/g, ""), url]),
);

/** The colour a team's transporters are painted on race day. */
export function transporterColour(team: Team): Color {
  // A white panel would leave the trailer looking unbranded, so it takes the lettering colour.
  const light = new Color(team.panel).getHSL({ h: 0, s: 0, l: 0 }).l > 0.8;
  return new Color(light ? team.text : team.panel);
}

/** Where a team's unit stands: the centre of its footprint, its north wall and its roof. */
export interface TeamUnit {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly ground: number;
}

const ROOF_CELL = { width: 512, height: 192 };
const FASCIA_CELL = { width: 1024, height: 64 };
const ROOF_COLUMNS = 4;
const FASCIA_COLUMNS = 2;
const ATLAS_WIDTH = 2048;
const ROOF_ROWS = Math.ceil(TEAMS.length / ROOF_COLUMNS);
const FASCIA_TOP = ROOF_ROWS * ROOF_CELL.height;
const ATLAS_HEIGHT = 1024;

/** The unit model's roof stops just short of 5 m and sits a little north of centre. */
const ROOF_HEIGHT = 5.02;
const ROOF_OFFSET = -0.08;
const ROOF_SHARE = { across: 0.9, along: 0.7 };
const FASCIA = { height: 1.5, top: 3.9, inset: 0.06 };

const LOGO_BACKGROUND = "#F7F8F9";

interface Cell {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function roofCell(index: number): Cell {
  return {
    x: (index % ROOF_COLUMNS) * ROOF_CELL.width,
    y: Math.floor(index / ROOF_COLUMNS) * ROOF_CELL.height,
    ...ROOF_CELL,
  };
}

function fasciaCell(index: number): Cell {
  return {
    x: (index % FASCIA_COLUMNS) * FASCIA_CELL.width,
    y: FASCIA_TOP + Math.floor(index / FASCIA_COLUMNS) * FASCIA_CELL.height,
    ...FASCIA_CELL,
  };
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
): void {
  let fontSize = size;
  context.font = `500 ${fontSize}px Roboto, "Helvetica Neue", Arial, sans-serif`;
  while (context.measureText(text).width > maxWidth && fontSize > 8) {
    fontSize -= 2;
    context.font = `500 ${fontSize}px Roboto, "Helvetica Neue", Arial, sans-serif`;
  }
}

/** Draws a logo as large as fits in the box, keeping its proportions. */
function paintLogo(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
): void {
  // An SVG without a width and height reports no size, so a square is assumed.
  const width = logo.naturalWidth || 1;
  const height = logo.naturalHeight || 1;
  const scale = Math.min(box.width / width, box.height / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  context.drawImage(
    logo,
    box.x + (box.width - drawnWidth) / 2,
    box.y + (box.height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function paintPanel(
  context: CanvasRenderingContext2D,
  team: Team,
  cell: Cell,
  logo: HTMLImageElement | undefined,
): void {
  const { x, y, width, height } = cell;
  const stripe = Math.max(4, Math.round(height * 0.14));
  const bar = Math.round(width * 0.04);
  // Logos are drawn for light backgrounds, and several vanish on their own
  // team colour, so a logo goes on white with the team colours framing it.
  context.fillStyle = logo ? LOGO_BACKGROUND : team.panel;
  context.fillRect(x, y, width, height);
  context.fillStyle = team.stripe;
  context.fillRect(x, y + height - stripe, width, stripe);
  context.fillStyle = logo ? team.panel : team.stripe;
  context.fillRect(x, y, bar, height - stripe);
  if (logo) {
    const pad = (height - stripe) * 0.12;
    const left = x + width * 0.04;
    paintLogo(context, logo, {
      x: left + pad,
      y: y + pad,
      width: x + width - left - 2 * pad,
      height: height - stripe - 2 * pad,
    });
    return;
  }
  context.fillStyle = team.text;
  context.textAlign = "center";
  context.textBaseline = "middle";
  fitText(context, team.name, width * 0.84, Math.round((height - stripe) * 0.62));
  context.fillText(team.name, x + width * 0.52, y + (height - stripe) / 2 + 2);
}

function paintAtlas(canvas: HTMLCanvasElement, logos: ReadonlyMap<string, HTMLImageElement>): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The team branding could not be drawn");
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const [index, team] of TEAMS.entries()) {
    const logo = logos.get(team.slug);
    paintPanel(context, team, roofCell(index), logo);
    paintPanel(context, team, fasciaCell(index), logo);
  }
}

/** Adds one flat quad, given its four corners in order and the atlas cell it shows. */
function addQuad(
  positions: number[],
  uvs: number[],
  indices: number[],
  corners: readonly (readonly [number, number, number])[],
  cell: Cell,
): void {
  const first = positions.length / 3;
  const u0 = cell.x / ATLAS_WIDTH;
  const u1 = (cell.x + cell.width) / ATLAS_WIDTH;
  // Canvas rows run down and texture rows run up; flipY puts the top row at v = 1.
  const v0 = 1 - (cell.y + cell.height) / ATLAS_HEIGHT;
  const v1 = 1 - cell.y / ATLAS_HEIGHT;
  for (const corner of corners) positions.push(...corner);
  uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
  indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

/**
 * Team colours and logos for race day: a panel across each unit's roof, for
 * the aerial view, and a fascia along its north wall, facing the service aisle.
 */
export function createTeamBranding(units: readonly TeamUnit[]): Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const logos = new Map<string, HTMLImageElement>();
  paintAtlas(canvas, logos);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  texture.flipY = true;
  // The lettering is redrawn once Roboto has loaded, in case it hadn't yet.
  document.fonts
    ?.load("500 48px Roboto")
    .then(() => {
      paintAtlas(canvas, logos);
      texture.needsUpdate = true;
    })
    .catch(() => undefined);
  // Each logo replaces its team's name as it arrives.
  for (const team of TEAMS) {
    const url = LOGO_URLS.get(team.slug);
    if (!url) continue;
    const logo = new Image();
    logo.decoding = "async";
    logo.addEventListener("load", () => {
      logos.set(team.slug, logo);
      paintAtlas(canvas, logos);
      texture.needsUpdate = true;
    });
    logo.src = url;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [index, unit] of units.slice(0, TEAMS.length).entries()) {
    const { x, z, width, depth, ground } = unit;
    // Roof panel, read from the south, the way the units face.
    const halfAcross = (width * ROOF_SHARE.across) / 2;
    const halfAlong = (depth * ROOF_SHARE.along) / 2;
    const roofZ = z + depth * ROOF_OFFSET;
    const roofY = ground + ROOF_HEIGHT;
    addQuad(
      positions,
      uvs,
      indices,
      [
        [x - halfAcross, roofY, roofZ + halfAlong],
        [x + halfAcross, roofY, roofZ + halfAlong],
        [x + halfAcross, roofY, roofZ - halfAlong],
        [x - halfAcross, roofY, roofZ - halfAlong],
      ],
      roofCell(index),
    );
    // Fascia on the north wall, read from the aisle, so left is east.
    const wallZ = z - depth / 2 - FASCIA.inset;
    const top = ground + FASCIA.top;
    const bottom = top - FASCIA.height;
    const half = (width * 0.92) / 2;
    addQuad(
      positions,
      uvs,
      indices,
      [
        [x + half, bottom, wallZ],
        [x - half, bottom, wallZ],
        [x - half, top, wallZ],
        [x + half, top, wallZ],
      ],
      fasciaCell(index),
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new MeshLambertMaterial({
    map: texture,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "team-branding";
  mesh.receiveShadow = true;
  return mesh;
}
