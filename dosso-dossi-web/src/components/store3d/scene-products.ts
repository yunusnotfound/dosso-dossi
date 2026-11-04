import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { CatalogItem } from "@/lib/catalog";
import type { Locale } from "@/lib/site";
import { createSignTexture } from "./scene-materials";
import type { ScenePin } from "./scene-types";
import type { ProductModelResources } from "./product-model-resources";
import { createThermosModel } from "./model-thermos";
import { createCoffeeModel } from "./model-coffee";
import { createFruitDrinkModel, type FruitDrink } from "./model-fruit-drinks";

export function createProducts(
  scene: THREE.Scene,
  items: CatalogItem[],
  locale: Locale,
  invalidate: () => void,
) {
  const root = new THREE.Group();
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  let disposed = false;
  const loader = new THREE.TextureLoader();
  const load = (url: string) => {
    const t = loader.load(
      url,
      () => {
        if (!disposed) invalidate();
      },
      undefined,
      () => {},
    );
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    textures.add(t);
    return t;
  };
  const logo = load("/images/store3d/product-logo.png");
  const resources: ProductModelResources = {
    geometry: (value) => {
      geometries.add(value);
      return value;
    },
    material: (value) => {
      materials.add(value);
      return value;
    },
    texture: (value) => {
      textures.add(value);
      return value;
    },
    logo,
  };
  const mat = (parameters: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(parameters);
    materials.add(m);
    return m;
  };
  const dark = mat({ color: 0x292926, roughness: 0.45, metalness: 0.15 });
  const add = (
    parent: THREE.Object3D,
    g: THREE.BufferGeometry,
    m: THREE.Material,
    p: [number, number, number],
  ) => {
    geometries.add(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...p);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  // Repeated shelf pieces reuse the same high-detail geometry and materials.
  const prototypes = new Map<string, THREE.Group>();
  const model = (
    item: CatalogItem,
    position: [number, number, number],
    angle = 0,
    scale = 1,
  ) => {
    let prototype = prototypes.get(item.id);
    if (!prototype) {
      prototype =
        item.category === "thermos"
          ? createThermosModel(item, resources)
          : createCoffeeModel(item, resources);
      prototypes.set(item.id, prototype);
    }
    const group = prototype.clone(true);
    group.position.set(...position);
    group.rotation.y = angle;
    group.scale.setScalar(scale);
    group.userData.productId = item.id;
    root.add(group);
    return group;
  };
  items.slice(0, 8).forEach((item, i) => {
    const angle = (i / (Math.max(items.length, 5) - 1) - 0.5) * 2.2;
    model(
      item,
      [Math.sin(angle) * 0.86, 0.85, Math.cos(angle) * 0.56],
      angle * 0.15,
      0.9,
    );
  });
  const coffee = items.filter((i) => i.category === "coffee"),
    thermos = items.filter((i) => i.category === "thermos");
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++) {
      if (coffee.length)
        model(
          coffee[(row * 3 + col) % coffee.length],
          [-6.08, 0.86 + row * 0.9, -3.7 + col * 1.65],
          Math.PI / 2,
          0.95,
        );
      if (thermos.length)
        model(
          thermos[(row * 3 + col) % thermos.length],
          [6.08, 0.86 + row * 0.9, -2.8 + col * 1.55],
          -Math.PI / 2,
          0.9,
        );
    }
  const tray = add(
    root,
    new RoundedBoxGeometry(2.15, 0.025, 0.65, 3, 0.035),
    mat({ color: 0xf1e9da, roughness: 0.5 }),
    [0.05, 1.13, -4.97],
  );
  tray.name = "Meyveli içecek servis tepsisi";
  const drinks: FruitDrink[] = [
    "fragola-limone",
    "mango-arancio",
    "passione-limone",
  ];
  drinks.forEach((kind, index) => {
    const drink = createFruitDrinkModel(kind, resources);
    drink.position.set(-0.65 + index * 0.7, 1.1425, -4.97);
    drink.rotation.y = [-0.1, 0.05, 0.15][index];
    drink.userData.action = "menu";
    root.add(drink);
  });
  const pins: ScenePin[] = [
    {
      id: "coffee",
      position: [-5.65, 2.6, -2],
      label: { tr: "Kahve seçkisi", en: "Coffee collection" },
      productId: coffee[0]?.id,
    },
    {
      id: "thermos",
      position: [5.65, 2.65, -1.2],
      label: { tr: "Termos koleksiyonu", en: "Thermos collection" },
      productId: thermos[0]?.id,
    },
    {
      id: "menu",
      position: [4.25, 4.1, -6.45],
      label: { tr: "Menüyü keşfet", en: "Explore the menu" },
      action: "menu",
    },
    {
      id: "story",
      position: [-4.25, 4.1, -6.45],
      label: { tr: "Kahve ve biz", en: "Coffee & us" },
      action: "story",
    },
    {
      id: "checkout",
      position: [2.2, 1.75, -4.45],
      label: { tr: "Kasa · Sepetim", en: "Checkout · My bag" },
      action: "checkout",
    },
    {
      id: "branches",
      position: [6.45, 4.15, 4.95],
      label: { tr: "Şubelerimiz", en: "Our locations" },
      action: "branches",
    },
  ];
  const sign = (
    title: string,
    subtitle: string,
    p: [number, number, number],
    angle = 0,
    size: [number, number] = [1.55, 1.05],
  ) => {
    const texture = createSignTexture({ title, subtitle });
    textures.add(texture);
    const mesh = add(
      root,
      new THREE.PlaneGeometry(...size),
      mat({ map: texture, roughness: 0.9 }),
      p,
    );
    mesh.rotation.y = angle;
    return mesh;
  };
  const pos = add(
    root,
    new RoundedBoxGeometry(0.42, 0.3, 0.07, 3, 0.025),
    dark,
    [2.2, 1.45, -4.8],
  );
  pos.rotation.x = -0.2;
  pos.userData.action = "checkout";
  const screen = sign(
    locale === "tr" ? "SEPETİM" : "MY BAG",
    "DOSSO DOSSI",
    [2.2, 1.45, -4.755],
  );
  screen.scale.set(0.23, 0.21, 1);
  screen.rotation.x = -0.2;
  screen.userData.action = "checkout";
  return {
    root,
    pins,
    dispose() {
      disposed = true;
      scene.remove(root);
      root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
