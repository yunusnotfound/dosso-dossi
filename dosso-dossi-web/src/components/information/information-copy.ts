export type InformationSlug = "gizlilik" | "cerezler" | "iade" | "mesafeli-satis";
type Section = { id?: string; title: string; text: string; points?: string[] };
type InformationCopy = { title: string; intro: string; sections: Section[] };
export const informationCopy: Record<"tr" | "en", Record<InformationSlug, InformationCopy>> = {
  tr: {
    gizlilik: {
      title: "Gizlilik ve veri kullanımı",
      intro: "Bu sayfa, web mağazasının mevcut özelliklerinde hangi bilgilerin ne amaçla kullanıldığını açıklar. Canlı satış öncesinde veri sorumlusunun kimliği, saklama süreleri ve başvuru kanallarını içeren onaylı aydınlatma metni ayrıca yayımlanacaktır.",
      sections: [
        { title: "Hesabınız ve profiliniz", text: "Üyelikte ad soyad, e-posta adresi, şifre ve dil tercihi alınır. Bu bilgiler hesabı oluşturmak, girişinizi doğrulamak, doğrulama/şifre yenileme işlemlerini yürütmek ve hesap iletişimini seçtiğiniz dilde yapmak için kullanılır. Profilinizden adınızı ve iletişim dilinizi güncelleyebilirsiniz." },
        { title: "Sepet, adres ve sipariş bilgileri", text: "Seçtiğiniz ürün, varyant, öğütüm ve adet hesabınızdaki sepette tutulur. Teslimat adresinde alıcı adı, telefon, il, ilçe, mahalle, açık adres ve posta kodu yer alır. Sipariş ekranları ürünleri, fiyatları, teslimat seçimini ve işlem durumunu göstermek için bu bilgileri kullanır. Önizleme dönemindeki test siparişleri gerçek satış anlamına gelmez." },
        { id: "franchise", title: "Franchising başvurunuz", text: "Başvuru formunda ad soyad, e-posta, telefon, şehir, mekân durumu, deneyim ve mesajınız alınır. Bu bilgiler başvurunuzu değerlendirmek, sizinle başvurunuz hakkında iletişime geçmek ve başvuru durumunu takip etmek için yetkili ekibe iletilir. Başvuru bilgileri bir başvuru numarasıyla kaydedilir. Formdaki bilgilendirme onayı, reklam veya kampanya mesajlarına otomatik abonelik oluşturmaz." },
        { title: "Oturum ve güvenlik", text: "Hesabınıza bağlı sayfalara erişim için oturum çerezleri kullanılır. Çıkış yaptığınızda bu tarayıcıdaki oturum kapatılır. Başvuru ve hesap işlemlerinde kötüye kullanımı sınırlayan kontroller bulunur. Ortak bir cihaz kullanıyorsanız işlem sonunda çıkış yapın." },
        { title: "Bilgi ve destek", text: "Hesabınız veya gönderdiğiniz bir başvuruyla ilgili sorularınız için +90 212 242 21 21 numaralı iletişim hattına ulaşabilirsiniz. İletişimde şifrenizi veya ödeme kartınızın tam bilgilerini paylaşmayın." },
      ],
    },
    cerezler: {
      title: "Çerezler ve oturum bilgileri",
      intro: "Çerezler, tarayıcının site için sakladığı küçük kayıtlardır. Aşağıdaki bilgiler mevcut web uygulamasındaki oturum çerezlerini açıklar.",
      sections: [
        { title: "Müşteri oturumu", text: "dosso_web_customer çerezi, giriş yaptığınız hesabı tanımak ve sepet, adres, profil ve siparişlerinize erişimi doğrulamak için kullanılır. Tarayıcıdaki üst saklama süresi 7 gündür; çıkış veya oturumun geçersiz olması bu süreyi kısaltabilir. Çerez HttpOnly olarak ayarlanır; sayfa JavaScript'i doğrudan okuyamaz." },
        { title: "Yönetim oturumu", text: "dosso_web_admin çerezi yalnız yönetim paneline giriş yapan yetkililer içindir. Müşteri oturumundan ayrıdır ve tarayıcıdaki üst saklama süresi 12 saattir. Bu çerez de HttpOnly olarak ayarlanır." },
        { title: "Tercihler ve diğer hizmetler", text: "Ürün, varyant, öğütüm ve adet seçimleri ürün bağlantısında taşınabilir. Sepetiniz hesabınızda saklanır. Dış bağlantılarla açtığınız hizmetlerin kendi çerez ve gizlilik uygulamaları olabilir. Siteye yeni analiz veya pazarlama hizmetleri eklendiğinde ilgili bilgiler ve gerekli tercih araçları bu sayfayla birlikte güncellenecektir." },
        { title: "Çerezleri nasıl yönetebilirsiniz?", text: "Tarayıcınızın site verileri ayarlarından bu sitenin çerezlerini silebilir veya engelleyebilirsiniz. Oturum çerezlerini silmek girişinizi kapatır; engellemek giriş gerektiren özelliklerin çalışmasını etkileyebilir. Oturumu kapatmak için Hesabım ekranındaki Çıkış yap düğmesini de kullanabilirsiniz." },
      ],
    },
    iade: {
      title: "İade talebi ve destek",
      intro: "Online mağaza şu anda önizleme aşamasındadır; gerçek satış yapılmamaktadır. Bu sayfa, mağazadaki iade talebi akışını anlatır. Canlı satışa ait bağlayıcı iade, teslimat ve geri ödeme koşulları satış başlamadan önce yayımlanacaktır.",
      sections: [
        { title: "Talebinizi hesabınızdan takip edin", text: "Ödemesi doğrulanmış ve iade talebine uygun durumdaki siparişlerde, sipariş detayında iade talebi seçeneği görünür.", points: ["Hesabım → Siparişlerim yolundan ilgili siparişi açın.", "İade talebi alanına talebinizin nedenini yazıp gönderin.", "Talebin durumunu ve ekibin açıklamasını aynı sipariş sayfasından takip edin."] },
        { title: "Talep sonrası ne olur?", text: "Talep yetkili ekip tarafından incelenir. İnceleme, kabul veya ret ve gerekli takip adımları sipariş kaydında görünür. Talep oluşturmak otomatik onay veya otomatik ücret iadesi anlamına gelmez. Ürünü göndermeden önce ekibin vereceği yönlendirmeyi bekleyin." },
        { title: "Destek almak istediğinizde", text: "Siparişinizi veya talep alanını bulamıyorsanız +90 212 242 21 21 üzerinden destek isteyebilirsiniz. Görüşmede sipariş numaranızı hazır bulundurun; şifrenizi ve kart bilgilerinizi paylaşmayın." },
      ],
    },
    "mesafeli-satis": {
      title: "Satış ve sipariş bilgileri",
      intro: "Bu web mağazasında paket/çekirdek kahveler, termoslar ve ilgili fiziksel ürünler sunulur. Hazır içecek menüsü şubeleri keşfetmeniz içindir. Online mağaza henüz gerçek satışa açık değildir; önizleme işlemleri test amaçlıdır.",
      sections: [
        { title: "Ürününüzü seçerken", text: "Ürün sayfasında gramaj veya renk/hacim varyantını, kahvede mevcutsa öğütümü ve adedi seçebilirsiniz. Seçiminize bağlı fiyat ekranda güncellenir. Stokta olmayan seçenekler sepete eklenemez. Sepete eklemek stok ayırmaz; stok ve fiyat işlem sırasında yeniden kontrol edilir." },
        { title: "Sepet ve teslimat", text: "Giriş yaptığınızda sepetiniz hesabınızda saklanır. Teslimat adresinizi seçerek ürünler toplamını, yapılandırılmışsa kargo ücretini ve genel toplamı inceleyebilirsiniz. Kargo veya sipariş verme henüz kullanılamıyorsa ekran bunu belirtir. Kargoya verilme süresi ve teslimat taahhütleri canlı satış koşullarında ayrıca açıklanacaktır." },
        { title: "Sipariş takibi", text: "Hesabım → Siparişlerim bölümünden oluşturduğunuz siparişlerin ayrıntılarını ve durumlarını görüntüleyebilirsiniz. İşlem sonucunu sipariş sayfasından kontrol edin; yalnızca tarayıcıda bir ödeme sayfasının açılması ödemenin tamamlandığı anlamına gelmez." },
        { title: "Canlı satıştan önce", text: "Satıcı unvanı ve iletişim bilgileri, bağlayıcı satış sözleşmesi, teslimat koşulları ve iade/geri ödeme şartları canlı satış başlamadan önce sağlanacaktır. Bu bilgilendirme sayfası onaylanmış bir mesafeli satış sözleşmesi değildir. Sorularınız için +90 212 242 21 21 üzerinden bize ulaşabilirsiniz." },
      ],
    },
  },
  en: {
    gizlilik: {
      title: "Privacy and data use",
      intro: "This page explains the information used by the current web store features and why it is needed. An approved privacy notice identifying the data controller, retention periods and contact channels will be published before live sales begin.",
      sections: [
        { title: "Your account and profile", text: "Registration collects your name, email address, password and language preference. These details are used to create and authenticate your account, handle verification and password recovery, and communicate in your selected language. You can update your name and communication language in your profile." },
        { title: "Bag, address and order information", text: "Your selected products, variants, grinds and quantities are saved to your account's bag. Delivery addresses include the recipient name, phone, province, district, neighbourhood, street address and postal code. Order screens use this information to display products, prices, delivery choices and transaction status. Preview test orders are not live sales." },
        { id: "franchise", title: "Your franchising enquiry", text: "The enquiry form collects your name, email, phone, city, premises status, experience and message. The authorised team uses these details to review your enquiry, contact you about it and track its progress. Your enquiry is saved with a reference number. Acknowledging the information notice does not automatically subscribe you to advertising or campaign messages." },
        { title: "Sessions and security", text: "Session cookies authenticate access to account pages. Signing out closes the session in this browser. Account and enquiry actions have controls to limit abuse. Sign out when you finish on a shared device." },
        { title: "Information and support", text: "For questions about your account or an enquiry, call +90 212 242 21 21. Do not share your password or full payment card details." },
      ],
    },
    cerezler: {
      title: "Cookies and session information",
      intro: "Cookies are small records stored by your browser for a website. The information below describes the session cookies in the current web application.",
      sections: [
        { title: "Customer session", text: "The dosso_web_customer cookie identifies your signed-in account and authenticates access to your bag, addresses, profile and orders. Its maximum browser lifetime is 7 days; signing out or invalidating the session may shorten that period. It is set as HttpOnly, so page JavaScript cannot read it directly." },
        { title: "Administration session", text: "The dosso_web_admin cookie is for authorised staff signing in to the administration panel. It is separate from the customer session and has a maximum browser lifetime of 12 hours. It is also set as HttpOnly." },
        { title: "Preferences and other services", text: "Product, variant, grind and quantity selections can be carried in the product link. Your bag is saved to your account. Services opened through external links may have their own cookie and privacy practices. If analytics or marketing services are added, the relevant information and required preference controls will be updated alongside this page." },
        { title: "Managing cookies", text: "You can remove or block this website's cookies in your browser's site-data settings. Removing session cookies signs you out; blocking them may prevent signed-in features from working. You can also use Sign out on the My account page." },
      ],
    },
    iade: {
      title: "Return requests and support",
      intro: "The online store is currently in preview and does not process live sales. This page explains the return-request flow. Binding return, delivery and refund terms will be published before live sales begin.",
      sections: [
        { title: "Track your request in your account", text: "Orders with a confirmed payment and an eligible status show a return-request option in their details.", points: ["Open the relevant order from My account → My orders.", "Enter the reason for your return request and submit it.", "Track the request status and the team's response on the same order page."] },
        { title: "What happens next?", text: "The authorised team reviews your request. Review, acceptance or rejection and follow-up steps appear in the order record. Sending a request does not automatically approve a return or issue a refund. Wait for the team's instructions before sending a product back." },
        { title: "Getting support", text: "If you cannot find your order or the request option, call +90 212 242 21 21. Have your order number available, but do not share your password or card details." },
      ],
    },
    "mesafeli-satis": {
      title: "Sales and order information",
      intro: "This web store offers packaged/whole-bean coffees, thermoses and related physical goods. The prepared-drink menu helps you explore our branches. The online store is not yet open for live sales; preview transactions are for testing.",
      sections: [
        { title: "Choosing your product", text: "Select a weight or colour/capacity variant, an available coffee grind and a quantity on the product page. The displayed price updates with your selection. Out-of-stock options cannot be added to your bag. Adding a product does not reserve stock; stock and prices are checked again during the transaction." },
        { title: "Bag and delivery", text: "When you sign in, your bag is saved to your account. Select a delivery address to review the product subtotal, shipping charge when configured and overall total. The screen states when shipping or ordering is not available. Dispatch times and delivery commitments will be provided in the live sales terms." },
        { title: "Order tracking", text: "View the details and status of your orders in My account → My orders. Check the result on the order page; opening a payment page alone does not mean payment has completed." },
        { title: "Before live sales", text: "The seller's business identity and contact information, binding sales agreement, delivery terms and return/refund conditions will be supplied before live sales begin. This information page is not an approved distance sales agreement. For questions, call +90 212 242 21 21." },
      ],
    },
  },
};
export function isInformationSlug(value: string): value is InformationSlug { return Object.hasOwn(informationCopy.tr, value); }
