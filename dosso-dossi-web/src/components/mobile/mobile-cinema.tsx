"use client";

import { useEffect, useRef, useState } from "react";
import type { MobileCinemaApi } from "./mobile-cinema-scene";
import s from "./mobile-cinema.module.css";

type Props = { locale: "tr" | "en"; paused: boolean; scene: number };

const screens = ["home", "rewards", "menu"];

export function MobileCinema({ locale, paused, scene }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<MobileCinemaApi | null>(null);
  const latest = useRef({ paused, scene });
  latest.current = { paused, scene };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    import("./mobile-cinema-scene")
      .then(({ createMobileCinema }) => {
        if (cancelled) return;
        api.current = createMobileCinema(target, {
          ...latest.current,
          onReady: () => { if (!cancelled) setReady(true); },
          onError: () => { if (!cancelled) setReady(false); },
        });
      })
      .catch(() => { if (!cancelled) setReady(false); });
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => { api.current?.setState({ paused, scene }); }, [paused, scene]);

  return (
    <div
      className={s.cinema}
      data-ready={ready}
      role="img"
      aria-label={locale === "tr"
        ? "Dosso Dossi mobil uygulaması. Üç boyutlu telefonlarda ana sayfa, kahve damgaları ve içecek menüsü."
        : "The Dosso Dossi mobile app. Three-dimensional phones display the home screen, coffee stamps and drink menu."}
    >
      <div className={s.halo} aria-hidden="true" />
      <div className={s.fallback} aria-hidden="true">
        {screens.map((screen, index) => (
          <div key={screen} className={s.phone} data-active={scene === index} data-position={(index - scene + 3) % 3} style={{ aspectRatio: "1206 / 2622" }}>
            {/* Native images preserve the exact app screen while WebGL loads. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/mobile/app-${screen}-20261014.webp`} width={1206} height={2622} alt="" />
          </div>
        ))}
      </div>
      <canvas ref={canvas} className={s.canvas} aria-hidden="true" />
    </div>
  );
}
