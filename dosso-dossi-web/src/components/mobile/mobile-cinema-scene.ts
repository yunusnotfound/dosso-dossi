import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type MobileCinemaApi = {
  setState: (state: { paused: boolean; scene: number }) => void;
  dispose: () => void;
};
type Options = { paused: boolean; scene: number; onReady: () => void; onError: () => void };
type Pose = { position: THREE.Vector3; rotation: THREE.Euler; scale: number };

function roundedShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function panelGeometry(width: number, height: number, radius: number) {
  const geometry = new THREE.ShapeGeometry(roundedShape(width, height, radius), 20);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, positions.getX(i) / width + .5, positions.getY(i) / height + .5);
  }
  uv.needsUpdate = true;
  return geometry;
}

function createPhone() {
  const group = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x72716e, roughness: .26, metalness: .92, clearcoat: .65, clearcoatRoughness: .22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111211, roughness: .27, metalness: .65 });
  const bodyGeometry = new THREE.ExtrudeGeometry(roundedShape(2.42, 5.23, .39), {
    depth: .17, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: .055, bevelThickness: .055, curveSegments: 20,
  });
  bodyGeometry.translate(0, 0, -.085);
  const body = new THREE.Mesh(bodyGeometry, shell);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const bezel = new THREE.Mesh(panelGeometry(2.39, 5.20, .37), dark);
  bezel.position.z = .147;
  group.add(bezel);
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f2e9, toneMapped: false });
  const screen = new THREE.Mesh(panelGeometry(2.28, 2.28 * 2622 / 1206, .29), screenMaterial);
  screen.position.z = .154;
  group.add(screen);
  // Small machined buttons and antenna bands make the silhouette read as a real object.
  const buttonGeometry = new THREE.BoxGeometry(.048, .44, .10);
  const sideButton = new THREE.Mesh(buttonGeometry, shell);
  sideButton.position.set(1.268, .62, 0);
  group.add(sideButton);
  for (const y of [.65, .03]) {
    const button = new THREE.Mesh(buttonGeometry, shell);
    button.scale.y = .76;
    button.position.set(-1.268, y, 0);
    group.add(button);
  }
  const bandGeometry = new THREE.BoxGeometry(.014, .042, .14);
  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xc6c2b9, roughness: .7 });
  for (const x of [-1.265, 1.265]) for (const y of [-1.88, 1.88]) {
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.position.set(x, y, 0);
    group.add(band);
  }
  return { group, screenMaterial };
}

function createBean(material: THREE.Material, grooveMaterial: THREE.Material) {
  const bean = new THREE.Group();
  const skin = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material);
  skin.scale.set(.16, .23, .115);
  skin.castShadow = true;
  bean.add(skin);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.012, -.21, .04), new THREE.Vector3(.023, -.10, .104),
    new THREE.Vector3(-.02, .03, .116), new THREE.Vector3(.01, .13, .087),
    new THREE.Vector3(.018, .21, .04),
  ]);
  bean.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .012, 6, false), grooveMaterial));
  return bean;
}

function getPoses(active: number): Pose[] {
  const poses: Pose[] = [];
  for (let index = 0; index < 3; index++) {
    const slot = (index - active + 3) % 3;
    poses.push(slot === 0
      ? { position: new THREE.Vector3(.06, .16, 1.05), rotation: new THREE.Euler(-.035, -.12, -.095), scale: 1 }
      : slot === 1
        ? { position: new THREE.Vector3(-1.91, -.10, -.40), rotation: new THREE.Euler(.07, -.43, -.19), scale: .90 }
        : { position: new THREE.Vector3(1.94, .20, -.68), rotation: new THREE.Euler(-.06, .37, .18), scale: .90 });
  }
  return poses;
}

