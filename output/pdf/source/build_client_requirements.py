"""Plain-language client checklist, revision 03; direct account details requested."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'output/pdf/Dosso-Dossi-Gelistirme-Icin-Gerekli-Bilgi-ve-Erisimler.pdf'
FONTS = ROOT / 'video-production/management-intro/fonts'
for name, filename in [('Poppins', 'Poppins-Regular.ttf'), ('PoppinsMedium', 'Poppins-Medium.ttf'), ('PoppinsSemi', 'Poppins-SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Poppins', normal='Poppins', bold='PoppinsSemi', italic='Poppins', boldItalic='PoppinsSemi')

W, H = 595.276, 841.89
M, CW = 42, 511.276
INK, ORANGE = HexColor('#2E211A'), HexColor('#EF6024')
CREAM, SOFT = HexColor('#FBF8F2'), HexColor('#F1E8E0')
MUTED, LINE, WHITE = HexColor('#75685F'), HexColor('#DDD1C6'), HexColor('#FFFFFF')
LOGO = ImageReader(str(ROOT / 'dosso-dossi-app/assets/images/logo.png'))
CHECKS = []
SOURCES = {
    'apple': 'https://developer.apple.com/help/app-store-connect/manage-your-team/add-and-edit-users/',
    'roles': 'https://developer.apple.com/help/account/access/roles',
    'google': 'https://support.google.com/googleplay/android-developer/answer/9844686?hl=tr',
    'hostinger': 'https://www.hostinger.com/support/1583777-how-to-share-access-to-your-account-at-hostinger/',
    'netgsm': 'https://bilgibankasi.netgsm.com.tr/entegrasyonlar/api-entegrasyonu-hazirlik-rehberi',
    'iyzico': 'https://docs.iyzico.com/on-hazirliklar/live-vs-sandbox',
}
OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Dosso Dossi Coffee | Geliştirme İçin Gerekli Bilgi ve Erişimler')
c.setAuthor('Berkay Demir | BitirGitsin')
c.setSubject('Mobil uygulama ve web mağazası için müşteri hazırlık ve paylaşım listesi')

def box(x, top, w, h, fill, radius=0):
    c.setFillColor(fill)
    if radius:
        c.roundRect(x, H-top-h, w, h, radius, fill=1, stroke=0)
    else:
        c.rect(x, H-top-h, w, h, fill=1, stroke=0)

def line(top):
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.line(M, H-top, W-M, H-top)

def txt(s, x, top, size=10, font='Poppins', color=INK, right=False, max_w=None):
    if max_w is not None:
        assert pdfmetrics.stringWidth(s, font, size) <= max_w, s
    c.setFillColor(color)
    c.setFont(font, size)
    (c.drawRightString if right else c.drawString)(x, H-top-size*.81, s)

def para(s, x, top, w, size=9.5, leading=14, color=INK, max_h=None):
    p = Paragraph(s, ParagraphStyle('body', fontName='Poppins', fontSize=size, leading=leading, textColor=color))
    _, h = p.wrap(w, 1000)
    if max_h is not None and h > max_h+.1:
        raise ValueError(f'Page {c.getPageNumber()} overflow {h}>{max_h}: {s[:120]}')
    if top+h > 785:
        raise ValueError(f'Footer overlap: {s[:120]}')
    p.drawOn(c, x, H-top-h)
    CHECKS.append((c.getPageNumber(), top, top+h))
    return h

def source(key, label):
    return f'<link href="{SOURCES[key]}" color="#75685F"><u>{label}</u></link>'

def base(page):
    box(0, 0, W, H, CREAM)
    box(0, 0, W, 5, ORANGE)
    c.drawImage(LOGO, M, H-79, 42, 42, mask='auto')
    txt('DOSSO DOSSI COFFEE', M+54, 43, 10.4, 'PoppinsSemi')
    txt('MOBİL UYGULAMA + WEB MAĞAZASI', M+54, 61, 7.2, 'PoppinsMedium', MUTED)
    txt('BİTİRGİTSİN', W-M, 43, 10, 'PoppinsSemi', right=True)
    txt('MÜŞTERİ HAZIRLIK LİSTESİ', W-M, 61, 7, color=MUTED, right=True)
    line(95)
    line(795)
    txt('Berkay Demir / BitirGitsin', M, 810, 7.4, 'PoppinsMedium', MUTED)
    txt('iletisim@bitirgitsin.com', M+174, 810, 7.4, color=MUTED)
    c.linkURL('mailto:iletisim@bitirgitsin.com', (M+174, H-821, M+316, H-806))
    txt(f'{page:02d} / 03', W-M, 810, 7.4, 'PoppinsMedium', MUTED, right=True)

def heading(kicker, title, subtitle):
    txt(kicker, M, 114, 8, 'PoppinsSemi', ORANGE)
    txt(title, M, 139, 25, 'PoppinsSemi', max_w=CW)
    para(subtitle, M, 179, CW, 10, 15, MUTED, max_h=31)

def card(num, title, body, top, h=None, fill=WHITE):
    p = Paragraph(body, ParagraphStyle('measure', fontName='Poppins', fontSize=10, leading=14.5))
    _, body_h = p.wrap(CW-32, 1000)
    h = h or body_h + 47
    assert top+h <= 779, f'Card {num} exceeds page: {top+h}'
    box(M, top, CW, h, fill, 10)
    txt(num, M+14, top+18, 8.8, 'PoppinsSemi', ORANGE)
    txt(title, M+40, top+15, 11.8, 'PoppinsSemi', max_w=CW-130)
    c.setStrokeColor(LINE)
    c.setLineWidth(.8)
    c.rect(W-M-77, H-top-24, 8, 8, fill=0, stroke=1)
    txt('Paylaşıldı', W-M-62, top+17, 7.3, color=MUTED)
    para(body, M+16, top+35, CW-32, 10, 14.5, max_h=h-43)
    return top+h+10

# PAGE 1: What the client shares, without technical account instructions.
base(1)
heading('13 EKİM 2026 / HAZIRLIK LİSTESİ / REVİZYON 03', 'Başlamak için gerekli bilgiler',
        'Hesap giriş bilgilerini ve aşağıdaki işletme bilgilerini paylaşmanız yeterlidir. Hesaplara giriş, gerekli ayarlar ve yönetim işlemlerini BitirGitsin yapacaktır.')
t = 219
t = card('01', 'Firma ve iletişim bilgileri',
     '<b>Paylaşın:</b> Firmanın resmi adı, adresi, vergi dairesi ve numarası; müşteri destek telefonu ve e-postası. Proje için görüşeceğimiz ve çalışmaları onaylayacak yetkilinin adı, telefonu ve e-postası.', t)
t = card('02', 'iPhone uygulaması için Apple hesabı',
     '<b>Paylaşın:</b> Apple Developer hesabı giriş bilgileri (e-posta ve şifre). Hesap henüz açılmadıysa veya başvuru devam ediyorsa belirtin.<br/>'
     '<b>Biz yapacağız:</b> Hesaba giriş, gerekli ayarlar ve uygulamanın yayın işlemleri.', t)
t = card('03', 'Android uygulaması için Google hesabı',
     '<b>Paylaşın:</b> Google Play geliştirici hesabı giriş bilgileri (e-posta ve şifre). Hesap henüz açılmadıysa veya başvuru devam ediyorsa belirtin.<br/>'
     '<b>Biz yapacağız:</b> Hesaba giriş, gerekli ayarlar ve uygulamanın yayın işlemleri.', t)
t = card('04', 'Uygulama ve site için sunucu',
     '<b>Paylaşın:</b> Hostinger hesabı giriş bilgileri ve KVM4 sunucu paketinin satın alınıp alınmadığı. Sunucu, uygulama ve sitenin çalışacağı hizmettir.<br/>'
     '<b>Biz yapacağız:</b> Kurulum, yönetim ve fiyata dahil sürekli teknik bakım.', t)
t = card('05', 'Mevcut internet adresiniz',
     '<b>Paylaşın:</b> İnternet sitenizin adresi, alan adını satın aldığınız firmanın adı ve bu hesaba giriş bilgileri.<br/>'
     '<b>Biz yapacağız:</b> Yeni sitenin mevcut adresinizde açılması için gerekli ayarlar.', t)
assert t <= 775, t
c.showPage()

# PAGE 2: Account details and provider contacts; BitirGitsin handles setup.
base(2)
heading('02 / HİZMET HESAPLARI VE BAĞLANTILAR', 'Hizmet hesapları',
        'Mevcut hesapların giriş bilgilerini paylaşın. Hesap açılmadıysa veya başvuru devam ediyorsa belirtin; kurulum ve ayarları biz yapacağız.')
t = 219
t = card('06', 'Telefon doğrulama mesajları: Netgsm',
     '<b>Paylaşın:</b> Netgsm hesabı giriş bilgileri, mesajda görünecek firma adı ve deneme mesajını alacak telefon numarası.<br/>'
     '<b>Biz yapacağız:</b> Doğrulama mesajı paketinin kontrolü ve mesaj gönderimi için gerekli ayarlar.', t)
t = card('07', 'Sipariş e-postaları ve şube haritaları',
     '<b>Paylaşın:</b> Sipariş mesajlarında kullanılacak e-posta adresi ve müşteri yanıtlarının ulaşacağı adres. Varsa e-posta hizmeti ve Mapbox hesabı giriş bilgileri.<br/>'
     '<b>Biz yapacağız:</b> E-posta ve şube haritası ayarları. Eksik hesapları sizinle birlikte oluşturacağız.', t)
t = card('08', 'İnternetten ödeme: iyzico',
     '<b>Paylaşın:</b> iyzico hesabı giriş bilgileri. Başvuru henüz sonuçlanmadıysa güncel durumu belirtin.<br/>'
     '<b>Biz yapacağız:</b> Webde ürün satışı ve uygulamada bakiye yükleme için iyzico ile gerekli ayarlar, onayların kontrolü ve ödeme denemeleri.', t)
t = card('09', 'Mağaza kasası bağlantısı: Kerzz',
     '<b>Paylaşın:</b> Kerzz veya yetkili bayiyle görüştüğünüz kişinin adı, telefonu, e-postası ve bekleyen talebinizin durumu.<br/>'
     '<b>Biz yapacağız:</b> Teknik bilgileri Kerzz ekibinden alacağız. İlgili kişiyle bizi görüştürmeniz yeterlidir.', t)
t = card('10', 'Uygulamayı deneyecek kişiler',
     '<b>Paylaşın:</b> Deneme yapılacak şube, şubedeki sorumlu kişi ve iPhone/Android uygulamasını deneyecek kişilerin e-postaları. Ödeme, sipariş ve sadakat işlemlerini kontrol edip yayına onay verecek kişiyi belirtin.', t)
assert t <= 775, t
assert t+42 <= 779, t
box(M, t, CW, 42, SOFT, 9)
para('<b>Hesaplar ve ödemeler:</b> Hesaplar firmaya ait kalır. Sunucu ve diğer hizmet ücretlerini firma öder. Sürekli teknik bakım geliştirme fiyatına dahildir.',
     M+16, t+8, CW-32, 9.5, 14, max_h=28)
c.showPage()

# PAGE 3: Familiar business inputs; no new scope or business-rule assumptions.
base(3)
heading('03 / İÇERİKLER VE İŞLETME BİLGİLERİ', 'İçerikler ve çalışma kuralları',
        'Dosyaları bir klasör bağlantısıyla, ürün ve şube bilgilerini Excel veya mevcut listenizle paylaşabilirsiniz. Hazır olmayanları belirtmeniz yeterlidir.')
t = 219
t = card('11', 'Logo, fotoğraflar ve tanıtım yazıları',
     '<b>Paylaşın:</b> Logonun elinizdeki en kaliteli dosyası, marka renkleri, firma tanıtımı, kullanılacak fotoğraflar ve sosyal medya bağlantıları. Uygulama mağazasında görünecek isim ve kısa tanıtım yazısını da iletin.', t)
t = card('12', 'Ürünler, fiyatlar ve stoklar',
     '<b>Paylaşın:</b> Ürün adı, açıklaması, fiyatı, fotoğrafı ve varsa ürün kodu. Boyut, renk, gramaj veya öğütme seçenekleri ile her seçeneğin stok adedini belirtin.<br/>'
     'Mobil uygulamadaki menüyü ve web mağazasında satılacak ürünleri ayrı listeler halinde iletin.', t)
t = card('13', 'Şubeler ve sadakat kuralları',
     '<b>Paylaşın:</b> Şube adresleri, telefonları, çalışma saatleri ve gel-al hizmeti verilecek şubeler. Yönetim ekranını kullanacak kişileri ve sorumlu oldukları şubeleri belirtin.<br/>'
     '<b>Teyit edin:</b> Damga kazanma, ücretsiz ürün, bakiye yükleme kampanyaları ve iptal/iade kuralları.', t)
t = card('14', 'Web mağazasının çalışma şekli',
     '<b>Paylaşın:</b> Gönderim yapılacak bölgeler, müşteriden alınacak kargo ücreti, varsa ücretsiz kargo tutarı ve siparişlerin kaç günde hazırlanacağı. Gönderim/iade adresini ve siparişlerle ilgilenecek kişiyi belirtin.', t)
t = card('15', 'Müşterilere gösterilecek bilgilendirmeler',
     '<b>Paylaşın:</b> Firmanızın onayladığı gizlilik ve kişisel veri metinleri, kullanım koşulları, alışveriş öncesi bilgilendirme, satış ve iade koşulları. Mevcut sitenizde varsa bağlantılarını iletebilirsiniz.', t)
assert t <= 775, t
assert t+65 <= 779, t
box(M, t, CW, 65, INK, 9)
para('<b>Giriş bilgileri:</b> Hesaba girişte kullanılan e-posta veya kullanıcı adı ile şifredir. Bu bilgileri, birlikte belirleyeceğimiz güvenli yöntemle BitirGitsin’e iletebilirsiniz. Hesaplara giriş ve teknik yönetim işlemlerini biz yapacağız.',
     M+16, t+11, CW-32, 9.5, 14, WHITE, max_h=43)
c.save()
print(OUT)
print(f'Pages: 3; requirement cards: 15; layout checks: {len(CHECKS)}')
