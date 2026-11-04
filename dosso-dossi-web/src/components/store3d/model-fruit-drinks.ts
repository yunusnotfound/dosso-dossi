import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { ProductModelResources } from "./product-model-resources";

export type FruitDrink = "fragola-limone" | "mango-arancio" | "passione-limone";

type SharedResources = {
  cup: THREE.LatheGeometry;
  dome: THREE.LatheGeometry;
  rim: THREE.TorusGeometry;
  label: THREE.BufferGeometry;
  droplet: THREE.SphereGeometry;
  slush: THREE.SphereGeometry;
  pulp: THREE.IcosahedronGeometry;
  ice: RoundedBoxGeometry;
  noise: THREE.DataTexture;
  plastic: THREE.MeshPhysicalMaterial;
  lid: THREE.MeshPhysicalMaterial;
  condensation: THREE.MeshPhysicalMaterial;
  iceMaterial: THREE.MeshPhysicalMaterial;
  orange: THREE.MeshPhysicalMaterial;
  strawInside: THREE.MeshStandardMaterial;
  labelMaterial: THREE.MeshStandardMaterial;
  pulpMaterial: THREE.MeshStandardMaterial;
};

const sharedResources = new WeakMap<ProductModelResources, SharedResources>();
const parameters = {
  "fragola-limone": { color: 0xc9162b, light: 0xe52c3b, seed: 17, tilt: 0.11 },
  "mango-arancio": { color: 0xec7805, light: 0xffa01a, seed: 41, tilt: -0.18 },
  "passione-limone": {
    color: 0xf4cb39,
    light: 0xffe88a,
    seed: 83,
    tilt: -0.16,
  },
} as const;