export function createMobileCinema(canvas: HTMLCanvasElement, options: Options): MobileCinemaApi {
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "default" });
  if (!context) throw new Error("WebGL 2 unavailable");
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 50);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .05);
  world.environment = environmentTarget.texture;
  world.environmentIntensity = .9;
  environment.dispose();
  pmrem.dispose();
  world.add(new THREE.HemisphereLight(0xfff8ef, 0xa7673d, .9));
  const key = new THREE.DirectionalLight(0xfff9f0, 3.2);
  key.position.set(-4, 6, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 24;
  key.shadow.normalBias = .03;
  key.shadow.bias = -.0001;
  key.shadow.radius = 4;
  world.add(key);
  const rim = new THREE.DirectionalLight(0xff8642, 2.2);
  rim.position.set(5, 1.5, -2);
  world.add(rim);
  const face = new THREE.DirectionalLight(0xffffff, 1.1);
  face.position.set(2, -1, 7);
  world.add(face);

  const stage = new THREE.Group();
  world.add(stage);
  const phones = [createPhone(), createPhone(), createPhone()];
  phones.forEach(({ group }) => stage.add(group));
  const orangeMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe34905, metalness: .18, roughness: .27, clearcoat: 1, clearcoatRoughness: .21 });
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(3.27, .082, 16, 160), orangeMaterial);
  orbit.scale.set(1, .85, 1);
  orbit.rotation.set(.77, -.26, -.46);
  orbit.position.set(0, .08, -1.35);
  stage.add(orbit);
  const pearlMaterial = new THREE.MeshPhysicalMaterial({ color: 0xfff6de, roughness: .2, metalness: .25, clearcoat: 1 });
  const orangePearl = new THREE.Mesh(new THREE.SphereGeometry(.27, 32, 24), orangeMaterial);
  orangePearl.position.set(2.72, -2.14, 1);
  stage.add(orangePearl);
  const creamPearl = new THREE.Mesh(new THREE.SphereGeometry(.16, 24, 18), pearlMaterial);
  creamPearl.position.set(-2.76, 2.15, .6);
  stage.add(creamPearl);
  const beanMaterial = new THREE.MeshPhysicalMaterial({ color: 0x6c3c20, roughness: .44, clearcoat: .25, clearcoatRoughness: .4 });
  const beanGroove = new THREE.MeshStandardMaterial({ color: 0x29190f, roughness: .75 });
  const beans = [createBean(beanMaterial, beanGroove), createBean(beanMaterial, beanGroove), createBean(beanMaterial, beanGroove)];
  const beanPositions = [[-2.52, -2.26, .5], [2.63, 2.2, .1], [-2.96, .5, -.8]];
  beans.forEach((bean, index) => {
    bean.position.fromArray(beanPositions[index]);
    bean.rotation.set(.3 + index * .4, -.4 + index * .3, -.6 + index * .7);
    bean.scale.setScalar(index === 0 ? 1.6 : 1.25);
    stage.add(bean);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.ShadowMaterial({ opacity: .10 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.02;
  floor.receiveShadow = true;
  world.add(floor);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false, contextLost = false, visible = true, loaded = false;
  let paused = options.paused, active = Math.max(0, Math.min(2, options.scene));
  let frame = 0, lastTime = 0, elapsed = 0;
  let poses = getPoses(active);
  let pointerX = 0, pointerY = 0;
  const textures: THREE.Texture[] = [];
  const targetQuaternion = new THREE.Quaternion();
  const targetScale = new THREE.Vector3();

  function staticMotion() { return paused || reducedMotion.matches; }
  function applyPoses(immediate: boolean, delta = 0) {
    const blend = immediate ? 1 : 1 - Math.exp(-delta * 5.2);
    phones.forEach(({ group }, index) => {
      const pose = poses[index];
      group.position.lerp(pose.position, blend);
      targetQuaternion.setFromEuler(pose.rotation);
      group.quaternion.slerp(targetQuaternion, blend);
      targetScale.setScalar(pose.scale);
      group.scale.lerp(targetScale, blend);
      if (!staticMotion()) group.position.y += Math.sin(elapsed * .55 + index * 1.6) * .0024;
    });
    stage.rotation.y = THREE.MathUtils.lerp(stage.rotation.y, staticMotion() ? 0 : pointerX * .085, immediate ? 1 : blend * .5);
    stage.rotation.x = THREE.MathUtils.lerp(stage.rotation.x, staticMotion() ? 0 : pointerY * .045, immediate ? 1 : blend * .5);
    if (!staticMotion()) {
      orbit.rotation.z = -.46 + Math.sin(elapsed * .19) * .06;
      orangePearl.position.y = -2.14 + Math.sin(elapsed * .7) * .08;
      creamPearl.position.y = 2.15 + Math.sin(elapsed * .6 + 1) * .10;
      beans.forEach((bean, index) => { bean.rotation.y = -.4 + index * .3 + Math.sin(elapsed * .4 + index) * .14; });
    }
  }
  function render(now: number) {
    frame = 0;
    if (disposed || contextLost || !visible || document.hidden) return;
    const delta = Math.min(lastTime ? (now - lastTime) / 1000 : 1 / 60, .05);
    lastTime = now;
    if (!staticMotion()) elapsed += delta;
    applyPoses(staticMotion(), delta);
    renderer.render(world, camera);
    if (loaded && !staticMotion()) frame = requestAnimationFrame(render);
  }
  function invalidate() {
    if (!disposed && !contextLost && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function resize() {
    if (disposed || contextLost) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    camera.aspect = width / height;
    const verticalSpan = Math.max(6.5, 7.0 / camera.aspect);
    camera.position.set(0, .20, verticalSpan / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) + .6);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    invalidate();
  }
  function pointerMove(event: PointerEvent) {
    if (event.pointerType === "touch" || staticMotion()) return;
    const bounds = canvas.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
  }
  function pointerLeave() { pointerX = 0; pointerY = 0; }
  function motionChanged() { stop(); invalidate(); }
  function visibilityChanged() { stop(); if (!document.hidden) invalidate(); }
  function loseContext(event: Event) { event.preventDefault(); contextLost = true; stop(); options.onError(); }
  function restoreContext() { contextLost = false; resize(); if (loaded) options.onReady(); }

  applyPoses(true);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate(); else stop();
  }, { rootMargin: "100px" });
  intersection.observe(canvas);
  reducedMotion.addEventListener("change", motionChanged);
  document.addEventListener("visibilitychange", visibilityChanged);
  canvas.addEventListener("pointermove", pointerMove, { passive: true });
  canvas.addEventListener("pointerleave", pointerLeave, { passive: true });
  canvas.addEventListener("webglcontextlost", loseContext);
  canvas.addEventListener("webglcontextrestored", restoreContext);
  resize();
  const loader = new THREE.TextureLoader();
  Promise.all(["home", "rewards", "menu"].map(async (name, index) => {
    const texture = await loader.loadAsync(`/images/mobile/app-${name}-20261014.webp`);
    if (disposed) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    textures.push(texture);
    phones[index].screenMaterial.map = texture;
    phones[index].screenMaterial.color.set(0xffffff);
    phones[index].screenMaterial.needsUpdate = true;
  })).then(() => {
    if (disposed) return;
    loaded = true;
    invalidate();
    options.onReady();
  }).catch(() => { if (!disposed) options.onError(); });

  return {
    setState(state) {
      paused = state.paused;
      const next = Math.max(0, Math.min(2, state.scene));
      if (next !== active) { active = next; poses = getPoses(active); }
      stop();
      invalidate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      observer.disconnect();
      intersection.disconnect();
      reducedMotion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("webglcontextlost", loseContext);
      canvas.removeEventListener("webglcontextrestored", restoreContext);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      world.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      environmentTarget.dispose();
      key.shadow.dispose();
      renderer.dispose();
      // React may recreate the effect on the same connected canvas during refresh.
      // Losing that live context would also blank its replacement renderer.
      if (!canvas.isConnected) renderer.forceContextLoss();
    },
  };
}
