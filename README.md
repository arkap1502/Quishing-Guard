# 🛡️ Quishing Guard — Scan QR Codes Before You Trust Them

> Scan or upload a QR code, decode the payload, and check where it **really** leads: shortened URLs, lookalike domains, and UPI payment links where the payee name doesn't match the merchant. Ships as a PWA so people can use it straight from their phone camera.

**Status:** 🟡 Planning / Pre-build — this README is the build blueprint.
**Target:** PWA (mobile-first) + desktop support for upload/scan.

---

## 1. Problem Statement

QR codes are opaque — humans can't read them. Attackers exploit this with **Quishing (QR phishing)**:

1.  **Fake payment QRs** stuck over real merchant QRs (payee VPA/name swapped).
2.  **Shortened / redirect URLs** (`bit.ly`, `tinyurl`, open-redirects) hiding phishing pages.
3.  **Lookalike domains** (`paytm-secure.com`, `gpay-offer.in`, punycode `pаypal.com`) for credential theft.
4.  **Malicious app intents / UPI autopay** links (`upi://pay?...`, `intent://...`) triggering payments.
5.  **WiFi / contact / plain-text QRs** used for social engineering.

Users scan with their native camera app → go straight to the malicious site with **zero context**. Quishing Guard sits **in between**: decode first, analyze risk, then let the user decide.

## 2. Solution Overview

```
[ Camera Scan / Upload Image ] 
        ↓
[ Decode QR Payload (client-side) ]
        ↓
[ Classify Payload Type ]
  URL | UPI | WiFi | Text | vCard | App Intent
        ↓
[ Threat Analysis Engine ]
  ├─ URL expander (unshorten + follow redirects)
  ├─ Domain reputation + lookalike detector
  ├─ UPI parser (payee, VPA, amount, merchant check)
  └─ Heuristics + Safe Browsing / VirusTotal (optional)
        ↓
[ Verdict Screen: 🟢 Safe / 🟡 Suspicious / 🔴 Malicious ]
  Show: real destination, preview, who you'd pay, why flagged
```

**Core promise:** No blind opens. Every QR gets a plain-English verdict in < 3 seconds.

## 3. Key Features

### 3.1 Scan & Decode
- [ ] Live camera scan (PWA, `getUserMedia` + `BarcodeDetector` / `jsQR` fallback)
- [ ] Upload image (`png/jpg/webp`) + drag-and-drop
- [ ] Multi-QR detection in one image
- [ ] Torch / zoom controls for low-light scans
- [ ] Offline decode (all decoding happens on-device)

### 3.2 URL Intelligence — "Where does it really lead?"
- [ ] Short-URL expansion (`bit.ly`, `t.ly`, `tinyurl`, `goo.gl`, `is.gd`, custom shorteners)
- [ ] Full redirect-chain tracer (max 10 hops, show each hop)
- [ ] Final destination preview (domain, title, favicon, screenshot)
- [ ] Lookalike / typosquat detection:
  - Levenshtein vs. top 500 brand domains (Google, Paytm, PhonePe, GPay, banks)
  - Punycode / homograph detection (`xn--`, Cyrillic/Greek confusables)
  - Suspicious TLDs (`.tk`, `.ml`, `.top`, `.xyz` + free-subdomain hosts)
  - Excessive subdomains, `@` tricks, IP-literal URLs, non-HTTPS
- [ ] Blocklist + allowlist check (Google Safe Browsing API, PhishTank, local cache)

### 3.3 UPI Payment Guard — "Who are you really paying?"
- [ ] Parse `upi://pay?pa=...&pn=...&am=...&cu=...&tn=...`
- [ ] Extract: payee VPA (`pa`), payee name (`pn`), amount (`am`), note (`tn`), merchant code (`mc`)
- [ ] **Payee-name vs. VPA mismatch:** `pn=Swiggy` but `pa=random123@okhdfc` → 🔴 flag
- [ ] Suspicious VPA patterns: random strings, personal handles for "merchant", `payee` on free PSPs
- [ ] Amount check: pre-filled large amount, `am` present in sticky-QR-overwrite scams
- [ ] Merchant verification hint: compare `pn` against user-entered expected merchant
- [ ] "Type the shop name" confirmation step before showing "Proceed"

### 3.4 Verdict UX
- [ ] Traffic-light verdict: 🟢 Safe / 🟡 Caution / 🔴 Do Not Proceed
- [ ] Risk reasons in plain language ("Shortened link hides real site", "Payee name doesn't match VPA")
- [ ] Actions: Copy URL, Open in Sandbox / Preview, Report Phishing, Share Verdict
- [ ] Scan history (local-only, IndexedDB) + export

### 3.5 PWA — "Use it straight from phone camera"
- [ ] Installable (`manifest.json`, icons 192/512, standalone display)
- [ ] Service worker + offline scan page (Workbox)
- [ ] Mobile-first camera UI, `<input capture="environment">` fallback for iOS
- [ ] Share Target API: share QR image → Quishing Guard from gallery
- [ ] Lighthouse PWA score ≥ 90

