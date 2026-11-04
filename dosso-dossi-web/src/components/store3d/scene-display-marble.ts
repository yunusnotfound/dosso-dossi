import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** One continuous marble wrap across the original drum and its rounded reeds. */
export function createMarbleDisplayDrum(
  parent: THREE.Group,
  material: THREE.MeshStandardMaterial,
): { dispose(): void } {
  const radius = 1.22;
  const circumference = Math.PI * 2 * radius;
  const repeats = Math.round(circumference / 2.1);
  const stoneUnit = circumference / repeats;
  const pieces: THREE.BufferGeometry[] = [];

  const wrap = (source: THREE.CylinderGeometry, x: number, z: number) => {
    const geometry = source.toNonIndexed();
    source.dispose();
    geometry.translate(x, 0.405, z);
    geometry.clearGroups();
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");

    for (let first = 0; first < positions.count; first += 3) {
      const cap = Math.abs(normals.getY(first)) > 0.9;
      const referenceAngle = Math.atan2(positions.getX(first), positions.getZ(first));
      for (let vertex = first; vertex < first + 3; vertex++) {
        const px = positions.getX(vertex);
        const py = positions.getY(vertex);
        const pz = positions.getZ(vertex);
        if (cap) {
          uv.setXY(vertex, px / stoneUnit, pz / stoneUnit);
          continue;
        }

        // Unwrap each triangle at the back seam. Every reed samples the same
        // world-space vein as the adjacent body, rather than repeating a slab.
        let angle = Math.atan2(px, pz);
        if (angle - referenceAngle > Math.PI) angle -= Math.PI * 2;
        if (angle - referenceAngle < -Math.PI) angle += Math.PI * 2;
        uv.setXY(vertex, (angle + Math.PI) * radius / stoneUnit, py / stoneUnit);
      }
    }
    pieces.push(geometry);
  };

  wrap(new THREE.CylinderGeometry(radius, radius, 0.65, 96), 0, 0);
  for (let i = 0; i < 64; i++) {
    const angle = i / 64 * Math.PI * 2;
    wrap(
      new THREE.CylinderGeometry(0.022, 0.022, 0.56, 12),
      Math.cos(angle) * 1.222,
      Math.sin(angle) * 1.222,
    );
  }

  const geometry = mergeGeometries(pieces, false)!;
  pieces.forEach((piece) => piece.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const drum = new THREE.Mesh(geometry, material);
  drum.name = "Central display — continuous orange marble";
  drum.castShadow = true;
  drum.receiveShadow = true;
  parent.add(drum);
  let disposed = false;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(drum);
      geometry.dispose();
    },
  };
}
