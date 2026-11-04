"use client";

import { useEffect, useRef } from "react";

/** Event-driven motion: no render loop, no work while the scene is off screen. */
export function useSceneMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;

    const paint = () => {
      frame = 0;
      if (preference.matches || !visible) return;
      const bounds = scene.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (window.innerHeight / 2 - bounds.top - bounds.height / 2) / window.innerHeight));
      scene.style.setProperty("--scene-shift", `${progress * 140}px`);
      scene.style.setProperty("--scene-turn", `${progress * 18}deg`);
      scene.style.setProperty("--pointer-x", `${pointerX}px`);
      scene.style.setProperty("--pointer-y", `${pointerY}px`);
    };
    const schedule = () => {
      if (!frame && visible && !preference.matches) frame = window.requestAnimationFrame(paint);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const bounds = scene.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 22;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 14;
      schedule();
    };
    const leave = () => { pointerX = 0; pointerY = 0; schedule(); };
    const reset = () => {
      if (preference.matches) {
        ["--scene-shift", "--scene-turn", "--pointer-x", "--pointer-y"].forEach((property) => scene.style.removeProperty(property));
      } else schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      scene.dataset.inView = String(visible);
      if (visible) schedule();
    }, { rootMargin: "80px" });

    observer.observe(scene);
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
    scene.addEventListener("pointermove", move, { passive: true });
    scene.addEventListener("pointerleave", leave);
    preference.addEventListener("change", reset);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerleave", leave);
      preference.removeEventListener("change", reset);
    };
  }, []);

  return ref;
}