## 4. Tech Stack (Recommended)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + TypeScript + Tailwind** (or Next.js) | Fast PWA, easy camera handling |
| QR Decode | `BarcodeDetector` (native) + `jsQR` / `@zxing/browser` fallback | Covers all browsers |
| PWA | `vite-plugin-pwa` (Workbox) | Manifest + SW in one plugin |
| Backend (Phase 2+) | **Node + Express / Fastify** or serverless (Vercel/Cloudflare Workers) | Needed for URL expansion (CORS) |
| URL Expand API | `GET /api/expand?url=` — follows redirects server-side, returns chain | Browsers block cross-origin redirects |
| Threat Intel | Google Safe Browsing v4, VirusTotal v3, PhishTank (all optional, cached) | Layered reputation |
| DB (optional) | Upstash Redis / SQLite — cache expansions + community reports | Avoid repeat API calls |
| Hosting | Vercel / Netlify (frontend) + serverless functions | Free tier, HTTPS, PWA-ready |

> **Privacy rule:** QR decode + UPI parse = 100% client-side. Only expanded URLs (never images) hit the backend. No tracking.

## 5. Payload Types Supported

| Prefix | Type | What we show |
|---|---|---|
| `https://`, `http://` | URL | Final URL, redirect chain, domain age signals |
| `upi://pay` | UPI Payment | Payee, VPA, amount, mismatch warning |
| `WIFI:T:...` | WiFi | SSID, auth type, hidden flag (never auto-join) |
| `SMSTO:`, `tel:`, `mailto:` | Contact actions | Number/address preview + confirm |
| plain text / vCard | Text | Safe preview, no auto-action |

## 6. Risk Scoring (v0.1 Heuristic)

```
start: 0 (safe)
+40  final URL on blocklist / Safe Browsing match
+30  UPI pn ≠ VPA identity OR personal VPA claiming to be brand
+25  shortener + final domain age < 30d / lookalike brand
+20  punycode / homograph / IP literal / @ trick
+15  non-HTTPS login/payment page, suspicious TLD
+10  excessive redirects (>3), URL params with base64 blobs

0–19   🟢 Safe
20–49  🟡 Caution
50+    🔴 Malicious
```

Tune weights after collecting real-world test QRs (see Roadmap Phase 3).

## 7. Project Structure (Target)

```
quishing-guard/
├── README.md
├── index.html
├── public/
│   ├── manifest.webmanifest
│   ├── icons/icon-192.png
│   └── icons/icon-512.png
├── src/
│   ├── App.tsx
│   ├── pages/Scan.tsx, Result.tsx, History.tsx
│   ├── components/Scanner.tsx, VerdictCard.tsx, RedirectChain.tsx, UpiCard.tsx
│   ├── lib/decode.ts        # jsQR + BarcodeDetector wrapper
│   ├── lib/classify.ts      # payload type router
│   ├── lib/urlAnalysis.ts   # lookalike, homograph, heuristics
│   ├── lib/upi.ts           # UPI param parser + mismatch rules
│   ├── lib/shorteners.ts    # known shortener list
│   └── lib/score.ts         # risk scorer
├── server/api/expand.ts     # redirect tracer (Phase 2)
└── tests/fixtures/qr-*.png  # benign + malicious samples
```

## 8. Total Roadmap

### ✅ Phase 0 — Foundations (Week 1)
- [ ] Scaffold Vite + React + TS + Tailwind + `vite-plugin-pwa`
- [ ] Add `manifest.webmanifest`, icons, theme color, offline fallback page
- [ ] Camera page + upload page skeleton
- [ ] Deploy empty PWA to Vercel/Netlify, verify install prompt on Android + iOS
- [ ] **Exit criteria:** installable PWA, Lighthouse PWA ≥ 90

### ✅ Phase 1 — MVP: Decode + Classify (Week 2) — *Hackathon-ready*
- [ ] Integrate `BarcodeDetector` with `jsQR` fallback, upload + drag-drop
- [ ] Build `classify()` router: URL / UPI / WiFi / text
- [ ] Result screen showing raw payload + type badge (no backend yet)
- [ ] UPI parser UI: `pa`, `pn`, `am`, `tn` table
- [ ] Shortener list detection (client-side flag only: "shortened — destination hidden")
- [ ] Scan history in `localStorage`
- [ ] **Exit criteria:** scan → decode → type + raw data works fully offline

