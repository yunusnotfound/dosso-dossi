"use client";
import { useEffect, useRef } from "react";
import type { CatalogItem } from "@/lib/catalog";
import type { Locale } from "@/lib/site";
import type { SceneAction, SceneApi, StationId } from "./scene-types";
import s from "./store-experience.module.css";

type Props = {
  items: CatalogItem[];
  locale: Locale;
  onProduct: (id: string) => void;
  onAction: (id: SceneAction) => void;
  onStation: (id: StationId) => void;
  onReady: (api: SceneApi) => void;
  onError: () => void;
};
export function StoreScene(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false,
      api: SceneApi | undefined;
    import("./scene-controller")
      .then((module) => {
        if (cancelled) return;
        return module.createStoreScene(target, {
          items: props.items,
          locale: props.locale,
          onProduct: (id) => callbacks.current.onProduct(id),
          onAction: (id) => callbacks.current.onAction(id),
          onStation: (id) => callbacks.current.onStation(id),
          onError: () => {
            if (!cancelled) callbacks.current.onError();
          },
        });
      })
      .then((instance) => {
        if (!instance) return;
        api = instance;
        if (cancelled) instance.dispose();
        else callbacks.current.onReady(instance);
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onError();
      });
    return () => {
      cancelled = true;
      api?.dispose();
    };
  }, [props.items, props.locale]);
  return (
    <canvas
      ref={canvas}
      className={s.canvas}
      tabIndex={0}
      aria-label={
        props.locale === "tr"
          ? "3D Dosso Dossi mağazası. Sürükleyerek bakın, bölüm düğmeleriyle gezinin. Ürün listesi de kullanılabilir."
          : "3D Dosso Dossi store. Drag to look and use the section buttons to explore. The product list is also available."
      }
    />
  );
}
