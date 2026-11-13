// How a race car laps the circuit: how fast it can go at each point, the line
// it takes through the bends, and where the turns are. It's worked out from
// the circuit's path alone, so it follows the layout when the layout changes.
// The figures are an illustration of a fast single-seater, not a prediction.

import type { TrackLocation } from "./locations.ts";
import { layout } from "./locations.ts";
import { GRID_SIZE } from "./race-grid.ts";
import type { Route } from "./route.ts";
import { pointAt, routeOf } from "./route.ts";

/** Spacing of the points the lap is worked out at, in metres. */
const STEP = 2;
/** The speed the car's acceleration tails off towards, in metres per second: about 330 km/h. */
const TERMINAL_SPEED = 92;
/** The slowest a car takes any bend, in metres per second: about 80 km/h. */
const MIN_SPEED = 22;
/** Sideways grip in the bends, in metres per second squared: about 3 g. */
const CORNERING = 30;
/** Acceleration from rest, which falls away as the car nears its terminal speed. */
const ACCELERATION = 13;
/** Braking, in metres per second squared: about 3.5 g. */
const BRAKING = 34;

/** A bend tighter than this radius counts as a turn, in metres. */
const TURN_RADIUS = 320;
/** Bends the same way that are closer together than this are one turn, in metres. */
const TURN_GAP = 30;
/** A turn has to change the car's heading by at least this much, in radians. */
const MIN_TURN_SWEEP = 0.2;
/** A turn is announced this far before the car reaches it, in metres. */
const TURN_APPROACH = 90;

/** A bend of this radius or tighter pulls the racing line fully to its inside, in metres. */
const LINE_RADIUS = 70;
/** How far along the track a bend's apex and its approach are felt, in metres. */
const APEX_REACH = 18;
const APPROACH_REACH = 75;
/** How much of the gap between the two is used. */
const LINE_GAIN = 1.9;
/** The racing line keeps this far inside the track's edge, in metres. */
const EDGE_MARGIN = 2.3;
/** The parked grid ends this far before the line, and the cars pass between its two columns. */
const GRID_SPACING = 10;
const GRID_CLEARANCE = 60;

export interface Turn {
  readonly number: number;
  /** Where the bend starts and ends, in metres along the circuit. */
  readonly from: number;
  readonly to: number;
}

export interface Race {
  /** The circuit's length, in metres. */
  readonly length: number;
  /** How long one lap takes, in seconds. */
  readonly lapTime: number;
  /** Where the start-finish line is, in metres along the circuit. */
  readonly line: number;
  readonly turns: readonly Turn[];
  /**
   * How far a car has gone `seconds` into the race, in metres along the
   * circuit. It keeps counting up lap after lap, and time 0 is at the start
   * of the circuit's path.
   */
  distanceAt(seconds: number): number;
  /** When a car reaches `distance`, the reverse of `distanceAt`. */
  timeAt(distance: number): number;
  /** The car's speed at a point along the circuit, in metres per second. */
  speedAt(distance: number): number;
  /**
   * How far from the middle of the track the racing line runs, in metres
   * towards the side `(-dirZ, dirX)`. `bias` moves one car off the line, so
   * that cars running together don't follow each other exactly.
   */
  sidewaysAt(distance: number, bias?: number): number;
  /** The turn the car is in or about to reach, if any. */
  turnAt(distance: number): Turn | null;
}

