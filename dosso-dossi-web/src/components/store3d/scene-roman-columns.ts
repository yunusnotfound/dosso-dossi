import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { StoreObstacle } from "./scene-environment";

type Position = [number, number, number];
type Finish = "quartz" | "bronze";
type Profile = readonly (readonly [number, number])[];

const TAU = Math.PI * 2;
const TEXTURE_METRES = 2.4;
const COLUMN_CENTRES = [
  [-0.92, -0.92],
  [0.92, -0.92],
  [-0.92, 0.92],
  [0.92, 0.92],
] as const;

/** Four carved Ionic columns, modelled around the existing orange display drum. */
export function createRomanColumns(
  parent: THREE.Group,
  materials: {
    quartz: THREE.MeshStandardMaterial;
    bronze: THREE.MeshStandardMaterial;
  },
) {
  const root = new THREE.Group();
  root.name = "Roman quartz colonnade — carved Ionic thermos display";
  parent.add(root);
  const pieces: Record<Finish, THREE.BufferGeometry[]> = { quartz: [], bronze: [] };
  const columnPieces: THREE.BufferGeometry[] = [];
  const owned: THREE.BufferGeometry[] = [];
  let disposed = false;

  const planarUv = (geometry: THREE.BufferGeometry) => {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      const nx = Math.abs(normal.getX(i));
      const ny = Math.abs(normal.getY(i));
      const nz = Math.abs(normal.getZ(i));
      uv[i * 2] = (nx > nz && nx > ny ? position.getZ(i) : position.getX(i)) / TEXTURE_METRES;
      uv[i * 2 + 1] = (ny > nx && ny > nz ? position.getZ(i) : position.getY(i)) / TEXTURE_METRES;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geometry;
  };

  const addColumn = (
    geometry: THREE.BufferGeometry,
    position: Position = [0, 0, 0],
    rotation: THREE.Euler = new THREE.Euler(),
    scale: Position = [1, 1, 1],
    preserveUv = false,
  ) => {
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(rotation),
      new THREE.Vector3(...scale),
    ));
    if (!preserveUv) planarUv(geometry);
    columnPieces.push(geometry);
  };

  const lathe = (profile: Profile, segments = 48) => {
    const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
    const uv = geometry.getAttribute("uv");
    const profileLength = [0];
    for (let j = 1; j < profile.length; j++) {
      profileLength.push(profileLength[j - 1] + Math.hypot(
        profile[j][0] - profile[j - 1][0],
        profile[j][1] - profile[j - 1][1],
      ));
    }
    const radius = Math.max(...profile.map(([r]) => r));
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j < profile.length; j++) {
        uv.setXY(i * profile.length + j,
          (i / segments) * TAU * radius / TEXTURE_METRES,
          (profile[0][1] + profileLength[j]) / TEXTURE_METRES,
        );
      }
    }
    return geometry;
  };

  const molding = (profile: Profile, segments = 40) => addColumn(lathe(profile, segments), undefined, undefined, undefined, true);
  const beveledSlab = (width: number, depth: number, height: number, y: number, bevel: number) => {
    addColumn(new RoundedBoxGeometry(width, height, depth, 2, bevel), [0, y, 0]);
  };

  // The grooves are carved into one continuous radial surface, with smooth
  // termination at each end. They are not separate rods glued to a cylinder.
  const flutedShaft = (bottom: number, top: number, radius: number, taper: number, short = false) => {
    const angularSegments = 24 * 8;
    const steps = short ? 6 : 20;
    const heights = [0, 0.004, 0.009, 0.017, 0.027];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (t > 0.027 && t < 0.973) heights.push(t);
    }
    heights.push(0.973, 0.983, 0.991, 0.996, 1);
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const length = top - bottom;
    for (const t of heights) {
      const y = bottom + t * length;
      const end = Math.min(t * length / 0.055, (1 - t) * length / 0.055, 1);
      const fluteFade = Math.sin(Math.max(end, 0) * Math.PI * 0.5);
      const entasis = Math.sin(t * Math.PI) * (short ? 0.0012 : 0.0036);
      const outerRadius = radius - taper * t + entasis;
      for (let j = 0; j <= angularSegments; j++) {
        const angle = j / angularSegments * TAU;
        const phase = Math.abs(((j / 8 + 0.5) % 1) * 2 - 1);
        const groove = phase < 0.84 ? Math.cos(phase / 0.84 * Math.PI * 0.5) ** 1.6 : 0;
        const r = outerRadius - 0.0118 * groove * fluteFade;
        vertices.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
        uvs.push(angle * radius / TEXTURE_METRES, y / TEXTURE_METRES);
      }
    }
    for (let row = 0; row < heights.length - 1; row++) {
      for (let j = 0; j < angularSegments; j++) {
        const a = row * (angularSegments + 1) + j;
        const b = a + angularSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // Close the UV seam with identical smooth normals.
    const normals = geometry.getAttribute("normal");
    const normal = new THREE.Vector3();
    for (let row = 0; row < heights.length; row++) {
      const a = row * (angularSegments + 1);
      const b = a + angularSegments;
      normal.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
      normals.setXYZ(a, normal.x, normal.y, normal.z);
      normals.setXYZ(b, normal.x, normal.y, normal.z);
    }
    addColumn(geometry, undefined, undefined, undefined, true);
  };

  // Stepped plinth, torus and scotia: the same stone continues below the bar.
  beveledSlab(0.44, 0.44, 0.085, 0.049, 0.008);
  beveledSlab(0.38, 0.38, 0.061, 0.121, 0.006);
  beveledSlab(0.332, 0.332, 0.039, 0.17, 0.005);
  molding([
    [0.155, 0.188], [0.175, 0.188], [0.182, 0.197], [0.184, 0.208],
    [0.181, 0.219], [0.169, 0.231], [0.158, 0.238], [0.156, 0.25],
    [0.163, 0.259], [0.166, 0.27], [0.16, 0.281], [0.149, 0.288],
  ]);
  flutedShaft(0.276, 0.713, 0.15, 0.002, true);
  molding([
    [0.147, 0.697], [0.158, 0.706], [0.163, 0.717], [0.164, 0.728],
    [0.173, 0.737], [0.184, 0.743], [0.188, 0.754], [0.185, 0.765],
  ]);

  // These small lobes intersect the existing circular quartz tabletop instead
  // of leaving the columns visually detached from the orange display.
  molding([
    [0, 0.751], [0.208, 0.751], [0.221, 0.759], [0.227, 0.771],
    [0.227, 0.831], [0.222, 0.844], [0.211, 0.85], [0, 0.85],
  ], 64);
  molding([
    [0.155, 0.848], [0.19, 0.848], [0.196, 0.856], [0.197, 0.868],
    [0.19, 0.88], [0.172, 0.891], [0.166, 0.902], [0.171, 0.914],
    [0.18, 0.925], [0.181, 0.94], [0.172, 0.955], [0.159, 0.964],
    [0.156, 0.974], [0.162, 0.983], [0.163, 0.996], [0.153, 1.009],
  ]);
  flutedShaft(0.998, 4.025, 0.15, 0.013);

  // Necking and the carved echinus carry the scrolls above the fluted shaft.
  molding([
    [0.137, 4.008], [0.146, 4.013], [0.15, 4.023], [0.151, 4.036],
    [0.147, 4.045], [0.145, 4.055], [0.154, 4.065], [0.171, 4.076],
    [0.181, 4.09], [0.183, 4.105], [0.178, 4.121], [0.167, 4.13],
    [0.165, 4.144],
  ]);
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * TAU;
    addColumn(new THREE.SphereGeometry(1, 8, 6),
      [Math.sin(angle) * 0.172, 4.102, Math.cos(angle) * 0.172],
      new THREE.Euler(0, angle, 0), [0.013, 0.026, 0.008]);
    const dartAngle = angle + Math.PI / 16;
    addColumn(new THREE.ConeGeometry(0.007, 0.034, 6),
      [Math.sin(dartAngle) * 0.176, 4.104, Math.cos(dartAngle) * 0.176],
      new THREE.Euler(0, dartAngle, Math.PI));
  }

  addColumn(new RoundedBoxGeometry(0.365, 0.135, 0.312, 2, 0.045), [0, 4.214, 0]);
  // A pair of true barrel-shaped volutes, each sculpted on both visible faces.
  // Their continuous spiral ridges have smooth tubular sections, not box steps.
  for (const side of [-1, 1]) {
    const centreX = side * 0.162;
    const centreY = 4.228;
    const bolster = lathe([
      [0, -0.16], [0.079, -0.16], [0.09, -0.15], [0.094, -0.13],
      [0.083, -0.075], [0.077, 0], [0.083, 0.075], [0.094, 0.13],
      [0.09, 0.15], [0.079, 0.16], [0, 0.16],
    ], 40);
    addColumn(bolster, [centreX, centreY, 0], new THREE.Euler(Math.PI / 2, 0, 0), undefined, true);
    for (const face of [-1, 1]) {
      const z = face * 0.162;
      const disk = lathe([
        [0, 0], [0.078, 0], [0.091, 0.004], [0.096, 0.01],
        [0.097, 0.018], [0.093, 0.026], [0.08, 0.03], [0, 0.03],
      ], 40);
      addColumn(disk, [centreX, centreY, z], new THREE.Euler(face * Math.PI / 2, 0, 0));
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 64;
        const angle = t * TAU * 1.47 + Math.PI * 0.37;
        const r = 0.006 + 0.076 * t;
        points.push(new THREE.Vector3(
          centreX + side * Math.cos(angle) * r,
          centreY + Math.sin(angle) * r,
          face * (0.195 + 0.002 * (1 - t)),
        ));
      }
      addColumn(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.0105, 6, false));
      addColumn(new THREE.SphereGeometry(0.014, 12, 8), [points[0].x, points[0].y, face * 0.197], undefined, [1, 1, 0.65]);
    }
    // Three slim rings articulate the bolster on the side of the capital.
    for (const z of [-0.037, 0, 0.037]) {
      addColumn(new THREE.TorusGeometry(0.0795, 0.005, 6, 32), [centreX, centreY, z]);
    }
  }

  for (const face of [-1, 1]) {
    for (let layer = 0; layer < 3; layer++) {
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-0.162, 4.303 - layer * 0.015, face * 0.17),
        new THREE.Vector3(-0.08, 4.296 - layer * 0.019, face * 0.187),
        new THREE.Vector3(0.08, 4.296 - layer * 0.019, face * 0.187),
        new THREE.Vector3(0.162, 4.303 - layer * 0.015, face * 0.17),
      );
      addColumn(new THREE.TubeGeometry(curve, 24, 0.006, 6, false));
    }
  }
  beveledSlab(0.475, 0.385, 0.033, 4.324, 0.008);
  beveledSlab(0.52, 0.43, 0.049, 4.361, 0.007);
  beveledSlab(0.538, 0.448, 0.016, 4.392, 0.004);

  const columnInputs = columnPieces.map((geometry) => {
    const unindexed = geometry.index ? geometry.toNonIndexed() : geometry;
    if (unindexed !== geometry) geometry.dispose();
    return unindexed;
  });
  const column = mergeGeometries(columnInputs, false);
  // The static merge copies its inputs; release all construction geometry.
  for (const geometry of columnInputs) geometry.dispose();
  if (!column) throw new Error("Unable to merge Roman column geometry");
  for (const [index, [x, z]] of COLUMN_CENTRES.entries()) {
    const geometry = column.clone();
    geometry.translate(x, 0, z);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) + index * 0.283, uv.getY(i) + index * 0.137);
    }
    pieces.quartz.push(geometry);
  }
  column.dispose();

  // The open crown leaves the existing chandelier and its suspension cables
  // clear, with a restrained bronze inner reveal matching the display drum.
  pieces.quartz.push(lathe([
    [1.075, 4.386], [1.516, 4.386], [1.535, 4.394], [1.54, 4.406],
    [1.535, 4.414], [1.526, 4.419], [1.526, 4.468], [1.54, 4.475],
    [1.542, 4.488], [1.531, 4.497], [1.08, 4.497], [1.071, 4.488],
    [1.071, 4.402], [1.075, 4.386],
  ], 128));
  pieces.bronze.push(lathe([
    [1.071, 4.36], [1.091, 4.36], [1.098, 4.369], [1.098, 4.384],
    [1.091, 4.393], [1.071, 4.393], [1.066, 4.386], [1.066, 4.368],
    [1.071, 4.36],
  ], 128));
  pieces.bronze.push(lathe([
    [1.52, 4.373], [1.532, 4.373], [1.538, 4.381], [1.532, 4.391],
    [1.52, 4.391], [1.52, 4.373],
  ], 128));

  for (const finish of ["quartz", "bronze"] as const) {
    const inputs = pieces[finish].map((geometry) => {
      if (!geometry.index) return geometry;
      const unindexed = geometry.toNonIndexed();
      geometry.dispose();
      return unindexed;
    });
    const geometry = mergeGeometries(inputs, false);
    for (const input of inputs) input.dispose();
    if (!geometry) throw new Error(`Unable to merge Roman ${finish} geometry`);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    owned.push(geometry);
    const mesh = new THREE.Mesh(geometry, materials[finish]);
    mesh.name = finish === "quartz" ? "Carved quartz shafts, Ionic capitals and open crown" : "Bronze crown reveals";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const collisionBoxes: StoreObstacle[] = COLUMN_CENTRES.map(([x, z]) => ({
    minX: x - 0.22,
    maxX: x + 0.22,
    minZ: z - 0.22,
    maxZ: z + 0.22,
  }));
  return {
    collisionBoxes,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of owned) geometry.dispose();
      root.clear();
      root.removeFromParent();
    },
  };
}
