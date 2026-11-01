# DAIRA — Architecture (v1.0)

## Vision
A Windchill-style PLM adapted to Moroccan cooperatives (Law 112-12): each cooperative gets an
isolated tenant workspace covering the full "cercle de vie" — from member raw-material intake,
through BOM transformation, certification, QR product passports, hybrid inventory & offline POS,
to statutory governance and patronage dividends.

## Deployment tiers
| Tier | Target | Status |
|---|---|---|
| **v1 — Static demo** | GitHub Pages (free) | ✅ This build. `domain.js` implements the full domain logic; `localStorage` (namespaced per tenant) acts as the database; `qrcode` vendored for offline QR. **Onboarding is moderated**: cooperatives submit an access request (form → WhatsApp to the platform owner with their details); the owner approves from the platform console, which provisions the isolated tenant. No self-service tenant creation → the tenant base stays clean of fake cooperatives. |
| **v2 — SaaS backend** | API + Postgres (RLS on `tenant_id`) + object storage | Spec in `API-SPEC.md`. Domain functions map 1:1 to endpoints. |
| **v3 — Mobile offline** | Capacitor/Capacitive wrapper or PWA with background sync | POS already designed offline-first (idempotency keys + `synced` flag). |

## Module map (code)
- `domain.js` — tenant guard (`scoped/get/put`), RBAC (`can/requirePerm`), `provisionTenant`,
  `ingestContribution`, `runTransformation`, `createSale`/`adjustInventory`, `allocateDividends`/`confirmDividends`,
  `buildPassport`, `recordVote`, `exportTenant`.
- `seed.js` — demo tenant "Coopérative Tafoukt" (argan), 12 members, recipe, batches, run, sale, certs, AG+vote.
- `i18n.js` — `fr` / `ar` / `darija` (Arabic script) / `zgh` (Tifinagh ⵜⴰⵎⴰⵣⵉⵖⵜ, starter glossary ~24 keys, French fallback for the rest), RTL via `document.dir`.
- `app.js` — hash router + views: landing (branding « Daïra | الدائرة التعاونية », trust badges ODCO/ONSSA/Bio/Fairtrade, CTAs demo/admin/request, in-hero language switcher), login (prefilled admin, 1-click demo fill, demo hint), validated onboarding wizard (ODCO/ICE, sector dropdown, Moroccan phone + email validation, step progress), dashboard,
  intake (printable reception ticket + WhatsApp receipt), production, stock (POS/inventory/sales), certifications, QR passport (+ printable A4 poster + public `#/p/:code/:lot`),
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
