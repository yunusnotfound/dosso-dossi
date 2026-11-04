import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CatalogItem } from "@/lib/catalog";
import type { ProductModelResources } from "./product-model-resources";

type GrainMaps = {
  normal?: THREE.CanvasTexture;
  roughness?: THREE.CanvasTexture;
};

type ModelParts = {
  body: THREE.LatheGeometry;
  rubber: THREE.BufferGeometry;
  lid: THREE.BufferGeometry;
  hingePin: THREE.CylinderGeometry;
  logo: THREE.BufferGeometry;
  grain: GrainMaps;
};

// All variants in a scene share geometry and procedural maps. The scene owns
// disposal through its resource registry; clones do not allocate new GPU data.
const sharedParts = new WeakMap<ProductModelResources, ModelParts>();

function powderGrain(resources: ProductModelResources): GrainMaps {
  if (typeof document === "undefined") return {};
  const size = 128;
  const normalCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  normalCanvas.width = normalCanvas.height = size;
  roughnessCanvas.width = roughnessCanvas.height = size;
  const normalContext = normalCanvas.getContext("2d");
  const roughnessContext = roughnessCanvas.getContext("2d");
  if (!normalContext || !roughnessContext) return {};

  const heights = new Float32Array(size * size);
  let seed = 0x51d0550;
  for (let i = 0; i < heights.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    heights[i] = seed / 4294967296;
  }
  const normalPixels = normalContext.createImageData(size, size);
  const roughnessPixels = roughnessContext.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const dx =
        heights[y * size + ((x + 1) % size)] -
        heights[y * size + ((x + size - 1) % size)];
      const dy =
        heights[((y + 1) % size) * size + x] -
        heights[((y + size - 1) % size) * size + x];
      normalPixels.data.set([128 - dx * 35, 128 - dy * 35, 255, 255], i * 4);
      const roughness = 215 + heights[i] * 28;
      roughnessPixels.data.set([roughness, roughness, roughness, 255], i * 4);
    }
  }
  normalContext.putImageData(normalPixels, 0, 0);
  roughnessContext.putImageData(roughnessPixels, 0, 0);
  const normal = resources.texture(new THREE.CanvasTexture(normalCanvas));
  const roughness = resources.texture(new THREE.CanvasTexture(roughnessCanvas));
  for (const texture of [normal, roughness]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 7);
    texture.anisotropy = 4;
  }
  return { normal, roughness };
}

function bodyRadius(y: number) {
  return 0.145 + ((y - 0.025) / (0.665 - 0.025)) * (0.181 - 0.145);
}

