import * as THREE from "three";

const PALETTE = {
  plaster: 0xf4efe7,
  stone: 0xe9e2d7,
  porcelain: 0xfffcf5,
  floor: 0xf2eee6,
  ink: 0x222321,
  orange: 0xef6024,
};

/** Subtle relief at architectural scale, without a downloaded material pack. */
function stoneRelief() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(256, 256);
  let seed = 47;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 120 + (seed % 22);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.anisotropy = 4;
  return texture;
}

export function createStoreMaterials(onLoad?: () => void) {
  const relief = stoneRelief();
  const textures = new Set<THREE.Texture>([relief]);
  let disposed = false;
  const plaster = new THREE.MeshStandardMaterial({
    color: PALETTE.plaster,
    roughness: 0.91,
    bumpMap: relief,
    bumpScale: 0.012,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: PALETTE.stone,
    roughness: 0.74,
    bumpMap: relief,
    bumpScale: 0.009,
  });
  const porcelain = new THREE.MeshStandardMaterial({
    color: PALETTE.porcelain,
    roughness: 0.4,
    metalness: 0.02,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: 0xe5d6bf,
    roughness: 0.67,
    metalness: 0,
    bumpMap: relief,
    bumpScale: 0.006,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: PALETTE.ink,
    roughness: 0.55,
    metalness: 0.22,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: PALETTE.orange,
    roughness: 0.76,
  });
  const orangeFabric = new THREE.MeshStandardMaterial({
    color: PALETTE.orange,
    roughness: 0.94,
    bumpMap: relief,
    bumpScale: 0.008,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: 0xd7d5ce,
    roughness: 0.95,
  });
  const niche = new THREE.MeshStandardMaterial({
    color: 0xedc8a9,
    roughness: 0.75,
  });
  const quartz = new THREE.MeshStandardMaterial({
    color: 0xeee3d2,
    roughness: 0.43,
    metalness: 0,
  });
  const walnut = new THREE.MeshStandardMaterial({
    color: 0x67452e,
    roughness: 0.48,
    metalness: 0,
  });
  const orangeTimber = new THREE.MeshStandardMaterial({
    color: 0xe65c25,
    roughness: 0.53,
    metalness: 0,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: 0x98764a,
    roughness: 0.36,
    metalness: 0.78,
  });
  const romanQuartz = new THREE.MeshStandardMaterial({
    color: 0xf1e7d5,
    roughness: 0.34,
    metalness: 0,
  });
  const orangeMarble = new THREE.MeshStandardMaterial({
    color: PALETTE.orange,
    roughness: 0.3,
    metalness: 0,
  });
  const brownMarble = new THREE.MeshStandardMaterial({
    color: 0x63402b,
    roughness: 0.32,
    metalness: 0,
  });
  const loader = new THREE.TextureLoader();
  const surface = (
    path: string,
    targets: THREE.MeshStandardMaterial[],
    bumpScale: number,
    paintedWood: THREE.MeshStandardMaterial[] = [],
  ) => {
    const texture = loader.load(path, (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
      loaded.anisotropy = 8;
      for (const material of targets) {
        material.map = loaded;
        material.bumpMap = loaded;
        material.bumpScale = bumpScale;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      }
      for (const material of paintedWood) {
        material.bumpMap = loaded;
        material.bumpScale = 0.012;
        material.needsUpdate = true;
      }
      onLoad?.();
    }, undefined, () => { if (!disposed) onLoad?.(); });
    textures.add(texture);
  };
  surface("/images/store3d/objects/ivory-quartz-v1.webp", [quartz, stone], 0.018);
  surface("/images/store3d/objects/roman-ivory-quartz-v1.webp", [romanQuartz], 0.003);
  surface("/images/store3d/objects/orange-marble-v1.webp", [orangeMarble], 0.003);
  surface("/images/store3d/objects/espresso-brown-marble-v1.webp", [brownMarble], 0.003);
  surface("/images/store3d/objects/honed-limestone-v1.webp", [floor], 0.012);
  surface("/images/store3d/objects/walnut-grain-v1.webp", [walnut], 0.006, [orangeTimber]);
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff7e4 });
  const foliage = new THREE.MeshStandardMaterial({
    color: 0x4c654b,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  return {
    plaster,
    stone,
    porcelain,
    floor,
    ink,
    orange,
    orangeFabric,
    joint,
    niche,
    quartz,
    romanQuartz,
    orangeMarble,
    brownMarble,
    walnut,
    orangeTimber,
    bronze,
    glow,
    foliage,
    dispose() {
      if (disposed) return;
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      [
        plaster,
        stone,
        porcelain,
        floor,
        ink,
        orange,
        orangeFabric,
        joint,
        niche,
        quartz,
        romanQuartz,
        orangeMarble,
        brownMarble,
        walnut,
        orangeTimber,
        bronze,
        glow,
        foliage,
      ].forEach((material) => material.dispose());
    },
  };
}

export type StoreMaterials = ReturnType<typeof createStoreMaterials>;

/** Physical signage rather than UI floating in front of the camera. */
export function createSignTexture({
  title,
  subtitle = "",
  eyebrow = "",
  dark = false,
  transparent = false,
  width = 1024,
  height = 512,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  dark?: boolean;
  transparent?: boolean;
  width?: number;
  height?: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  if (!transparent) {
    context.fillStyle = dark ? "#222321" : "#f4efe7";
    context.fillRect(0, 0, width, height);
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = dark ? "#f4efe7" : "#222321";
  if (eyebrow) {
    context.font = `500 ${height * 0.054}px sans-serif`;
    context.fillText(eyebrow, width / 2, height * 0.17, width * 0.8);
  }
  const lines = title.split("\n");
  const size = height * (lines.length > 1 ? 0.15 : 0.22);
  context.font = `600 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const lineHeight = size * 1.17;
  lines.forEach((line, i) => {
    const y = height * 0.43 + (i - (lines.length - 1) / 2) * lineHeight;
    context.fillText(line, width / 2, y, width * 0.86);
  });
  context.fillStyle = transparent ? "#fffcf5" : "#ef6024";
  context.fillRect(width * 0.44, height * 0.72, width * 0.12, height * 0.009);
  if (subtitle) {
    context.fillStyle = dark ? "#f4efe7" : "#222321";
    context.font = `500 ${height * 0.062}px sans-serif`;
    context.fillText(subtitle, width / 2, height * 0.85, width * 0.84);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
