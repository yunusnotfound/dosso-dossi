import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CatalogItem } from "@/lib/catalog";
import type { ProductModelResources } from "./product-model-resources";

const WIDTH = 0.44;
const HEIGHT = 0.68;

/** A filled, gusseted pouch, pinched at its heat-sealed edges. */
function pouchPoint(u: number, v: number, side = 1) {
  const edge = Math.pow(Math.max(0, 1 - u * u), 0.55);
  const fullness = Math.pow(Math.sin(Math.PI * v), 0.52);
  const shoulder = 1 - 0.045 * Math.exp(-(((v - 0.85) / 0.06) ** 2));
  const x = u * WIDTH * 0.5 * shoulder;
  const y = 0.012 + v * HEIGHT;
  const crease =
    (Math.sin(v * 47 + u * 8) * 0.0015 + Math.sin(u * 29 + v * 12) * 0.0012) *
    edge;
  const z = side * (0.009 + 0.081 * edge * fullness + crease * fullness);
  return [x, y, z] as const;
}

function pouchSurface(side: 1 | -1, segmentsX = 40, segmentsY = 48) {
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= segmentsY; row++) {
    for (let column = 0; column <= segmentsX; column++) {
      const u = column / segmentsX;
      const v = row / segmentsY;
      vertices.push(...pouchPoint(u * 2 - 1, v, side));
      uvs.push(side === 1 ? u : 1 - u, v);
      if (row < segmentsY && column < segmentsX) {
        const a = row * (segmentsX + 1) + column,
          b = a + 1,
          c = a + segmentsX + 1,
          d = c + 1;
        indices.push(...(side === 1 ? [a, b, d, a, d, c] : [a, d, b, a, c, d]));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Interpolate the same triangles used by the body, including its shoulder.
// Detail edges then meet the rendered surface rather than the idealised curve.
function pouchSurfacePoint(u: number, v: number, side: 1 | -1 = 1) {
  const column = ((u + 1) / 2) * 40,
    row = v * 48;
  const x = Math.min(39, Math.floor(column)),
    y = Math.min(47, Math.floor(row));
  const fx = column - x,
    fy = row - y;
  const a = pouchPoint((x / 40) * 2 - 1, y / 48, side);
  const d = pouchPoint(((x + 1) / 40) * 2 - 1, (y + 1) / 48, side);
  const middle =
    fx >= fy
      ? pouchPoint(((x + 1) / 40) * 2 - 1, y / 48, side)
      : pouchPoint((x / 40) * 2 - 1, (y + 1) / 48, side);
  const aWeight = 1 - Math.max(fx, fy),
    dWeight = Math.min(fx, fy);
  return a.map(
    (value, i) =>
      value * aWeight + middle[i] * Math.abs(fx - fy) + d[i] * dWeight,
  ) as [number, number, number];
}

function gridGeometry(
  columns: number,
  rows: number,
  point: (u: number, v: number) => readonly [number, number, number],
  reverse = false,
) {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns,
        v = row / rows;
      positions.push(...point(u, v));
      uvs.push(u, v);
      if (column < columns && row < rows) {
        const a = row * (columns + 1) + column;
        const b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(...(reverse ? [a, d, b, a, c, d] : [a, b, d, a, d, c]));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A shallow embossed band follows the pouch instead of crossing it as a bar. */
function surfaceSeal(
  y: number,
  height: number,
  halfWidth: number,
  side: 1 | -1,
  relief = 0.0012,
) {
  return gridGeometry(
    40,
    4,
    (u, v) => {
      const pouchV = (y + (v - 0.5) * height - 0.012) / HEIGHT;
      const [x, py, z] = pouchSurfacePoint(
        (u * 2 - 1) * halfWidth,
        pouchV,
        side,
      );
      return [x, py, z + side * (0.00035 + Math.sin(v * Math.PI) * relief)];
    },
    side === -1,
  );
}

/** Folded side walls join both faces and follow the indented shoulder. */
function sideSeal(side: 1 | -1) {
  return gridGeometry(
    5,
    48,
    (u, v) => {
      const edge = pouchSurfacePoint(side, v);
      const inner = pouchSurfacePoint(side * 0.975, v);
      const profile: [number, number][] = [
        [inner[0], inner[2] + 0.0003],
        [edge[0] - side * 0.001, 0.0108],
        [edge[0] + side * 0.002, 0.006],
        [edge[0] + side * 0.002, -0.006],
        [edge[0] - side * 0.001, -0.0108],
        [inner[0], -inner[2] - 0.0003],
      ];
      const [x, z] = profile[Math.round(u * 5)];
      return [x, edge[1], z];
    },
    side === -1,
  );
}

function endSeal(top: boolean) {
  return gridGeometry(
    40,
    4,
    (u, v) => {
      const [x, y, z] = pouchPoint(u * 2 - 1, top ? 1 : 0);
      // The folded bottom rests at the same Y=0.009 as the original base seal.
      return [x, top ? y : y - Math.sin(v * Math.PI) * 0.003, (v * 2 - 1) * z];
    },
    top,
  );
}

function mergePaperParts(parts: THREE.BufferGeometry[]) {
  const compatible = parts.map((part) =>
    part.index ? part.toNonIndexed() : part,
  );
  const merged = mergeGeometries(compatible, false);
  new Set([...parts, ...compatible]).forEach((part) => part.dispose());
  if (!merged) throw new Error("Cannot merge coffee pouch geometry");
  return merged;
}

function printTexture(item: CatalogItem, resources: ProductModelResources) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 3072;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e0d3ba";
  ctx.fillRect(0, 0, 2048, 3072);
  ctx.fillStyle = "#ded0b5";
  ctx.fillRect(0, 0, 2048, 360);
  // Typeset the existing Turkish-coffee packaging at native texture resolution.
  if (
    item.image &&
    /türk|turk|turkish/i.test(`${item.name.tr} ${item.name.en}`)
  ) {
    ctx.fillStyle = "#b83214";
    ctx.fillRect(205, 820, 1638, 1820);
    ctx.strokeStyle = "#f0e1be";
    ctx.lineWidth = 4;
    ctx.strokeRect(205, 820, 1638, 1820);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f6efdc";
    ctx.font = '600 164px "DM Sans", sans-serif';
    ctx.fillText("TÜRK", 1024, 1770);
    ctx.fillText("KAHVESİ", 1024, 1940);
    ctx.font = '400 74px "DM Sans", sans-serif';
    ctx.fillText("TURKISH COFFEE", 1024, 2060);
    ctx.strokeStyle = "#e9cfaf";
    ctx.lineWidth = 3;
    for (const x of [330, 1160]) {
      for (const y of [2225, 2310]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 560, y);
        ctx.stroke();
      }
    }
    ctx.font = '500 38px "DM Sans", sans-serif';
    ctx.fillText("FINE GRINDED", 610, 2280);
    ctx.fillText("MEDIUM ROAST", 1440, 2280);
    if (item.variant.weightGrams) {
      ctx.font = '700 98px "DM Sans", sans-serif';
      ctx.fillText(`${item.variant.weightGrams} G`, 1024, 2510);
    }
    ctx.fillStyle = "#292821";
    ctx.font = '600 43px "DM Sans", sans-serif';
    ctx.fillText("PULL RIP ZIP TO OPEN", 610, 540);
    for (let x = 1050; x < 1860; x += 130) {
      ctx.beginPath();
      ctx.moveTo(x, 510);
      ctx.lineTo(x + 34, 532);
      ctx.lineTo(x, 554);
      ctx.fill();
    }
    ctx.font = '500 35px "DM Sans", sans-serif';
    ctx.fillText("PRESS TO CLOSE ZIPPER", 1024, 680);
    ctx.setLineDash([10, 11]);
    ctx.beginPath();
    ctx.moveTo(140, 720);
    ctx.lineTo(1900, 720);
    ctx.strokeStyle = "#4b463a";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  const texture = resources.texture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function paperGrain(resources: ProductModelResources) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(256, 256);
  let seed = 82;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 110 + (seed % 35);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = resources.texture(new THREE.CanvasTexture(canvas));
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  return texture;
}

export function createCoffeeModel(
  item: CatalogItem,
  resources: ProductModelResources,
) {
  const group = new THREE.Group();
  group.name = `${item.name.tr} — gusseted pouch`;
  const grain = paperGrain(resources);
  const paper = resources.material(
    new THREE.MeshPhysicalMaterial({
      color: 0xe0d3ba,
      roughness: 0.66,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
      bumpMap: grain,
      bumpScale: 0.00045,
    }),
  );
  const front = resources.material(paper.clone());
  front.color.set(0xffffff);
  front.map = printTexture(item, resources);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(resources.geometry(geometry), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(pouchSurface(1), front);
  const paperParts = [
    pouchSurface(-1),
    sideSeal(-1),
    sideSeal(1),
    endSeal(false),
    endSeal(true),
  ];
  for (const side of [-1, 1] as const) {
    paperParts.push(surfaceSeal(0.022, 0.014, 0.975, side));
    for (const y of [0.662, 0.675]) {
      paperParts.push(surfaceSeal(y, 0.005, 0.973, side));
    }
  }
  paperParts.push(surfaceSeal(0.535, 0.0035, 0.9545, 1, 0.002));
  add(mergePaperParts(paperParts), paper);

  if (item.image) {
    const logoGeometry = new THREE.PlaneGeometry(0.145, 0.145, 16, 16);
    const positions = logoGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i) + 0.407;
      positions.setXYZ(
        i,
        x,
        y,
        pouchPoint(x / (WIDTH / 2), (y - 0.012) / HEIGHT)[2] + 0.0008,
      );
    }
    logoGeometry.computeVertexNormals();
    add(
      logoGeometry,
      resources.material(
        new THREE.MeshStandardMaterial({
          map: resources.logo,
          transparent: true,
          roughness: 0.65,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      ),
    );
  }
  return group;
}