/** Blurs values around a closed loop, weighting neighbours by a bell curve `reach` points wide. */
function smoothLoop(values: Float64Array, reach: number): Float64Array {
  const count = values.length;
  const span = Math.ceil(reach * 3);
  const weights = Array.from({ length: span * 2 + 1 }, (_, index) =>
    Math.exp(-0.5 * ((index - span) / reach) ** 2),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const smoothed = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    let sum = 0;
    for (let offset = -span; offset <= span; offset += 1) {
      sum += values[(((index + offset) % count) + count) % count] * weights[offset + span];
    }
    smoothed[index] = sum / total;
  }
  return smoothed;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Works out the lap of a closed route `width` metres wide, with its line at `line` metres. */
export function raceAlong(route: Route, width: number, line: number): Race {
  const count = Math.round(route.length / STEP);
  const step = route.length / count;
  const points = Array.from({ length: count }, (_, index) => pointAt(route, index * step));

  // How sharply the track turns at each point, positive towards `(-dirZ, dirX)`.
  const bend = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const before = points[(index - 1 + count) % count];
    const after = points[(index + 1) % count];
    const here = points[index];
    bend[index] =
      ((after.dirX - before.dirX) * -here.dirZ + (after.dirZ - before.dirZ) * here.dirX) /
      (2 * step);
  }
  const curvature = smoothLoop(bend, 6 / step);

  // The speed the bends allow, then what braking into them and accelerating
  // out of them leaves. Twice round, so the end of the lap meets its start.
  const speed = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const grip = Math.sqrt(CORNERING / Math.max(Math.abs(curvature[index]), 1e-6));
    speed[index] = clamp(grip, MIN_SPEED, TERMINAL_SPEED * 0.97);
  }
  for (let pass = 0; pass < 2 * count; pass += 1) {
    const index = pass % count;
    const next = (index + 1) % count;
    const pull = ACCELERATION * (1 - (speed[index] / TERMINAL_SPEED) ** 2);
    speed[next] = Math.min(speed[next], Math.sqrt(speed[index] ** 2 + 2 * pull * step));
  }
  for (let pass = 2 * count; pass > 0; pass -= 1) {
    const index = pass % count;
    const previous = (index - 1 + count) % count;
    speed[previous] = Math.min(speed[previous], Math.sqrt(speed[index] ** 2 + 2 * BRAKING * step));
  }

  // When the car passes each point, with one more entry for the end of the lap.
  const time = new Float64Array(count + 1);
  for (let index = 0; index < count; index += 1) {
    time[index + 1] = time[index] + (2 * step) / (speed[index] + speed[(index + 1) % count]);
  }
  const lapTime = time[count];

  // The racing line swings wide before a bend and cuts to its inside at the
  // apex: the bend felt over a short stretch, less the bend felt over a long one.
  const pull = curvature.map((value) => clamp(value * LINE_RADIUS, -1, 1));
  const apex = smoothLoop(pull, APEX_REACH / step);
  const approach = smoothLoop(pull, APPROACH_REACH / step);
  const reach = width / 2 - EDGE_MARGIN;
  // Cars on the grid stand either side of the middle, so the line stays between them there.
  const gridLength = GRID_SIZE * GRID_SPACING + GRID_CLEARANCE;
  const clear = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    const beforeLine = (((line - index * step) % route.length) + route.length) % route.length;
    const pastLine = route.length - beforeLine;
    clear[index] = beforeLine < gridLength || pastLine < GRID_CLEARANCE ? 0 : 1;
  }
  const open = smoothLoop(clear, 25 / step);
  const sideways = smoothLoop(
    apex.map((value, index) => clamp((value - approach[index]) * LINE_GAIN, -1, 1) * reach),
    8 / step,
  ).map((value, index) => value * open[index]);

  const turns = findTurns(curvature, step, route.length, line);

  /** A value between the stored points, `distance` metres round the loop. */
  const between = (values: Float64Array, distance: number): number => {
    const along = (((distance % route.length) + route.length) % route.length) / step;
    const index = Math.min(Math.floor(along), count - 1);
    const next = (index + 1) % count;
    return values[index] + (values[next] - values[index]) * (along - index);
  };

  return {
    length: route.length,
    lapTime,
    line,
    turns,
    distanceAt(seconds) {
      const laps = Math.floor(seconds / lapTime);
      const within = seconds - laps * lapTime;
      let low = 0;
      let high = count;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (time[middle] <= within) {
          low = middle;
        } else {
          high = middle;
        }
      }
      const share = (within - time[low]) / (time[low + 1] - time[low]);
      return laps * route.length + (low + share) * step;
    },
    timeAt(distance) {
      const laps = Math.floor(distance / route.length);
      const along = (distance - laps * route.length) / step;
      const index = Math.min(Math.floor(along), count - 1);
      return laps * lapTime + time[index] + (time[index + 1] - time[index]) * (along - index);
    },
    speedAt: (distance) => between(speed, distance),
    sidewaysAt: (distance, bias = 0) =>
      clamp(between(sideways, distance) + bias * between(open, distance), -reach, reach),
    turnAt(distance) {
      const along = ((distance % route.length) + route.length) % route.length;
      for (const turn of turns) {
        const sinceApproach =
          (((along - (turn.from - TURN_APPROACH)) % route.length) + route.length) % route.length;
        if (sinceApproach <= turn.to - turn.from + TURN_APPROACH) {
          return turn;
        }
      }
      return null;
    },
  };
}

/** The bends that count as turns, numbered from the start-finish line. */
function findTurns(curvature: Float64Array, step: number, length: number, line: number): Turn[] {
  const count = curvature.length;
  const first = Math.round(line / step) % count;
  const found: { from: number; to: number; side: number; sweep: number }[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const value = curvature[(first + offset) % count];
    if (Math.abs(value) < 1 / TURN_RADIUS) {
      continue;
    }
    const side = Math.sign(value);
    const at = offset * step;
    const last = found.at(-1);
    if (last && last.side === side && at - last.to <= TURN_GAP) {
      last.to = at;
      last.sweep += Math.abs(value) * step;
    } else {
      found.push({ from: at, to: at, side, sweep: Math.abs(value) * step });
    }
  }
  return found
    .filter((turn) => turn.sweep >= MIN_TURN_SWEEP)
    .map((turn, index) => ({
      number: index + 1,
      from: (line + turn.from) % length,
      to: ((line + turn.from) % length) + (turn.to - turn.from),
    }));
}

let circuit: Race | null = null;

/** The lap of the circuit in the layout, worked out once. */
export function circuitRace(): Race {
  if (circuit) {
    return circuit;
  }
  const track = layout.locations.find((location) => location.id === "circuit") as TrackLocation;
  const route = routeOf("circuit");
  const [lineX, lineZ] = track.startFinish ?? [route.samples[0].x, route.samples[0].z];
  let line = route.samples[0];
  for (const sample of route.samples) {
    if (
      Math.hypot(sample.x - lineX, sample.z - lineZ) < Math.hypot(line.x - lineX, line.z - lineZ)
    ) {
      line = sample;
    }
  }
  circuit = raceAlong(route, track.width, line.distance);
  return circuit;
}
