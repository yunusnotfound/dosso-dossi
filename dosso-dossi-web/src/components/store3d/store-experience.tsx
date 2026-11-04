"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { catalogItems, type CatalogResult } from "@/lib/catalog";
import type { Locale } from "@/lib/site";
import { cartPath } from "@/lib/web-commerce";
import { StoreHud } from "./store-hud";
import { StoreCatalogOverlay } from "./store-overlays";
import { StoreProductPanel } from "./store-product-panel";
import { StoreInfoPanel, type StoreInfo } from "./store-info-panel";
import { StoreScene } from "./store-scene";
import type { SceneAction, SceneApi, StationId } from "./scene-types";
import s from "./store-experience.module.css";

const hashSections: Record<string, StoreInfo> = {
  "#hikayemiz": "story",
  "#mobil": "mobile",
  "#menu": "menu",
  "#subeler": "branches",
  "#franchising": "franchise",
};

export function StoreExperience({
  locale,
  catalog,
}: {
  locale: Locale;
  catalog: CatalogResult;
}) {
  const tr = locale === "tr";
  const items = useMemo(
    () => catalogItems(catalog.products),
    [catalog.products],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<StoreInfo | null>(null);
  const [station, setStation] = useState<StationId>("entrance");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [list, setList] = useState(false);
  const api = useRef<SceneApi | null>(null);
  const item = items.find((candidate) => candidate.id === selected);

  const onReady = useCallback((instance: SceneApi) => {
    api.current = instance;
    setReady(true);
  }, []);
  const onError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const onProduct = useCallback((id: string) => {
    setSelected(id);
    setList(false);
    setWelcome(false);
  }, []);
  const onStation = useCallback((id: StationId) => {
    setStation(id);
    setWelcome(false);
  }, []);
  const onAction = useCallback(
    (action: SceneAction) => {
      if (action === "checkout") window.location.assign(cartPath(locale));
      else setInfo(action);
      setWelcome(false);
    },
    [locale],
  );

  useEffect(() => {
    api.current?.pause(Boolean(selected || info || list));
  }, [selected, info, list, ready]);

  useEffect(() => {
    function followHash() {
      const section = hashSections[location.hash];
      if (section) {
        setInfo(section);
        setWelcome(false);
      }
    }
    followHash();
    window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);

  function go(id: StationId) {
    api.current?.goTo(id);
    setWelcome(false);
    setList(false);
  }

  function pinAction(id: string) {
    if (id === "coffee" || id === "thermos") {
      const product = items.find((candidate) => candidate.category === id);
      if (product) onProduct(product.id);
      else setList(true);
    } else onAction(id as SceneAction);
  }

  function closeInfo() {
    setInfo(null);
    if (hashSections[location.hash]) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  return (
    <section
      className={s.experience}
      aria-label={tr ? "Dosso Dossi 3D mağaza" : "Dosso Dossi 3D store"}
    >
      {!failed && (!ready || !welcome) && (
        <h1 className={s.srOnly}>
          {tr ? "Dosso Dossi 3D mağaza" : "Dosso Dossi 3D store"}
        </h1>
      )}
      <div
        className={s.viewport}
        onPointerDownCapture={(event) => {
          if (event.target instanceof HTMLCanvasElement) setWelcome(false);
        }}
      >
        {!failed && (
          <StoreScene
            locale={locale}
            items={items}
            onReady={onReady}
            onError={onError}
            onProduct={onProduct}
            onStation={onStation}
            onAction={onAction}
          />
        )}
        <StoreHud
          locale={locale}
          station={station}
          ready={ready}
          failed={failed}
          welcome={welcome}
          catalogOpen={list}
          onToggleCatalog={() => {
            setList(!list);
            setWelcome(false);
          }}
          onInfo={setInfo}
          onGo={go}
          onPin={pinAction}
        />
      </div>
      {list && (
        <StoreCatalogOverlay
          locale={locale}
          items={items}
          available={catalog.available}
          onClose={() => setList(false)}
          onProduct={onProduct}
        />
      )}
      {item && (
        <StoreProductPanel
          item={item}
          items={items}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      )}
      {info && (
        <StoreInfoPanel
          locale={locale}
          section={info}
          onClose={closeInfo}
          onSection={setInfo}
        />
      )}
    </section>
  );
}
