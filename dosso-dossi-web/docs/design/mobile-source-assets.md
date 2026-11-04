# Mobile page source assets — 14 October 2026

The MOBİL presentation uses fresh captures of the actual mobile application, built from source commit **`4f73c08`** (the current `origin/main` source at capture time). The app ran through its normal **`lib/main.dart`** entry point with **`USE_MOCKS=false`** against the existing local backend at `http://127.0.0.1:3000`.

The existing account was accessed through the normal application login flow and the configured local SMS development provider. The final captures do not use a fabricated identity, a wallet override, a menu fixture, or a story-provider override. No app source or database business data was edited for the capture. Normal authentication/session handling and the wallet QR request created their expected transient records; this was not a zero-write database operation. No purchase, balance load, gift transfer, or other business transaction was performed for these screenshots.

## Current app captures

Original PNG directory: `output/mobile-promo-current/2026-10-14/real/` in the repository root.

All eight original captures and their public WebP derivatives are **1206 × 2622 px**. The screen content was not recreated, cropped, resized, or cosmetically edited. The only image transformation was encoding the PNG captures as WebP with **quality 94, effort 6** through the project's existing `sharp` package. The website supplies the surrounding phone model separately.

| Public asset | Original PNG | Captured content |
| --- | --- | --- |
| `/images/mobile/app-home-20261014.webp` | `app-home.png` | Current home screen, actual account state and four available story entries. |
| `/images/mobile/app-rewards-20261014.webp` | `app-rewards.png` | Current İkramlarım screen and actual reward progress/history. |
| `/images/mobile/app-menu-20261014.webp` | `app-menu.png` | Current menu UI with the backend's actual product information and photographs. |
| `/images/mobile/app-wallet-20261014.webp` | `app-wallet.png` | Current Dosso Dossi Kart / Tara & Öde screen. The captured QR's 60-second validity expired before website delivery. |
| `/images/mobile/app-story-coffee-20261014.webp` | `app-story-coffee.png` | Actual “Kahve Kazan” story and its current published poster. |
| `/images/mobile/app-story-topup-20261014.webp` | `app-story-topup.png` | Actual “Yükle Kazan” story and its current published poster. |
| `/images/mobile/app-story-fruit-20261014.webp` | `app-story-fruit.png` | Actual “Serinliğin Üç Hali” story and its current published poster. |
| `/images/mobile/app-story-shop-20261014.webp` | `app-story-shop.png` | Actual “Kahve Keyfi Evinde” story and its current published poster. |

The four stories were supplied by the real local **`/campaign-stories`** endpoint. Their poster images came from that endpoint's current media URLs. They were not reduced to the two hardcoded mock stories or reconstructed with substitute artwork.

Displayed account information, menu prices and campaign terms reflect the capture moment. The web presentation displays static local images; it does not request a mobile session, refresh a wallet, load the mobile API, or offer a functioning payment QR.

The September management-video screenshots and their original undated WebP copies are superseded and are not sources for the final presentation. The temporary `/tmp/dosso-mobile-preview-20261014.dart` wrapper is obsolete and was not used for the final eight captures.

## Existing brand artwork

These supporting assets remain faithful derivatives of existing app artwork.

| Public asset | Source within `dosso-dossi-app/assets/images/` | Dimensions |
| --- | --- | --- |
| `/images/mobile/venice-card.webp` | `damga_karti_arka_plan.jpg` | 1200 × 1003 |
| `/images/mobile/cupcutout.webp` | `yukle_kazan_cup.png` | 1024 × 1536, alpha retained |
| `/images/mobile/app-logo.webp` | `logo.png` | 1229 × 1229, alpha retained |
| `/images/mobile/coffee-bean.svg` | Faithful SVG equivalent of `lib/core/widgets/coffee_bean_icon.dart` | 100 × 100 viewBox |

The bean matches the app icon's ellipse ratio, -0.60-radian rotation and transparent curved slit. It extends the existing vector icon system; it is not generated replacement artwork.

## Presentation scope

- The screenshots demonstrate the real application interface and its current local-backend content. They do not establish live external bank settlement, production SMS/push delivery, or connected POS acceptance.
- Stamp wording follows the app's reward rule: **5 stamps earn 1 reward**.
- The website remains independent of the mobile application and its services. All promotional screenshots and brand artwork are served from the website's own public asset directory.
- No verified App Store or Google Play listing URL was established for this work; no invented download destination or availability claim should be attached to the presentation.

Verification: the current commit and dimensions of all eight dated WebP files were checked locally. Source UI, backend business data and external service configuration were not modified for the website presentation.
