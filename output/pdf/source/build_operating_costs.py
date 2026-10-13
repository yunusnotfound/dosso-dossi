"""Customer-facing recurring-cost sheet; prices checked on 2026-10-12.

Hostinger live public cart: KVM4, 24 months, no daily backup add-on,
13,271.76 TRY plan subtotal, 15,926.11 TRY displayed checkout total.
No purchase, account creation or payment was made.
Apple annual local membership price: 1,029 TRY, supplied by the user on 2026-10-13.
Netgsm OTP is a required customer-paid service, selected by the user on 2026-10-13.
"""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'output/pdf/Dosso-Dossi-Dijital-Hizmet-ve-Isletme-Giderleri.pdf'
FONTS = ROOT / 'video-production/management-intro/fonts'
for name, filename in [('Poppins', 'Poppins-Regular.ttf'), ('PoppinsMedium', 'Poppins-Medium.ttf'), ('PoppinsSemi', 'Poppins-SemiBold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / filename)))
pdfmetrics.registerFontFamily('Poppins', normal='Poppins', bold='PoppinsSemi', italic='Poppins', boldItalic='PoppinsSemi')

W, H = 595.276, 841.89
M, CW = 42, 511.276
INK = HexColor('#2E211A')
ORANGE = HexColor('#EF6024')
CREAM = HexColor('#FBF8F2')
SOFT = HexColor('#F1E8E0')
MUTED = HexColor('#75685F')
LINE = HexColor('#DDD1C6')
WHITE = HexColor('#FFFFFF')
LIGHT = HexColor('#EEE0D5')
LOGO = ImageReader(str(ROOT / 'dosso-dossi-app/assets/images/logo.png'))
HOST_TOTAL = Decimal('15926.11')
HOST_MONTHLY = (HOST_TOTAL / 24).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
APPLE_ANNUAL = Decimal('1029')
SMS_INITIAL = Decimal('316')
INITIAL_TRY = HOST_TOTAL + APPLE_ANNUAL + SMS_INITIAL
INITIAL_USD = Decimal('25')
assert HOST_MONTHLY == Decimal('663.59')
assert INITIAL_TRY == Decimal('17271.11')

def money_tr(amount):
    return f'{amount:,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')

SOURCES = {
    'host': 'https://www.hostinger.com/tr/vps-hosting',
    'apple': 'https://developer.apple.com/help/account/membership/program-enrollment/',
    'google': 'https://support.google.com/googleplay/android-developer/answer/6112435?hl=tr',
    'sms': 'https://www.netgsm.com.tr/fiyatlar/otp-sms',
    'email': 'https://resend.com/pricing',
    'maps': 'https://www.mapbox.com/static-maps',
    'backup': 'https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/',
    'management': 'https://www.hostinger.com/support/8852150-what-is-a-self-managed-vps-at-hostinger/',
}

OUT.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Dosso Dossi Coffee | Dijital Hizmet ve İşletme Giderleri')
c.setAuthor('Berkay Demir | BitirGitsin')
c.setSubject('Mobil uygulama ve web mağazası için firma tarafından karşılanan dış hizmet giderleri')
CHECKS = []

def box(x, top, w, h, fill, radius=0):
    c.setFillColor(fill)
    if radius:
        c.roundRect(x, H-top-h, w, h, radius, fill=1, stroke=0)
    else:
        c.rect(x, H-top-h, w, h, fill=1, stroke=0)

def line(top, x=M, w=CW):
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.line(x, H-top, x+w, H-top)

def txt(s, x, top, size=10, font='Poppins', color=INK, right=False, max_w=None):
    if max_w is not None:
        assert pdfmetrics.stringWidth(s, font, size) <= max_w, s
    c.setFillColor(color)
    c.setFont(font, size)
    (c.drawRightString if right else c.drawString)(x, H-top-size*.81, s)

def para(s, x, top, w, size=10, leading=15, color=INK, max_h=None, bold=False):
    p = Paragraph(s, ParagraphStyle('body', fontName='PoppinsSemi' if bold else 'Poppins', fontSize=size, leading=leading, textColor=color))
    _, h = p.wrap(w, 1000)
    if max_h is not None and h > max_h + .1:
        raise ValueError(f'Overflow page {c.getPageNumber()}: {h}>{max_h}: {s[:100]}')
    if top+h > 785:
        raise ValueError(f'Footer overlap: {s[:100]}')
    p.drawOn(c, x, H-top-h)
    CHECKS.append((c.getPageNumber(), round(top+h, 1)))
    return h

def source_link(key, label):
    return f'<link href="{SOURCES[key]}" color="#75685F"><u>{label}</u></link>'

def base(page):
    box(0, 0, W, H, CREAM)
    box(0, 0, W, 5, ORANGE)
    c.drawImage(LOGO, M, H-79, 42, 42, mask='auto')
    txt('DOSSO DOSSI COFFEE', M+54, 43, 10.4, 'PoppinsSemi')
    txt('MOBİL UYGULAMA + WEB MAĞAZASI', M+54, 61, 7.2, 'PoppinsMedium', MUTED)
    txt('BİTİRGİTSİN', W-M, 43, 10, 'PoppinsSemi', right=True)
    txt('GİDER BİLGİLENDİRMESİ', W-M, 61, 7.1, color=MUTED, right=True)
    line(95)
    line(795)
    txt('Berkay Demir / BitirGitsin', M, 810, 7.4, 'PoppinsMedium', MUTED)
    txt('iletisim@bitirgitsin.com', M+174, 810, 7.4, color=MUTED)
    c.linkURL('mailto:iletisim@bitirgitsin.com', (M+174, H-821, M+316, H-806))
    txt(f'{page:02d} / 04', W-M, 810, 7.4, 'PoppinsMedium', MUTED, right=True)

def heading(kicker, title, subtitle):
    txt(kicker, M, 114, 8, 'PoppinsSemi', ORANGE)
    txt(title, M, 139, 25, 'PoppinsSemi', max_w=CW)
    para(subtitle, M, 179, CW, 10, 15, MUTED, max_h=31)

def compact_row(top, name, explanation, price, period, h=57):
    box(M, top, CW, h, WHITE, 7)
    txt(name, M+14, top+11, 10.2, 'PoppinsSemi')
    para(explanation, M+14, top+29, 325, 8.7, 12.5, MUTED, max_h=26)
    txt(price, W-M-14, top+11, 12.4, 'PoppinsSemi', right=True)
    txt(period, W-M-14, top+32, 8.3, color=MUTED, right=True)

# PAGE 1: One-table payment summary. Different currencies are not added together.
base(1)
heading('13 EKİM 2026 / BG-DD-GİDER-01 / REV. 05', 'Başlangıç ve dönemsel ödemeler',
        '24 aylık sunucu, yeni hizmet hesapları ve ücretsiz e-posta/harita kotaları esas alınmıştır.')

COLS = (120, 122, CW-242)
X = (M, M+COLS[0], M+COLS[0]+COLS[1])
box(M, 222, CW, 32, INK, 7)
for label, x in zip(['GİDER KALEMİ', 'BAŞLANGIÇ ÖDEMESİ', 'SONRAKİ AYLIK / YILLIK ÖDEME'], X):
    txt(label, x+11, 234, 7.4, 'PoppinsSemi', WHITE)

summary_rows = [
    (60, '<b>Hostinger KVM4</b><br/>Ortak sunucu',
     '<b>15.926,11 TL</b><br/>24 ay peşin',
     'İlk 24 ay aylık ödeme yok. 24 ay sonunda yenilenir. İlan edilen yenileme tarifesi 1.381,99 TL/ay; nihai tutar yenileme ekranında belirlenir.'),
    (43, '<b>Apple Developer</b>',
     '<b>1.029 TL</b><br/>İlk yıl',
     '<b>Yıllık: 1.029 TL.</b> İlk yıl başlangıç ödemesine dahildir; sonraki yıl yenilenir.'),
    (58, '<b>Netgsm OTP SMS</b><br/>Zorunlu hizmet',
     '<b>316 TL</b><br/>İlk 1.000 SMS',
     'Sabit aylık bedel yok. Paket tükendiğinde veya 1 yıllık süresi dolduğunda güncel Netgsm tarifesiyle yeni paket alınır.'),
    (42, '<b>Google Play</b>',
     '<b>25 USD</b><br/>Yeni hesap',
     'Tek seferliktir. Mevcut firma hesabı varsa başlangıçtaki bu ödeme oluşmaz.'),
    (45, '<b>Alan adı</b>',
     'Yeni alım yok',
     '<b>Yıllık yenileme:</b> Mevcut kayıt firmasının tarifesi. Tutar henüz bilinmiyor.'),
    (47, '<b>E-posta ve harita</b>',
     '<b>0 TL</b><br/>Ücretsiz kota içinde',
     'Aylık ücret, ücretsiz kota aşıldığında veya ücretli paket seçildiğinde oluşur. Tarifeler 3. sayfada.'),
    (42, '<b>Sürekli teknik bakım</b>',
     'Geliştirme bedeline dahil',
     '<b>Ek aylık/yıllık ücret yok.</b> Teknik bakım BitirGitsin tarafından yürütülür.'),
]
top = 254
for i, (height, name, initial, recurring) in enumerate(summary_rows):
    box(M, top, CW, height, WHITE if i % 2 == 0 else SOFT)
    for value, x, width in zip([name, initial, recurring], X, COLS):
        para(value, x+11, top+10, width-22, 8.7, 12.1, max_h=height-17)
    line(top+height)
    top += height

box(M, top, CW, 61, INK)
para('BİLİNEN<br/>BAŞLANGIÇ<br/>TOPLAMI', X[0]+11, top+11, COLS[0]-22, 8.5, 12, WHITE, max_h=39, bold=True)
para(f'{money_tr(INITIAL_TRY)} TL<br/>+ {INITIAL_USD:.0f} USD', X[1]+11, top+12, COLS[1]-22, 11.6, 17, WHITE, max_h=38, bold=True)
para('Sunucu + ilk yıl Apple + ilk SMS paketi + yeni Google Play hesabı. Alan adı yenilemesi ve ek kullanım giderleri bu toplama dahil değildir.',
     X[2]+11, top+10, COLS[2]-22, 8.7, 12.1, WHITE, max_h=49)
top += 61
box(M, top, CW, 64, SOFT)
para('SONRAKİ DÖNEM<br/>ÖZETİ', X[0]+11, top+12, COLS[0]-22, 8.5, 12, max_h=39, bold=True)
para('<b>Yıllık:</b><br/>1.029 TL Apple<br/>+ alan adı yenileme', X[1]+11, top+12, COLS[1]-22, 8.7, 12.1, max_h=43)
para('İlk 24 ay, ücretsiz kotalar içinde ek sabit aylık tahsilat öngörülmez. SMS, kota aşımı ve ek servis giderleri ayrıca oluşur. Sunucu 24 ay sonunda yenilenir.',
     X[2]+11, top+10, COLS[2]-22, 8.7, 12.1, max_h=49)
top += 64
assert top <= 716, top

para('<b>663,59 TL/ay</b> sunucunun bütçe karşılığıdır; aylık tahsilat değildir. Alan adı yenilemesi başlangıca denk gelirse bedeli toplama eklenir. Yenilemelerde güncel sağlayıcı tarifeleri geçerlidir.',
     M, 728, CW, 8.4, 12, MUTED, max_h=27)
para('<b>50.000 TL web geliştirme bedeli bu dış hizmet toplamından ayrıdır ve teslimde ödenir.</b> Mobil geliştirme bedeli bu işletme giderleri belgesinde hesaplanmamıştır.',
     M, 759, CW, 8.4, 12, MUTED, max_h=26)
c.showPage()

# PAGE 2: What the company pays, with the actual upfront server amount.
base(2)
heading('01 / SABİT VE DÖNEMSEL GİDERLER', 'Dijital hizmet giderleri',
        'Mobil sadakat uygulaması, kurumsal web sitesi ve online mağazanın işletme giderleri.')

box(M, 220, CW, 95, INK, 11)
txt('Dönemsel giderleri firma karşılar.', M+18, 238, 15, 'PoppinsSemi', WHITE)
para('Sunucu, alan adı ve dış servis ödemeleri firma tarafından doğrudan sağlayıcılara yapılır. '
     '<b>Sürekli teknik bakım geliştirme bedeline dahildir.</b> '
     'BitirGitsin dış hizmetlerin aylık veya yıllık ücretlerini üstlenmez.',
     M+18, 265, CW-36, 10, 15, WHITE, max_h=46)

txt('01 / ORTAK SUNUCU', M, 335, 8.6, 'PoppinsSemi', ORANGE)
box(M, 356, CW, 212, WHITE, 10)
txt('Hostinger VPS KVM4', M+16, 371, 14, 'PoppinsSemi')
txt('4 vCPU / 16 GB RAM / 200 GB NVMe', M+16, 396, 9, color=MUTED)
txt('24 AYLIK ÖRNEK / PEŞİN ÖDEME', M+16, 428, 8, 'PoppinsMedium', MUTED)
txt('15.926,11 TL', M+16, 451, 28, 'PoppinsSemi')
txt('AYLIK BÜTÇE KARŞILIĞI', M+294, 428, 8, 'PoppinsMedium', MUTED)
txt('663,59 TL', M+294, 452, 25, 'PoppinsSemi', ORANGE)
para('12 Ekim’de görülen ödeme ekranı toplamıdır; günlük yedek eklentisi seçilmemiştir. '
     '<b>Aylık taksit değildir:</b> 24 aylık bedel başta ödenir.',
     M+16, 492, CW-32, 9.1, 13.3, max_h=28)
para('<b>Yenileme:</b> İlan edilen tarife 24 aylık yenilemede 1.381,99 TL/ay. '
     'Bu, nihai tahsilat toplamı değildir; yenileme ekranındaki tutar esas alınır.',
     M+16, 532, CW-32, 8.6, 12.5, MUTED, max_h=26)

txt('02 / DİĞER SABİT VE DÖNEMSEL KALEMLER', M, 589, 8.6, 'PoppinsSemi', ORANGE)
compact_row(610, 'Apple Developer hesabı', 'iOS uygulamasının App Store’da yayımlanması.', '1.029 TL', 'Yıllık')
compact_row(675, 'Google Play hesabı', 'Android yayını; mevcut firma hesabı varsa tekrar alınmaz.', '25 USD', 'Tek seferlik')

para('<b>Alan adı:</b> Zaten firmaya ait. Yeni alım öngörülmez; yıllık yenileme mevcut kayıt firmasının tarifesiyle ödenir.',
     M, 744, CW, 9.1, 13.5, max_h=28)
para('Kaynaklar: '+source_link('host', 'Hostinger KVM4 ve 24 aylık sepet')+' | '+source_link('apple', 'Apple')+' | '+source_link('google', 'Google Play'),
     M, 775, CW, 7, 9, MUTED, max_h=9)
c.showPage()

# PAGE 3: Required Netgsm OTP package and other services with usage-based charges.
base(3)
heading('03 / DOĞRULAMA VE DİĞER HİZMETLER', 'SMS ve diğer hizmetler',
        'Netgsm telefon doğrulama paketi zorunlu işletme gideridir. E-posta ve harita ücretleri kullanıma göre oluşur.')

def usage_card(top, h, number, title, fee, body):
    box(M, top, CW, h, WHITE, 10)
    box(M+14, top+15, 27, 27, SOFT, 13)
    txt(number, M+21, top+24, 8.5, 'PoppinsSemi', ORANGE)
    txt(title, M+54, top+16, 12.5, 'PoppinsSemi')
    txt(fee, M+54, top+41, 10.4, 'PoppinsSemi', ORANGE, max_w=CW-70)
    para(body, M+54, top+64, CW-72, 9.6, 14, max_h=h-75)

usage_card(222, 121, '01', 'Netgsm telefon doğrulama SMS’leri', 'Başlangıç paketi: 1.000 OTP SMS / 316 TL',
           '<b>Zorunlu hizmet:</b> Firma adına Netgsm hesabı açılır; paket ve yenileme ücretlerini firma öder. '
           'Yeni abone paketinin kullanım süresi 1 yıldır. Paket tükendiğinde yeni paket alınır.')
usage_card(355, 121, '02', 'Sipariş e-postaları', 'Örnek: Resend Free / 0 USD',
           'Ayda 3.000, günde en fazla 100 e-posta. Bu sınırlar yetmezse örnek Pro paket '
           '20 USD/ay karşılığında 50.000 e-posta sunar; üzeri kullanım ayrıca ücretlenir.')
usage_card(488, 121, '03', 'Şube haritası', 'Mapbox / ücretsiz kota, ardından kullanım ücreti',
           'Mevcut haritada kullanılan Static Tiles API için aylık ilk 200.000 harita parçası isteği ücretsizdir. '
           'Üzeri kullanım 1.000 istek için 0,50 USD’den başlar. Bir harita açılışı birden çok istek oluşturabilir.')

box(M, 628, CW, 83, SOFT, 10)
txt('Yedekleme ve ek kapasite', M+16, 643, 11.5, 'PoppinsSemi')
para('KVM4 haftalık sunucu yedeği içerir. <b>Önerimiz:</b> sipariş ve bakiye verileri için daha sık, sunucu dışı yedek planı oluşturulmasıdır. '
     'Ek yedekleme, depolama veya daha büyük paket seçilirse bedelini firma karşılar; tutar hizmet seçiminde netleşir.',
     M+16, 666, CW-32, 9.2, 13.4, max_h=41)

para('<b>Telefon doğrulamasında Netgsm kullanılacaktır.</b> E-posta için Resend örnek olarak gösterilmiştir; '
     'mevcut uygun firma e-posta hesabı kullanılabilir. Ücretsiz kotalar sınırsız kullanım içermez.',
     M, 727, CW, 9, 13.2, MUTED, max_h=28)
para('Kaynaklar: '+source_link('sms', 'Netgsm OTP')+' | '+source_link('email', 'Resend')+' | '+source_link('maps', 'Mapbox Static Tiles')+' | '+source_link('backup', 'Hostinger yedekleme'),
     M, 774, CW, 7.5, 10, MUTED, max_h=10)
c.showPage()

# PAGE 4: A plainly stated responsibility model, consistent with the sent offer.
base(4)
heading('04 / HESAPLAR, ÖDEMELER VE İŞLETME', 'Kim neyi üstleniyor?',
        'Geliştirme hizmeti ile sistemi yayında tutan dış hizmetlerin ödemesi ayrı yürütülür.')

box(M, 222, CW, 106, INK, 10)
txt('Firmanın sorumluluğu', M+18, 240, 14, 'PoppinsSemi', WHITE)
para('Sunucu, alan adı, uygulama mağazası hesapları ve kullanılan dış servislerin '
     '<b>satın alma, kullanım, yenileme ve kapasite artışı bedelleri firmaya aittir.</b> '
     'Hesap, fatura ve ödeme yöntemi firma adına tanımlanır. Yenilemelerin ve paket bakiyelerinin '
     'zamanında karşılanmasını firma takip eder.',
     M+18, 267, CW-36, 10.1, 15.2, WHITE, max_h=61)

box(M, 340, CW, 100, WHITE, 10)
txt('BitirGitsin’in hizmeti', M+18, 357, 13, 'PoppinsSemi')
para('Yazılım geliştirme, ilk kurulum, yayına alma ve <b>sürekli teknik bakım mevcut geliştirme bedeline dahildir.</b> '
     'Teknik işlemler için gerekli yönetim erişimleri firmadan alınır.',
     M+18, 384, CW-36, 10, 15, max_h=46)

box(M, 452, CW, 120, SOFT, 10)
txt('Sürekli teknik bakım fiyata dahildir', M+18, 469, 13, 'PoppinsSemi')
para('Uygulama ve sunucunun teknik takibi, yazılım/güvenlik güncellemeleri, '
     'yedeklerin kontrolü ve teknik arızalara müdahale BitirGitsin tarafından yürütülür. '
     '<b>Bu bakım hizmeti için ayrıca aylık veya yıllık hizmet bedeli alınmaz.</b> '
     'Sunucu ve diğer dış servislerin kullanım ve yenileme ücretlerini firma öder.',
     M+18, 497, CW-36, 10, 15, max_h=61)

txt('Hesaplar nasıl kurulacak?', M, 594, 12.3, 'PoppinsSemi')
steps = [
    'Firma kendi e-posta, fatura ve ödeme bilgileriyle hizmet hesaplarını açar.',
    'BitirGitsin’e kurulum ve sürekli bakım için gerekli yönetim yetkileri verilir.',
    'Yenileme bildirimleri ve ödemeler firma hesabı üzerinden takip edilir.',
]
for i, s in enumerate(steps):
    y = 619 + i*25
    txt(f'{i+1:02d}', M, y+1, 8.8, 'PoppinsSemi', ORANGE)
    para(s, M+26, y, CW-26, 9.3, 13.5, max_h=15)

line(702)
para('<b>Bütçe notu:</b> Sunucu için tek VPS üzerinde ortak barındırma varsayılmıştır; ayrı veritabanı kirası eklenmemiştir. '
     'Kaynak ihtiyacı kullanım arttıkça yeniden değerlendirilir. Alan adı, kullanım ücretleri ve mağaza hesapları sunucu tutarına dahil değildir.',
     M, 716, CW, 8.7, 12.8, MUTED, max_h=39)
para('Fiyat kontrolü: 12 Ekim 2026; Apple bedeli 13 Ekim’de iletilen yerel tutarla güncellenmiştir. '
     'Tarifeler değişebilir; satın alma ekranı esas alınır. USD tutarlarında ödeme günündeki kur geçerlidir. '
     +source_link('management', 'Hostinger VPS hizmet kapsamı'),
     M, 754, CW, 7.5, 10, MUTED, max_h=31)
c.save()
print(OUT)
print(f'Pages: 4; layout checks: {len(CHECKS)}; initial: {INITIAL_TRY} TRY + {INITIAL_USD} USD; monthly server budget: {HOST_MONTHLY} TRY')