### ✅ Phase 2 — "Where Does It Really Lead?" (Week 3–4)
- [ ] `GET /api/expand` serverless endpoint: follow redirects (HEAD→GET, 10 hops, timeout 8s), return chain + final URL + headers
- [ ] Redirect-chain timeline UI (each hop with domain + status code)
- [ ] Lookalike engine: Levenshtein, confusables map, punycode, IP/`@`/subdomain checks, suspicious-TLD list
- [ ] Brand list JSON (`brands.json`: paytm, phonepe, gpay, amazon, banks…)
- [ ] UPI mismatch engine: `pn`-vs-`pa` rules, personal-VPA-as-merchant heuristic, amount-present warning
- [ ] Risk scorer + 🟢🟡🔴 verdict card with reasons
- [ ] **Exit criteria:** 20-fixture test set (10 benign / 10 malicious) scores correctly

### ✅ Phase 3 — Threat Intel + Hardening (Week 5–6)
- [ ] Google Safe Browsing + PhishTank integration (server-side, cached 24h in Redis)
- [ ] VirusTotal optional enrichment (rate-limit aware)
- [ ] "Expected merchant" input: user types shop name → fuzzy-match vs `pn`
- [ ] Screenshot / title preview via Microlink or self-hosted (with SSRF guards)
- [ ] Report-phishing button (stores hashed URL + reason, no PII)
- [ ] E2E tests (Playwright): camera-mock + fixture QRs; unit tests for `upi.ts`, `urlAnalysis.ts`
- [ ] Privacy audit: no image upload, CSP headers, minimal logging
- [ ] **Exit criteria:** <3s median verdict, zero false-negatives on fixture set

### ✅ Phase 4 — PWA Polish + Share (Week 7)
- [ ] Share Target API (receive images from gallery / other apps)
- [ ] `Web Share` verdict sharing (text + link)
- [ ] iOS fallbacks: file-input camera, `BarcodeDetector` polyfill notice
- [ ] Onboarding carousel: "Don't scan blind" + demo malicious QR
- [ ] Hindi + English strings (UPI users), dark mode
- [ ] **Exit criteria:** usable from phone home-screen icon, camera → verdict ≤ 2 taps

### 🔮 Phase 5 — Beyond (Post-launch)
- [ ] Community blocklist + crowdsourced merchant-VPA directory (opt-in)
- [ ] Browser extension / in-app "Open with Quishing Guard" intent
- [ ] Bulk QR audit for shop owners ("verify all my counter QRs")
- [ ] Admin dashboard: scam trends, top abused shorteners/brands
- [ ] On-device ML (TensorFlow.js) for phishing-page text signals
- [ ] Multi-lang (Tamil, Telugu, Bengali) + accessibility pass

## 9. Test Fixtures (Build These Early)

Generate with `qrcode` lib and keep in `tests/fixtures/`:

| # | Fixture | Expected |
|---|---|---|
| 1 | `https://www.google.com` | 🟢 Safe |
| 2 | `bit.ly` → legit site | 🟡 Caution (shortened, resolves safe) |
| 3 | `bit.ly` → lookalike bank | 🔴 Malicious |
| 4 | `paytm-secure-offer.top/login` | 🔴 Lookalike + susp TLD |
| 5 | `http://192.168.x.x/login` (IP literal) | 🔴 |
| 6 | `upi://pay?pa=swiggy@okhdfc&pn=Swiggy&am=299` | 🟢 (consistent) |
| 7 | `upi://pay?pa=xyz123@okhdfc&pn=Swiggy` | 🔴 (mismatch) |
| 8 | `upi://pay?pa=random@okupi&pn=ElectricityBoard&am=4999` | 🔴 |
| 9 | `WIFI:T:WPA;S:FreeWiFi;P:1234;;` | 🟡 (never auto-join) |
| 10 | Punycode `xn--` Apple lookalike | 🔴 |

## 10. Quickstart (Once Scaffolded)

```bash
npm create vite@latest quishing-guard -- --template react-ts
cd quishing-guard
npm i jsqr @zxing/browser tailwindcss
npm i -D vite-plugin-pwa
npm run dev
# phone test: npm run dev -- --host  # open LAN URL on mobile
```

## 11. API Contract (Phase 2+)

```
GET /api/expand?url=<encoded>
→ {
    "chain": [{"url": "...", "status": 301}, ...],
    "finalUrl": "https://...",
    "https": true,
    "ipLiteral": false,
    "punycode": false,
    "cached": false
  }

POST /api/check  { "url": "https://..." }
→ { "safeBrowsing": "clean|malicious", "score": 72, "reasons": [...] }
```

## 12. Security & Privacy Notes

- Never auto-open decoded URLs, auto-join WiFi, or auto-trigger `upi://` intents.
- Server-side fetcher must enforce: timeout, max hops, max body size, private-IP block (SSRF guard), no cookie jar.
- Store only URL hashes in reports; never store QR images server-side.
- CSP: `default-src 'self'`, camera permission requested only on scan page.

## 13. Contributing / Next Step

1. Complete Phase 0 scaffold.
2. Add fixtures from §9.
3. Implement `src/lib/upi.ts` + `urlAnalysis.ts` first — they carry the demo value.

---

*Built for everyone who has ever pointed their camera at a sticker QR and hoped for the best.*
