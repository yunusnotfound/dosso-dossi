import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type ShelfMaterials = {
  orangeMarble: THREE.MeshStandardMaterial;
  quartz: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  glow: THREE.Material;
};
type Position = [number, number, number];

/** Six stone shelves and two matching plinths; the caller owns all materials. */
export function createPremiumShelves(
  parent: THREE.Group,
  materials: ShelfMaterials,
): { dispose(): void } {
  const root = new THREE.Group();
  root.name = "Orange marble merchandising — coffee and thermos";
  parent.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const prototypes = new Map<string, THREE.BufferGeometry>();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  let disposed = false;

  // Projection follows each physical face, so a two-metre vein stays two
  // metres long on both a narrow fascia and the broad stone plinth.
  const metreScaledUvs = (geometry: THREE.BufferGeometry, unit = 2.1) => {
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    for (let first = 0; first < positions.count; first += 3) {
      const nx = Math.abs(normals.getX(first) + normals.getX(first + 1) + normals.getX(first + 2));
      const ny = Math.abs(normals.getY(first) + normals.getY(first + 1) + normals.getY(first + 2));
      const nz = Math.abs(normals.getZ(first) + normals.getZ(first + 1) + normals.getZ(first + 2));
      for (let vertex = first; vertex < first + 3; vertex++) {
        const x = positions.getX(vertex), y = positions.getY(vertex), z = positions.getZ(vertex);
        if (ny >= nx && ny >= nz) uv.setXY(vertex, z / unit, x / unit);
        else if (nx >= nz) uv.setXY(vertex, z / unit, y / unit);
        else uv.setXY(vertex, x / unit, y / unit);
      }
    }
  };
  const rounded = (
    size: Position,
    position: Position,
    surface: THREE.Material,
    radius: number,
    segments = 3,
  ) => {
    const key = [...size, radius, segments].join(":");
    let prototype = prototypes.get(key);
    if (!prototype) {
      prototype = new RoundedBoxGeometry(...size, segments, radius);
      prototypes.set(key, prototype);
    }
    const geometry = prototype.index ? prototype.toNonIndexed() : prototype.clone();
    geometry.translate(...position);
    geometry.clearGroups();
    metreScaledUvs(geometry);
    const pieces = batches.get(surface) ?? [];
    pieces.push(geometry);
    batches.set(surface, pieces);
  };

  for (const side of [-1, 1]) {
    const z = side === -1 ? -2.05 : -1.2;

    // The assembled plinth retains the original 1.02 × 0.48 × 4.90 m bounds.
    // Its rounded marble body overhangs a recessed ivory foot and bronze reveal.
    rounded([1.02, 0.43, 4.9], [side * 6.14, 0.295, z], materials.orangeMarble, 0.065, 4);
    rounded([0.91, 0.045, 4.75], [side * 6.14, 0.0525, z], materials.quartz, 0.012);
    rounded([0.935, 0.009, 4.775], [side * 6.14, 0.078, z], materials.bronze, 0.003);

    // Small rear stone piers and slender uprights carry the shelves without
    // placing a frame in front of the separately clickable product models.
    for (const end of [-1, 1]) {
      const endZ = z + end * 2.14;
      rounded([0.16, 0.23, 0.2], [side * 6.44, 0.625, endZ], materials.orangeMarble, 0.025);
      rounded([0.038, 1.94, 0.065], [side * 6.48, 1.63, endZ], materials.bronze, 0.012);
    }

    for (const top of [0.86, 1.76, 2.66]) {
      // Product contact surfaces remain exactly at the established shelf tops;
      // a 26 mm eased stone edge catches the light without reducing usable depth.
      rounded([0.83, 0.12, 4.72], [side * 6.12, top - 0.06, z], materials.orangeMarble, 0.026, 4);

      // A narrow inlaid bronze line leaves almost the entire orange stone fascia
      // visible. It stops before the rounded ends instead of wrapping as a frame.
      rounded([0.003, 0.007, 4.51], [side * 5.7045, top - 0.058, z], materials.bronze, 0.0014, 2);

      // The warm diffuser is tucked 9 cm behind the front edge, inside a slim
      // bronze housing. Its downward-facing surface sits just below the stone.
      rounded([0.045, 0.012, 4.45], [side * 5.795, top - 0.122, z], materials.bronze, 0.004, 2);
      rounded([0.023, 0.003, 4.39], [side * 5.795, top - 0.128, z], materials.glow, 0.001, 2);

      // Compact bronze saddle brackets sit at the back, under the slab. Their
      // footprint is beyond the products, so neither faces nor handles are hidden.
      for (const end of [-1, 1]) {
        rounded([0.19, 0.025, 0.095], [side * 6.43, top - 0.13, z + end * 2.14], materials.bronze, 0.008);
      }
    }
  }

  // One mesh per supplied material: at most four draw calls for both walls.
  for (const [surface, pieces] of batches) {
    const geometry = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    if (!geometry) continue;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, surface);
    const name = Object.entries(materials).find(([, value]) => value === surface)?.[0] ?? "detail";
    mesh.name = `Premium shelves — ${name}`;
    mesh.castShadow = surface !== materials.glow;
    mesh.receiveShadow = surface !== materials.glow;
    root.add(mesh);
  }
  prototypes.forEach((geometry) => geometry.dispose());
  prototypes.clear();
  batches.clear();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      geometries.forEach((geometry) => geometry.dispose());
      geometries.clear();
      root.clear();
    },
  };
}
