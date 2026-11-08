# DAIRA — Architecture (v1.0)

## Vision
A Windchill-style PLM adapted to Moroccan cooperatives (Law 112-12): each cooperative gets an
isolated tenant workspace covering the full "cercle de vie" — from member raw-material intake,
through BOM transformation, certification, QR product passports, hybrid inventory & offline POS,
to statutory governance and patronage dividends.

## Deployment tiers
| Tier | Target | Status |
|---|---|---|
| **v1 — Static demo** | GitHub Pages (free) | ✅ This build. `domain.js` implements the full domain logic; `localStorage` (namespaced per tenant) acts as the database; `qrcode` vendored for offline QR. **Onboarding is moderated**: cooperatives submit an access request (form → WhatsApp to the platform owner with their details); the owner approves from the platform console, which provisions the isolated tenant. **Cross-device**: localStorage is per-device, so the finish screen shows a portable request code (`DREQ1.…`, also sent in the WhatsApp message) — paste it into the console's « Importer une demande » card to approve a request submitted on another browser/device. No self-service tenant creation → the tenant base stays clean of fake cooperatives. |
| **v2 — SaaS backend** | API + Postgres (RLS on `tenant_id`) + object storage | Spec in `API-SPEC.md`. Domain functions map 1:1 to endpoints. |
| **v3 — Mobile offline** | Capacitor/Capacitive wrapper or PWA with background sync | POS already designed offline-first (idempotency keys + `synced` flag). |

## Module map (code)
- `domain.js` — tenant guard (`scoped/get/put`), RBAC (`can/requirePerm`), `provisionTenant`,
  `ingestContribution`, `runTransformation`, `createSale`/`adjustInventory`, `allocateDividends`/`confirmDividends`,
  `buildPassport`, `recordVote`, `exportTenant`. `provisionTenant` captures Loi 112-12 fields:
  `category` (صنف 1/2/3), `purpose` (الغرض الرئيسي), `province` (الإقليم), `share_value` (MAD),
  `capital_liberated`, `denom_cert_date` (60-day validity), `legal_docs` checklist; members carry `fonction`.
- `seed.js` — demo tenant "Coopérative Tafoukt" (argan), 12 members, recipe, batches, run, sale, certs, AG+vote.
- `i18n.js` — `fr` / `ar` / `darija` (Arabic script), RTL via `document.dir`. (Tifinagh was prototyped in v2 then removed per user request — « blach mn tifinagh ».)
- `app.js` — hash router + views: landing (branding « Daïra | الدائرة التعاونية », trust badges ODCO/ONSSA/Bio/Fairtrade, CTAs demo/admin/request, in-hero language switcher), login (prefilled admin, 1-click demo fill, demo hint), validated onboarding wizard (ODCO/ICE, sector dropdown, Moroccan phone + email validation, step progress), dashboard,
  intake (printable reception ticket + WhatsApp receipt), **catalog** (materials/products/recipes management — required before first intake/production on a new tenant), production, stock (POS/inventory/sales), certifications, QR passport (+ printable A4 poster + public `#/p/:code/:lot`),
  governance (full member registry: firstname/CIN/phone/gender/shares/status badges, assemblies with printable PV, votes, **ODCO compliance dashboard** with annual report export), dividends (individual printable slips + WhatsApp notices), docs, settings, platform console (pending requests approval, credential issuance, **data toolbox**: dated JSON backup / import / demo reset).
- `qrcode.min.js` — vendored QR generator (no CDN dependency → works offline).

## Key design decisions
1. **Tenant isolation as a code-level invariant**: every domain function runs inside `scoped()`;
   cross-tenant reads/writes throw `TENANT_ISOLATION`. Production upgrades this to Postgres RLS —
   the invariant stays identical.
2. **Append-only ledgers** (`inv_ledger`, `member_ledger`) are the source of truth; mutable counters
   (`qty_available`) are caches validated before every commit.
3. **Idempotent sales**: `idempotency_key` makes retried POS submissions safe on flaky networks.
4. **Dividend fairness**: `points = Σ qty × qualityFactor × priceFactor` per grade — rewards both
   volume and quality, computed transparently and shown before confirmation.
5. **Public passport without login**: `#/p/:tenantCode/:lotCode` renders read-only from the local DB
   (demo) / signed API payload (production), so any consumer can verify provenance by scanning.
6. **Ultra-simplified mobile UX**: icon-heavy cards, big touch targets, 3 languages with RTL first,
   zero technical jargon in field screens.

## Honest limitations of the static tier (v1)
- Data lives in the browser (`localStorage`) — per-device, no real multi-user sync.
- Public QR verification resolves only on a device that holds the tenant data; production needs the
  signed `GET /passport/:lotCode` endpoint.
- Auth is demo-grade: per-user PIN hashed with cyrb53 in `localStorage` (no server, no bcrypt).
  Credentials are issued by the platform owner at approval (username = tenant code, e.g. `T002`).
  Default admin login: `admin` / `daira2026` — change it in Settings after first login.
  Production uses bcrypt + JWT per the API spec.
- File uploads (certificates) store metadata only in v1.

## v3 — ERP & Governance Suite (2026-11-08, full spec)
- **Finance (#/finance)**: journals caisse/banque/OD with running balance; budget prévisionnel with planned vs actual variance; loans & grants tracking; equipment register with straight-line depreciation and net value; CAF = net surplus + depreciation.
- **Surplus wizard (Art. 69)**: `allocateSurplus69` — net surplus from sales + journal income − expenses; 10% legal reserve (capped at capital − already built), 2% development levy, discretionary special/training/reinvestment %, remainder → ristournes prorated by member activity (reuses `allocateDividends`).
- **Actes officiels (#/actes)**: denomination request (3 names AR+Latin, founders, receipt stub), model statutes (29 articles, general/housing/harmonization), subscribers list (Art. 11), share certificates (Art. 21), greffe forms (immatriculation/modification/radiation, Arrêté 1369.16), AGM dossier (convocation, attendance Art. 45, proxy Art. 39, PV), members register (Art. 17 & 97).
- **Operations**: purchase orders (#/intake/orders, auto-expense on receipt), packaging inventory (#/catalog/packaging, low-stock alerts), multi-channel sales (POS channel select: local/foire/magasin/social/e-commerce/B2B + per-channel totals).
- **Typography**: Amiri + Cairo + Tajawal fonts; @page A4 print CSS; print windows now offer Imprimer + 📥 Télécharger PDF via vendored `html2pdf.bundle.min.js` (0.10.1).
- **Validations**: CIN `^[A-Z]{1,2}[0-9]{5,6}$`, ICE 15 digits (when numeric), MA phone `^(05|06|07)[0-9]{8}$`.
- **Docs (#/docs)**: replaced dev schema docs with the cooperative leader's guide (constitution, daily ops, year-end, legal/fiscal calendar) + template links.