function curvedLogo() {
  const width = 0.216;
  const height = 0.216;
  const centerY = 0.421;
  const segmentsX = 40;
  const segmentsY = 16;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const slope = (0.181 - 0.145) / (0.665 - 0.025);
  const normalLength = Math.hypot(1, slope);
  for (let row = 0; row <= segmentsY; row++) {
    const v = row / segmentsY;
    const y = centerY + (v - 0.5) * height;
    const radius = bodyRadius(y) + 0.00045;
    for (let col = 0; col <= segmentsX; col++) {
      const u = col / segmentsX;
      const angle = ((u - 0.5) * width) / radius;
      positions.push(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
      normals.push(
        Math.sin(angle) / normalLength,
        -slope / normalLength,
        Math.cos(angle) / normalLength,
      );
      uvs.push(u, v);
      if (row < segmentsY && col < segmentsX) {
        const a = row * (segmentsX + 1) + col;
        const b = a + segmentsX + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function getParts(resources: ProductModelResources): ModelParts {
  const existing = sharedParts.get(resources);
  if (existing) return existing;
  const lathe = (profile: [number, number][], segments = 96) =>
    new THREE.LatheGeometry(
      profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
      segments,
    );
  const merge = (parts: THREE.BufferGeometry[]) => {
    const compatible = parts.map((part) =>
      part.index ? part.toNonIndexed() : part,
    );
    const geometry = mergeGeometries(compatible, false);
    new Set([...parts, ...compatible]).forEach((part) => part.dispose());
    if (!geometry) throw new Error("Cannot merge thermos geometry");
    return resources.geometry(geometry);
  };

  const body = lathe([
    [0, 0.004],
    [0.126, 0.004],
    [0.135, 0.006],
    [0.1405, 0.0105],
    [0.1438, 0.017],
    [0.145, 0.025],
    [bodyRadius(0.1), 0.1],
    [bodyRadius(0.24), 0.24],
    [bodyRadius(0.4), 0.4],
    [bodyRadius(0.55), 0.55],
    [0.181, 0.665],
    [0.1818, 0.675],
    [0.1809, 0.68],
    [0.1778, 0.683],
    [0.171, 0.684],
    [0, 0.684],
  ]);
  // Lathe's default V follows profile points, which would stretch the grain at
  // rounded edges. World-height UVs keep the powder coat evenly sized.
  const bodyUv = body.getAttribute("uv");
  const bodyPositions = body.getAttribute("position");
  for (let i = 0; i < bodyUv.count; i++) {
    bodyUv.setY(i, bodyPositions.getY(i) / 0.684);
  }

  const deckShape = new THREE.Shape();
  deckShape.absarc(0, 0, 0.155, 0, Math.PI * 2, false);
  const drinkingHole = new THREE.Path();
  drinkingHole.absellipse(0, -0.089, 0.027, 0.039, 0, Math.PI * 2, true, 0);
  deckShape.holes.push(drinkingHole);
  const deck = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.004,
    bevelEnabled: false,
    curveSegments: 48,
    steps: 1,
  });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, 0.792, 0);

  const foot = lathe(
    [
      [0, 0],
      [0.13, 0],
      [0.134, 0.0015],
      [0.135, 0.004],
      [0.132, 0.006],
      [0, 0.006],
    ],
    64,
  );
  const gasket = lathe([
    [0.176, 0.6805],
    [0.182, 0.6805],
    [0.183, 0.6825],
    [0.183, 0.6865],
    [0.1815, 0.688],
    [0.176, 0.688],
  ]);
  const lid = lathe([
    [0.174, 0.686],
    [0.1815, 0.686],
    [0.184, 0.688],
    [0.1855, 0.692],
    [0.186, 0.699],
    [0.1857, 0.739],
    [0.185, 0.751],
    [0.1825, 0.7565],
    [0.1785, 0.759],
    [0.1685, 0.7605],
    [0.1658, 0.7635],
    [0.1648, 0.773],
    [0.1618, 0.787],
    [0.157, 0.794],
    [0.1535, 0.796],
    [0.15, 0.796],
  ]);
  const drinkingWell = lathe(
    [
      [0.027, 0],
      [0.0262, -0.001],
      [0.024, -0.007],
      [0.02, -0.011],
      [0, -0.011],
    ],
    48,
  );
  drinkingWell.scale(1, 1, 0.039 / 0.027);
  drinkingWell.translate(0, 0.794, 0.089);
  const tab = new RoundedBoxGeometry(0.114, 0.024, 0.151, 4, 0.008);
  tab.rotateX(-0.04);
  tab.translate(0, 0.814, 0.017);
  const tabGrip = new RoundedBoxGeometry(0.082, 0.008, 0.012, 3, 0.003);
  tabGrip.translate(0, 0.826, 0.07);
  const hinge = new THREE.CylinderGeometry(0.011, 0.011, 0.13, 40);
  hinge.rotateZ(Math.PI / 2);
  hinge.translate(0, 0.804, -0.057);
  const hingePin = new THREE.CylinderGeometry(0.006, 0.006, 0.132, 32);
  hingePin.rotateZ(Math.PI / 2);
  hingePin.translate(0, 0.804, -0.057);
  const parts: ModelParts = {
    body: resources.geometry(body),
    rubber: merge([foot, gasket, drinkingWell]),
    lid: merge([lid, deck, tab, tabGrip, hinge]),
    hingePin: resources.geometry(hingePin),
    logo: resources.geometry(curvedLogo()),
    grain: powderGrain(resources),
  };
  sharedParts.set(resources, parts);
  return parts;
}

function variantFinish(item: CatalogItem) {
  const label =
    `${item.color?.tr ?? ""} ${item.color?.en ?? ""} ${item.variant?.colorNameTr ?? ""} ${item.variant?.colorNameEn ?? ""}`.toLocaleLowerCase(
      "tr",
    );
  if (/krem|cream|ivory/.test(label)) {
    return { body: "#eee6ce", lid: "#ef6024", cream: true };
  }
  if (/yeşil|yesil|green/.test(label)) {
    return { body: "#075637", lid: "#075637", cream: false };
  }
  if (/pembe|pink/.test(label)) {
    return { body: "#edabcb", lid: "#edabcb", cream: false };
  }
  if (/turuncu|orange/.test(label)) {
    return { body: "#ef6024", lid: "#ef6024", cream: false };
  }
  const fallback = item.color?.hex ?? "#ef6024";
  return { body: fallback, lid: fallback, cream: false };
}

/** Front is +Z; base is Y=0 and the closed flip tab reaches Y=0.83. */
export function createThermosModel(
  item: CatalogItem,
  resources: ProductModelResources,
): THREE.Group {
  const parts = getParts(resources);
  const finish = variantFinish(item);
  const group = new THREE.Group();
  group.name = "Dosso Dossi — sculpted travel thermos";
  group.userData.productId = item.id;

  const body = resources.material(
    new THREE.MeshPhysicalMaterial({
      color: finish.body,
      roughness: finish.cream ? 0.72 : 0.69,
      metalness: 0.025,
      clearcoat: 0.1,
      clearcoatRoughness: 0.7,
      specularIntensity: 0.45,
      normalMap: parts.grain.normal ?? null,
      normalScale: new THREE.Vector2(0.1, 0.1),
      roughnessMap: parts.grain.roughness ?? null,
    }),
  );
  const lid = resources.material(
    new THREE.MeshPhysicalMaterial({
      color: finish.lid,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.14,
      clearcoatRoughness: 0.6,
      specularIntensity: 0.44,
      normalMap: parts.grain.normal ?? null,
      normalScale: new THREE.Vector2(0.075, 0.075),
    }),
  );
  const rubber = resources.material(
    new THREE.MeshStandardMaterial({
      color: "#222522",
      roughness: 0.96,
      metalness: 0,
    }),
  );
  const metal = resources.material(
    new THREE.MeshStandardMaterial({
      color: "#8a918c",
      roughness: 0.3,
      metalness: 0.82,
    }),
  );
  const print = resources.material(
    new THREE.MeshStandardMaterial({
      map: resources.logo,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      roughness: 0.79,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const add = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number] = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  add("Rounded tapered powder-coated body", parts.body, body);
  add(
    "Nonslip base, closure seam and recessed drinking well",
    parts.rubber,
    rubber,
  );
  add("Sculpted lid with aperture, flip tab, grip and hinge", parts.lid, lid);
  add("Inset hinge axle", parts.hingePin, metal);
  const logo = add("Logo printed on the curved body", parts.logo, print);
  logo.castShadow = false;
  return group;
}
