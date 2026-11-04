import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { StoreObstacle } from "./scene-environment";

type Position = [number, number, number];

/** Built at human scale; all static parts are batched into one mesh per material. */
export function createCafeFurniture(parent: THREE.Group, onLoad?: () => void) {
  const root = new THREE.Group();
  root.name = "Café — walnut banquette, bentwood lounge chairs and stone tables";
  parent.add(root);
  const source = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  const material = (parameters: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial(parameters);

  // A subtle woven relief reads as upholstery in the window's grazing light.
  const weavePixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const index = (y * 64 + x) * 4;
      const value = 126 + (x % 4 < 2 ? 14 : -14) + (y % 4 < 2 ? 8 : -8);
      weavePixels.set([value, value, value, 255], index);
    }
  }
  const weave = new THREE.DataTexture(weavePixels, 64, 64);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(5, 5);
  weave.needsUpdate = true;
  textures.add(weave);
  const materials = {
    walnut: material({ color: 0x765039, roughness: 0.46 }),
    linen: material({ color: 0xe8ddc9, roughness: 0.95, bumpMap: weave, bumpScale: 0.004 }),
    orange: material({ color: 0xed632b, roughness: 0.92, bumpMap: weave, bumpScale: 0.003 }),
    orangePiping: material({ color: 0xc64a20, roughness: 0.85 }),
    orangeCeramic: material({ color: 0xde632f, roughness: 0.26, metalness: 0.015 }),
    porcelain: material({ color: 0xfff9e9, roughness: 0.23, metalness: 0.015 }),
    romanQuartz: material({ color: 0xf1e7d5, roughness: 0.31 }),
    ink: material({ color: 0x292a26, roughness: 0.48, metalness: 0.35 }),
    brass: material({ color: 0xa88a55, roughness: 0.3, metalness: 0.78 }),
    steel: material({ color: 0xc7c6c0, roughness: 0.22, metalness: 0.9 }),
    terracotta: material({ color: 0xb47150, roughness: 0.87 }),
    soil: material({ color: 0x343126, roughness: 1 }),
    stem: material({ color: 0x5b5340, roughness: 0.85 }),
    leaf: material({ color: 0x35563d, roughness: 0.55, side: THREE.DoubleSide }),
    leafLight: material({ color: 0x5b7245, roughness: 0.63, side: THREE.DoubleSide }),
    coffee: material({ color: 0x4a2614, roughness: 0.28 }),
    crema: material({ color: 0xc08c51, roughness: 0.48 }),
    paper: material({ color: 0xe9e0c9, roughness: 0.94 }),
    book: material({ color: 0x3d5149, roughness: 0.76 }),
  };
  const loader = new THREE.TextureLoader();
  const woodTexture = loader.load(
    "/images/store3d/objects/walnut-grain-v1.webp",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      materials.walnut.map = texture;
      materials.walnut.color.set(0xd3bea6);
      materials.walnut.needsUpdate = true;
      onLoad?.();
    },
    undefined,
    () => { if (!disposed) onLoad?.(); },
  );
  textures.add(woodTexture);
  const quartzTexture = loader.load(
    "/images/store3d/objects/roman-ivory-quartz-v1.webp",
    (texture) => {
      if (disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      materials.romanQuartz.map = texture;
      materials.romanQuartz.bumpMap = texture;
      materials.romanQuartz.bumpScale = 0.002;
      materials.romanQuartz.color.set(0xffffff);
      materials.romanQuartz.needsUpdate = true;
      onLoad?.();
    },
    undefined,
    () => { if (!disposed) onLoad?.(); },
  );
  textures.add(quartzTexture);

  const mesh = (
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: Position,
    group: THREE.Object3D = source,
  ) => {
    geometries.add(geometry);
    const item = new THREE.Mesh(geometry, surface);
    item.position.set(...position);
    group.add(item);
    return item;
  };
  const rounded = (
    size: Position,
    position: Position,
    surface: THREE.Material,
    radius = 0.025,
    group: THREE.Object3D = source,
  ) => mesh(new RoundedBoxGeometry(...size, 2, radius), surface, position, group);
  const cylinder = (
    top: number,
    bottom: number,
    height: number,
    position: Position,
    surface: THREE.Material,
    group: THREE.Object3D = source,
    segments = 32,
  ) => mesh(new THREE.CylinderGeometry(top, bottom, height, segments), surface, position, group);
  const lathe = (
    profile: [number, number][],
    position: Position,
    surface: THREE.Material,
    group: THREE.Object3D = source,
    segments = 40,
  ) => mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments), surface, position, group);
  const tube = (
    points: Position[],
    radius: number,
    surface: THREE.Material,
    group: THREE.Object3D = source,
    segments = 24,
  ) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), segments, radius, 8, false), surface, [0, 0, 0], group);
  const rod = (
    from: Position,
    to: Position,
    radius: number,
    surface: THREE.Material,
    group: THREE.Object3D = source,
    bottomRadius = radius,
  ) => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const middle = start.add(end).multiplyScalar(0.5);
    const item = cylinder(radius, bottomRadius, direction.length(), middle.toArray() as Position, surface, group, 12);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return item;
  };
  const torus = (
    radius: number,
    thickness: number,
    position: Position,
    surface: THREE.Material,
    group: THREE.Object3D = source,
  ) => mesh(new THREE.TorusGeometry(radius, thickness, 8, 40), surface, position, group);

  // The banquette sits below the window sill, with three loose cushions and a
  // ventilated walnut base. Its open underside preserves light and floor depth.
  rounded([0.82, 0.09, 2.48], [6.12, 0.405, 2.87], materials.walnut, 0.035);
  rounded([0.07, 0.56, 2.48], [6.47, 0.69, 2.87], materials.walnut, 0.025);
  for (const z of [1.76, 2.87, 3.98]) {
    rounded([0.68, 0.27, 0.055], [6.12, 0.245, z], materials.walnut, 0.012);
    for (const x of [5.86, 6.39]) cylinder(0.022, 0.024, 0.11, [x, 0.065, z], materials.brass, source, 12);
  }
  for (let index = 0; index < 3; index++) {
    const z = 2.06 + index * 0.81;
    rounded([0.7, 0.13, 0.775], [6.08, 0.515, z], materials.linen, 0.055);
    const back = rounded([0.12, 0.38, 0.775], [6.39, 0.74, z], materials.linen, 0.045);
    back.rotation.z = -0.08;
  }
  // Two small orange cushions bookend the cream banquette. Their piping and
  // fabric-covered buttons share each cushion's lean rather than floating.
  const pipingPoints: Position[] = [
    [-0.079, 0.131, 0.098], [-0.079, 0.12, 0.125],
    [-0.079, 0.093, 0.136], [-0.079, -0.093, 0.136],
    [-0.079, -0.12, 0.125], [-0.079, -0.131, 0.098],
    [-0.079, -0.131, -0.098], [-0.079, -0.12, -0.125],
    [-0.079, -0.093, -0.136], [-0.079, 0.093, -0.136],
    [-0.079, 0.12, -0.125], [-0.079, 0.131, -0.098],
  ];
  const pipingGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pipingPoints.map((point) => new THREE.Vector3(...point)), true),
    56, 0.002, 6, true,
  );
  for (const [z, tilt] of [[2.0, -0.1], [3.7, 0.12]]) {
    const pillow = new THREE.Group();
    pillow.position.set(6.19, 0.74, z);
    pillow.rotation.set(tilt, tilt * 0.6, -0.2);
    source.add(pillow);
    rounded([0.18, 0.33, 0.34], [0, 0, 0], materials.orange, 0.075, pillow);
    mesh(pipingGeometry, materials.orangePiping, [0, 0, 0], pillow);
    const button = mesh(new THREE.SphereGeometry(0.013, 10, 8), materials.orange, [-0.092, 0, 0], pillow);
    button.scale.set(0.25, 1, 1);
  }

  // Porcelain-topped bistro table: rolled edge, turned metal stem and low bell foot.
  const table: Position = [5.0, 0, 2.92];
  const tableGroup = new THREE.Group();
  tableGroup.position.set(...table);
  source.add(tableGroup);
  lathe([[0, 0.745], [0.48, 0.745], [0.513, 0.751], [0.522, 0.766], [0.516, 0.784], [0.49, 0.794], [0, 0.794]], [0, 0, 0], materials.porcelain, tableGroup, 64);
  lathe([[0, 0.025], [0.29, 0.025], [0.305, 0.039], [0.297, 0.062], [0.23, 0.078], [0.125, 0.14], [0.065, 0.21], [0.055, 0.69], [0.17, 0.728], [0.17, 0.744], [0, 0.744]], [0, 0, 0], materials.ink, tableGroup);
  cylinder(0.063, 0.063, 0.025, [0, 0.19, 0], materials.brass, tableGroup);

  // Both seating areas share the same bentwood joinery, tapered legs and
  // orange upholstery. The existing right-hand chair keeps its exact pose.
  const bentwoodChair = (position: Position, rotation: number) => {
    const chair = new THREE.Group();
    chair.position.set(...position);
    chair.rotation.y = rotation;
    source.add(chair);
    lathe([[0, 0.43], [0.29, 0.43], [0.326, 0.442], [0.331, 0.477], [0.306, 0.492], [0, 0.492]], [0, 0, 0], materials.walnut, chair);
    lathe([[0, 0.49], [0.272, 0.49], [0.293, 0.504], [0.282, 0.531], [0, 0.537]], [0, 0, 0], materials.orange, chair);
    for (const x of [-1, 1]) {
      rod([x * 0.235, 0.445, -0.19], [x * 0.29, 0.035, -0.27], 0.022, materials.walnut, chair, 0.017);
      rod([x * 0.225, 0.46, 0.19], [x * 0.285, 0.035, 0.31], 0.022, materials.walnut, chair, 0.017);
      cylinder(0.021, 0.021, 0.045, [x * 0.29, 0.024, -0.27], materials.ink, chair, 12);
      cylinder(0.021, 0.021, 0.045, [x * 0.285, 0.024, 0.31], materials.ink, chair, 12);
    }
    tube([[-0.25, 0.45, 0.2], [-0.31, 0.75, 0.3], [-0.275, 0.99, 0.34], [0, 1.075, 0.36], [0.275, 0.99, 0.34], [0.31, 0.75, 0.3], [0.25, 0.45, 0.2]], 0.027, materials.walnut, chair, 44);
    tube([[-0.3, 0.76, 0.3], [0, 0.79, 0.34], [0.3, 0.76, 0.3]], 0.024, materials.walnut, chair);
    rounded([0.49, 0.18, 0.042], [0, 0.885, 0.337], materials.linen, 0.035, chair);
    const stretcher = torus(0.224, 0.013, [0, 0.22, 0.02], materials.walnut, chair);
    stretcher.rotation.x = Math.PI / 2;
  };
  bentwoodChair([4.82, 0, 4.1], -0.15);

  // The lounge tabletop meets the existing cups, linen and book at y=.811.
  // A continuous eased stone edge sits on a sculpted metal tulip pedestal.
  const loungeTable = new THREE.Group();
  loungeTable.position.set(-4.1, 0, 3.6);
  source.add(loungeTable);
  const stoneTop = lathe([
    [0, 0.738], [0.712, 0.738], [0.735, 0.741], [0.752, 0.753],
    [0.76, 0.772], [0.758, 0.788], [0.749, 0.801], [0.733, 0.809],
    [0.713, 0.811], [0, 0.811],
  ], [0, 0, 0], materials.romanQuartz, loungeTable, 80);
  const topPositions = stoneTop.geometry.getAttribute("position");
  const topUvs = stoneTop.geometry.getAttribute("uv");
  for (let vertex = 0; vertex < topPositions.count; vertex++) {
    topUvs.setXY(vertex, topPositions.getX(vertex) / 1.9 + 0.5, topPositions.getZ(vertex) / 1.9 + 0.5);
  }
  lathe([
    [0, 0.026], [0.318, 0.026], [0.352, 0.034], [0.365, 0.051],
    [0.356, 0.071], [0.32, 0.084], [0.267, 0.097], [0.205, 0.127],
    [0.142, 0.18], [0.094, 0.247], [0.071, 0.325], [0.065, 0.51],
    [0.078, 0.586], [0.114, 0.64], [0.182, 0.687], [0.255, 0.717],
    [0.269, 0.73], [0, 0.73],
  ], [0, 0, 0], materials.ink, loungeTable, 64);
  cylinder(0.254, 0.254, 0.008, [0, 0.734, 0], materials.brass, loungeTable, 64);
  const footReveal = torus(0.352, 0.004, [0, 0.038, 0], materials.brass, loungeTable);
  footReveal.rotation.x = Math.PI / 2;
  cylinder(0.073, 0.074, 0.017, [0, 0.314, 0], materials.brass, loungeTable, 40);
  for (const [x, z] of [[-5.25, 3.6], [-3, 3.6], [-4.1, 4.85]]) {
    bentwoodChair([x, 0, z], Math.atan2(x + 4.1, z - 3.6));
  }

  // True hollow ceramics, curved handles, recessed saucers and a visible liquid
  // surface give the small objects a readable silhouette from every viewpoint.
  const cupProfile: [number, number][] = [[0, 0.012], [0.043, 0.012], [0.052, 0.02], [0.063, 0.085], [0.072, 0.114], [0.071, 0.12], [0.064, 0.12], [0.057, 0.087], [0.046, 0.025], [0, 0.025]];
  const cupGeometry = new THREE.LatheGeometry(cupProfile.map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const saucerGeometry = new THREE.LatheGeometry([[0, 0.005], [0.075, 0.005], [0.119, 0.016], [0.127, 0.025], [0.124, 0.032], [0.114, 0.033], [0.067, 0.017], [0, 0.017]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const cup = (x: number, y: number, z: number, rotation: number, surface = materials.porcelain) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    source.add(group);
    mesh(saucerGeometry, surface, [0, 0, 0], group);
    mesh(cupGeometry, surface, [0, 0.017, 0], group);
    const handle = torus(0.036, 0.009, [0.079, 0.09, 0], surface, group);
    handle.scale.set(0.83, 1, 0.85);
    cylinder(0.058, 0.058, 0.002, [0, 0.119, 0], materials.coffee, group);
    const crema = torus(0.05, 0.0045, [0, 0.1205, 0], materials.crema, group);
    crema.rotation.x = Math.PI / 2;
    // The spoon rests on the saucer rather than intersecting the ceramic cup.
    rounded([0.009, 0.004, 0.103], [-0.097, 0.031, 0.012], materials.steel, 0.002, group);
    const bowl = mesh(new THREE.SphereGeometry(1, 12, 8), materials.steel, [-0.097, 0.032, -0.049], group);
    bowl.scale.set(0.014, 0.004, 0.022);
  };
  cup(4.88, 0.795, 2.72, 0.15);
  cup(-4.4, 0.811, 3.38, 0.45);
  cup(-3.79, 0.811, 3.85, Math.PI + 0.3);
  const napkin = rounded([0.22, 0.012, 0.24], [-3.83, 0.816, 3.3], materials.linen, 0.009);
  napkin.rotation.y = 0.18;
  const fold = rounded([0.205, 0.004, 0.095], [-3.828, 0.823, 3.36], materials.linen, 0.004);
  fold.rotation.y = 0.18;
  const windowNapkin = rounded([0.2, 0.01, 0.22], [5.2, 0.801, 3.12], materials.linen, 0.008);
  windowNapkin.rotation.y = -0.2;

  // A closed linen-bound book, with separate covers, page block and bookmark.
  const book = new THREE.Group();
  book.position.set(-4.34, 0.814, 3.92);
  book.rotation.y = -0.28;
  source.add(book);
  rounded([0.29, 0.035, 0.37], [0, 0.024, 0], materials.paper, 0.005, book);
  for (const y of [0.004, 0.046]) rounded([0.306, 0.009, 0.388], [0, y, 0], materials.book, 0.004, book);
  rounded([0.015, 0.052, 0.388], [-0.149, 0.025, 0], materials.book, 0.006, book);
  rounded([0.026, 0.002, 0.072], [0.075, 0.009, 0.21], materials.orange, 0.001, book);
  // The little metal cover inlay is actual geometry, kept restrained at this scale.
  rounded([0.12, 0.002, 0.0025], [0.01, 0.051, -0.086], materials.brass, 0.001, book);
  rounded([0.07, 0.002, 0.0025], [0.01, 0.051, -0.073], materials.brass, 0.001, book);
  for (const y of [0.014, 0.022, 0.03, 0.038]) rounded([0.001, 0.001, 0.354], [0.146, y, 0], materials.linen, 0.0004, book);

  // A sculpted ficus in a hollow, rolled-rim terracotta planter. Each leaf has a
  // folded midrib and pointed tip; it is geometry rather than a textured card.
  const plant = new THREE.Group();
  plant.position.set(6.08, 0, 4.88);
  source.add(plant);
  lathe([[0, 0.018], [0.237, 0.018], [0.25, 0.04], [0.29, 0.46], [0.31, 0.49], [0.31, 0.54], [0.294, 0.555], [0.274, 0.545], [0.273, 0.49], [0.236, 0.065], [0, 0.065]], [0, 0, 0], materials.terracotta, plant, 56);
  cylinder(0.268, 0.268, 0.018, [0, 0.485, 0], materials.soil, plant);
  const potFoot = torus(0.246, 0.012, [0, 0.045, 0], materials.terracotta, plant);
  potFoot.rotation.x = Math.PI / 2;
  tube([[0, 0.48, 0], [-0.055, 0.95, 0.015], [0.025, 1.45, -0.025], [0.045, 2.03, 0]], 0.022, materials.stem, plant, 28);

  const leafGeometry = () => {
    const vertices: number[] = [];
    const uv: number[] = [];
    const indices: number[] = [];
    const rows = 12, columns = 6;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows;
      const width = Math.pow(Math.sin(Math.PI * t), 0.8) * 0.145;
      for (let column = 0; column <= columns; column++) {
        const s = (column / columns) * 2 - 1;
        vertices.push(width * s, t * 0.43, Math.sin(t * Math.PI) * (0.048 - Math.abs(s) * 0.032) - t * t * 0.055);
        uv.push(column / columns, t);
        if (row < rows && column < columns) {
          const index = row * (columns + 1) + column;
          indices.push(index, index + 1, index + columns + 1, index + 1, index + columns + 2, index + columns + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };
  const leafShape = leafGeometry();

  // A glazed bud vase sits behind the cup, leaving the napkin and table edge
  // clear. Three short, branching sprigs repeat the living plant's real leaves.
  const vase = new THREE.Group();
  vase.position.set(5.19, 0.795, 2.87);
  source.add(vase);
  lathe([
    [0, 0], [0.035, 0], [0.049, 0.008], [0.06, 0.045],
    [0.057, 0.083], [0.04, 0.114], [0.021, 0.138],
    [0.019, 0.169], [0.022, 0.178], [0.021, 0.184],
    [0.014, 0.184], [0.013, 0.169], [0.016, 0.14],
    [0.033, 0.111], [0.046, 0.079], [0.048, 0.042],
    [0.033, 0.013], [0, 0.013],
  ], [0, 0, 0], materials.orangeCeramic, vase, 40);
  const sprigs: Position[] = [[-0.045, 0.36, 0.012], [0.035, 0.405, -0.025], [0.055, 0.325, 0.03]];
  sprigs.forEach((tip, index) => {
    tube([[0, 0.12, 0], [tip[0] * 0.45, 0.245, tip[2] * 0.45], tip], 0.002, materials.stem, vase, 10);
    for (const side of [-1, 1]) {
      const leaf = mesh(leafShape, index === 1 ? materials.leafLight : materials.leaf,
        [tip[0] * 0.65, tip[1] - (side === -1 ? 0.09 : 0.025), tip[2] * 0.65], vase);
      leaf.scale.set(0.27, 0.27, 0.27);
      leaf.rotation.set(0.32 + index * 0.2, index * 2.1, side * 0.85);
    }
  });

  for (let index = 0; index < 23; index++) {
    const angle = index * 2.39996;
    const height = 0.87 + (index / 22) * 1.13;
    const reach = 0.13 + ((index * 7) % 5) * 0.028;
    const end: Position = [Math.cos(angle) * reach, height + 0.07, Math.sin(angle) * reach];
    tube([[0, height - 0.12, 0], [end[0] * 0.65, height, end[2] * 0.65], end], 0.006, materials.stem, plant, 6);
    const leaf = mesh(leafShape, index % 4 === 0 ? materials.leafLight : materials.leaf, end, plant);
    leaf.rotation.set(0.65 + (index % 3) * 0.15, -angle, -0.55);
    const size = 0.72 + (index % 5) * 0.07;
    leaf.scale.setScalar(size);
  }
  // Small earth-colored pebbles break the planter's otherwise perfect soil disk.
  const pebbleShape = new THREE.IcosahedronGeometry(0.015, 0);
  for (let index = 0; index < 13; index++) {
    const angle = index * 2.39996, radius = 0.075 + (index % 4) * 0.048;
    const pebble = mesh(pebbleShape, materials.stem, [Math.cos(angle) * radius, 0.499, Math.sin(angle) * radius], plant);
    pebble.scale.set(1, 0.5, 0.8);
  }

  // Convert local furniture transforms once and combine compatible parts.
  // Keeping a single material per batch avoids creating hundreds of draw calls.
  source.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.clearGroups();
    const surface = object.material as THREE.Material;
    const batch = batches.get(surface) ?? [];
    batch.push(geometry);
    batches.set(surface, batch);
  });
  geometries.forEach((geometry) => geometry.dispose());
  geometries.clear();
  for (const [surface, pieces] of batches) {
    const geometry = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    geometries.add(geometry);
    const batch = new THREE.Mesh(geometry, surface);
    batch.name = `Café furniture — ${Object.entries(materials).find(([, value]) => value === surface)?.[0] ?? "detail"}`;
    batch.castShadow = true;
    batch.receiveShadow = true;
    root.add(batch);
  }
  source.clear();

  const collisionBoxes: StoreObstacle[] = [
    { minX: 5.7, maxX: 6.54, minZ: 1.63, maxZ: 4.11 },
    { minX: 4.477, maxX: 5.523, minZ: 2.397, maxZ: 3.443 },
    { minX: 4.44, maxX: 5.2, minZ: 3.72, maxZ: 4.51 },
    { minX: 5.76, maxX: 6.4, minZ: 4.56, maxZ: 5.2 },
  ];
  return {
    collisionBoxes,
    dispose() {
      if (disposed) return;
      disposed = true;
      parent.remove(root);
      geometries.forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((surface) => surface.dispose());
      textures.forEach((texture) => texture.dispose());
      root.clear();
    },
  };
}
