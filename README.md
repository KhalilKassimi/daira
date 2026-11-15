# Daira — دائرة | Le cercle de vie des coopératives

Multi-tenant PLM & Operations SaaS platform tailored for Moroccan cooperatives (Law 112-12).
A Windchill-style product lifecycle system adapted to cooperatives: each cooperative gets an
isolated workspace to manage raw-material intake from members, BOM transformation, certifications,
QR product passports, hybrid inventory & offline POS, governance, and patronage dividends.

**Live demo:** https://khalilkassimi.github.io/daira/

## Features (v1 — static demo)
- 🏢 Tenant onboarding wizard (isolated workspace per cooperative, custom branding)
- 🧺 Field intake: member → material → weight → grade → traceability batch + member credit
- 🏭 Transformation engine: recipes, yield − loss %, production runs, finished lots
- 🔳 QR Digital Product Passport (public verification page, printable)
- 💰 Offline-first POS + inventory + sales ledger
- 📜 Certification vault (ONSSA, AOP/IGP, Bio, Fair-Trade) with expiry alerts
- 🏛️ Governance: member registry, assemblies/PVs, voting sessions
- 🤝 Patronage dividend engine (pro-rata on volume × quality)
- 🌍 FR / العربية / الدارجة with full RTL support, mobile-first
- 📱 **iPhone app (PWA)** — install to Home Screen, runs full-screen offline

## Install on iPhone
1. Open the live demo in **Safari**: https://khalilkassimi.github.io/daira/
2. Tap **Share** → **Add to Home Screen** → **Add**
3. Launch **Daira** from the home screen — it opens like a native app (no Safari chrome), with offline cache via service worker

> Tip: “Add to Home Screen” only appears in Safari (not Chrome/Firefox on iOS).

## Docs
- `DATA-MODEL.md` — multi-tenant ER data model
- `API-SPEC.md` — REST API routes & middleware for the production backend
- `ARCHITECTURE.md` — architecture, deployment tiers, honest limitations

## Run locally
No build step — serve the folder over HTTP (required for the service worker):
```bash
python3 -m http.server 8080
```
Then open http://localhost:8080 (or your machine’s LAN IP from an iPhone on the same Wi‑Fi).
