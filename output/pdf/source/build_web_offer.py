from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path('/Users/celik/Documents/dev/dosso-dossi-app')
OUT = ROOT / 'output/pdf/Dosso-Dossi-Web-Sitesi-ve-Online-Magaza-Fiyat-Teklifi.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
FONTS = ROOT / 'video-production/management-intro/fonts'
for name, file in [('Poppins', 'Poppins-Regular.ttf'), ('PoppinsMedium', 'Poppins-Medium.ttf'), ('PoppinsSemi', 'Poppins-SemiBold.ttf'), ('PoppinsBold', 'Poppins-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
pdfmetrics.registerFontFamily('Poppins', normal='Poppins', bold='PoppinsSemi', italic='Poppins', boldItalic='PoppinsSemi')

W, H = 595.276, 841.89
M, CW = 44, 507.276
INK = HexColor('#2E211A')
ORANGE = HexColor('#EF6024')
CREAM = HexColor('#FBF8F2')
SOFT = HexColor('#F1E8E0')
MUTED = HexColor('#75685F')
LINE = HexColor('#DDD1C6')
WHITE = HexColor('#FFFFFF')
LOGO = ImageReader(str(ROOT / 'dosso-dossi-app/assets/images/logo.png'))
CHECKS = []
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Dosso Dossi Coffee | Web Sitesi ve Online Mağaza Fiyat Teklifi')
c.setAuthor('Berkay Demir | BitirGitsin')
c.setSubject('Kurumsal web sitesi ve e-ticaret geliştirme teklifi - 50.000 TL')

def box(x, top, w, h, fill, radius=0, stroke=None):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    if radius:
        c.roundRect(x, H-top-h, w, h, radius, fill=1, stroke=bool(stroke))
    else:
        c.rect(x, H-top-h, w, h, fill=1, stroke=bool(stroke))

def line(x, top, w, color=LINE):
    c.setStrokeColor(color)
    c.setLineWidth(.6)
    c.line(x, H-top, x+w, H-top)

def txt(s, x, top, size=10, font='Poppins', color=INK, align='left'):
    c.setFillColor(color)
    c.setFont(font, size)
    fn = c.drawRightString if align == 'right' else c.drawString
    fn(x, H-top-size*.81, s)

def para(s, x, top, w, size=9.4, leading=14.5, color=INK, bold=False, max_h=None):
    p = Paragraph(s, ParagraphStyle('x', fontName='PoppinsSemi' if bold else 'Poppins', fontSize=size, leading=leading, textColor=color, spaceAfter=0, allowWidows=0, allowOrphans=0))
    _, h = p.wrap(w, 1000)
    if max_h is not None and h > max_h + .1:
        raise ValueError(f'Overflow {h}>{max_h}: {s[:80]}')
    if top+h > 783:
        raise ValueError(f'Footer overlap {top+h}: {s[:80]}')
    p.drawOn(c, x, H-top-h)
    CHECKS.append((c.getPageNumber(), top, top+h, s[:70]))
    return h

def pill(s, x, top, w):
    box(x, top, w, 23, SOFT, 11)
    txt(s, x+10, top+7, 8.0, 'PoppinsMedium')

def base(page, label):
    box(0, 0, W, H, CREAM)
    box(0, 0, W, 5, ORANGE)
    c.drawImage(LOGO, M, H-79, 43, 43, mask='auto')
    txt('DOSSO DOSSI COFFEE', M+55, 42, 10.4, 'PoppinsSemi')
    txt('WEB SİTESİ & ONLINE MAĞAZA', M+55, 59, 7.4, 'PoppinsMedium', MUTED)
    txt('BİTİRGİTSİN', W-M, 44, 9.6, 'PoppinsSemi', align='right')
    txt('FİYAT TEKLİFİ', W-M, 60, 7.4, color=MUTED, align='right')
    line(M, 94, CW)
    line(M, 793, CW)
    txt('Berkay Demir  /  BitirGitsin', M, 808, 7.5, 'PoppinsMedium', MUTED)
    txt('iletisim@bitirgitsin.com', M+170, 808, 7.5, color=MUTED)
    c.linkURL('mailto:iletisim@bitirgitsin.com', (M+170,H-819,M+320,H-805), relative=0)
    txt(f'{page:02d} / 04', W-M, 808, 7.5, 'PoppinsMedium', MUTED, 'right')

def heading(kicker, title, subtitle=None):
    txt(kicker, M, 116, 8.2, 'PoppinsSemi', ORANGE)
    txt(title, M, 140, 24, 'PoppinsSemi')
    if subtitle:
        para(subtitle, M, 179, CW, 9.5, 15, MUTED)

def section_block(num, title, body, top, h):
    box(M, top, CW, h, WHITE, 10)
    box(M+14, top+15, 28, 28, SOFT, 14)
    txt(num, M+21, top+24, 9, 'PoppinsSemi', ORANGE)
    txt(title, M+56, top+16, 11.1, 'PoppinsSemi')
    para(body, M+56, top+38, CW-73, 9.0, 13.5, max_h=h-46)

# PAGE 1 - Clear commercial summary.
base(1, 'Özet')
txt('12 EKİM 2026  /  TEKLİF NO: BG-DD-2026-01', M, 116, 8.1, 'PoppinsMedium', MUTED)
txt('Kahve deneyiminizi', M, 153, 29, 'PoppinsSemi')
txt('online mağazaya taşıyalım.', M, 194, 26, 'PoppinsSemi')
para('Dosso Dossi Coffee için kurumsal web sitesi yenileme ve fiziksel ürün satışına uygun e-ticaret geliştirme teklifi.', M, 245, CW-12, 11.2, 17, MUTED, max_h=40)

box(M, 307, CW, 137, INK, 13)
txt('TOPLAM GELİŞTİRME BEDELİ', M+24, 330, 9, 'PoppinsMedium', HexColor('#EADDD3'))
txt('50.000 TL', M+22, 355, 38, 'PoppinsSemi', WHITE)
txt('İş tesliminde tek seferde ödeme', M+24, 411, 10, 'PoppinsMedium', WHITE)

gap = 12
cardw = (CW-2*gap)/3
cards = [
    ('01', 'Kurumsal web', 'Marka hikâyesi, şubeler, menü ve iletişim.'),
    ('02', 'Online mağaza', 'Çekirdek kahve, termos, kupa ve aksesuar satışı.'),
    ('03', 'Yönetim paneli', 'Ürün, stok, içerik ve web siparişlerinin yönetimi.'),
]
for i,(n,t,b) in enumerate(cards):
    x=M+i*(cardw+gap)
    box(x, 466, cardw, 111, SOFT, 10)
    txt(n, x+14, 479, 8, 'PoppinsSemi', ORANGE)
    txt(t, x+14, 499, 10.5, 'PoppinsSemi')
    para(b, x+14, 521, cardw-28, 8.5, 12.5, max_h=42)

txt('Mevcut dijital yapının üzerine', M, 607, 14, 'PoppinsSemi')
para('Mobil uygulamadaki marka, ürün ve yönetim altyapısından yararlanılarak yeni web kanalı geliştirilecektir. Web mağazasına teslimat ve fatura adresleri, adet bazlı stok, kargo takibi ve iyzico ile kartla ödeme akışları eklenecektir.', M, 637, CW, 9.4, 15, max_h=64)
para('Tasarım yaklaşımı: Espressolab’ın kurumsal site ve online mağaza akışı referans alınarak Dosso Dossi kimliğine uygun özgün bir deneyim hazırlanacaktır.', M, 716, CW, 8.6, 13, MUTED, max_h=30)
para('Referans: <link href="https://espressolab.com/alisveris" color="#75685F">espressolab.com/alisveris</link>  |  İnceleme: 12 Ekim 2026', M, 756, CW, 7.2, 11, MUTED)
c.showPage()

# PAGE 2 - Scope and practical limits.
base(2, 'Kapsam')
heading('01 / PROJE KAPSAMI', 'Neler teslim edilecek?', 'Kurumsal görünümden sipariş yönetimine kadar temel web mağazası deneyimi.')
section_block('01', 'Markaya özel tasarım ve kurumsal sayfalar',
    'Telefon, tablet ve masaüstüne uyumlu arayüz; ana sayfa, hakkımızda, şubeler, menü, iletişim ve mobil uygulama tanıtımı. Banner ve temel içeriklerin panelden düzenlenmesi.', 220, 90)
section_block('02', 'Ürün kataloğu ve stok yönetimi',
    'Kategori, arama ve sıralama; ürün görselleri, açıklamalar ve fiyatlar. Gramaj veya renk gibi temel varyantlar, ürün kodu ve tek depo için adet stok takibi; stokta olmayan üründe satış kontrolü.', 320, 96)
section_block('03', 'Üyelik, sepet ve adresli sipariş',
    'Mevcut müşteri altyapısına bağlı üyelik; telefon doğrulaması için bir standart SMS servisi bağlantısı. Sepet, teslimat/fatura adresi, sipariş özeti, geçmiş ve sipariş onay e-postası.', 426, 96)
section_block('04', 'iyzico ile online ödeme',
    'Web mağazasına iyzico ödeme formunun bağlanması, ödeme sonucunun doğrulanması ve başarılı/başarısız işlem senaryolarının testi. Entegrasyon işçiliği teklif bedeline dahildir.', 532, 90)
section_block('05', 'Sipariş, kargo ve iade operasyonu',
    'Panelden sipariş durumu, sabit kargo ücreti/ücretsiz kargo eşiği ve manuel takip numarası yönetimi. İade talebi kaydı; ödeme iadesi iyzico panelinden, stok düzeltmesi yönetici onayıyla yapılır.', 632, 96)
para('<b>Kapsam varsayımı:</b> Türkçe, TL, Türkiye içi satış ve tek depo. İlk içerik girişinde en fazla 30 ana ürün ve 8 kurumsal sayfa öngörülür; panelden daha sonra ürün eklenebilir. Müşterinin sağladığı yasal metin sayfaları ayrıca yerleştirilir.', M, 742, CW, 8.0, 11.5, MUTED, max_h=38)
c.showPage()

# PAGE 3 - Service allocation and clearly separate third-party expenses.
base(3, 'Bedel')
heading('02 / HİZMET BEDELİ DAĞILIMI', '50.000 TL’nin kapsamı', 'Aşağıdaki kalemler tek seferlik tasarım ve geliştirme hizmet bedelini oluşturur.')
box(M, 218, CW, 29, INK, 5)
txt('HİZMET KALEMİ', M+14, 228, 8, 'PoppinsSemi', WHITE)
txt('BEDEL', W-M-14, 228, 8, 'PoppinsSemi', WHITE, 'right')
rows = [
    ('Analiz, kullanıcı deneyimi ve arayüz tasarımı', 7000),
    ('Kurumsal web sitesi ve mobil uyumlu sayfalar', 9000),
    ('Ürün kataloğu, varyantlar ve adet stok altyapısı', 9000),
    ('Üyelik, adres, sepet ve web sipariş akışı', 8000),
    ('iyzico web ödeme entegrasyonu', 5000),
    ('Yönetim panelinin web mağazası için genişletilmesi', 6000),
    ('Temel SEO, performans düzenlemeleri ve testler', 3000),
    ('Yayına alma, eğitim ve teslim sonrası hata desteği', 3000),
]
assert sum(v for _,v in rows)==50000
for i,(name,value) in enumerate(rows):
    top=247+i*26
    if i%2==0: box(M, top, CW, 26, WHITE)
    txt(name, M+14, top+8, 8.6)
    txt(f'{value:,}'.replace(',','.')+' TL', W-M-14, top+8, 9, 'PoppinsMedium', align='right')
    line(M, top+26, CW)
box(M, 462, CW, 43, SOFT, 6)
txt('TOPLAM GELİŞTİRME BEDELİ', M+14, 477, 10, 'PoppinsSemi')
txt('50.000 TL', W-M-14, 474, 17, 'PoppinsSemi', align='right')

txt('Dış hizmet ve işletme giderleri', M, 528, 16, 'PoppinsSemi')
para('Geliştirme bedelinden ayrı, müşteri tarafından karşılanan hizmetler.', M, 554, CW, 9.2, 14, MUTED)

box(M, 579, CW, 118, INK, 10)
box(M, 593, 4, 90, ORANGE, 2)
txt('Sunucu ve barındırma giderleri müşteriye aittir', M+18, 595, 11.5, 'PoppinsSemi', WHITE)
para('Sunucu, veritabanı, depolama ve yedekleme ücretleri <b>50.000 TL geliştirme bedeline dahil değildir.</b> Hizmet müşteri hesabı üzerinden alınır; dönemsel ücretleri müşteri doğrudan hizmet sağlayıcıya öder. <b>BitirGitsin’in ilk kurulum ve yayına alma hizmeti teklif bedeline dahildir.</b>', M+18, 621, CW-36, 9.4, 14.5, WHITE, max_h=63)

expense_w=(CW-12)/2
for i,(title,body) in enumerate([
    ('SMS ve e-posta', 'Hesap doğrulama ve bildirim hizmetlerinin kullanım ücretleri müşteriye aittir; sağlayıcının tarifesine göre ödenir.'),
    ('Mevcut alan adı', 'Alan adı müşteriye aittir. Yenileme ücretini müşteri karşılar; kurulum için yönetim/DNS erişimi yeterlidir.'),
]):
    x=M+i*(expense_w+12)
    box(x, 709, expense_w, 73, SOFT, 8)
    txt(title, x+13, 722, 10, 'PoppinsSemi')
    para(body, x+13, 741, expense_w-26, 8.3, 11.5, max_h=36)
c.showPage()

# PAGE 4 - Prominent client preparation checklist and confirmed delivery terms.
base(4, 'Koşullar')
heading('03 / HAZIRLIK VE TESLİM', 'Müşteriden sağlanacaklar', 'Web sitesinin hazırlanması için paylaşılacak bilgi, içerik ve erişimler.')

requirements = [
    ('01', 'Mevcut alan adına erişim',
     'Satın alınmış alan adının yönetim hesabına erişim veya DNS (alan adı yönlendirme) ayarlarını değiştirme yetkisi.', 216, 82),
    ('02', 'Marka ve ürün içerikleri',
     '<b>Marka:</b> Logo, kurumsal tanıtım yazıları, şube ve iletişim bilgileri.<br/>'
     '<b>Ürünler:</b> Fotoğraflar, açıklamalar, satış fiyatları ve stok adetleri.<br/>'
     '<b>Yasal metinler:</b> Müşteri tarafından onaylanmış gizlilik, satış ve iade metinleri.', 310, 108),
    ('03', 'Ödeme ve hizmet hesapları',
     '<b>iyzico:</b> Başvuru onayı sonrasında ödeme entegrasyonu için gerekli erişim bilgileri.<br/>'
     '<b>Barındırma:</b> Müşteriye ait sunucu hizmetinin yönetim erişimi.<br/>'
     '<b>Bildirimler:</b> SMS ve e-posta hizmetlerinin hesap ve bağlantı bilgileri.', 430, 108),
]
for num, title, body, top, h in requirements:
    box(M, top, CW, h, WHITE, 10)
    box(M, top+13, 4, h-26, ORANGE, 2)
    box(M+15, top+16, 29, 29, SOFT, 14)
    txt(num, M+22, top+25, 9, 'PoppinsSemi', ORANGE)
    txt(title, M+58, top+17, 12, 'PoppinsSemi')
    para(body, M+58, top+41, CW-77, 9.6, 14.5, max_h=h-49)

box(M, 557, CW, 60, INK, 10)
txt('ÖDEME KOŞULU', M+19, 571, 8.5, 'PoppinsMedium', HexColor('#EADDD3'))
txt('İş tesliminde tek seferde 50.000 TL', M+19, 591, 17, 'PoppinsSemi', WHITE)

txt('Teklife dahil teslim hizmetleri', M, 637, 12.2, 'PoppinsSemi')
para('Temel arama motoru ayarları (sayfa başlıkları, açıklamalar ve site haritası), tarayıcı/mobil kontrolleri, alan adı yönlendirme ve SSL kurulumu; yönetim paneli eğitimi, kısa kullanım notları ve kaynak kod teslimi. Tasarımda 2 toplu revizyon turu ve teslimden sonra 30 gün kapsam içi yazılım hatalarının giderilmesi dahildir.', M, 662, CW, 9, 13.5, max_h=60)

line(M, 735, CW)
para('Teslim kontrolü; ürün yönetimi, stok, sepet, adres, ödeme, sipariş ve kargo takibi akışlarının birlikte doğrulanmasını kapsar. Kapsam değişiklikleri ve ilave hizmetler uygulamadan önce ayrıca mutabık kalınarak fiyatlandırılır.', M, 748, CW, 8.1, 11.5, MUTED, max_h=35)
c.save()
print(str(OUT))
print(f'Pages: 4; priced items: {len(rows)}; total: {sum(v for _,v in rows)} TL; layout checks: {len(CHECKS)}')
