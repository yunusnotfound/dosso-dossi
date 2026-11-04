import Image from "next/image";
import type { AppScreen } from "./mobile-copy";
import s from "./app-phone.module.css";

export function AppPhone({ screen, alt, eager = false }: { screen: AppScreen; alt: string; eager?: boolean }) {
  return <div className={s.phone}>
    <div className={s.rim}><div className={s.glass}>
      <Image src={`/images/mobile/app-${screen}-20261014.webp`} alt={alt} width={1206} height={2622} sizes="(max-width: 760px) 65vw, 320px" preload={eager} />
      <span className={s.reflection} aria-hidden="true" />
    </div></div>
    <span className={s.sideButton} aria-hidden="true" />
  </div>;
}
