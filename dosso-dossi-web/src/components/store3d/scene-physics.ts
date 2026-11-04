import type { StoreObstacle } from "./scene-environment";

type Point = { x: number; z: number };
let ready: Promise<typeof import("@dimforge/rapier3d-compat")> | undefined;

export async function createPhysics(boxes: StoreObstacle[]) {
  ready ??= import("@dimforge/rapier3d-compat")
    .then(async (R) => {
      await R.init();
      return R;
    })
    .catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
  const R = await ready;
  const world = new R.World({ x: 0, y: 0, z: 0 });
  let disposed = false;
  let position = { x: 0, y: 0.83, z: 6.2 };
  try {
    const walls = [
      ...boxes,
      { minX: -7, maxX: -6.65, minZ: -7, maxZ: 7 },
      { minX: 6.65, maxX: 7, minZ: -7, maxZ: 7 },
      { minX: -7, maxX: 7, minZ: -7, maxZ: -6.7 },
      { minX: -7, maxX: 7, minZ: 6.7, maxZ: 7 },
    ];
    for (const box of walls) {
      world.createCollider(
        R.ColliderDesc.cuboid(
          (box.maxX - box.minX) / 2,
          2.5,
          (box.maxZ - box.minZ) / 2,
        ).setTranslation(
          (box.minX + box.maxX) / 2,
          2.5,
          (box.minZ + box.maxZ) / 2,
        ),
      );
    }
    const body = world.createCollider(
      R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.83, 6.2),
    );
    const controller = world.createCharacterController(0.015);
    world.step();
    return {
      move(dx: number, dz: number) {
        if (disposed || !Number.isFinite(dx) || !Number.isFinite(dz))
          return { ...position };
        const length = Math.hypot(dx, dz);
        if (length < 0.000001) return { ...position };
        // Reduced-motion navigation still uses swept collision at every step.
        const count = Math.max(1, Math.ceil(Math.min(length, 30) / 0.3));
        const factor = Math.min(1, 30 / length);
        for (let i = 0; i < count; i++) {
          controller.computeColliderMovement(body, {
            x: (dx * factor) / count,
            y: 0,
            z: (dz * factor) / count,
          });
          const delta = controller.computedMovement();
          const current = body.translation();
          position = {
            x: current.x + delta.x,
            y: 0.83,
            z: current.z + delta.z,
          };
          body.setTranslation(position);
          world.step();
        }
        return { ...position };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        world.free();
      },
    };
  } catch (error) {
    world.free();
    throw error;
  }
}

function segmentBlocked(
  a: Point,
  b: Point,
  boxes: StoreObstacle[],
  margin: number,
) {
  return boxes.some((box) => {
    let enter = 0,
      leave = 1;
    for (const axis of ["x", "z"] as const) {
      const min = (axis === "x" ? box.minX : box.minZ) - margin;
      const max = (axis === "x" ? box.maxX : box.maxZ) + margin;
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 0.000001) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        const t0 = (min - a[axis]) / delta,
          t1 = (max - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t0, t1));
        leave = Math.min(leave, Math.max(t0, t1));
        if (enter > leave) return false;
      }
    }
    return leave >= 0 && enter <= 1;
  });
}

/** Routes respect the character radius and preserve exact safe endpoints. */
export function walkingPath(
  start: Point,
  target: Point,
  boxes: StoreObstacle[],
): Point[] {
  if (![start.x, start.z, target.x, target.z].every(Number.isFinite)) return [];
  const step = 0.45,
    x0 = -6.1,
    z0 = -4.05,
    nx = 28,
    nz = 24;
  const point = (index: number): Point => ({
    x: x0 + (index % nx) * step,
    z: z0 + Math.floor(index / nx) * step,
  });
  const blocked = (p: Point) =>
    boxes.some(
      (b) =>
        p.x >= b.minX - 0.32 &&
        p.x <= b.maxX + 0.32 &&
        p.z >= b.minZ - 0.32 &&
        p.z <= b.maxZ + 0.32,
    );
  const within = (p: Point) =>
    p.x >= x0 &&
    p.x <= x0 + (nx - 1) * step &&
    p.z >= z0 &&
    p.z <= z0 + (nz - 1) * step;
  if (
    within(target) &&
    !blocked(target) &&
    !segmentBlocked(start, target, boxes, 0.26)
  ) {
    return Math.hypot(start.x - target.x, start.z - target.z) < 0.01
      ? []
      : [{ ...target }];
  }
  const nearest = (p: Point, connect: boolean) => {
    let best = -1,
      distance = Infinity;
    for (let i = 0; i < nx * nz; i++) {
      const q = point(i),
        d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2;
      if (
        d >= distance ||
        blocked(q) ||
        (connect && segmentBlocked(p, q, boxes, 0.26))
      )
        continue;
      best = i;
      distance = d;
    }
    return best;
  };
  const begin = nearest(start, true),
    end = nearest(target, false);
  if (begin < 0 || end < 0) return [];
  const queue = [begin],
    parents = new Map<number, number>([[begin, -1]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const at = queue[cursor];
    if (at === end) break;
    const x = at % nx,
      z = Math.floor(at / nx);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx,
        zz = z + dz,
        next = zz * nx + xx;
      if (
        xx < 0 ||
        xx >= nx ||
        zz < 0 ||
        zz >= nz ||
        parents.has(next) ||
        blocked(point(next))
      )
        continue;
      parents.set(next, at);
      queue.push(next);
    }
  }
  if (!parents.has(end)) return [];
  const raw: Point[] = [];
  for (let at = end; at !== -1; at = parents.get(at)!) raw.unshift(point(at));
  if (
    within(target) &&
    !blocked(target) &&
    !segmentBlocked(raw[raw.length - 1], target, boxes, 0.3)
  )
    raw.push({ ...target });
  // Remove unnecessary grid stops, without cutting through furniture corners.
  const path: Point[] = [];
  let previous = start,
    index = 0;
  while (index < raw.length) {
    let furthest = index;
    for (let next = index + 1; next < raw.length; next++) {
      if (!segmentBlocked(previous, raw[next], boxes, path.length ? 0.3 : 0.26))
        furthest = next;
    }
    const next = raw[furthest];
    if (Math.hypot(previous.x - next.x, previous.z - next.z) > 0.01)
      path.push(next);
    previous = next;
    index = furthest + 1;
  }
  return path;
}
