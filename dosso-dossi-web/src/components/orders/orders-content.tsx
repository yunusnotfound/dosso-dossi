"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/site";
import { accountPath } from "@/lib/customer-account";
import { cartPath, CommerceRequestError } from "@/lib/web-commerce";
import { formatPrice } from "@/lib/catalog";
import {
  orderDate,
  orderError,
  orderLabel,
  ordersPath,
  sandboxPaymentUrl,
  type OrderQuote,
  type OrderResponse,
  type PaymentConfig,
  type WebOrder,
} from "@/lib/web-orders";
import { useCustomerOrders } from "./use-customer-orders";
import { OrderAddressCard, OrderLines, OrderTotals } from "./order-summary";
import s from "./orders.module.css";

type OrderData = {
  customerId: string;
  quote?: OrderQuote;
  order?: WebOrder;
  orders?: WebOrder[];
  payment?: PaymentConfig;
  pagination?: { page: number; limit: number; total: number; pages: number };
};
export function OrdersContent({
  locale,
  orderId,
}: {
  locale: Locale;
  orderId?: string;
}) {
  const en = locale === "en";
  const creating = orderId === "yeni";
  const router = useRouter();
  const [page, setPage] = useState(1);
  const path = creating
    ? "orders/quote"
    : orderId
      ? `orders/${encodeURIComponent(orderId)}`
      : `orders?page=${page}&limit=20`;
  const { status, data, customer, error, busy, refresh, mutate, setError } =
    useCustomerOrders<OrderData>(path);
  const [accepted, setAccepted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const creationKey = useRef<{ identity: string; key: string } | null>(null);
  const quote = data?.quote;
  const order = data?.order;
  useEffect(() => {
    setAccepted(false);
    setConfirmCancel(false);
  }, [quote?.quoteHash, customer?.id, order?.version]);

  async function create() {
    if (!quote || !customer || !accepted || busy) return;
    const identity = `${customer.id}:${quote.quoteHash}`;
    if (creationKey.current?.identity !== identity)
      creationKey.current = { identity, key: crypto.randomUUID() };
    const result = await mutate<OrderResponse>("orders", {
      cartVersion: quote.cartVersion,
      quoteHash: quote.quoteHash,
      idempotencyKey: creationKey.current.key,
      locale,
    });
    if (result) router.push(ordersPath(locale, result.order.id));
  }
  async function action(kind: "cancel" | "payment" | "payment/refresh") {
    if (!order || busy) return;
    const result = await mutate<OrderResponse>(`orders/${order.id}/${kind}`, {
      version: order.version,
    });
    if (!result) return;
    if (kind === "payment" && result.payment?.paymentPageUrl) {
      const destination = sandboxPaymentUrl(result.payment.paymentPageUrl);
      if (!destination) {
        setError(new CommerceRequestError("INVALID_PAYMENT_URL", 503));
        return;
      }
      window.location.assign(destination);
      return;
    }
    setConfirmCancel(false);
    await refresh();
  }

  return (
    <section className={s.page}>
      <div className={s.container}>
        <nav
          className={s.breadcrumb}
          aria-label={en ? "Breadcrumb" : "Sayfa yolu"}
        >
          <Link href={accountPath(locale)}>
            {en ? "My account" : "Hesabım"}
          </Link>
          <span>/</span>
          {orderId ? (
            <Link href={ordersPath(locale)}>
              {en ? "My orders" : "Siparişlerim"}
            </Link>
          ) : (
            <span>{en ? "My orders" : "Siparişlerim"}</span>
          )}
          {orderId && (
            <>
              <span>/</span>
              <span>
                {creating
                  ? en
                    ? "Review"
                    : "Son kontrol"
                  : en
                    ? "Order details"
                    : "Sipariş detayı"}
              </span>
            </>
          )}
        </nav>
        <header className={s.heading}>
          <div>
            <p className={s.eyebrow}>DOSSO DOSSI & YOU</p>
            <h1>
              {creating
                ? en
                  ? "Your selection,\none last look."
                  : "Seçtiklerinize\nson bir bakış."
                : orderId
                  ? en
                    ? "Every step of\nyour coffee journey."
                    : "Kahvenizin yolculuğu,\nadım adım."
                  : en
                    ? "Your coffee\nstories."
                    : "Kahveyle geçen\ngüzel anlar."}
            </h1>
            <p>
              {creating
                ? en
                  ? "Review the products, delivery address and final total before creating your test order."
                  : "Test siparişinizi oluşturmadan önce ürünleri, teslimat adresini ve son tutarı kontrol edin."
                : en
                  ? "Follow your orders and payment status in one place."
                  : "Siparişlerinizi ve ödeme durumlarını tek yerden takip edin."}
            </p>
          </div>
          <Link className={s.textLink} href={cartPath(locale)}>
            {en ? "My bag" : "Sepetim"} <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <div className={s.sandbox}>
          <span>SANDBOX</span>
          <p>
            {en
              ? "This store is in test mode. Orders and iyzico payments are for testing; no real purchase or delivery is made."
              : "Mağaza test modunda. Sipariş ve iyzico ödemeleri deneme amaçlıdır; gerçek satın alma veya teslimat yapılmaz."}
          </p>
        </div>
        {error && status !== "guest" ? (
          <div className={s.error} role="alert">
            {orderError(error, locale)}
          </div>
        ) : null}
        {status === "loading" && (
          <div className={s.empty} role="status">
            {en
              ? "Loading your order details…"
              : "Sipariş bilgileriniz yükleniyor…"}
          </div>
        )}
        {status === "guest" && (
          <div className={s.empty}>
            <h2>
              {en
                ? "Your orders are in your account."
                : "Siparişleriniz hesabınızda."}
            </h2>
            <p>
              {en
                ? "Sign in to create and follow your orders."
                : "Sipariş oluşturmak ve takip etmek için giriş yapın."}
            </p>
            <Link className={s.primary} href={accountPath(locale)}>
              {en ? "Sign in / Create account" : "Giriş yap / Üye ol"} →
            </Link>
          </div>
        )}
        {status === "error" && (
          <div className={s.empty}>
            <h2>
              {creating
                ? en
                  ? "Your bag needs a review."
                  : "Sepetinizi kontrol edelim."
                : en
                  ? "We could not load your orders."
                  : "Siparişlerinize ulaşamadık."}
            </h2>
            <p>
              {creating
                ? en
                  ? "A valid bag, available stock, a selected Türkiye delivery address and configured shipping are required."
                  : "Geçerli sepet, yeterli stok, seçilmiş Türkiye teslimat adresi ve tanımlı kargo ücreti gerekir."
                : en
                  ? "Refresh to view the latest details."
                  : "Güncel bilgileri görmek için yeniden deneyin."}
            </p>
            <div className={s.actions}>
              <button className={s.secondary} onClick={() => void refresh()}>
                {en ? "Try again" : "Yeniden dene"}
              </button>
              {creating && (
                <Link className={s.primary} href={cartPath(locale)}>
                  {en ? "Review my bag" : "Sepetimi kontrol et"}
                </Link>
              )}
            </div>
          </div>
        )}
        {status === "ready" && quote && (
          <div className={s.layout} aria-busy={busy}>
            <div className={s.left}>
              <section className={s.card}>
                <p className={s.eyebrow}>
                  {en ? "YOUR SELECTION" : "SEÇTİKLERİNİZ"}
                </p>
                <h2>
                  {en
                    ? "A little moment for you."
                    : "Kendinize küçük bir mola."}
                </h2>
                <OrderLines lines={quote.lines} locale={locale} />
              </section>
              <OrderAddressCard address={quote.address} locale={locale} />
              <p className={s.note}>
                {en
                  ? "To change products or the delivery address, return to your bag."
                  : "Ürünleri veya teslimat adresini değiştirmek için sepetinize dönün."}{" "}
                <Link href={cartPath(locale)}>
                  {en ? "Edit bag →" : "Sepeti düzenle →"}
                </Link>
              </p>
            </div>
            <aside className={s.summary}>
              <p className={s.eyebrow}>
                {en ? "TEST ORDER SUMMARY" : "TEST SİPARİŞİ ÖZETİ"}
              </p>
              <h2>{en ? "Everything ready." : "Her şey hazır."}</h2>
              <OrderTotals {...quote} locale={locale} />
              <p className={s.note}>
                {en
                  ? `Creating an order reserves stock for ${quote.reservationMinutes} minutes. Payment is a separate step.`
                  : `Sipariş oluşturulduğunda stok ${quote.reservationMinutes} dakika ayrılır. Ödeme ayrı bir adımdır.`}
              </p>
              {!quote.payment.configured && (
                <p className={s.warning}>
                  {en
                    ? "iyzico sandbox credentials are pending. You can create a test order; payment cannot start yet."
                    : "iyzico sandbox bağlantısı bekleniyor. Test siparişi oluşturabilirsiniz; ödeme henüz başlatılamaz."}
                </p>
              )}
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  {en
                    ? "I reviewed the amount and delivery address and understand this is a test order."
                    : "Tutarı ve teslimat adresini kontrol ettim; bunun bir test siparişi olduğunu biliyorum."}
                </span>
              </label>
              <button
                className={s.primary}
                disabled={busy || !accepted}
                onClick={() => void create()}
              >
                {busy
                  ? en
                    ? "Creating…"
                    : "Oluşturuluyor…"
                  : en
                    ? "Create test order"
                    : "Test siparişi oluştur"}
                <span aria-hidden="true">→</span>
              </button>
            </aside>
          </div>
        )}
        {status === "ready" && order && (
          <>
            <div className={s.orderHeading}>
              <div>
                <p className={s.eyebrow}>
                  {en ? "ORDER NUMBER" : "SİPARİŞ NUMARASI"}
                </p>
                <h2>{order.number}</h2>
                <p>
                  {orderDate(order.createdAt, locale)} ·{" "}
                  {en ? "Türkiye time" : "Türkiye saati"}
                </p>
              </div>
              <span className={s.badge}>
                {orderLabel(order.status, locale)}
              </span>
            </div>
            <div className={s.layout} aria-busy={busy}>
              <div className={s.left}>
                <OrderProgress order={order} locale={locale} />
                <section className={s.card}>
                  <h2>{en ? "Your selection" : "Seçtikleriniz"}</h2>
                  <OrderLines lines={order.lines} locale={locale} />
                  <p className={s.note}>
                    {en
                      ? "Products, prices and delivery address are saved as they were when this order was created."
                      : "Ürün, fiyat ve teslimat adresi bilgileri siparişin oluşturulduğu haliyle saklanır."}
                  </p>
                </section>
                <OrderAddressCard address={order.address} locale={locale} />
                {order.carrier && (
                  <section className={s.card}>
                    <p className={s.eyebrow}>
                      {en ? "DELIVERY TRACKING" : "KARGO TAKİBİ"}
                    </p>
                    <h2>{order.carrier}</h2>
                    <p className={s.tracking}>
                      {en ? "Tracking number" : "Takip numarası"}:{" "}
                      <strong>{order.trackingNumber}</strong>
                    </p>
                  </section>
                )}
              </div>
              <aside className={s.summary}>
                <p className={s.eyebrow}>
                  {en ? "ORDER SUMMARY" : "SİPARİŞ ÖZETİ"}
                </p>
                <h2>{en ? "Your coffee moment." : "Kahve molanız."}</h2>
                <OrderTotals {...order} locale={locale} />
                <div className={s.paymentState}>
                  <span>{en ? "Payment" : "Ödeme"}</span>
                  <strong>{orderLabel(order.paymentStatus, locale)}</strong>
                </div>
                {order.status === "OPEN" && order.paymentStatus !== "PAID" && (
                  <p className={s.note}>
                    {en ? "Stock reservation ends:" : "Stok ayırma süresi:"}{" "}
                    {orderDate(order.reservationExpiresAt, locale)}
                  </p>
                )}
                {data.payment &&
                  !data.payment.configured &&
                  order.status === "OPEN" &&
                  order.paymentStatus !== "PAID" && (
                    <p className={s.warning}>
                      {en
                        ? "Sandbox payment is not connected yet. Your order has been saved; no payment was taken."
                        : "Sandbox ödeme bağlantısı henüz hazır değil. Siparişiniz kaydedildi; ödeme alınmadı."}
                    </p>
                  )}
                {order.paymentStatus === "REVIEW" && (
                  <p className={s.warning}>
                    {en
                      ? "This payment needs review. Do not make another payment; the store will check the result."
                      : "Bu ödemenin kontrol edilmesi gerekiyor. Yeniden ödeme yapmayın; mağaza sonucu inceleyecek."}
                  </p>
                )}
                <div className={s.stack}>
                  {order.canPay && (
                    <button
                      className={s.primary}
                      disabled={busy}
                      onClick={() => void action("payment")}
                    >
                      {en
                        ? "Continue to iyzico sandbox"
                        : "iyzico sandbox’a devam et"}{" "}
                      →
                    </button>
                  )}
                  {order.canRefreshPayment && (
                    <button
                      className={s.secondary}
                      disabled={busy}
                      onClick={() => void action("payment/refresh")}
                    >
                      {en
                        ? "Check payment result"
                        : "Ödeme sonucunu kontrol et"}
                    </button>
                  )}
                  <button
                    className={s.secondary}
                    disabled={busy}
                    onClick={() => void refresh()}
                  >
                    {busy
                      ? en
                        ? "Updating…"
                        : "Güncelleniyor…"
                      : en
                        ? "Refresh order"
                        : "Siparişi yenile"}
                  </button>
                  {order.canCancel && !confirmCancel && (
                    <button
                      className={s.textButton}
                      disabled={busy}
                      onClick={() => setConfirmCancel(true)}
                    >
                      {en
                        ? "Cancel unpaid order"
                        : "Ödenmemiş siparişi iptal et"}
                    </button>
                  )}
                  {order.canCancel && confirmCancel && (
                    <div className={s.confirm}>
                      <p>
                        {en
                          ? "Cancel this unpaid test order and release its stock?"
                          : "Ödenmemiş test siparişi iptal edilsin ve ayrılan stok bırakılsın mı?"}
                      </p>
                      <button
                        className={s.secondary}
                        disabled={busy}
                        onClick={() => void action("cancel")}
                      >
                        {en ? "Yes, cancel order" : "Evet, siparişi iptal et"}
                      </button>
                      <button
                        className={s.textButton}
                        disabled={busy}
                        onClick={() => setConfirmCancel(false)}
                      >
                        {en ? "Keep order" : "Vazgeç"}
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
        {status === "ready" && data?.orders && (
          <>
            {data.orders.length ? (
              <div className={s.orderList}>
                {data.orders.map((item) => (
                  <Link
                    className={s.orderRow}
                    href={ordersPath(locale, item.id)}
                    key={item.id}
                  >
                    <div>
                      <span className={s.eyebrow}>{item.number}</span>
                      <h2>
                        {locale === "tr"
                          ? item.lines[0]?.nameTr
                          : item.lines[0]?.nameEn}
                        {item.lines.length > 1
                          ? ` +${item.lines.length - 1}`
                          : ""}
                      </h2>
                      <p>{orderDate(item.createdAt, locale)}</p>
                    </div>
                    <div className={s.orderStatus}>
                      <span className={s.badge}>
                        {orderLabel(item.status, locale)}
                      </span>
                      <span>{orderLabel(item.paymentStatus, locale)}</span>
                      <span>{orderLabel(item.fulfillmentStatus, locale)}</span>
                    </div>
                    <div className={s.orderPrice}>
                      <strong>{formatPrice(item.totalMinor, locale)}</strong>
                      <span>{en ? "View order" : "Siparişi incele"} ↗</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={s.empty}>
                <p className={s.eyebrow}>DOSSO DOSSI COFFEE</p>
                <h2>
                  {en
                    ? "Your first coffee story starts here."
                    : "İlk kahve hikâyeniz burada başlasın."}
                </h2>
                <p>
                  {en
                    ? "You have no orders yet. Your saved bag is ready when you are."
                    : "Henüz siparişiniz yok. Hazır olduğunuzda sepetiniz sizi bekliyor."}
                </p>
                <Link className={s.primary} href={cartPath(locale)}>
                  {en ? "Go to my bag" : "Sepetime git"} →
                </Link>
              </div>
            )}
            {data.pagination && data.pagination.pages > 1 && (
              <div className={s.pagination}>
                <button
                  className={s.secondary}
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {en ? "Previous" : "Önceki"}
                </button>
                <span>
                  {page} / {data.pagination.pages}
                </span>
                <button
                  className={s.secondary}
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {en ? "Next" : "Sonraki"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function OrderProgress({ order, locale }: { order: WebOrder; locale: Locale }) {
  const en = locale === "en";
  const steps = [
    {
      label: en ? "Order created" : "Sipariş oluşturuldu",
      at: order.createdAt,
      done: true,
    },
    {
      label: en ? "Test payment" : "Test ödemesi",
      at: order.paidAt,
      done: order.paymentStatus === "PAID",
    },
    {
      label: en ? "Preparing" : "Hazırlanıyor",
      at: null,
      done: ["PREPARING", "SHIPPED", "DELIVERED"].includes(
        order.fulfillmentStatus,
      ),
    },
    {
      label: en ? "Shipped" : "Kargoya verildi",
      at: order.shippedAt,
      done: ["SHIPPED", "DELIVERED"].includes(order.fulfillmentStatus),
    },
    {
      label: en ? "Delivered" : "Teslim edildi",
      at: order.deliveredAt,
      done: order.fulfillmentStatus === "DELIVERED",
    },
  ];
  return (
    <section className={s.card}>
      <p className={s.eyebrow}>
        {en ? "ORDER JOURNEY" : "SİPARİŞİN YOLCULUĞU"}
      </p>
      {["CANCELLED", "EXPIRED"].includes(order.status) ? (
        <p className={s.closed}>
          {orderLabel(order.status, locale)} —{" "}
          {en
            ? "The stock reservation has been released."
            : "Ayrılan stok serbest bırakıldı."}
        </p>
      ) : (
        <ol className={s.timeline}>
          {steps.map((step) => (
            <li key={step.label} className={step.done ? s.stepDone : ""}>
              <span className={s.stepDot}>{step.done ? "✓" : ""}</span>
              <div>
                <strong>{step.label}</strong>
                {step.at && <small>{orderDate(step.at, locale)}</small>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
