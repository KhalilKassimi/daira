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
- `i18n.js` — `fr` / `ar` / `darija` (Arabic script), RTL via `document.dir`.
- `app.js` — hash router + views: landing, login, onboarding wizard, platform console, dashboard,
  intake, production, stock (POS/inventory/sales), certifications, QR passport (+ public `#/p/:code/:lot`),
  governance (members/assemblies/votes), dividends, docs, settings.
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
- No real authentication (demo role picker); production uses JWT + PIN per the API spec.
- File uploads (certificates) store metadata only in v1.
