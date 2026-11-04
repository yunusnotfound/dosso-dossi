import type { Locale } from "@/lib/site";

export const storyCopy = {
  tr: {
    eyebrow: "DOSSO DOSSI COFFEE · HİKÂYEMİZ",
    title: ["BİR FİNCAN.", "BAMBAŞKA", "BİR DÜNYA."],
    intro: "Kahvenin sanatla, müzikle ve seninle buluştuğu yer.",
    start: "Hikâyenin içine gir", scroll: "Aşağıda devam ediyor", pause: "Hareketi durdur", play: "Hareketi aç",
    manifestoLabel: "BİZİ BİR ARAYA GETİREN",
    manifesto: ["Bir fincanla başlar.", "Bir sohbete dönüşür.", "Sende iz bırakır."],
    manifestoText: "Dosso Dossi Coffee’de özgün lezzetler, sanat ve müzik aynı deneyimin parçası. Her detay, kendine ayırdığın zamanı biraz daha özel kılmak için.",
    chapterLabel: "DÜNYAMIZIN ÜÇ HALİ", chapterTitle: ["TADINI AL.", "İLHAMINI BUL."],
    drag: "Sürükle ve keşfet", previous: "Önceki bölüm", next: "Sonraki bölüm", chapterGroup: "Hikâye bölümleri",
    chapters: [
      { name: "Kahve", cue: "01 / TUTKU", title: "O İLK\nYUDUM.", text: "Güne küçük bir ara. Fincandan yükselen bir koku. Bir sonraki cümleden önce kendine ayırdığın o an.", note: "KÜÇÜK BİR RİTÜEL. GÜZEL BİR BAŞLANGIÇ.", image: "/images/editorial/coffee-moment.webp", alt: "Bir barista fincana süt dökerek latte sanatı hazırlıyor" },
      { name: "Sanat", cue: "02 / İLHAM", title: "BAŞKA\nTÜRLÜ BAK.", text: "Tanıdık bir biçim, beklenmedik bir renk. Bazen ilham, gündelik bir ana biraz farklı bakmakla başlar.", note: "ESTETİK, GÜNLÜK HAYATIN İÇİNDE.", image: "/images/story/coffee-meets-art-v1.webp", alt: "Turuncu bir kurdele, mermer heykel ve espresso ile hazırlanmış kavramsal sanat kompozisyonu" },
      { name: "Müzik", cue: "03 / RİTİM", title: "ANIN\nRİTMİNİ BUL.", text: "Bir melodiye takıl. Sohbetin akışına bırak kendini. Kahven soğumadan, zaman biraz yavaşlasın.", note: "TASTE THE ART. FEEL THE MELODY.", image: "/images/story/coffee-meets-music-v1.webp", alt: "Turuncu etiketli plak ve espresso fincanıyla kavramsal müzik kompozisyonu" },
    ],
    visionLabel: "HİKMET ERASLAN’IN VİZYONU", visionTitle: ["PAYLAŞMA", "TUTKUSUNDAN."],
    visionText: "Hikmet Eraslan’ın yaklaşımı; kahveyi yaratıcılık, estetik ve insanları buluşturan bir yaşam alanıyla birlikte düşünmek. Dosso Dossi Coffee’nin hikâyesi bu paylaşma tutkusuyla şekilleniyor.",
    visionLink: "Vizyonun tamamını oku", portrait: "Hikmet Eraslan",
  },
  en: {
    eyebrow: "DOSSO DOSSI COFFEE · OUR STORY",
    title: ["ONE CUP.", "A WHOLE", "NEW WORLD."],
    intro: "Where coffee meets art, music and you.",
    start: "Step into our story", scroll: "The story continues below", pause: "Pause motion", play: "Enable motion",
    manifestoLabel: "WHAT BRINGS US TOGETHER",
    manifesto: ["It starts with a cup.", "Becomes a conversation.", "Stays with you."],
    manifestoText: "At Dosso Dossi Coffee, distinctive flavours, art and music are part of one experience. Thoughtful details make the time you take for yourself feel a little more special.",
    chapterLabel: "THREE SIDES OF OUR WORLD", chapterTitle: ["FIND YOUR TASTE.", "FEEL INSPIRED."],
    drag: "Drag to explore", previous: "Previous chapter", next: "Next chapter", chapterGroup: "Story chapters",
    chapters: [
      { name: "Coffee", cue: "01 / PASSION", title: "THAT\nFIRST SIP.", text: "A little pause in your day. An aroma rising from the cup. A moment to yourself before the next conversation begins.", note: "A LITTLE RITUAL. A BEAUTIFUL BEGINNING.", image: "/images/editorial/coffee-moment.webp", alt: "A barista pouring milk into a cup to create latte art" },
      { name: "Art", cue: "02 / INSPIRATION", title: "SEE THINGS\nDIFFERENTLY.", text: "A familiar shape. An unexpected colour. Sometimes inspiration begins by looking at an ordinary moment in a new way.", note: "A LITTLE ART IN THE EVERYDAY.", image: "/images/story/coffee-meets-art-v1.webp", alt: "Conceptual artwork with an orange ribbon, marble sculpture and espresso" },
      { name: "Music", cue: "03 / RHYTHM", title: "FIND YOUR\nRHYTHM.", text: "Follow a melody. Let the conversation flow. Before your coffee cools, let time slow down a little.", note: "TASTE THE ART. FEEL THE MELODY.", image: "/images/story/coffee-meets-music-v1.webp", alt: "Conceptual music composition featuring an orange-label vinyl record and espresso" },
    ],
    visionLabel: "HİKMET ERASLAN’S VISION", visionTitle: ["A PASSION", "FOR SHARING."],
    visionText: "Hikmet Eraslan’s vision brings coffee together with creativity, thoughtful design and spaces that connect people. That passion for sharing shapes the Dosso Dossi Coffee story.",
    visionLink: "Read the full vision", portrait: "Hikmet Eraslan",
  },
} satisfies Record<Locale, unknown>;
