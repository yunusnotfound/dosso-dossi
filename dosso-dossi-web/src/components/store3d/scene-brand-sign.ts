import * as THREE from "three";

/** A wall-mounted lightbox; the light stays local instead of washing out the room. */
export function createBrandSign(parent: THREE.Object3D, onLoad?: () => void) {
  const root = new THREE.Group();
  root.name = "Dosso Dossi — illuminated acrylic brand sign";
  // Shared centre with the arch and lettering. Local +Z faces into the store.
  root.position.set(0, 3.02, -6.85);
  parent.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;

  const material = <T extends THREE.Material>(value: T) => {
    materials.add(value);
    return value;
  };
  const mesh = (
    name: string,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    z: number,
    shadow = true,
  ) => {
    geometries.add(geometry);
    const item = new THREE.Mesh(geometry, surface);
    item.name = name;
    item.position.z = z;
    item.castShadow = shadow;
    root.add(item);
    return item;
  };

  const graphite = material(new THREE.MeshPhysicalMaterial({
    color: 0x161817,
    metalness: 0.7,
    roughness: 0.24,
    clearcoat: 0.8,
    clearcoatRoughness: 0.16,
  }));
  const edge = material(new THREE.MeshStandardMaterial({
    color: 0xd5c9b0,
    metalness: 0.9,
    roughness: 0.22,
  }));
  const acrylic = material(new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.54,
    clearcoat: 0.075,
    clearcoatRoughness: 0.4,
    specularIntensity: 0.12,
    emissive: 0xffffff,
    emissiveIntensity: 0.18,
    alphaTest: 0.02,
  }));
  const led = material(new THREE.MeshBasicMaterial({
    color: 0xffe0a3,
    toneMapped: false,
  }));

  // The rear housing floats 4 cm off the wall; the front lip is smoothly bevelled.
  const housing = mesh(
    "Graphite lightbox housing",
    new THREE.CylinderGeometry(0.796, 0.796, 0.068, 128),
    graphite,
    0.074,
  );
  housing.rotation.x = Math.PI / 2;
  const bezelProfile = [
    [0.774, 0.043], [0.798, 0.043], [0.808, 0.048],
    [0.816, 0.059], [0.819, 0.075], [0.818, 0.098],
    [0.813, 0.116], [0.804, 0.128], [0.792, 0.132],
    [0.778, 0.132], [0.771, 0.125], [0.771, 0.054],
    [0.774, 0.043],
  ].map(([radius, depth]) => new THREE.Vector2(radius, depth));
  const bezel = mesh(
    "Polished concentric black bezel",
    new THREE.LatheGeometry(bezelProfile, 160),
    graphite,
    0,
  );
  bezel.rotation.x = Math.PI / 2;
  mesh("Fine metal rim highlight", new THREE.TorusGeometry(0.814, 0.003, 8, 160), edge, 0.114, false);
  mesh("Warm concealed LED diffuser", new THREE.TorusGeometry(0.815, 0.009, 12, 160), led, 0.048, false);
  mesh("Original high-resolution logo under acrylic", new THREE.CircleGeometry(0.773, 160), acrylic, 0.123, false);

  // A radial light footprint lies on the actual wall plane. No bloom, new room
  // light, animation or full-screen pass is needed for this stationary fixture.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, "rgba(255, 221, 163, 0)");
  gradient.addColorStop(0.66, "rgba(255, 221, 163, 0)");
  gradient.addColorStop(0.75, "rgba(255, 227, 175, 0.74)");
  gradient.addColorStop(0.79, "rgba(255, 232, 184, 0.92)");
  gradient.addColorStop(0.82, "rgba(255, 218, 151, 0.58)");
  gradient.addColorStop(0.87, "rgba(255, 196, 112, 0.21)");
  gradient.addColorStop(0.94, "rgba(255, 172, 81, 0.035)");
  gradient.addColorStop(1, "rgba(255, 164, 74, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const haloTexture = new THREE.CanvasTexture(canvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(haloTexture);
  const halo = material(new THREE.MeshBasicMaterial({
    map: haloTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }));
  mesh("Soft warm LED spill on orange wall", new THREE.PlaneGeometry(2.08, 2.08), halo, 0.002, false);

  const logo = new THREE.TextureLoader().load(
    "/images/store3d/product-logo.png",
    (loaded) => {
      if (disposed) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = 8;
      acrylic.map = loaded;
      acrylic.emissiveMap = loaded;
      acrylic.needsUpdate = true;
      onLoad?.();
    },
    undefined,
    () => { if (!disposed) onLoad?.(); },
  );
  textures.add(logo);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      textures.forEach((texture) => texture.dispose());
      root.clear();
    },
  };
}
