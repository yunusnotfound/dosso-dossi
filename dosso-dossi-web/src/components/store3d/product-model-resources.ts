import type * as THREE from "three";

export type ProductModelResources = {
  geometry: <T extends THREE.BufferGeometry>(value: T) => T;
  material: <T extends THREE.Material>(value: T) => T;
  texture: <T extends THREE.Texture>(value: T) => T;
  logo: THREE.Texture;
};
