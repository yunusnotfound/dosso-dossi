"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AdminApiError,
  adminRequest,
  formatPrice,
  mediaUrl,
  newProduct,
  statusLabels,
  toDraft,
  type Admin,
  type AdminProduct,
  type ProductDraft,
  type ProductStatus,
} from "@/lib/admin-catalog";
import { ProductEditor } from "./product-editor";
import { OrdersManager } from "./orders-manager";
import { ShippingEditor } from "./shipping-editor";
import type { ShippingEditorState } from "@/lib/admin-shipping";
import styles from "./admin.module.css";

type EditorState = {
  draft: ProductDraft;
  original?: AdminProduct;
  generation: number;
};

export function AdminDashboard() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [section, setSection] = useState<"products" | "shipping" | "orders">(
    "products",
  );
  const [shippingState, setShippingState] =
    useState<ShippingEditorState | null>(null);

  const checkSession = useCallback(async () => {
    setCheckingSession(true);
    setSessionError("");
    try {
      const result = await adminRequest<{ admin: Admin }>("/auth/session");
      setAdmin(result.admin);
    } catch (error) {
      if (!(error instanceof AdminApiError && error.status === 401))
        setSessionError(
          error instanceof Error ? error.message : "Oturum kontrol edilemedi.",
        );
    } finally {
      setCheckingSession(false);
    }
  }, []);

  const expired = useCallback(() => {
    setAdmin(null);
    setSessionError("");
    setNotice(
      "Oturumunuz sona erdi. Kaydedilmemiş formunuz açık kaldı; tekrar giriş yapabilirsiniz.",
    );
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await adminRequest<{ products: AdminProduct[] }>(
        "/products",
      );
      setProducts(result.products);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) expired();
      else
        setListError(
          error instanceof Error ? error.message : "Ürünler yüklenemedi.",
        );
    } finally {
      setLoading(false);
    }
  }, [expired]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);
  useEffect(() => {
    if (admin) void loadProducts();
  }, [admin, loadProducts]);
  useEffect(() => {
    if (!dirty && !editorBusy) return;
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLeaving);
    return () => window.removeEventListener("beforeunload", preventLeaving);
  }, [dirty, editorBusy]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const searchText =
          `${product.nameTr} ${product.nameEn} ${product.slug} ${product.variants.map((variant) => variant.sku).join(" ")}`.toLocaleLowerCase(
            "tr-TR",
          );
        return (
          (status === "ALL" || product.status === status) &&
          searchText.includes(query.toLocaleLowerCase("tr-TR").trim())
        );
      }),
    [products, query, status],
  );

  function canLeave() {
    return (
      !editorBusy &&
      (!dirty ||
        window.confirm(
          "Kaydedilmemiş değişiklikleriniz var. Değişiklikleri bırakmak istiyor musunuz?",
        ))
    );
  }
  function openProduct(product?: AdminProduct) {
    if (!canLeave()) return;
    setSection("products");
    setShippingState(null);
    setEditor({
      draft: product ? toDraft(product) : newProduct(),
      original: product,
      generation: Date.now(),
    });
    setDirty(false);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function closeEditor() {
    if (canLeave()) {
      setEditor(null);
      setShippingState(null);
      setSection("products");
      setDirty(false);
    }
  }
  function openShipping() {
    if (section === "shipping" || !canLeave()) return;
    setEditor(null);
    setDirty(false);
    setNotice("");
    setSection("shipping");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openOrders() {
    if (section === "orders" || !canLeave()) return;
    setEditor(null);
    setShippingState(null);
    setDirty(false);
    setNotice("");
    setSection("orders");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function logout() {
    if (!canLeave()) return;
    setLoggingOut(true);
    try {
      await adminRequest("/auth/logout", { method: "POST", body: "{}" });
      setAdmin(null);
      setEditor(null);
      setShippingState(null);
      setSection("products");
      setDirty(false);
      setProducts([]);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Çıkış yapılamadı. Yeniden deneyin.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  function saved(product: AdminProduct, wasSaved = true) {
    setProducts((current) =>
      [product, ...current.filter((item) => item.id !== product.id)].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    );
    setEditor({
      draft: toDraft(product),
      original: product,
      generation: Date.now(),
    });
    setDirty(false);
    setNotice(
      wasSaved
        ? `${product.nameTr} kaydedildi. ${product.status === "PUBLISHED" ? "Değişiklikler mağazada görünür." : "Ürün mağazada görünmez."}`
        : "Ürünün sunucudaki güncel sürümü yüklendi.",
    );
  }

  if (checkingSession)
    return (
      <main className={styles.sessionScreen}>
        <img
          src="/images/brand/logo.png"
          alt="Dosso Dossi Coffee"
          width="82"
          height="82"
        />
        <p role="status">Yönetim paneli açılıyor…</p>
      </main>
    );
  if (!admin)
    return (
      <Login
        onLogin={setAdmin}
        sessionError={sessionError}
        onRetry={checkSession}
        notice={notice}
      />
    );
  const showShipping = section === "shipping" && admin.role === "ADMIN";
  const showOrders = section === "orders" && admin.role === "ADMIN";

  return (
    <div className={styles.shell}>
      <a href="#admin-main" className={styles.skip}>
        İçeriğe geç
      </a>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="/" aria-label="Dosso Dossi ana sayfa">
          <img src="/images/brand/logo.png" alt="" width="59" height="59" />
          <span>
            DOSSO DOSSI<small>WEB MAĞAZASI</small>
          </span>
        </a>
        <div className={styles.workspaceLabel}>YÖNETİM PANELİ</div>
        <button
          className={
            showShipping || showOrders ? styles.navInactive : styles.navActive
          }
          onClick={closeEditor}
          disabled={editorBusy}
        >
          <span aria-hidden="true">▦</span> Ürünler{" "}
          <span className={styles.navCount}>{products.length}</span>
        </button>
        {admin.role === "ADMIN" && (
          <button
            className={showOrders ? styles.navActive : styles.navInactive}
            onClick={openOrders}
            disabled={editorBusy}
          >
            <span aria-hidden="true">▤</span> Siparişler
          </button>
        )}
        {admin.role === "ADMIN" && (
          <button
            className={showShipping ? styles.navActive : styles.navInactive}
            onClick={openShipping}
            disabled={editorBusy}
          >
            <span aria-hidden="true">▱</span> Kargo ayarları
          </button>
        )}
        <a
          className={styles.storeLink}
          href="/alisveris"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mağazayı görüntüle <span aria-hidden="true">↗</span>
        </a>
        <div className={styles.sidebarBottom}>
          <div className={styles.avatar} aria-hidden="true">
            {(admin.name || admin.email).slice(0, 1).toLocaleUpperCase("tr-TR")}
          </div>
          <div className={styles.account}>
            <strong>{admin.name || "Mağaza yöneticisi"}</strong>
            <span>{admin.email}</span>
          </div>
          <button
            className={styles.logout}
            onClick={logout}
            disabled={loggingOut || editorBusy}
          >
            {loggingOut ? "Çıkılıyor…" : "Çıkış yap"}
          </button>
        </div>
      </aside>
      <main className={styles.main} id="admin-main">
        <header className={styles.topbar}>
          <span>
            Web mağazası <span aria-hidden="true">/</span>{" "}
            {showShipping
              ? "Kargo ayarları"
              : showOrders
                ? "Siparişler"
                : "Ürünler"}
            {editor && !showShipping && !showOrders ? (
              <>
                <span aria-hidden="true">/</span>{" "}
                {editor.original ? "Düzenle" : "Yeni ürün"}
              </>
            ) : null}
          </span>
          <span className={styles.region}>Türkiye · TRY ₺</span>
        </header>
        {notice && (
          <div className={styles.notice} role="status">
            {notice}
            <button aria-label="Bildirimi kapat" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {showOrders ? (
          <OrdersManager
            admin={admin}
            onExpired={expired}
            onBusy={setEditorBusy}
            onDirty={setDirty}
          />
        ) : showShipping ? (
          <ShippingEditor
            value={shippingState}
            onChange={setShippingState}
            onDirty={setDirty}
            onBusy={setEditorBusy}
            onExpired={expired}
          />
        ) : editor ? (
          <ProductEditor
            key={editor.generation}
            initial={editor.draft}
            original={editor.original}
            onSaved={saved}
            onClose={closeEditor}
            onDirty={setDirty}
            onBusy={setEditorBusy}
            onExpired={expired}
            onDraftChange={(draft) =>
              setEditor((current) => (current ? { ...current, draft } : null))
            }
          />
        ) : (
          <>
            <div className={styles.pageHeading}>
              <div>
                <p className={styles.eyebrow}>ÜRÜN KATALOĞU</p>
                <h1>Mağazanızın rafları.</h1>
                <p>
                  Kahve ve termosları, seçeneklerini ve stoklarını tek yerden
                  yönetin.
                </p>
              </div>
              <button className={styles.primary} onClick={() => openProduct()}>
                <span aria-hidden="true">＋</span> Ürün ekle
              </button>
            </div>
            <div className={styles.stats}>
              <div>
                <span>Tüm ürünler</span>
                <strong>{products.length}</strong>
              </div>
              <div>
                <span>Yayındaki ürünler</span>
                <strong>
                  {
                    products.filter((product) => product.status === "PUBLISHED")
                      .length
                  }
                </strong>
              </div>
              <div>
                <span>Taslaklar</span>
                <strong>
                  {
                    products.filter((product) => product.status === "DRAFT")
                      .length
                  }
                </strong>
              </div>
              <div>
                <span>Aktif varyant stoğu</span>
                <strong>
                  {products
                    .filter((product) => product.status !== "ARCHIVED")
                    .reduce(
                      (sum, product) =>
                        sum +
                        product.variants
                          .filter((variant) => variant.active)
                          .reduce((total, variant) => total + variant.stock, 0),
                      0,
                    )}
                  <small>adet</small>
                </strong>
              </div>
            </div>
            <section className={styles.listPanel} aria-label="Ürün listesi">
              <div className={styles.filters}>
                <label className={styles.search}>
                  <span className={styles.srOnly}>Ürün veya stok kodu ara</span>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    placeholder="Ürün veya stok kodu ara…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className={styles.statusSelect}>
                  <span className={styles.srOnly}>Yayın durumu</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ProductStatus | "ALL")
                    }
                  >
                    <option value="ALL">Tüm durumlar</option>
                    <option value="PUBLISHED">Yayında</option>
                    <option value="DRAFT">Taslak</option>
                    <option value="ARCHIVED">Arşivde</option>
                  </select>
                </label>
                <button
                  className={styles.secondary}
                  onClick={() => void loadProducts()}
                  disabled={loading}
                >
                  {loading ? "Yükleniyor…" : "Yenile"}
                </button>
              </div>
              {listError ? (
                <div className={styles.empty}>
                  <p className={styles.error} role="alert">
                    {listError}
                  </p>
                  <button
                    className={styles.secondary}
                    onClick={() => void loadProducts()}
                  >
                    Yeniden dene
                  </button>
                </div>
              ) : loading && !products.length ? (
                <p className={styles.empty} role="status">
                  Ürünler yükleniyor…
                </p>
              ) : !visibleProducts.length ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon} aria-hidden="true">
                    ▦
                  </span>
                  <h2>
                    {products.length
                      ? "Eşleşen ürün bulunamadı"
                      : "İlk ürününüzü ekleyin"}
                  </h2>
                  <p>
                    {products.length
                      ? "Aramanızı veya yayın durumu filtresini değiştirin."
                      : "Ürün bilgilerini ve görsellerini ekleyin, varyantlarını oluşturun."}
                  </p>
                  <button
                    className={styles.secondary}
                    onClick={() =>
                      products.length
                        ? (setQuery(""), setStatus("ALL"))
                        : openProduct()
                    }
                  >
                    {products.length ? "Filtreleri temizle" : "Ürün ekle"}
                  </button>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.productTable}>
                    <thead>
                      <tr>
                        <th>Ürün</th>
                        <th>Durum</th>
                        <th>Varyant</th>
                        <th>Fiyat</th>
                        <th>Stok</th>
                        <th>
                          <span className={styles.srOnly}>İşlemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => {
                        const active = product.variants.filter(
                          (variant) => variant.active,
                        );
                        const prices = (
                          active.length ? active : product.variants
                        ).map((variant) => variant.priceMinor);
                        const total = active.reduce(
                          (sum, variant) => sum + variant.stock,
                          0,
                        );
                        const source = product.images[0]
                          ? mediaUrl(product.images[0].url)
                          : "";
                        return (
                          <tr key={product.id}>
                            <td>
                              <button
                                className={styles.productIdentity}
                                onClick={() => openProduct(product)}
                              >
                                <div className={styles.thumbnail}>
                                  {source ? (
                                    <img src={source} alt="" />
                                  ) : (
                                    <span aria-hidden="true">▧</span>
                                  )}
                                </div>
                                <span>
                                  <strong>{product.nameTr}</strong>
                                  <small>
                                    {product.type === "COFFEE"
                                      ? "Kahve"
                                      : "Termos"}{" "}
                                    · {product.slug}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <span
                                className={`${styles.badge} ${styles[product.status.toLowerCase()]}`}
                              >
                                {statusLabels[product.status]}
                              </span>
                            </td>
                            <td>
                              {active.length}
                              <span className={styles.cellNote}> aktif</span>
                            </td>
                            <td className={styles.priceCell}>
                              {prices.length
                                ? formatPrice(Math.min(...prices))
                                : "—"}
                              {new Set(prices).size > 1 && (
                                <small>başlayan fiyatlarla</small>
                              )}
                            </td>
                            <td>
                              <span
                                className={total === 0 ? styles.noStock : ""}
                              >
                                {total}
                              </span>
                              <span className={styles.cellNote}> adet</span>
                            </td>
                            <td>
                              <button
                                className={styles.editButton}
                                onClick={() => openProduct(product)}
                                aria-label={`${product.nameTr} düzenle`}
                              >
                                Düzenle <span aria-hidden="true">↗</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className={styles.listFooter}>
                {visibleProducts.length} ürün gösteriliyor
                <span>Yalnızca yayındaki ürünler mağazada görünür.</span>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Login({
  onLogin,
  sessionError,
  onRetry,
  notice,
}: {
  onLogin: (admin: Admin) => void;
  sessionError: string;
  onRetry: () => void;
  notice: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ admin: Admin }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setPassword("");
      onLogin(result.admin);
    } catch (issue) {
      setError(
        issue instanceof Error
          ? issue.message
          : "Giriş yapılamadı. Yeniden deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.loginPage}>
      <div className={styles.loginEditorial}>
        <a href="/">
          <img
            src="/images/brand/logo.png"
            alt="Dosso Dossi Coffee"
            width="88"
            height="88"
          />
        </a>
        <div>
          <p className={styles.eyebrow}>DOSSO DOSSI COFFEE</p>
          <h1>
            İyi kahvenin <br />
            arka planı.
          </h1>
          <p>
            Web mağazanızın ürünleri,
            <br />
            her ayrıntısıyla elinizin altında.
          </p>
        </div>
        <span>WEB MAĞAZASI YÖNETİM PANELİ</span>
      </div>
      <div className={styles.loginFormWrap}>
        <form className={styles.loginForm} onSubmit={submit}>
          <p className={styles.eyebrow}>TEKRAR HOŞ GELDİNİZ</p>
          <h2>Yönetici girişi</h2>
          <p>Web mağazanızı yönetmek için hesabınızla giriş yapın.</p>
          {notice && (
            <p className={styles.info} role="status">
              {notice}
            </p>
          )}
          {sessionError && (
            <div className={styles.error} role="alert">
              <p>{sessionError}</p>
              <button
                type="button"
                className={styles.textButton}
                onClick={onRetry}
              >
                Bağlantıyı yeniden kontrol et
              </button>
            </div>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <label className={styles.field}>
            <span>E-posta adresi</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-posta adresiniz"
              disabled={busy}
            />
          </label>
          <label className={styles.field}>
            <span>Şifre</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Şifreniz"
              disabled={busy}
            />
          </label>
          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? "Giriş yapılıyor…" : "Giriş yap →"}
          </button>
          <p className={styles.loginNote}>
            Bu alan yalnızca yetkili web mağazası yöneticileri içindir.
          </p>
          <a href="/" className={styles.backLink}>
            ← Web sitesine dön
          </a>
        </form>
      </div>
    </main>
  );
}