function randomSequence(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function cupRadius(y: number) {
  return 0.122 + THREE.MathUtils.clamp((y - 0.035) / 0.46, 0, 1) * 0.05;
}

function createCurvedLabel() {
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 8);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i += 1) {
    const angle = (uv.getX(i) - 0.5) * 1.42;
    const y = 0.278 + (uv.getY(i) - 0.5) * 0.215;
    const radius = cupRadius(y) + 0.002;
    positions.setXYZ(i, Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function getShared(resources: ProductModelResources): SharedResources {
  const cached = sharedResources.get(resources);
  if (cached) return cached;
  const geometry = resources.geometry;
  const material = resources.material;
  const random = randomSequence(1337);
  const noisePixels = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < noisePixels.length; i += 4) {
    const value = Math.round(110 + random() * 145);
    noisePixels[i] = value;
    noisePixels[i + 1] = value;
    noisePixels[i + 2] = value;
    noisePixels[i + 3] = 255;
  }
  const noise = resources.texture(new THREE.DataTexture(noisePixels, 64, 64));
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true;
  noise.repeat.set(4, 6);
  noise.needsUpdate = true;

  const plastic = material(
    new THREE.MeshPhysicalMaterial({
      color: 0xf5fbff,
      roughness: 0.08,
      metalness: 0,
      ior: 1.45,
      thickness: 0.003,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    }),
  );
  const lid = material(plastic.clone());
  lid.opacity = 0.2;
  const condensation = material(plastic.clone());
  condensation.opacity = 0.48;
  condensation.roughness = 0.06;
  const iceMaterial = material(
    new THREE.MeshPhysicalMaterial({
      color: 0xfffdf3,
      roughness: 0.13,
      ior: 1.31,
      thickness: 0.04,
      transparent: true,
      opacity: 0.73,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
  );

  const shared: SharedResources = {
    cup: geometry(
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.114, 0],
          [0.122, 0.008],
          [0.122, 0.035],
          [0.125, 0.06],
          [0.145, 0.25],
          [0.167, 0.45],
          [0.172, 0.495],
          [0.18, 0.505],
          [0.18, 0.511],
          [0.173, 0.514],
          [0.168, 0.498],
          [0.117, 0.02],
          [0, 0.02],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        56,
      ),
    ),
    dome: geometry(
      new THREE.LatheGeometry(
        [
          [0.019, 0.643],
          [0.043, 0.638],
          [0.074, 0.627],
          [0.105, 0.608],
          [0.133, 0.58],
          [0.155, 0.548],
          [0.169, 0.516],
          [0.18, 0.511],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        48,
      ),
    ),
    rim: geometry(new THREE.TorusGeometry(1, 0.022, 6, 40)),
    label: geometry(createCurvedLabel()),
    droplet: geometry(new THREE.SphereGeometry(1, 6, 4)),
    slush: geometry(new THREE.SphereGeometry(1, 10, 6)),
    pulp: geometry(new THREE.IcosahedronGeometry(1, 0)),
    ice: geometry(new RoundedBoxGeometry(1, 1, 1, 1, 0.14)),
    noise,
    plastic,
    lid,
    condensation,
    iceMaterial,
    orange: material(
      new THREE.MeshPhysicalMaterial({
        color: 0xef6024,
        roughness: 0.24,
        clearcoat: 0.7,
        clearcoatRoughness: 0.16,
      }),
    ),
    strawInside: material(
      new THREE.MeshStandardMaterial({ color: 0xaf3b12, roughness: 0.5 }),
    ),
    labelMaterial: material(
      new THREE.MeshStandardMaterial({
        map: resources.logo,
        alphaTest: 0.15,
        roughness: 0.48,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    ),
    pulpMaterial: material(new THREE.MeshStandardMaterial({ roughness: 0.48 })),
  };
  sharedResources.set(resources, shared);
  return shared;
}

function placeInstances(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  place: (index: number, transform: THREE.Object3D) => void,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    transform.position.set(0, 0, 0);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(1, 1, 1);
    place(i, transform);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

/** Decorative bar drink: base y=0, top y≈0.85 m, curved brand label faces +Z. */
export function createFruitDrinkModel(
  kind: FruitDrink,
  resources: ProductModelResources,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `fruit-drink-${kind}`;
  group.userData.fruitDrink = kind;
  const shared = getShared(resources);
  const settings = parameters[kind];
  const random = randomSequence(settings.seed);
  const isIced = kind === "passione-limone";
  const isDomed = kind === "fragola-limone";
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    order = 0,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };

  const liquidGeometry = resources.geometry(
    new THREE.LatheGeometry(
      [
        [0, 0.019],
        [0.113, 0.019],
        [0.118, 0.038],
        [0.139, 0.25],
        [0.161, 0.45],
        [0.166, 0.492],
        [0.15, isIced ? 0.494 : 0.512],
        [0.105, isIced ? 0.497 : 0.535],
        [0.045, isIced ? 0.497 : 0.552],
        [0, isIced ? 0.497 : 0.555],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      56,
    ),
  );
  const colors = new Float32Array(
    liquidGeometry.getAttribute("position").count * 3,
  );
  const bottom = new THREE.Color(settings.color);
  const top = new THREE.Color(settings.light);
  const tint = new THREE.Color();
  for (let i = 0; i < colors.length / 3; i += 1) {
    const y = liquidGeometry.getAttribute("position").getY(i);
    tint.copy(bottom).lerp(top, Math.max(0, (y - 0.15) / 0.65) * 0.55);
    tint.toArray(colors, i * 3);
  }
  liquidGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const liquidMaterial = resources.material(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: isIced ? 0.24 : 0.39,
      bumpMap: shared.noise,
      bumpScale: isIced ? 0.0007 : 0.0023,
      clearcoat: isIced ? 0.65 : 0.35,
      clearcoatRoughness: 0.22,
    }),
  );
  const liquid = add(liquidGeometry, liquidMaterial);
  liquid.castShadow = true;
  liquid.receiveShadow = true;
  add(shared.cup, shared.plastic, 2);
  add(shared.label, shared.labelMaterial);

  const rims = placeInstances(
    group,
    shared.rim,
    shared.lid,
    4,
    (index, transform) => {
      const radii = [0.18, 0.176, 0.123, 0.125];
      transform.position.y = [0.508, 0.515, 0.035, 0.057][index];
      transform.rotation.x = Math.PI / 2;
      transform.scale.setScalar(radii[index]);
    },
  );
  rims.renderOrder = 3;
  if (isDomed) add(shared.dome, shared.lid, 3);

  const strawBase = 0.432;
  const strawHeight = (0.85 - strawBase) / Math.cos(settings.tilt);
  const straw = new THREE.Group();
  straw.position.set(isDomed ? 0.021 : 0.065, strawBase, -0.018);
  straw.rotation.z = settings.tilt;
  group.add(straw);
  const strawGeometry = resources.geometry(
    new THREE.LatheGeometry(
      [
        [0.011, 0],
        [0.014, 0],
        [0.014, strawHeight],
        [0.01, strawHeight],
        [0.01, 0],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      24,
    ),
  );
  const pipe = new THREE.Mesh(strawGeometry, shared.orange);
  pipe.castShadow = true;
  straw.add(pipe);
  const opening = new THREE.Mesh(
    resources.geometry(new THREE.CircleGeometry(0.01, 20)),
    shared.strawInside,
  );
  opening.rotation.x = -Math.PI / 2;
  opening.position.y = strawHeight - 0.009;
  straw.add(opening);

  const drops = placeInstances(
    group,
    shared.droplet,
    shared.condensation,
    84,
    (_index, transform) => {
      const y = 0.055 + random() * 0.425;
      const angle = random() * Math.PI * 2;
      const radius = cupRadius(y) + 0.0013;
      transform.position.set(
        Math.sin(angle) * radius,
        y,
        Math.cos(angle) * radius,
      );
      transform.rotation.y = angle;
      const size = 0.0013 + random() ** 3 * 0.004;
      transform.scale.set(size, size * (1 + random() * 0.6), size * 0.48);
    },
  );
  drops.renderOrder = 4;

  if (isIced) {
    const ice = placeInstances(
      group,
      shared.ice,
      shared.iceMaterial,
      12,
      (index, transform) => {
        const angle = index * 2.39996;
        const radius = Math.sqrt((index + 0.5) / 12) * 0.132;
        transform.position.set(
          Math.sin(angle) * radius,
          0.511 + random() * 0.022,
          Math.cos(angle) * radius,
        );
        transform.rotation.set(random() * 0.8, angle, random() * 0.7);
        const size = 0.046 + random() * 0.017;
        transform.scale.set(size, size * 0.82, size * 0.93);
      },
    );
    ice.renderOrder = 3;
  } else {
    const slushMaterial = resources.material(
      new THREE.MeshPhysicalMaterial({
        color: settings.light,
        roughness: 0.37,
        bumpMap: shared.noise,
        bumpScale: 0.002,
        clearcoat: 0.35,
        clearcoatRoughness: 0.2,
      }),
    );
    placeInstances(
      group,
      shared.slush,
      slushMaterial,
      19,
      (index, transform) => {
        const angle = index * 2.39996;
        const radius = Math.sqrt((index + 0.3) / 19) * 0.145;
        const rise = 0.038 * (1 - radius / 0.17);
        transform.position.set(
          Math.sin(angle) * radius,
          0.501 + rise,
          Math.cos(angle) * radius,
        );
        const size = 0.021 + random() * 0.013;
        transform.scale.set(size, size * (0.6 + random() * 0.5), size);
      },
    );
  }

  const pulp = placeInstances(
    group,
    shared.pulp,
    shared.pulpMaterial,
    isIced ? 26 : 62,
    (_index, transform) => {
      const y = 0.045 + random() * 0.445;
      const angle = random() * Math.PI * 2;
      const radius = cupRadius(y) - 0.0048;
      transform.position.set(
        Math.sin(angle) * radius,
        y,
        Math.cos(angle) * radius,
      );
      const size = (isIced ? 0.0018 : 0.0012) + random() * 0.0015;
      transform.scale.set(size, size * 1.4, size * 0.7);
    },
  );
  for (let i = 0; i < pulp.count; i += 1) {
    tint.copy(top).lerp(new THREE.Color(0xfff3cd), random() * 0.38);
    pulp.setColorAt(i, tint);
  }
  if (pulp.instanceColor) pulp.instanceColor.needsUpdate = true;
  return group;
}
