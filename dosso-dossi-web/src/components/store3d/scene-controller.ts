import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createEnvironment } from "./scene-environment";
import { createProducts } from "./scene-products";
import { createPosters } from "./scene-posters";
import { createPhysics, walkingPath } from "./scene-physics";
import {
  stations,
  type SceneApi,
  type SceneAction,
  type StationId,
} from "./scene-types";
import type { CatalogItem } from "@/lib/catalog";
import type { Locale } from "@/lib/site";

type Options = {
  locale: Locale;
  items: CatalogItem[];
  onProduct: (id: string) => void;
  onAction: (id: SceneAction) => void;
  onStation: (id: StationId) => void;
  onError: () => void;
};
export async function createStoreScene(
  canvas: HTMLCanvasElement,
  options: Options,
): Promise<SceneApi> {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL 2 unavailable");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: true,
  });
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eee9e1");
  scene.fog = new THREE.Fog("#eee9e1", 17, 35);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.06, 60);
  camera.position.set(0, 1.72, 6.2);
  camera.lookAt(0, 2.35, 0);
  camera.rotation.order = "YXZ";
  const room = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer),
    environmentMap = pmrem.fromScene(room, 0.04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff6e9, 0x9e8b76, 0.4));
  const sun = new THREE.DirectionalLight(0xfff5df, 1.35);
  sun.position.set(4.5, 7.5, 4);
  sun.castShadow = true;
  const shadowSize = innerWidth < 760 ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.5,
    far: 25,
  });
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.0001;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.PointLight(0xffe4bd, 12, 16, 2);
  fill.position.set(0, 3.8, 2);
  scene.add(fill);
  const barLight = new THREE.PointLight(0xffe4bd, 12, 10, 2);
  barLight.position.set(0, 3, -4.2);
  scene.add(barLight);
  let initialised = false;
  let frame = 0,
    disposed = false,
    paused = false,
    visible = true,
    last = 0,
    contextLost = false,
    stalled = 0;
  let path: { x: number; z: number }[] = [],
    lookTarget = new THREE.Vector3(0, 2.35, 0),
    guided = false;
  let yaw = camera.rotation.y,
    pitch = camera.rotation.x;
  const invalidate = () => {
    if (
      initialised &&
      !disposed &&
      !frame &&
      !paused &&
      visible &&
      !document.hidden
    )
      frame = requestAnimationFrame(render);
  };
  const assetsChanged = () => {
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  };
  const architecture = createEnvironment(scene, assetsChanged),
    products = createProducts(
      scene,
      options.items,
      options.locale,
      assetsChanged,
    );
  const posters = createPosters(scene, assetsChanged);
  let physics: Awaited<ReturnType<typeof createPhysics>>;
  try {
    physics = await createPhysics(architecture.collisionBoxes);
  } catch (error) {
    architecture.dispose();
    products.dispose();
    posters.dispose();
    environmentMap.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    throw error;
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    projected = new THREE.Vector3();
  const overlayRoot = canvas.parentElement;
  const targetQuaternion = new THREE.Quaternion(),
    targetCamera = new THREE.PerspectiveCamera();
  targetCamera.rotation.order = "YXZ";
  const updatePins = () => {
    const width = canvas.clientWidth,
      height = canvas.clientHeight,
      mobile = width < 760,
      top = mobile ? 170 : 140,
      bottom = mobile ? 200 : 110;
    for (const pin of products.pins) {
      const element = overlayRoot?.querySelector<HTMLButtonElement>(
        `[data-scene-pin="${pin.id}"]`,
      );
      if (!element) continue;
      projected.set(...pin.position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width,
        y = (-projected.y * 0.5 + 0.5) * height,
        show =
          projected.z < 1 &&
          projected.z > -1 &&
          Math.abs(projected.x) < 0.94 &&
          y >= top &&
          y <= height - bottom;
      element.style.visibility = show ? "visible" : "hidden";
      element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    }
    const compass = overlayRoot?.querySelector<HTMLElement>(
      "[data-store-compass]",
    );
    if (compass) compass.style.transform = `rotate(${-camera.rotation.y}rad)`;
  };
  function render(now: number) {
    frame = 0;
    if (disposed || paused || !visible || document.hidden) return;
    const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 0.05);
    last = now;
    let moving = false;
    if (path.length) {
      const next = path[0],
        dx = next.x - camera.position.x,
        dz = next.z - camera.position.z,
        distance = Math.hypot(dx, dz);
      if (distance < 0.035) {
        path.shift();
        stalled = 0;
      } else {
        const speed = Math.min(3.1, distance * 8);
        const p = physics.move(
          (dx / distance) * speed * dt,
          (dz / distance) * speed * dt,
        );
        stalled =
          Math.hypot(p.x - camera.position.x, p.z - camera.position.z) < 0.0001
            ? stalled + dt
            : 0;
        camera.position.x = p.x;
        camera.position.z = p.z;
        if (stalled > 0.45) {
          path = [];
          stalled = 0;
        }
      }
      moving = path.length > 0;
    }
    if (guided) {
      targetCamera.position.copy(camera.position);
      targetCamera.lookAt(lookTarget);
      targetQuaternion.copy(targetCamera.quaternion);
    } else {
      targetCamera.rotation.set(pitch, yaw, 0, "YXZ");
      targetQuaternion.copy(targetCamera.quaternion);
    }
    const rotationDifference = camera.quaternion.angleTo(targetQuaternion);
    camera.quaternion.slerp(
      targetQuaternion,
      reduced.matches ? 1 : 1 - Math.exp(-dt * 6),
    );
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.68, 5, dt);
    camera.updateMatrixWorld();
    updatePins();
    renderer.render(scene, camera);
    canvas.dataset.drawCalls = String(renderer.info.render.calls);
    canvas.dataset.cameraPosition = `${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)}`;
    if (
      moving ||
      rotationDifference > 0.0005 ||
      Math.abs(camera.position.y - 1.68) > 0.0005
    )
      invalidate();
  }
  const goTo = (id: StationId) => {
    if (disposed || contextLost) return;
    const station = stations.find((s) => s.id === id);
    if (!station) return;
    stalled = 0;
    path = walkingPath(
      camera.position,
      { x: station.position[0], z: station.position[2] },
      architecture.collisionBoxes,
    );
    lookTarget.set(
      ...(canvas.clientWidth < 760 && station.mobileLook
        ? station.mobileLook
        : station.look),
    );
    guided = true;
    options.onStation(id);
    if (reduced.matches) {
      for (const p of path) {
        const n = physics.move(
          p.x - camera.position.x,
          p.z - camera.position.z,
        );
        camera.position.x = n.x;
        camera.position.z = n.z;
      }
      path = [];
    }
    invalidate();
  };
  let drag: {
    x: number;
    y: number;
    startX: number;
    startY: number;
    id: number;
  } | null = null;
  const down = (event: PointerEvent) => {
    if (paused || contextLost || drag || event.button !== 0 || !event.isPrimary)
      return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    drag = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      id: event.pointerId,
    };
    yaw = camera.rotation.y;
    pitch = camera.rotation.x;
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId || paused) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4
    ) {
      guided = false;
      path = [];
      yaw -= dx * 0.0032;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0025, -0.7, 0.65);
      drag.x = event.clientX;
      drag.y = event.clientY;
      invalidate();
    }
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const clicked =
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (!clicked || paused) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(scene.children, true)[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object) {
      if (object.userData.productId) {
        options.onProduct(object.userData.productId);
        return;
      }
      if (object.userData.action) {
        options.onAction(object.userData.action);
        return;
      }
      object = object.parent;
    }
    // Only an actual floor hit is a movement command; never walk through a wall click.
    if (!hit || Math.abs(hit.point.y) > 0.035) return;
    const point = ray.ray.intersectPlane(ground, new THREE.Vector3());
    if (
      point &&
      point.x > -6.4 &&
      point.x < 6.4 &&
      point.z > -4.1 &&
      point.z < 6.4
    ) {
      path = walkingPath(camera.position, point, architecture.collisionBoxes);
      if (guided) {
        yaw = camera.rotation.y;
        pitch = camera.rotation.x;
      }
      guided = false;
      stalled = 0;
      invalidate();
    }
  };
  const blur = () => {
    const pointerId = drag?.id;
    drag = null;
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height || disposed) return;
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, r.width < 760 ? 1.5 : 1.75),
    );
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.fov = r.width < 760 ? 72 : 64;
    camera.updateProjectionMatrix();
    last = 0;
    invalidate();
  };
  const visibility = () => {
    last = 0;
    blur();
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else invalidate();
  };
  const lost = (e: Event) => {
    e.preventDefault();
    if (contextLost || disposed) return;
    contextLost = true;
    paused = true;
    blur();
    cancelAnimationFrame(frame);
    frame = 0;
    options.onError();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", blur);
  canvas.addEventListener("lostpointercapture", blur);
  canvas.addEventListener("blur", blur);
  canvas.addEventListener("webglcontextlost", lost);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        last = 0;
        invalidate();
      }
    },
    { threshold: 0.01 },
  );
  intersection.observe(canvas);
  // React mounts pins after onReady, and the compass only when the map opens.
  const overlayObserver = new MutationObserver(invalidate);
  if (overlayRoot)
    overlayObserver.observe(overlayRoot, { childList: true, subtree: true });
  const motionChange = () => {
    last = 0;
    invalidate();
  };
  reduced.addEventListener("change", motionChange);
  initialised = true;
  resize();
  invalidate();
  return {
    goTo,
    pause(value) {
      if (disposed || contextLost) return;
      paused = value;
      blur();
      last = 0;
      if (value) {
        path = [];
        yaw = camera.rotation.y;
        pitch = camera.rotation.x;
        guided = false;
        cancelAnimationFrame(frame);
        frame = 0;
      } else invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      blur();
      cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      intersection.disconnect();
      overlayObserver.disconnect();
      reduced.removeEventListener("change", motionChange);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", blur);
      canvas.removeEventListener("lostpointercapture", blur);
      canvas.removeEventListener("blur", blur);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      architecture.dispose();
      products.dispose();
      posters.dispose();
      physics.dispose();
      environmentMap.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}
