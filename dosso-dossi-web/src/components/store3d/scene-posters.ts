import * as THREE from "three";

const IMAGE_HEIGHT = 2.35;
const IMAGE_WIDTH = IMAGE_HEIGHT * (941 / 1672);
const FRAME_RIM = 0.03;
const FRAME_DEPTH = 0.07;

const POSTERS: {
  name: string;
  file: string;
  position: [number, number, number];
  rotationY: number;
}[] = [
  {
    name: "5 damga, 1 ikram",
    file: "bes-damga.webp",
    position: [-4.25, 2.55, -6.79],
    rotationY: 0,
  },
  {
    name: "Yükle Kazan",
    file: "yukle-kazan.webp",
    position: [4.25, 2.55, -6.79],
    rotationY: 0,
  },
  {
    name: "Kahve keyfin hep yanında",
    file: "termos.webp",
    position: [-6.79, 2.65, 2.2],
    rotationY: Math.PI / 2,
  },
  {
    name: "Serinliğin üç hali",
    file: "serinligin-uc-hali.png",
    position: [6.79, 2.65, 4.95],
    rotationY: -Math.PI / 2,
  },
];

/** Existing approved artwork, mounted as physical frames facing into the shop. */
export function createPosters(scene: THREE.Scene, onLoad?: () => void) {
  const root = new THREE.Group();
  root.name = "Dosso Dossi — framed campaign posters";
  scene.add(root);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const paperGeometry = new THREE.PlaneGeometry(IMAGE_WIDTH, IMAGE_HEIGHT);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x252624,
    roughness: 0.88,
    metalness: 0.06,
  });
  const paperMaterials: THREE.MeshBasicMaterial[] = [];
  const textures = new Set<THREE.Texture>();
  const loader = new THREE.TextureLoader();
  let disposed = false;
  const outerWidth = IMAGE_WIDTH + FRAME_RIM * 2;
  const outerHeight = IMAGE_HEIGHT + FRAME_RIM * 2;

  const box = (
    group: THREE.Group,
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    castShadow = true,
  ) => {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  for (const poster of POSTERS) {
    const group = new THREE.Group();
    group.name = poster.name;
    group.position.set(...poster.position);
    group.rotation.y = poster.rotationY;
    root.add(group);

    box(group, [outerWidth, outerHeight, 0.025], [0, 0, -0.025], frameMaterial);
    for (const side of [-1, 1]) {
      box(
        group,
        [FRAME_RIM, outerHeight, FRAME_DEPTH],
        [(side * (IMAGE_WIDTH + FRAME_RIM)) / 2, 0, 0],
        frameMaterial,
      );
      box(
        group,
        [IMAGE_WIDTH, FRAME_RIM, FRAME_DEPTH],
        [0, (side * (IMAGE_HEIGHT + FRAME_RIM)) / 2, 0],
        frameMaterial,
      );
    }

    // The artwork meets the inner black frame edge without a mat, crop or tint.
    const paperMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      fog: false,
    });
    paperMaterials.push(paperMaterial);
    const paper = new THREE.Mesh(paperGeometry, paperMaterial);
    paper.name = `${poster.name} — original artwork`;
    paper.position.z = 0.0085;
    paper.visible = false;
    group.add(paper);
    const texture = loader.load(
      `/images/store3d/posters/${poster.file}`,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = 4;
        paperMaterial.map = loaded;
        paperMaterial.needsUpdate = true;
        paper.visible = true;
        onLoad?.();
      },
      undefined,
      () => {
        if (!disposed) onLoad?.();
      },
    );
    textures.add(texture);
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(root);
      root.clear();
      boxGeometry.dispose();
      paperGeometry.dispose();
      frameMaterial.dispose();
      paperMaterials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      textures.clear();
    },
  };
}
