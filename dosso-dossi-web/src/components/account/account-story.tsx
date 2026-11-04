import Image from "next/image";
import type { Locale } from "@/lib/site";
import { AccountIcon } from "./account-icon";
import s from "./account.module.css";

export function AccountStory({ locale }: { locale: Locale }) {
  const tr = locale === "tr";
  return (
    <div className={s.story}>
      <div className={s.storyCopy}>
        <p className={s.kicker}>DOSSO DOSSI & YOU</p>
        <h1>{tr ? "Kahve keyfi," : "Your coffee,"}<span>{tr ? "size özel." : "your way."}</span></h1>
        <p className={s.intro}>{tr ? "Siparişleriniz, sepetiniz ve adresleriniz. Kahveye dair her şey, tek bir yerde." : "Your orders, your bag, your addresses. Your coffee essentials, all in one place."}</p>
      </div>
      <div className={s.storyImage}>
        <Image
          src="/images/account/account-coffee-v1.webp"
          alt={tr ? "Turuncu kapaklı Dosso Dossi kahve bardağı, kahve çekirdekleri ve kuvars sunum alanı" : "A Dosso Dossi coffee cup with an orange lid, coffee beans and a quartz display"}
          fill
          sizes="(max-width: 760px) 42vw, (max-width: 1440px) 45vw, 620px"
          priority
        />
      </div>
      <ul className={s.storyBenefits}>
        <li><AccountIcon kind="orders" /><span>{tr ? "Sipariş takibi" : "Order tracking"}</span></li>
        <li><AccountIcon kind="bag" /><span>{tr ? "Size özel sepet" : "Your saved bag"}</span></li>
        <li><AccountIcon kind="address" /><span>{tr ? "Kolay teslimat" : "Easy delivery"}</span></li>
      </ul>
    </div>
  );
}
