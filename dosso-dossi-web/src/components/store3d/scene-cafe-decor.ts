import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Small brand-colour details, kept clear of product displays and walking routes. */
export function createCafeDecor(parent: THREE.Group) {
  const root = new THREE.Group();
  root.name = "Cafe — orange relief art and woven lounge rug";
  parent.add(root);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const material = (color: number, roughness = 0.8, metalness = 0) => {
    const finish = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(finish);
    return finish;
  };
  const orange = material(0xef6024, 0.53);
  const clay = material(0xbe744e, 0.98);
  const weave = material(0xaf6946, 1);
  const cream = material(0xf3e8d4, 0.94);
  const sand = material(0xe1c6a0, 0.94);
  const walnut = material(0x614736, 0.6);
  const brass = material(0xa98a58, 0.38, 0.75);

  const mesh = (
    owner: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    finish: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const part = new THREE.Mesh(geometry, finish);
    part.position.set(x, y, z);
    part.receiveShadow = true;
    owner.add(part);
    return part;
  };

  // A physical shallow relief rather than a poster texture. Local +Z faces into the room.
  const artwork = new THREE.Group();
  artwork.name = "Framed coffee-bean relief";
  artwork.position.set(-6.84, 2.55, 3.6);
  artwork.rotation.y = Math.PI / 2;
  root.add(artwork);
  mesh(artwork, new RoundedBoxGeometry(1.14, 1.40, 0.065, 2, 0.025), walnut, 0, 0, 0);
  mesh(artwork, new RoundedBoxGeometry(1.075, 1.335, 0.012, 2, 0.015), brass, 0, 0, 0.037);
  mesh(artwork, new RoundedBoxGeometry(1.055, 1.315, 0.018, 2, 0.013), cream, 0, 0, 0.047);

  // Warm architectural shapes frame two sculptural beans without competing with the merchandise.
  const field = mesh(artwork, new THREE.CircleGeometry(0.39, 48), sand, 0.14, 0.23, 0.058);
  field.scale.set(0.80, 1, 1);
  mesh(artwork, new RoundedBoxGeometry(0.30, 0.56, 0.014, 3, 0.145), clay, -0.245, -0.33, 0.065);
  const bean = (x: number, y: number, angle: number, scale: number) => {
    const group = new THREE.Group();
    group.position.set(x, y, 0.068);
    group.rotation.z = angle;
    group.scale.setScalar(scale);
    artwork.add(group);
    const body = mesh(group, new THREE.SphereGeometry(1, 24, 16), orange, 0, 0, 0);
    body.scale.set(0.165, 0.265, 0.032);
    const seam = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, -0.235, 0.016),
      new THREE.Vector3(-0.026, -0.12, 0.031),
      new THREE.Vector3(0.022, 0.03, 0.034),
      new THREE.Vector3(-0.010, 0.14, 0.029),
      new THREE.Vector3(0.013, 0.235, 0.016),
    ]);
    mesh(group, new THREE.TubeGeometry(seam, 24, 0.011, 6, false), cream, 0, 0, 0);
  };
  bean(-0.13, 0.23, -0.43, 1);
  bean(0.19, -0.22, 0.50, 0.88);
  for (let line = 0; line < 3; line += 1) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.25 + line * 0.045, 0.43, 0.064),
      new THREE.Vector3(0.21 + line * 0.045, 0.49, 0.064),
      new THREE.Vector3(0.24 + line * 0.045, 0.56, 0.064),
    ]);
    mesh(artwork, new THREE.TubeGeometry(path, 12, 0.0045, 5, false), clay, 0, 0, 0);
  }

  // Thin and collision-free. Individual rings give the weave real light-catching relief.
  const rug = new THREE.Group();
  rug.name = "Burnt-orange woven lounge rug";
  rug.position.set(-4.1, 0.009, 4.1);
  root.add(rug);
  mesh(rug, new THREE.CylinderGeometry(1.80, 1.80, 0.004, 96), clay, 0, 0, 0);
  for (let ring = 0; ring < 42; ring += 1) {
    const radius = 0.075 + ring * 0.039;
    const fibre = mesh(rug, new THREE.TorusGeometry(radius, 0.0023, 4, Math.max(24, Math.round(radius * 50))), weave, 0, 0.003, 0);
    fibre.rotation.x = Math.PI / 2;
  }
  for (const radius of [1.695, 1.735]) {
    const border = mesh(rug, new THREE.TorusGeometry(radius, 0.007, 5, 96), cream, 0, 0.003, 0);
    border.rotation.x = Math.PI / 2;
  }
  const binding = mesh(rug, new THREE.TorusGeometry(1.787, 0.007, 5, 96), weave, 0, 0.002, 0);
  binding.rotation.x = Math.PI / 2;

  // One draw per finish; transform all nested art parts before joining them.
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    geometry.applyMatrix4(inverseRoot.clone().multiply(child.matrixWorld));
    const finish = child.material as THREE.Material;
    const batch = batches.get(finish) ?? [];
    batch.push(geometry);
    batches.set(finish, batch);
    child.geometry.dispose();
  });
  root.clear();
  for (const [finish, batch] of batches) {
    const joined = mergeGeometries(batch, false);
    for (const part of batch) part.dispose();
    if (!joined) continue;
    geometries.add(joined);
    const part = new THREE.Mesh(joined, finish);
    part.receiveShadow = true;
    // The very shallow rug should not cast large shadow-map artefacts onto the floor.
    part.castShadow = finish === orange || finish === walnut || finish === brass;
    root.add(part);
  }
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const finish of materials) finish.dispose();
      root.clear();
    },
  };
}
