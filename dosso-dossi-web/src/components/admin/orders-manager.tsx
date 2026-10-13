"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AdminApiError,
  adminRequest,
  formatPrice,
  type Admin,
} from "@/lib/admin-catalog";
import {
  orderDate,
  orderLabel,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentStatus,
  type WebOrder,
} from "@/lib/web-orders";
import {
  OrderAddressCard,
  OrderLines,
  OrderTotals,
} from "@/components/orders/order-summary";
import styles from "./admin.module.css";
import s from "./orders-manager.module.css";

type List = {
  orders: WebOrder[];
  pagination: { page: number; limit: number; total: number; pages: number };
  payment: { configured: boolean; mode: "sandbox" };
};
type Action = "PREPARE" | "SHIP" | "DELIVER" | "CANCEL";
const actions: Record<Action, string> = {
  PREPARE: "Hazırlamaya başla",
  SHIP: "Kargoya verildi olarak kaydet",
  DELIVER: "Teslim edildi olarak kaydet",
  CANCEL: "Ödenmemiş siparişi iptal et",
};

export function OrdersManager({
  admin,
  onExpired,
  onBusy,
  onDirty,
}: {
  admin: Admin;
  onExpired: () => void;
  onBusy: (value: boolean) => void;
  onDirty: (value: boolean) => void;
}) {
  const [data, setData] = useState<List | null>(null);
  const [order, setOrder] = useState<WebOrder | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const [fulfillment, setFulfillment] = useState<FulfillmentStatus | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const epoch = useRef(0);
  const control = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const busy = loading || saving;
  const dirty = Boolean(carrier || trackingNumber || note);
  useEffect(() => {
    onBusy(saving);
    return () => onBusy(false);
  }, [saving, onBusy]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const clearDraft = useCallback(() => {
    setCarrier("");
    setTrackingNumber("");
    setNote("");
    setConfirmAction(null);
  }, []);
  const invalidate = useCallback(() => {
    epoch.current++;
    control.current?.abort();
    mutation.current = false;
    setData(null);
    setOrder(null);
    setLoading(true);
    setSaving(false);
    clearDraft();
  }, [clearDraft]);
  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof AdminApiError && [401, 403].includes(cause.status)) {
        onExpired();
        return;
      }
      setError(
        cause instanceof AdminApiError && cause.status === 409
          ? "Sipariş başka bir oturumda değişmiş veya bu işlem artık geçerli değil. Güncel bilgileri yükleyip yeniden kontrol edin."
          : "Sipariş işlemi tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.",
      );
    },
    [onExpired],
  );
  const load = useCallback(async () => {
    const request = ++epoch.current;
    control.current?.abort();
    const controller = new AbortController();
    control.current = controller;
    mutation.current = false;
    setSaving(false);
    setLoading(true);
    setError("");
    try {
      const session = await adminRequest<{ admin: Admin }>("/auth/session", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || epoch.current !== request) return;
      if (session.admin.id !== admin.id || session.admin.role !== "ADMIN") {
        invalidate();
        onExpired();
        return;
      }
      if (selected) {
        const response = await adminRequest<{ order: WebOrder }>(
          `/orders/${selected}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted || epoch.current !== request) return;
        setOrder(response.order);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("q", search);
        if (status) params.set("status", status);
        if (payment) params.set("paymentStatus", payment);
        if (fulfillment) params.set("fulfillmentStatus", fulfillment);
        const response = await adminRequest<List>(`/orders?${params}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || epoch.current !== request) return;
        setData(response);
      }
    } catch (cause) {
      if (!controller.signal.aborted && epoch.current === request) fail(cause);
    } finally {
      if (!controller.signal.aborted && epoch.current === request)
        setLoading(false);
    }
  }, [
    admin.id,
    selected,
    page,
    search,
    status,
    payment,
    fulfillment,
    invalidate,
    onExpired,
    fail,
  ]);
  useEffect(() => {
    void load();
    const resume = () => {
      if (document.visibilityState === "visible") void load();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") invalidate();
      else resume();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", invalidate);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      epoch.current++;
      control.current?.abort();
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", invalidate);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [load, invalidate]);
  function open(id: string | null) {
    if (
      saving ||
      (dirty &&
        !window.confirm(
          "Kaydedilmemiş kargo bilgilerini bırakmak istiyor musunuz?",
        ))
    )
      return;
    clearDraft();
    setOrder(null);
    setNotice("");
    setSelected(id);
  }
  async function mutate(action: Action) {
    if (!order || mutation.current) return;
    mutation.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    const generation = epoch.current;
    const controller = new AbortController();
    control.current = controller;
    try {
      const session = await adminRequest<{ admin: Admin }>("/auth/session", {
        signal: controller.signal,
      });
      if (controller.signal.aborted || generation !== epoch.current) return;
      if (session.admin.id !== admin.id || session.admin.role !== "ADMIN") {
        invalidate();
        onExpired();
        return;
      }
      const response = await adminRequest<{ order: WebOrder }>(
        `/orders/${order.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            version: order.version,
            action,
            ...(action === "SHIP"
              ? {
                  carrier: carrier.trim(),
                  trackingNumber: trackingNumber.trim(),
                }
              : {}),
            ...(note.trim() ? { note: note.trim().replace(/\s+/g, " ") } : {}),
          }),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted || generation !== epoch.current) return;
      setOrder(response.order);
      clearDraft();
      setNotice("Sipariş durumu kaydedildi.");
    } catch (cause) {
      if (!controller.signal.aborted && generation === epoch.current)
        fail(cause);
    } finally {
      if (!controller.signal.aborted && generation === epoch.current) {
        mutation.current = false;
        setSaving(false);
      }
    }
  }
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(query.trim());
    setPage(1);
  }
  async function reload() {
    if (
      saving ||
      (dirty &&
        !window.confirm(
          "Güncel siparişi yüklemek kaydedilmemiş kargo bilgilerini kaldırır. Devam edilsin mi?",
        ))
    )
      return;
    clearDraft();
    await load();
  }
  const paid = order?.paymentStatus === "PAID" && order.status === "OPEN";
  const nextAction: Action | null = paid
    ? order.fulfillmentStatus === "UNFULFILLED"
      ? "PREPARE"
      : order.fulfillmentStatus === "PREPARING"
        ? "SHIP"
        : order.fulfillmentStatus === "SHIPPED"
          ? "DELIVER"
          : null
    : null;

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>SİPARİŞ YÖNETİMİ</p>
          <h1>{order ? order.number : "Her sipariş, bir kahve molası."}</h1>
          <p>
            {selected
              ? "Ödeme, hazırlık ve kargo hareketlerini takip edin."
              : "Siparişleri inceleyin, ödeme ve teslimat durumlarını yönetin."}
          </p>
        </div>
        <div className={s.headingActions}>
          {selected && (
            <button
              className={styles.secondary}
              disabled={saving}
              onClick={() => open(null)}
            >
              ← Sipariş listesi
            </button>
          )}
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => void reload()}
          >
            Yenile
          </button>
        </div>
      </div>
      <div className={s.sandbox}>
        <strong>SANDBOX · TEST ORTAMI</strong>
        <span>
          Buradaki siparişler ve ödeme sonuçları test içindir. Gerçek tahsilat
          veya kargo gönderimi yapılmaz. Ödeme durumu yalnızca iyzico sonucu
          doğrulanarak değişir.
        </span>
      </div>
      {error && (
        <div className={styles.errorSummary} role="alert">
          <p>{error}</p>
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={() => void reload()}
          >
            Güncel bilgileri yükle
          </button>
        </div>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {!selected && (
        <>
          <form className={s.filters} onSubmit={filter}>
            <label className={s.search}>
              <span>Sipariş veya müşteri ara</span>
              <div>
                <input
                  type="search"
                  maxLength={100}
                  placeholder="Sipariş no, ad veya e-posta…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button className={styles.secondary} disabled={saving}>
                  Ara
                </button>
              </div>
            </label>
            <label>
              <span>Sipariş durumu</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as OrderStatus | "");
                  setPage(1);
                }}
              >
                <option value="">Tümü</option>
                {(["OPEN", "CANCELLED", "EXPIRED", "COMPLETED"] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {orderLabel(value, "tr")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span>Ödeme</span>
              <select
                value={payment}
                onChange={(event) => {
                  setPayment(event.target.value as PaymentStatus | "");
                  setPage(1);
                }}
              >
                <option value="">Tümü</option>
                {(["PENDING", "PAID", "FAILED", "REVIEW"] as const).map(
                  (value) => (
                    <option key={value} value={value}>
                      {orderLabel(value, "tr")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span>Teslimat</span>
              <select
                value={fulfillment}
                onChange={(event) => {
                  setFulfillment(event.target.value as FulfillmentStatus | "");
                  setPage(1);
                }}
              >
                <option value="">Tümü</option>
                {(
                  ["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED"] as const
                ).map((value) => (
                  <option key={value} value={value}>
                    {orderLabel(value, "tr")}
                  </option>
                ))}
              </select>
            </label>
          </form>
          {loading ? (
            <p className={styles.empty} role="status">
              Siparişler yükleniyor…
            </p>
          ) : (
            data && (
              <section className={styles.listPanel}>
                {data.orders.length ? (
                  <div className={styles.tableWrap}>
                    <table className={`${styles.productTable} ${s.table}`}>
                      <thead>
                        <tr>
                          <th>Sipariş / Müşteri</th>
                          <th>Tutar</th>
                          <th>Sipariş</th>
                          <th>Ödeme</th>
                          <th>Teslimat</th>
                          <th>
                            <span className={styles.srOnly}>İşlemler</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.orders.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <button
                                className={s.identity}
                                onClick={() => open(item.id)}
                              >
                                <strong>{item.number}</strong>
                                <span>{item.customer.name}</span>
                                <small>{item.customer.email}</small>
                                <small>{orderDate(item.createdAt, "tr")}</small>
                              </button>
                            </td>
                            <td className={s.price}>
                              {formatPrice(item.totalMinor)}
                            </td>
                            <td>
                              <span className={s.badge}>
                                {orderLabel(item.status, "tr")}
                              </span>
                            </td>
                            <td>
                              <span
                                className={
                                  item.paymentStatus === "REVIEW"
                                    ? s.review
                                    : ""
                                }
                              >
                                {orderLabel(item.paymentStatus, "tr")}
                              </span>
                            </td>
                            <td>{orderLabel(item.fulfillmentStatus, "tr")}</td>
                            <td>
                              <button
                                className={styles.editButton}
                                onClick={() => open(item.id)}
                              >
                                İncele ↗
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <h2>Henüz eşleşen sipariş yok.</h2>
                    <p>
                      Yeni test siparişleri burada görünür. Arama ve durum
                      filtrelerini de kontrol edebilirsiniz.
                    </p>
                  </div>
                )}
                <div className={styles.listFooter}>
                  {data.pagination.total} sipariş
                  <span>
                    Sayfa {data.pagination.page} /{" "}
                    {Math.max(1, data.pagination.pages)}
                  </span>
                </div>
                {data.pagination.pages > 1 && (
                  <div className={s.pagination}>
                    <button
                      className={styles.secondary}
                      disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Önceki
                    </button>
                    <button
                      className={styles.secondary}
                      disabled={page >= data.pagination.pages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Sonraki
                    </button>
                  </div>
                )}
              </section>
            )
          )}
        </>
      )}
      {selected && loading && (
        <p className={styles.empty} role="status">
          Sipariş ayrıntıları yükleniyor…
        </p>
      )}
      {selected && !loading && order && (
        <>
          <div className={s.statuses}>
            <div>
              <span>Sipariş</span>
              <strong>{orderLabel(order.status, "tr")}</strong>
            </div>
            <div>
              <span>Ödeme</span>
              <strong>{orderLabel(order.paymentStatus, "tr")}</strong>
            </div>
            <div>
              <span>Teslimat</span>
              <strong>{orderLabel(order.fulfillmentStatus, "tr")}</strong>
            </div>
            <div>
              <span>Oluşturulma</span>
              <strong>{orderDate(order.createdAt, "tr")}</strong>
            </div>
          </div>
          <div className={s.detailGrid}>
            <div className={s.mainColumn}>
              <section className={styles.formCard}>
                <div className={styles.sectionHeading}>
                  <span>01</span>
                  <div>
                    <h2>Sipariş içeriği</h2>
                    <p>
                      Fiyat ve ürün bilgileri sipariş oluşturulduğundaki haliyle
                      saklanır.
                    </p>
                  </div>
                </div>
                <OrderLines lines={order.lines} locale="tr" />
              </section>
              <OrderAddressCard address={order.address} locale="tr" />
              <section className={styles.formCard}>
                <div className={styles.sectionHeading}>
                  <span>02</span>
                  <div>
                    <h2>Sipariş hareketleri</h2>
                    <p>Tüm zamanlar Türkiye saatidir.</p>
                  </div>
                </div>
                <ol className={s.audit}>
                  {order.audits.map((event) => (
                    <li key={event.id}>
                      <strong>{auditLabel(event.action)}</strong>
                      <time>{orderDate(event.createdAt, "tr")}</time>
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <aside className={s.aside}>
              <section className={styles.formCard}>
                <p className={styles.eyebrow}>MÜŞTERİ VE TUTAR</p>
                <h2 className={s.customer}>{order.customer.name}</h2>
                <p className={s.email}>{order.customer.email}</p>
                <OrderTotals {...order} locale="tr" />
                {order.status === "OPEN" && order.paymentStatus !== "PAID" && (
                  <p className={s.note}>
                    Stok ayırma süresi:{" "}
                    {orderDate(order.reservationExpiresAt, "tr")}
                  </p>
                )}
              </section>
              <section className={styles.formCard}>
                <div className={styles.sectionHeading}>
                  <span>03</span>
                  <div>
                    <h2>Teslimat yönetimi</h2>
                    <p>
                      Hazırlık ve kargo adımları ödeme doğrulandıktan sonra
                      açılır.
                    </p>
                  </div>
                </div>
                {order.carrier && (
                  <div className={s.tracking}>
                    <strong>{order.carrier}</strong>
                    <span>Takip numarası: {order.trackingNumber}</span>
                  </div>
                )}
                {order.paymentStatus === "REVIEW" && (
                  <p className={s.warning}>
                    Ödeme inceleme bekliyor. Teslimat başlatmayın; sağlayıcı
                    kayıtları kontrol edilmelidir. Bu ekrandan ödeme onayı
                    verilmez.
                  </p>
                )}
                {!nextAction && !order.canCancel && (
                  <p className={s.note}>
                    Bu sipariş için şu anda uygulanabilir bir teslimat işlemi
                    bulunmuyor.
                  </p>
                )}
                {(nextAction || order.canCancel) && (
                  <fieldset disabled={saving} className={s.fieldset}>
                    {nextAction === "SHIP" && (
                      <>
                        <label className={styles.field}>
                          <span>Kargo firması</span>
                          <input
                            maxLength={80}
                            value={carrier}
                            onChange={(event) => setCarrier(event.target.value)}
                            placeholder="Kargo firmasının adı"
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Kargo takip numarası</span>
                          <input
                            maxLength={100}
                            value={trackingNumber}
                            onChange={(event) =>
                              setTrackingNumber(event.target.value)
                            }
                            placeholder="Takip numarası"
                          />
                        </label>
                      </>
                    )}
                    <label className={styles.field}>
                      <span>İşlem notu (isteğe bağlı)</span>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Sipariş hareketine eklenecek açıklama"
                      />
                      <small>
                        Yönetim panelindeki işlem geçmişine kaydedilir.
                      </small>
                    </label>
                    {confirmAction ? (
                      <div className={s.confirm}>
                        <p>{actions[confirmAction]} işlemi uygulansın mı?</p>
                        <button
                          className={styles.primary}
                          disabled={saving}
                          onClick={() => void mutate(confirmAction)}
                        >
                          {saving ? "Kaydediliyor…" : "Onayla ve kaydet"}
                        </button>
                        <button
                          className={styles.textButton}
                          disabled={saving}
                          onClick={() => setConfirmAction(null)}
                        >
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <div className={s.operationButtons}>
                        {nextAction && (
                          <button
                            className={styles.primary}
                            disabled={
                              saving ||
                              (nextAction === "SHIP" &&
                                (!carrier.trim() || !trackingNumber.trim()))
                            }
                            onClick={() => setConfirmAction(nextAction)}
                          >
                            {actions[nextAction]}
                          </button>
                        )}
                        {order.canCancel && (
                          <button
                            className={styles.secondary}
                            disabled={saving}
                            onClick={() => setConfirmAction("CANCEL")}
                          >
                            {actions.CANCEL}
                          </button>
                        )}
                      </div>
                    )}
                  </fieldset>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function auditLabel(action: string) {
  const names: Record<string, string> = {
    CREATED: "Sipariş oluşturuldu",
    ORDER_CREATED: "Sipariş oluşturuldu",
    CANCELLED: "Sipariş iptal edildi",
    CANCEL: "Sipariş iptal edildi",
    EXPIRED: "Stok ayırma süresi doldu",
    PREPARE: "Hazırlanmaya başlandı",
    PREPARING: "Hazırlanmaya başlandı",
    SHIP: "Kargoya verildi",
    SHIPPED: "Kargoya verildi",
    DELIVER: "Teslim edildi",
    DELIVERED: "Teslim edildi",
    PAYMENT_INITIALIZING: "Sandbox ödeme hazırlanıyor",
    PAYMENT_INITIALIZE_FAILED: "Sandbox ödeme başlatılamadı",
    PAYMENT_READY: "Sandbox ödeme sayfası hazır",
    PAYMENT_VERIFIED: "Test ödemesi doğrulandı",
    ADDITIONAL_PAYMENT_REVIEW: "Ek ödeme incelemeye alındı",
    PAYMENT_INITIALIZED: "Sandbox ödeme başlatıldı",
    PAYMENT_STARTED: "Sandbox ödeme başlatıldı",
    PAYMENT_PAID: "Test ödemesi doğrulandı",
    PAYMENT_SUCCEEDED: "Test ödemesi doğrulandı",
    PAYMENT_FAILED: "Test ödemesi başarısız",
    PAYMENT_REVIEW: "Ödeme incelemeye alındı",
  };
  return names[action] || "Sipariş durumu güncellendi";
}
