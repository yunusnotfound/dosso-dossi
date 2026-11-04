import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSignTexture, createStoreMaterials } from "./scene-materials";
import { createCafeFurniture } from "./scene-cafe-furniture";
import { createCafeLighting } from "./scene-cafe-lighting";
import { createCafeEquipment } from "./scene-cafe-equipment";
import { createCafeDecor } from "./scene-cafe-decor";
import { createBrandSign } from "./scene-brand-sign";
import { createRomanColumns } from "./scene-roman-columns";
import { createPremiumShelves } from "./scene-premium-shelves";
import { createMarbleDisplayDrum } from "./scene-display-marble";

export type StoreObstacle = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/** Shelf tops for the separately rendered, interactive product models. */
export const STORE_SHELF_SURFACES = {
  coffee: { x: -6.08, zs: [-3.7, -2.05, -0.4], ys: [0.86, 1.76, 2.66] },
  thermos: { x: 6.08, zs: [-2.8, -1.25, 0.3], ys: [0.86, 1.76, 2.66] },
  pedestal: { x: 0, z: 0, y: 0.85, radius: 1.25 },
} as const;

export function createEnvironment(scene: THREE.Scene, onLoad?: () => void) {
  const root = new THREE.Group();
  root.name = "Dosso Dossi — architectural environment";
  scene.add(root);
  const materials = createStoreMaterials(onLoad);
  const geometries = new Set<THREE.BufferGeometry>();
  const customMaterials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  geometries.add(boxGeometry);

  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    parent: THREE.Object3D = root,
    shadow = true,
  ) => {
    geometries.add(geometry);
    const item = new THREE.Mesh(geometry, material);
    item.position.set(...position);
    item.castShadow = shadow;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  };
  const box = (
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material = materials.plaster,
    parent: THREE.Object3D = root,
    shadow = true,
  ) => {
    // Stone and timber use metre-scaled UVs, so a wall never stretches a
    // countertop-sized vein across the whole room.
    if ([materials.quartz, materials.floor, materials.walnut, materials.stone].includes(material as THREE.MeshStandardMaterial)) {
      const geometry = new THREE.BoxGeometry(...size);
      const uv = geometry.getAttribute("uv");
      const unit = material === materials.walnut ? 1.4 : 2.4;
      const faces = [[size[2], size[1]], [size[2], size[1]], [size[0], size[2]], [size[0], size[2]], [size[0], size[1]], [size[0], size[1]]];
      for (let face = 0; face < 6; face++) {
        for (let i = face * 4; i < face * 4 + 4; i++) {
          uv.setXY(i, uv.getX(i) * faces[face][0] / unit, uv.getY(i) * faces[face][1] / unit);
        }
      }
      return mesh(geometry, material, position, parent, shadow);
    }
    const item = mesh(boxGeometry, material, position, parent, shadow);
    item.scale.set(...size);
    return item;
  };
  const cylinder = (
    radius: number,
    height: number,
    position: [number, number, number],
    material: THREE.Material = materials.stone,
    parent: THREE.Object3D = root,
    radiusBottom = radius,
    segments = 48,
  ) =>
    mesh(
      new THREE.CylinderGeometry(radius, radiusBottom, height, segments),
      material,
      position,
      parent,
    );

  const arch = (width: number, height: number) => {
    const shape = new THREE.Shape();
    const radius = width / 2;
    const spring = height - radius;
    shape.moveTo(-radius, 0);
    shape.lineTo(radius, 0);
    shape.lineTo(radius, spring);
    shape.absarc(0, spring, radius, 0, Math.PI, false);
    shape.lineTo(-radius, 0);
    return shape;
  };
  const framedArch = (
    width: number,
    height: number,
    depth: number,
    position: [number, number, number],
    rotationY = 0,
    border = 0.16,
  ) => {
    const group = new THREE.Group();
    group.position.set(...position);
    group.rotation.y = rotationY;
    root.add(group);
    mesh(
      new THREE.ShapeGeometry(arch(width, height), 40),
      materials.niche,
      [0, 0, -0.012],
      group,
      false,
    );
    const radius = width / 2;
    const spring = height - radius;
    const frame = new THREE.Shape();
    frame.moveTo(-radius - border, 0);
    frame.lineTo(-radius - border, spring);
    frame.absarc(0, spring, radius + border, Math.PI, 0, true);
    frame.lineTo(radius + border, 0);
    frame.lineTo(radius, 0);
    frame.lineTo(radius, spring);
    frame.absarc(0, spring, radius, 0, Math.PI, false);
    frame.lineTo(-radius, 0);
    frame.closePath();
    mesh(
      new THREE.ExtrudeGeometry(frame, {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.018,
        bevelThickness: 0.018,
        curveSegments: 40,
      }),
      materials.stone,
      [0, 0, 0],
      group,
    );
    return group;
  };

  // Honed limestone slabs and warm ivory quartz walls, in physical room scale.
  box([14.4, 0.16, 14.4], [0, -0.08, 0], materials.floor, root, false);
  // One continuous textured ceiling meets all four walls at y=4.8.
  const ceiling = box([14.4, 0.2, 14.4], [0, 4.9, 0], materials.quartz, root, false);
  ceiling.name = "Continuous quartz ceiling";
  box([14.4, 4.8, 0.28], [0, 2.4, -7.04], materials.quartz, root, false);
  box([14.4, 4.8, 0.28], [0, 2.4, 7.04], materials.quartz, root, false);
  box([0.28, 4.8, 14.4], [-7.04, 2.4, 0], materials.quartz, root, false);
  box([0.28, 4.8, 14.4], [7.04, 2.4, 0], materials.quartz, root, false);
  for (let offset = -6; offset <= 6; offset += 2.4) {
    box([0.007, 0.003, 14], [offset, 0.002, 0], materials.joint, root, false);
    box([14, 0.003, 0.007], [0, 0.002, offset], materials.joint, root, false);
  }
  // Stone skirting and a fine shadow gap keep the room from reading as a cube.
  for (const side of [-1, 1]) {
    box([0.09, 0.18, 14], [side * 6.87, 0.09, 0], materials.stone);
    box(
      [0.014, 0.018, 14],
      [side * 6.81, 0.205, 0],
      materials.joint,
      root,
      false,
    );
    box([0.2, 0.18, 14], [side * 6.75, 4.55, 0], materials.stone);
  }
  for (const side of [-1, 1]) {
    box([14, 0.18, 0.09], [0, 0.09, side * 6.87], materials.stone);
    box([14, 0.018, 0.014], [0, 0.205, side * 6.81], materials.joint, root, false);
    box([14, 0.18, 0.24], [0, 4.55, side * 6.75], materials.stone);
  }
  // Matching piers complete the fourth wall inside the enclosed store.
  box([0.46, 4.8, 0.55], [-6.65, 2.4, 6.8], materials.stone);
  box([0.46, 4.8, 0.55], [6.65, 2.4, 6.8], materials.stone);
  box([13.75, 0.38, 0.55], [0, 4.57, 6.8], materials.stone);

  // The central arched brand wall is seen directly from the entry camera.
  const brandArch = framedArch(5.15, 4.0, 0.18, [0, 0.35, -6.84], 0, 0.2);
  (brandArch.children[0] as THREE.Mesh).material = materials.orange;
  const brandSign = createBrandSign(root, onLoad);
  // Soft contact shadows ground the furniture without a post-processing pass.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext("2d")!;
  const contact = shadowContext.createRadialGradient(64, 64, 18, 64, 64, 64);
  contact.addColorStop(0, "rgba(30, 29, 26, .24)");
  contact.addColorStop(0.6, "rgba(30, 29, 26, .12)");
  contact.addColorStop(1, "rgba(30, 29, 26, 0)");
  shadowContext.fillStyle = contact;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  textures.add(shadowTexture);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  customMaterials.add(contactMaterial);
  for (const [x, z, width, depth] of [
    [0, 0, 3.8, 3.8],
    [0, -5.15, 8, 3],
    [-4.1, 4.1, 4.2, 3.3],
    [5.5, 3.15, 3.2, 4.2],
  ]) {
    const contactPlane = mesh(
      new THREE.PlaneGeometry(width, depth),
      contactMaterial,
      [x, 0.008, z],
      root,
      false,
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.receiveShadow = false;
  }

  const sign = (
    title: string,
    subtitle: string,
    size: [number, number],
    position: [number, number, number],
    options: { rotationY?: number; dark?: boolean; eyebrow?: string; transparent?: boolean } = {},
  ) => {
    const texture = createSignTexture({
      title,
      subtitle,
      dark: options.dark,
      eyebrow: options.eyebrow,
      transparent: options.transparent,
    });
    textures.add(texture);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.87,
      transparent: options.transparent ?? false,
      depthWrite: !options.transparent,
    });
    customMaterials.add(material);
    const panel = mesh(
      new THREE.PlaneGeometry(...size),
      material,
      position,
      root,
      false,
    );
    panel.rotation.y = options.rotationY ?? 0;
    return panel;
  };
  sign("DOSSO DOSSI", "COFFEE · GOOD COMPANY", [3.25, 1.02], [0, 1.99, -6.61], { transparent: true });

  // Brown marble wraps the rear bar, rounded worktop and every front flute.
  // Each curved face unwraps by its physical arc length; all flat surfaces use
  // the same 2.4 m stone scale, with world offsets preserving the broad veins.
  const counterParts: THREE.BufferGeometry[] = [];
  const counterStone = (
    geometry: THREE.BufferGeometry,
    position: [number, number, number],
    curve?: { radius: number; uOffset: number },
  ) => {
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    for (let index = 0; index < positions.count; index++) {
      const localX = positions.getX(index), localZ = positions.getZ(index);
      const x = localX + position[0], y = positions.getY(index) + position[1], z = localZ + position[2];
      if (Math.abs(normals.getY(index)) > 0.9) {
        uv.setXY(index, (x + 2.95) / 2.4, z / 2.4);
      } else if (curve) {
        const arc = Math.atan2(localX, localZ) * curve.radius;
        uv.setXY(index, (curve.uOffset + arc) / 2.4, y / 2.4);
      } else if (Math.abs(normals.getX(index)) > 0.9) {
        uv.setXY(index, z / 2.4, y / 2.4);
      } else {
        uv.setXY(index, (x + 2.95) / 2.4, y / 2.4);
      }
    }
    geometry.translate(...position);
    geometry.clearGroups();
    counterParts.push(geometry);
  };
  counterStone(new THREE.BoxGeometry(5.9, 0.98, 1.15), [0, 0.55, -5.15]);
  counterStone(new THREE.BoxGeometry(5.9, 0.075, 1.24), [0, 1.08, -5.15]);
  for (const side of [-1, 1]) {
    const uOffset = side === 1 ? 5.9 : 0;
    counterStone(
      new THREE.CylinderGeometry(0.575, 0.575, 0.98, 48),
      [side * 2.95, 0.55, -5.15],
      { radius: 0.575, uOffset },
    );
    counterStone(
      new THREE.CylinderGeometry(0.62, 0.62, 0.075, 48),
      [side * 2.95, 1.08, -5.15],
      { radius: 0.62, uOffset },
    );
  }
  for (let index = 0; index < 44; index++) {
    const x = -2.8 + index * (5.6 / 43);
    counterStone(
      new THREE.CylinderGeometry(0.025, 0.025, 0.79, 16),
      [x, 0.56, -4.564],
      { radius: 0.025, uOffset: x + 2.95 },
    );
  }
  const counterGeometry = mergeGeometries(counterParts, false);
  counterParts.forEach((geometry) => geometry.dispose());
  if (!counterGeometry) throw new Error("Unable to build the marble service counter");
  const counterCladding = mesh(counterGeometry, materials.brownMarble, [0, 0, 0]);
  counterCladding.name = "Brown marble service counter — body, worktop and 44 flutes";

  const equipment = createCafeEquipment(root, onLoad);

  // Existing arched niches frame the rounded marble merchandising shelves.
  const premiumShelves = createPremiumShelves(root, {
    orangeMarble: materials.orangeMarble,
    quartz: materials.romanQuartz,
    bronze: materials.bronze,
    glow: materials.glow,
  });
  const nicheWidth = 2.08;
  for (const side of [-1, 1]) {
    const centers = side === -1 ? [-3.35, -0.75] : [-2.5, 0.1];
    for (const z of centers) {
      framedArch(
        nicheWidth,
        3.55,
        0.18,
        [side * 6.81, 0.35, z],
        side === -1 ? Math.PI / 2 : -Math.PI / 2,
        0.14,
      );
    }
  }

  // Continuous orange marble matches the shelves; the cap and reveals stay put.
  const centralFlutes = createMarbleDisplayDrum(root, materials.orangeMarble);
  cylinder(1.228, 0.035, [0, 0.105, 0], materials.bronze);
  cylinder(1.248, 0.028, [0, 0.738, 0], materials.bronze);
  cylinder(1.25, 0.1, [0, 0.8, 0], materials.romanQuartz);
  const romanColumns = createRomanColumns(root, {
    quartz: materials.romanQuartz,
    bronze: materials.bronze,
  });
  const inlay = mesh(
    new THREE.RingGeometry(1.75, 1.765, 96),
    materials.joint,
    [0, 0.007, 0],
    root,
    false,
  );
  inlay.rotation.x = -Math.PI / 2;

  // The lounge table and chairs share the detailed furniture collection below.
  // A tiny ceramic vase provides scale at the table without clutter.
  cylinder(0.075, 0.17, [-4.1, 0.89, 3.6], materials.orange, root, 0.06, 24);

  const lighting = createCafeLighting(root);
  const furniture = createCafeFurniture(root, onLoad);
  const decor = createCafeDecor(root);

  // One restrained living plant softens the lounge corner.
  cylinder(0.32, 0.58, [5.4, 0.3, 5.92], materials.stone, root, 0.24);
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x506448,
    roughness: 0.94,
  });
  customMaterials.add(stemMaterial);
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4;
    const height = 0.7 + (i % 4) * 0.16;
    const stem = cylinder(
      0.009,
      height,
      [5.4, 0.58 + height / 2, 5.92],
      stemMaterial,
      root,
      0.009,
      6,
    );
    stem.rotation.z = Math.cos(angle) * 0.2;
    stem.rotation.x = Math.sin(angle) * 0.2;
    const leaf = mesh(new THREE.SphereGeometry(1, 12, 8), materials.foliage, [
      5.4 + Math.cos(angle) * 0.2,
      0.74 + height,
      5.92 + Math.sin(angle) * 0.2,
    ]);
    leaf.scale.set(0.18, 0.37, 0.045);
    leaf.rotation.set(0.28, angle, Math.cos(angle) * 0.5);
  }

  const collisionBoxes: StoreObstacle[] = [
    ...furniture.collisionBoxes,
    ...romanColumns.collisionBoxes,
    { minX: -3.58, maxX: 3.58, minZ: -5.82, maxZ: -4.48 },
    { minX: -6.85, maxX: -5.55, minZ: -4.58, maxZ: 0.5 },
    { minX: 5.55, maxX: 6.85, minZ: -3.73, maxZ: 1.32 },
    { minX: -1.28, maxX: 1.28, minZ: -1.28, maxZ: 1.28 },
    { minX: -5.72, maxX: -2.5, minZ: 2.85, maxZ: 5.32 },
    { minX: 4.97, maxX: 5.83, minZ: 5.48, maxZ: 6.35 },
  ];

  return {
    collisionBoxes,
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(root);
      brandSign.dispose();
      equipment.dispose();
      furniture.dispose();
      lighting.dispose();
      decor.dispose();
      romanColumns.dispose();
      premiumShelves.dispose();
      centralFlutes.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      customMaterials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      materials.dispose();
      root.clear();
    },
  };
}
