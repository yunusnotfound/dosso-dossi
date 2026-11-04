import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Position = [number, number, number];
type Finish = "bronze" | "dark" | "opal" | "glass" | "light";

/** Modelled luminaires: the scene lighting remains owned by the renderer. */
export function createCafeLighting(parent: THREE.Group) {
  const root = new THREE.Group();
  root.name = "Atelier lighting — cascading glass chandelier and warm pendants";
  parent.add(root);

  const materials: Record<Finish, THREE.Material> = {
    bronze: new THREE.MeshStandardMaterial({
      color: 0x9a784c,
      metalness: 0.78,
      roughness: 0.31,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x282622,
      metalness: 0.48,
      roughness: 0.43,
    }),
    opal: new THREE.MeshStandardMaterial({
      color: 0xfff6e6,
      emissive: 0xffdca0,
      emissiveIntensity: 0.24,
      metalness: 0,
      roughness: 0.27,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffefd0,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
    light: new THREE.MeshBasicMaterial({
      color: 0xffebc2,
      toneMapped: false,
    }),
  };
  const parts: Record<Finish, THREE.BufferGeometry[]> = {
    bronze: [],
    dark: [],
    opal: [],
    glass: [],
    light: [],
  };
  const merged: THREE.BufferGeometry[] = [];
  const rotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);

  const add = (
    finish: Finish,
    geometry: THREE.BufferGeometry,
    position: Position,
    orientation = new THREE.Quaternion(),
    scale: Position = [1, 1, 1],
  ) => {
    matrix.compose(
      new THREE.Vector3(...position),
      orientation,
      new THREE.Vector3(...scale),
    );
    geometry.applyMatrix4(matrix);
    parts[finish].push(geometry);
  };
  const cylinder = (
    finish: Finish,
    radius: number,
    height: number,
    position: Position,
    bottomRadius = radius,
  ) =>
    add(
      finish,
      new THREE.CylinderGeometry(radius, bottomRadius, height, radius < 0.08 ? 16 : 32),
      position,
    );
  const ring = (
    finish: Finish,
    radius: number,
    thickness: number,
    position: Position,
  ) =>
    add(
      finish,
      new THREE.TorusGeometry(radius, thickness, 8, radius > 0.5 ? 96 : 32),
      position,
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
    );
  const rod = (
    finish: Finish,
    start: Position,
    end: Position,
    radius: number,
  ) => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const length = direction.length();
    rotation.setFromUnitVectors(up, direction.normalize());
    add(
      finish,
      new THREE.CylinderGeometry(radius, radius, length, 10),
      a.add(b).multiplyScalar(0.5).toArray() as Position,
      rotation,
    );
  };
  const globe = (
    position: Position,
    radius: number,
    scale: Position = [1, 1, 1],
    fluted = false,
  ) => {
    const geometry = new THREE.SphereGeometry(
      radius,
      fluted ? 48 : 32,
      fluted ? 24 : 20,
    );
    if (fluted) {
      const vertices = geometry.getAttribute("position");
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i);
        const z = vertices.getZ(i);
        const latitude = Math.hypot(x, z) / radius;
        const relief = 1 + Math.cos(Math.atan2(z, x) * 24) * 0.017 * latitude;
        vertices.setXYZ(i, x * relief, vertices.getY(i), z * relief);
      }
      geometry.computeVertexNormals();
    }
    add("opal", geometry, position, undefined, scale);
  };
  const canopy = (x: number, z: number, radius = 0.1) => {
    cylinder("dark", radius, 0.03, [x, 4.785, z]);
    cylinder("bronze", radius * 0.93, 0.047, [x, 4.754, z]);
    cylinder("dark", radius * 0.35, 0.026, [x, 4.718, z]);
  };
  const cable = (start: Position, end: Position) => {
    rod("dark", start, end, 0.004);
    const towardStart = new THREE.Vector3(...start)
      .sub(new THREE.Vector3(...end))
      .normalize()
      .multiplyScalar(0.043);
    rod(
      "bronze",
      end,
      new THREE.Vector3(...end).add(towardStart).toArray() as Position,
      0.009,
    );
  };

  // A single ceiling plate anchors fifteen vertical drops inside the colonnade.
  // Its 0.68m radius clears the crown's 1.07m opening; the lowest glass ends at
  // 2.37m, leaving generous space above the products on the 0.85m display top.
  cylinder("dark", 0.68, 0.034, [0, 4.783, 0]);
  cylinder("bronze", 0.665, 0.026, [0, 4.753, 0]);
  ring("bronze", 0.654, 0.009, [0, 4.737, 0]);

  const glassDrop = (x: number, z: number, bottom: number, height: number) => {
    const radius = 0.057;
    const top = bottom + height;
    cylinder("bronze", 0.014, 0.055, [x, 4.711, z]);
    cable([x, 4.686, z], [x, top + 0.065, z]);
    cylinder("bronze", 0.019, 0.056, [x, top + 0.044, z]);
    cylinder("bronze", 0.049, 0.048, [x, top + 0.002, z], 0.058);
    ring("dark", 0.049, 0.004, [x, top + 0.026, z]);

    // Rounded, finely fluted glass sleeves enclose separate warm LED cores.
    // This avoids costly screen refraction or bloom across the entire shop.
    const glass = new THREE.CapsuleGeometry(radius, height - radius * 2, 8, 32);
    const vertices = glass.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const vx = vertices.getX(i);
      const vz = vertices.getZ(i);
      const relief = 1 + Math.cos(Math.atan2(vz, vx) * 16) * 0.035;
      vertices.setXYZ(i, vx * relief, vertices.getY(i), vz * relief);
    }
    glass.computeVertexNormals();
    add("glass", glass, [x, bottom + height / 2, z]);
    add("light", new THREE.CapsuleGeometry(0.023, height - 0.145, 6, 12), [x, bottom + height / 2, z]);
    cylinder("bronze", 0.047, 0.029, [x, bottom + 0.026, z], 0.035);
    ring("bronze", 0.048, 0.004, [x, bottom + 0.043, z]);
  };
  // Two staggered spirals fall toward the centre, keeping individual glass
  // pieces legible from every station instead of forming a solid curtain.
  for (let i = 0; i < 9; i++) {
    const angle = i / 9 * Math.PI * 2 + 0.18;
    const bottom = 2.82 + (Math.sin(angle + 0.5) + 1) * 0.21;
    glassDrop(Math.cos(angle) * 0.56, Math.sin(angle) * 0.56, bottom, 0.56 + (i % 3) * 0.055);
  }
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2 + 0.55;
    glassDrop(Math.cos(angle) * 0.275, Math.sin(angle) * 0.275, 2.57 + i * 0.045, 0.7);
  }
  glassDrop(0, 0, 2.37, 0.79);

  const pendant = (
    x: number,
    z: number,
    y: number,
    radius: number,
  ) => {
    canopy(x, z);
    const top = y + radius * 0.91;
    cable([x, 4.709, z], [x, top + 0.075, z]);
    cylinder("bronze", 0.016, 0.09, [x, top + 0.043, z]);
    cylinder("dark", radius * 0.29, 0.018, [x, top + 0.005, z]);
    cylinder("bronze", radius * 0.28, 0.036, [x, top - 0.009, z], radius * 0.36);
    ring("bronze", radius * 0.35, 0.008, [x, top - 0.028, z]);
    globe([x, y, z], radius, [1, 0.98, 1], true);
    // The small threaded bottom finial completes the hand-blown shade assembly.
    cylinder("bronze", 0.024, 0.023, [x, y - radius * 0.98, z]);
    add(
      "bronze",
      new THREE.SphereGeometry(0.023, 16, 10),
      [x, y - radius * 1.02, z],
      undefined,
      [1, 0.72, 1],
    );
  };
  for (const x of [-2.2, 0, 2.2]) pendant(x, -5.05, 3.65, 0.24);

  // A smaller three-arm chandelier provides an intimate scale over the lounge.
  const loungeX = -4.1;
  const loungeZ = 3.6;
  canopy(loungeX, loungeZ, 0.135);
  cable([loungeX, 4.709, loungeZ], [loungeX, 3.72, loungeZ]);
  cylinder("bronze", 0.022, 0.25, [loungeX, 3.61, loungeZ]);
  cylinder("dark", 0.082, 0.043, [loungeX, 3.52, loungeZ]);
  cylinder("bronze", 0.089, 0.025, [loungeX, 3.493, loungeZ]);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const x = loungeX + Math.cos(angle) * 0.43;
    const z = loungeZ + Math.sin(angle) * 0.43;
    const arm = new THREE.CatmullRomCurve3([
      new THREE.Vector3(loungeX, 3.51, loungeZ),
      new THREE.Vector3(
        loungeX + Math.cos(angle) * 0.22,
        3.58,
        loungeZ + Math.sin(angle) * 0.22,
      ),
      new THREE.Vector3(x, 3.53, z),
      new THREE.Vector3(x, 3.46, z),
    ]);
    add("bronze", new THREE.TubeGeometry(arm, 18, 0.013, 8, false), [0, 0, 0]);
    cylinder("bronze", 0.057, 0.035, [x, 3.468, z]);
    ring("dark", 0.053, 0.006, [x, 3.449, z]);
    globe([x, 3.3, z], 0.18, [1, 0.95, 1], true);
  }
  pendant(5, 3, 3.45, 0.28);

  // Each finish is one draw call, including all canopies, suspension and fittings.
  for (const finish of Object.keys(parts) as Finish[]) {
    const geometry = mergeGeometries(parts[finish], false);
    parts[finish].forEach((part) => part.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    merged.push(geometry);
    const mesh = new THREE.Mesh(geometry, materials[finish]);
    mesh.name = `Chandelier ${finish}`;
    mesh.castShadow = finish === "bronze" || finish === "dark";
    mesh.receiveShadow = mesh.castShadow;
    root.add(mesh);
  }

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      merged.forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((material) => material.dispose());
      root.clear();
    },
  };
}
