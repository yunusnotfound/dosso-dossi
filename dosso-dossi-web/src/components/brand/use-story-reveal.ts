"use client";

import { useEffect, useRef } from "react";

export function useStoryReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const elements = root.querySelectorAll<HTMLElement>("[data-story-reveal]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -25px 0px" });
    elements.forEach((element) => observer.observe(element));
    root.dataset.revealReady = "true";
    return () => {
      observer.disconnect();
      delete root.dataset.revealReady;
    };
  }, []);
  return ref;
}
