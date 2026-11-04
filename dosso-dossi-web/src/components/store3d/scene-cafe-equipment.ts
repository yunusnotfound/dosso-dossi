import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Vec3 = [number, number, number];

/** Counter props are actual geometry, batched by finish to keep the walking view light. */
export function createCafeEquipment(parent: THREE.Group, onLoad?: () => void) {
  const root = new THREE.Group();
  root.name = "Cafe — barista equipment and patisserie";
  parent.add(root);
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  const parts: THREE.Mesh[] = [];
  let disposed = false;
  const finish = (parameters: THREE.MeshStandardMaterialParameters) => {
    const material = new THREE.MeshStandardMaterial(parameters);
    materials.add(material);
    return material;
  };
  const load = (url: string) => {
    const texture = new THREE.TextureLoader().load(
      url,
      (loaded) => {
        if (disposed) loaded.dispose();
        else onLoad?.();
      },
      undefined,
      () => {},
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.add(texture);
    return texture;
  };
  const cream = finish({ color: 0xf3eddf, roughness: 0.32, metalness: 0.18 });
  const ceramic = finish({ color: 0xfffcf3, roughness: 0.25 });
  const chrome = finish({ color: 0xc6c9c6, roughness: 0.22, metalness: 0.95 });
  const brushed = finish({ color: 0x929b99, roughness: 0.37, metalness: 0.88 });
  const black = finish({ color: 0x202321, roughness: 0.53, metalness: 0.15 });
  const orange = finish({ color: 0xe75920, roughness: 0.45 });
  const wood = finish({ color: 0xb99a78, roughness: 0.57, map: load("/images/store3d/objects/walnut-grain-v1.webp") });
  const coffee = finish({ color: 0x28150d, roughness: 0.78 });
  const crust = finish({ color: 0xd59a49, roughness: 0.77 });
  const bakedEdge = finish({ color: 0x94511f, roughness: 0.83 });
  const cake = finish({ color: 0x4d2819, roughness: 0.85 });
  const icing = finish({ color: 0x3b1b12, roughness: 0.29 });
  const red = finish({ color: 0x8e2925, roughness: 0.42 });
  const paper = finish({ color: 0xece5d5, roughness: 0.98 });
  const label = finish({ map: load("/images/brand/logo.png"), roughness: 0.73, transparent: true, alphaTest: 0.05 });
  // Alpha glass avoids a costly second refraction render while preserving visibility of the food.
  const glass = finish({ color: 0xd9eff0, transparent: true, opacity: 0.10, roughness: 0.14, metalness: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const hopperGlass = finish({ color: 0xb8cac7, transparent: true, opacity: 0.22, roughness: 0.21, depthWrite: false, side: THREE.DoubleSide });

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Vec3,
    rotation: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = material !== glass && material !== hopperGlass;
    mesh.receiveShadow = true;
    root.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const box = (size: Vec3, position: Vec3, material: THREE.Material, radius = 0.012, rotation?: Vec3) =>
    add(new RoundedBoxGeometry(...size, 2, radius), material, position, rotation);
  const cylinder = (top: number, bottom: number, height: number, position: Vec3, material: THREE.Material, rotation?: Vec3, segments = 24) =>
    add(new THREE.CylinderGeometry(top, bottom, height, segments), material, position, rotation);
  const torus = (radius: number, tube: number, position: Vec3, material: THREE.Material, rotation?: Vec3) =>
    add(new THREE.TorusGeometry(radius, tube, 6, 24), material, position, rotation);
  const pipe = (points: Vec3[], radius: number, material: THREE.Material) => {
    const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    add(new THREE.TubeGeometry(path, 16, radius, 7, false), material, [0, 0, 0]);
  };

  const dialCanvas = document.createElement("canvas");
  dialCanvas.width = dialCanvas.height = 256;
  const dialContext = dialCanvas.getContext("2d");
  if (dialContext) {
    dialContext.fillStyle = "#f8f3e8";
    dialContext.fillRect(0, 0, 256, 256);
    dialContext.translate(128, 128);
    for (let tick = 0; tick < 15; tick += 1) {
      const angle = ((tick / 14) * 280 + 130) * Math.PI / 180;
      dialContext.strokeStyle = tick > 11 ? "#df5b28" : "#454641";
      dialContext.lineWidth = tick % 2 === 0 ? 5 : 3;
      dialContext.beginPath();
      dialContext.moveTo(Math.cos(angle) * 81, Math.sin(angle) * 81);
      dialContext.lineTo(Math.cos(angle) * 99, Math.sin(angle) * 99);
      dialContext.stroke();
    }
    dialContext.fillStyle = "#454641";
    dialContext.font = "bold 23px sans-serif";
    dialContext.textAlign = "center";
    dialContext.fillText("BAR", 0, 49);
    dialContext.strokeStyle = "#df5b28";
    dialContext.lineWidth = 7;
    dialContext.beginPath();
    dialContext.moveTo(-8, 10);
    dialContext.lineTo(48, -63);
    dialContext.stroke();
    dialContext.beginPath();
    dialContext.arc(0, 0, 9, 0, Math.PI * 2);
    dialContext.fill();
  }
  const dialTexture = new THREE.CanvasTexture(dialCanvas);
  dialTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(dialTexture);
  const dial = finish({ map: dialTexture, roughness: 0.54 });

  // Two-group espresso machine: deep body, metal work surfaces, walnut cheeks and service details.
  const machineX = -1.72;
  for (const x of [-0.65, 0.65]) {
    for (const z of [-5.48, -4.9]) cylinder(0.034, 0.039, 0.067, [machineX + x, 1.155, z], black);
  }
  box([1.55, 0.065, 0.78], [machineX, 1.207, -5.17], brushed, 0.025);
  box([1.49, 0.47, 0.50], [machineX, 1.507, -5.305], cream, 0.065);
  box([1.34, 0.19, 0.045], [machineX, 1.626, -5.04], brushed, 0.014);
  box([1.40, 0.018, 0.043], [machineX, 1.735, -5.047], orange, 0.006);
  box([1.37, 0.035, 0.46], [machineX, 1.76, -5.305], chrome, 0.015);
  for (const side of [-1, 1]) {
    box([0.065, 0.48, 0.52], [machineX + side * 0.725, 1.516, -5.3], wood, 0.032);
    pipe([[machineX + side * 0.62, 1.795, -5.49], [machineX + side * 0.62, 1.827, -5.49], [machineX + side * 0.62, 1.827, -5.11], [machineX + side * 0.62, 1.795, -5.11]], 0.009, chrome);
  }
  pipe([[machineX - 0.62, 1.825, -5.49], [machineX, 1.825, -5.49], [machineX + 0.62, 1.825, -5.49]], 0.009, chrome);
  box([1.36, 0.014, 0.30], [machineX, 1.248, -4.983], black, 0.01);
  for (let slit = 0; slit < 21; slit += 1) box([0.013, 0.009, 0.273], [machineX - 0.63 + slit * 0.063, 1.261, -4.983], chrome, 0.003);
  for (const offset of [-0.32, 0.32]) {
    const x = machineX + offset;
    cylinder(0.082, 0.09, 0.062, [x, 1.491, -5.003], chrome);
    cylinder(0.065, 0.076, 0.035, [x, 1.442, -4.985], brushed);
    cylinder(0.021, 0.025, 0.23, [x, 1.451, -4.825], black, [Math.PI / 2, 0, 0]);
    cylinder(0.023, 0.023, 0.02, [x, 1.451, -4.707], chrome, [Math.PI / 2, 0, 0]);
    pipe([[x, 1.427, -4.977], [x, 1.4, -4.977], [x - 0.032, 1.389, -4.977]], 0.008, chrome);
    pipe([[x, 1.427, -4.977], [x, 1.4, -4.977], [x + 0.032, 1.389, -4.977]], 0.008, chrome);
    for (const button of [-0.075, -0.025, 0.025, 0.075]) {
      cylinder(0.012, 0.012, 0.012, [x + button, 1.64, -5.008], black, [Math.PI / 2, 0, 0], 12);
    }
  }
  cylinder(0.059, 0.059, 0.025, [machineX, 1.631, -5.006], chrome, [Math.PI / 2, 0, 0]);
  add(new THREE.CircleGeometry(0.049, 32), dial, [machineX, 1.631, -4.991]);
  for (const side of [-1, 1]) {
    const x = machineX + side * 0.60;
    cylinder(0.031, 0.031, 0.03, [x, 1.644, -5.011], black, [Math.PI / 2, 0, 0]);
    pipe([[x, 1.51, -5.0], [x + side * 0.035, 1.43, -4.94], [x + side * 0.075, 1.31, -4.91]], 0.012, chrome);
    cylinder(0.018, 0.013, 0.03, [x + side * 0.075, 1.301, -4.91], brushed);
  }

  const espressoCup = (x: number, y: number, z: number, upsideDown = false) => {
    const profile = [new THREE.Vector2(0.031, 0), new THREE.Vector2(0.037, 0.008), new THREE.Vector2(0.050, 0.068), new THREE.Vector2(0.049, 0.075), new THREE.Vector2(0.043, 0.075), new THREE.Vector2(0.036, 0.017), new THREE.Vector2(0.027, 0.013)];
    add(new THREE.LatheGeometry(profile, 24), ceramic, [x, upsideDown ? y + 0.075 : y, z], upsideDown ? [Math.PI, 0, 0] : undefined);
    torus(0.025, 0.008, [x + 0.049, y + 0.039, z], ceramic);
    if (!upsideDown) cylinder(0.042, 0.042, 0.004, [x, y + 0.065, z], coffee);
  };
  for (const offset of [-0.45, -0.15, 0.15, 0.45]) espressoCup(machineX + offset, 1.782, -5.31, true);
  for (const offset of [-0.32, 0.32]) {
    cylinder(0.085, 0.068, 0.01, [machineX + offset, 1.271, -4.94], ceramic);
    espressoCup(machineX + offset, 1.277, -4.94);
  }

  // On-demand grinder with a transparent bean hopper and visible dosing fork.
  const grinderX = -0.48;
  box([0.31, 0.034, 0.39], [grinderX, 1.143, -5.28], brushed, 0.03);
  cylinder(0.12, 0.135, 0.34, [grinderX, 1.331, -5.32], black);
  cylinder(0.13, 0.12, 0.045, [grinderX, 1.511, -5.32], chrome);
  cylinder(0.125, 0.07, 0.21, [grinderX, 1.642, -5.32], hopperGlass);
  cylinder(0.115, 0.055, 0.145, [grinderX, 1.619, -5.32], coffee);
  cylinder(0.132, 0.132, 0.023, [grinderX, 1.759, -5.32], black);
  cylinder(0.025, 0.025, 0.014, [grinderX, 1.777, -5.32], wood);
  box([0.12, 0.12, 0.07], [grinderX, 1.43, -5.179], brushed, 0.018);
  box([0.065, 0.058, 0.065], [grinderX, 1.366, -5.14], black, 0.008);
  for (const side of [-1, 1]) pipe([[grinderX + side * 0.033, 1.257, -5.22], [grinderX + side * 0.033, 1.257, -5.09]], 0.006, chrome);
  // Individual top beans stop the hopper reading as one solid brown cone.
  for (let bean = 0; bean < 32; bean += 1) {
    const angle = bean * 2.39996;
    const radius = Math.sqrt((bean + 0.5) / 32) * 0.093;
    const x = grinderX + Math.cos(angle) * radius;
    const z = -5.32 + Math.sin(angle) * radius;
    add(new THREE.SphereGeometry(1, 7, 5), bean % 3 === 0 ? bakedEdge : coffee, [x, 1.697 + Math.sin(bean * 8) * 0.008, z], [0, angle, 0.25], [0.014, 0.008, 0.010]);
  }

  // Compact payment terminal faces the customer, keeping the centre of the bar clear.
  box([0.22, 0.028, 0.23], [0.38, 1.142, -4.91], black, 0.02);
  cylinder(0.027, 0.04, 0.16, [0.38, 1.229, -4.94], brushed);
  const tilt = -0.28;
  box([0.34, 0.23, 0.035], [0.38, 1.369, -4.93], black, 0.025, [tilt, 0, 0]);
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 384;
  screenCanvas.height = 256;
  const screenContext = screenCanvas.getContext("2d");
  if (screenContext) {
    screenContext.fillStyle = "#1d2927";
    screenContext.fillRect(0, 0, 384, 256);
    screenContext.fillStyle = "#f5efde";
    screenContext.font = "bold 28px sans-serif";
    screenContext.textAlign = "center";
    screenContext.fillText("DOSSO DOSSI", 192, 82);
    screenContext.fillStyle = "#ed6429";
    screenContext.fillRect(68, 117, 248, 3);
    screenContext.fillStyle = "#d8d7c9";
    screenContext.font = "19px sans-serif";
    screenContext.fillText("COFFEE & GOOD COMPANY", 192, 157);
    screenContext.fillStyle = "#81ab91";
    screenContext.beginPath();
    screenContext.arc(192, 206, 7, 0, Math.PI * 2);
    screenContext.fill();
  }
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(screenTexture);
  const screen = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  materials.add(screen);
  add(new THREE.PlaneGeometry(0.30, 0.195), screen, [0.38, 1.374, -4.91], [tilt, 0, 0]);

  // Walnut and glass pastry vitrine with shelves, frames and individually modelled food.
  const caseX = 1.83;
  const caseZ = -5.21;
  box([1.63, 0.092, 0.77], [caseX, 1.171, caseZ], wood, 0.025);
  box([1.55, 0.018, 0.69], [caseX, 1.226, caseZ], brushed, 0.01);
  for (const x of [caseX - 0.765, caseX + 0.765]) {
    for (const z of [caseZ - 0.325, caseZ + 0.325]) box([0.015, 0.52, 0.015], [x, 1.484, z], chrome, 0.004);
    box([0.009, 0.505, 0.65], [x, 1.484, caseZ], glass, 0.002);
  }
  box([1.55, 0.012, 0.68], [caseX, 1.75, caseZ], glass, 0.004);
  box([1.53, 0.50, 0.009], [caseX, 1.489, caseZ + 0.329], glass, 0.002);
  for (const z of [caseZ - 0.329, caseZ + 0.329]) box([1.55, 0.013, 0.013], [caseX, 1.748, z], chrome, 0.003);
  box([1.49, 0.011, 0.59], [caseX, 1.489, caseZ], glass, 0.003);
  for (const x of [caseX - 0.72, caseX + 0.72]) box([0.022, 0.012, 0.6], [x, 1.48, caseZ], chrome, 0.003);
  for (const x of [caseX - 0.36, caseX + 0.36]) {
    box([0.66, 0.015, 0.54], [x, 1.248, caseZ], ceramic, 0.035);
    box([0.66, 0.015, 0.54], [x, 1.502, caseZ], ceramic, 0.035);
  }
  const croissant = (x: number, y: number, z: number, angle: number) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const segments = 26;
    const rings = 10;
    const curvePoint = (u: number, v: number, lift = 0) => {
      const theta = -Math.PI * 0.69 + u * Math.PI * 1.38;
      const radius = 0.011 + 0.043 * Math.pow(Math.sin(u * Math.PI), 0.72);
      const ringAngle = v * Math.PI * 2;
      return new THREE.Vector3(
        Math.sin(theta) * (0.102 + Math.cos(ringAngle) * (radius + lift)),
        Math.sin(ringAngle) * (radius * 0.82 + lift),
        Math.cos(theta) * (0.102 + Math.cos(ringAngle) * (radius + lift)),
      );
    };
    for (let segment = 0; segment <= segments; segment += 1) {
      for (let ring = 0; ring <= rings; ring += 1) {
        const p = curvePoint(segment / segments, ring / rings);
        positions.push(p.x, p.y, p.z);
        uvs.push(segment / segments, ring / rings);
        if (segment < segments && ring < rings) {
          const index = segment * (rings + 1) + ring;
          indices.push(index, index + rings + 1, index + 1, index + 1, index + rings + 1, index + rings + 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    add(geometry, crust, [x, y + 0.041, z - 0.045], [0, angle, 0]);
    for (let fold = 1; fold < 9; fold += 1) {
      const points = Array.from({ length: 19 }, (_, index) => curvePoint(fold / 9, index / 18, 0.0008));
      const path = new THREE.CatmullRomCurve3(points, true);
      add(new THREE.TubeGeometry(path, 20, 0.002, 4, true), bakedEdge, [x, y + 0.041, z - 0.045], [0, angle, 0]);
    }
  };
  for (const [x, z, angle] of [[1.29, -5.34, -0.3], [1.55, -5.34, 0.3], [1.42, -5.08, 0.1], [2.08, -5.35, -0.2], [2.35, -5.34, 0.3], [2.21, -5.08, -0.4]]) {
    croissant(x, 1.261, z, angle);
  }
  for (const x of [1.30, 1.56, 2.07, 2.34]) {
    for (const z of [-5.35, -5.09]) {
      box([0.17, 0.074, 0.17], [x, 1.548, z], cake, 0.007);
      box([0.171, 0.012, 0.171], [x, 1.543, z], cream, 0.004);
      box([0.18, 0.016, 0.18], [x, 1.59, z], icing, 0.008);
      cylinder(0.024, 0.033, 0.022, [x, 1.609, z], ceramic, undefined, 12);
      add(new THREE.SphereGeometry(0.017, 10, 8), red, [x, 1.631, z]);
      for (const drizzle of [-0.052, 0.0, 0.052]) pipe([[x - 0.07, 1.601, z + drizzle], [x, 1.602, z + drizzle + 0.016], [x + 0.07, 1.601, z + drizzle]], 0.0025, crust);
    }
  }

  // Service corner: cup stack, branded takeaway coffee, stirrers and folded napkins.
  const takeaway = (x: number, z: number, height = 0.23) => {
    const y = 1.122;
    cylinder(0.084, 0.059, height, [x, y + height / 2, z], paper, undefined, 32);
    cylinder(0.089, 0.09, 0.021, [x, y + height + 0.005, z], orange, undefined, 32);
    cylinder(0.078, 0.089, 0.026, [x, y + height + 0.025, z], orange, undefined, 32);
    box([0.024, 0.004, 0.009], [x, y + height + 0.04, z + 0.05], black, 0.003);
    add(new THREE.CircleGeometry(0.047, 32), label, [x, y + height * 0.56, z + 0.074], [-0.10, 0, 0]);
  };
  takeaway(0.79, -5.18);
  takeaway(0.08, -5.39, 0.19);
  for (let napkin = 0; napkin < 5; napkin += 1) box([0.19, 0.004, 0.20], [0.02, 1.125 + napkin * 0.0045, -4.92], paper, 0.003, [0, napkin * 0.025, 0]);
  cylinder(0.052, 0.045, 0.105, [0.67, 1.176, -5.49], black);
  for (let stirrer = 0; stirrer < 7; stirrer += 1) box([0.006, 0.17, 0.011], [0.64 + (stirrer % 4) * 0.016, 1.251, -5.50 + Math.floor(stirrer / 4) * 0.024], wood, 0.002, [0.03 * (stirrer - 3), 0, 0.03 * (stirrer % 3 - 1)]);

  // Merge static parts in local space. Every finish is one draw, regardless of its detail count.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of parts) {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(part.matrix);
    const material = part.material as THREE.Material;
    const batch = batches.get(material) ?? [];
    batch.push(geometry);
    batches.set(material, batch);
    part.geometry.dispose();
    root.remove(part);
  }
  for (const [material, batch] of batches) {
    const merged = mergeGeometries(batch, false);
    for (const geometry of batch) geometry.dispose();
    if (!merged) continue;
    geometries.add(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = "Counter details — shared finish";
    mesh.castShadow = material !== glass && material !== hopperGlass;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      root.clear();
    },
  };
}
