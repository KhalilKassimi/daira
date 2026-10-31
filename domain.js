/* ============================================================
   DAIRA — Domain layer (v1.0)
   Multi-tenant PLM & Operations core for Moroccan cooperatives.
   ------------------------------------------------------------
   This file is the "backend-in-a-box" for the static demo:
   every record carries a tenant_id and ALL queries are filtered
   through the tenant guard. In production this same domain logic
   runs behind the REST API (see docs/API-SPEC.md) with
   row-level security (tenant_id) enforced at the database layer.
   ============================================================ */
'use strict';

const Daira = (() => {

  /* ---------------- Storage (tenant-isolated document store) -------- */
  const DB_KEY = 'daira_db_v1';

  function blankDB() {
    return {
      version: 1,
      tenants: {},          // tenantId -> tenant
      users: {},            // userId -> user (tenant_id)
      members: {},          // memberId -> member (tenant_id)
      materials: {},
      rawBatches: {},
      recipes: {},
      products: {},
      runs: {},
      finishedLots: {},
      invLedger: {},        // append-only
      memberLedger: {},     // append-only (credits / payouts / dividends)
      certifications: {},
      sales: {},
      assemblies: {},
      votes: {},
      dividendCampaigns: {},
      counters: {},         // tenantId:entity -> int  (for human codes)
      session: { tenantId: null, userId: null },  // persisted
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) { const db = JSON.parse(raw); db.session = db.session || { tenantId: null, userId: null }; return db; }
    } catch (e) { /* corrupted -> reseed */ }
    return blankDB();
  }

  let DB = load();
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) {} }
  function resetDB() { DB = blankDB(); save(); }

  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------------- Tenant guard ------------------------------------
     Every read/write passes through `scoped()` which injects the
     active tenant_id and rejects cross-tenant access.               */
  function activeTenantId() { return DB.session.tenantId; }

  function scoped(collection) {
    const t = activeTenantId();
    if (!t) throw new Error('NO_TENANT: no active tenant session');
    return Object.values(DB[collection]).filter(r => r.tenant_id === t);
  }

  function get(collection, id) {
    const r = DB[collection][id];
    if (!r) return null;
    if (r.tenant_id !== activeTenantId()) throw new Error('TENANT_ISOLATION: cross-tenant read blocked');
    return r;
  }

  function put(collection, record) {
    const t = activeTenantId();
    if (!t) throw new Error('NO_TENANT');
    if (record.tenant_id && record.tenant_id !== t) throw new Error('TENANT_ISOLATION: cross-tenant write blocked');
    record.tenant_id = t;
    DB[collection][record.id] = record;
    save();
    return record;
  }

  function nextSeq(entity, pad) {
    const t = activeTenantId();
    const k = t + ':' + entity;
    DB.counters[k] = (DB.counters[k] || 0) + 1;
    save();
    return String(DB.counters[k]).padStart(pad || 4, '0');
  }

  /* ---------------- RBAC -------------------------------------------- */
  const ROLES = ['super_admin', 'manager', 'supervisor', 'member'];

  // action -> roles allowed (checked in the ACTIVE tenant context)
  const PERMISSIONS = {
    'tenant.provision':      ['super_admin'],
    'tenant.configure':      ['super_admin', 'manager'],
    'member.create':         ['super_admin', 'manager'],
    'member.read':           ['super_admin', 'manager', 'supervisor', 'member'],
    'intake.create':         ['super_admin', 'manager', 'supervisor'],
    'recipe.manage':         ['super_admin', 'manager'],
    'production.run':        ['super_admin', 'manager', 'supervisor'],
    'inventory.adjust':      ['super_admin', 'manager'],
    'sale.create':           ['super_admin', 'manager', 'supervisor'],
    'cert.manage':           ['super_admin', 'manager'],
    'assembly.manage':       ['super_admin', 'manager'],
    'vote.manage':           ['super_admin', 'manager'],
    'dividend.run':          ['super_admin', 'manager'],
    'passport.generate':     ['super_admin', 'manager', 'supervisor'],
    'data.export':           ['super_admin', 'manager'],
  };

  function currentUser() {
    if (!DB.session.userId) return null;
    return DB.users[DB.session.userId] || null;
  }

  function can(action) {
    const u = currentUser();
    if (!u) return false;
    // super_admin is platform-scoped: allowed everywhere
    if (u.role === 'super_admin') return true;
    const allowed = PERMISSIONS[action] || [];
    return allowed.includes(u.role);
  }

  function requirePerm(action) {
    if (!can(action)) throw new Error('FORBIDDEN: role "' + (currentUser()||{}).role + '" cannot ' + action);
  }

  /* ---------------- Tenant provisioning ------------------------------
     Onboarding pipeline: register -> provision isolated workspace ->
     seed roles, default settings, sequence counters.                  */
  function provisionTenant(input) {
    // input: { name, name_ar, region, sector, phone, adminName, adminPhone, primaryColor, locale }
    if (!input.name || !input.adminName) throw new Error('VALIDATION: name and adminName required');
    const tid = uid('tnt');
    const tenant = {
      id: tid,
      code: 'T' + String(Object.keys(DB.tenants).length + 1).padStart(3, '0'),
      name: input.name,
      name_ar: input.name_ar || input.name,
      region: input.region || '',
      sector: input.sector || '',
      phone: input.phone || '',
      status: 'active',
      plan: 'coop_free',
      branding: { primary: input.primaryColor || '#0e6b4a', logo_emoji: input.logoEmoji || '🌿' },
      settings: { locale: input.locale || 'fr', currency: 'MAD', timezone: 'UTC' },
      created_at: new Date().toISOString(),
    };
    DB.tenants[tid] = tenant;

    // bootstrap admin user inside the new tenant
    const adminId = uid('usr');
    DB.users[adminId] = {
      id: adminId, tenant_id: tid, name: input.adminName, phone: input.adminPhone || '',
      role: 'manager', is_owner: true, created_at: new Date().toISOString(),
    };
    save();
    return { tenant, adminUserId: adminId };
  }

  function listTenants() {
    // platform scope: only super_admin (enforced by caller/UI)
    return Object.values(DB.tenants);
  }

  /* ---------------- Phase 1: Intake & traceability --------------------
     Member Contribution Ledger + automatic lot/batch generation.      */
  const GRADE_TABLE = {
    // grade -> { priceFactor, qualityFactor }  (qualityFactor feeds dividends)
    'A': { priceFactor: 1.15, qualityFactor: 1.20, label: 'Excellent' },
    'B': { priceFactor: 1.00, qualityFactor: 1.00, label: 'Bon' },
    'C': { priceFactor: 0.85, qualityFactor: 0.80, label: 'Moyen' },
  };

  function ingestContribution(input) {
    // input: { memberId, materialId, qty, grade, moisture, acidity, note, receivedBy }
    requirePerm('intake.create');
    const member = get('members', input.memberId);
    const material = get('materials', input.materialId);
    if (!member || !material) throw new Error('VALIDATION: unknown member or material');
    const qty = Number(input.qty);
    if (!(qty > 0)) throw new Error('VALIDATION: qty must be > 0');
    const grade = GRADE_TABLE[input.grade] ? input.grade : 'B';

    const unitPrice = round2(material.base_price * GRADE_TABLE[grade].priceFactor);
    const totalCredit = round2(unitPrice * qty);
    const t = DB.tenants[activeTenantId()];
    const batchCode = t.code + '-MP-' + new Date().getFullYear() + '-' + nextSeq('rawBatch');

    const batch = {
      id: uid('rb'), batch_code: batchCode,
      member_id: member.id, member_name: member.name,
      material_id: material.id, material_name: material.name,
      qty, unit: material.unit, grade,
      quality: { moisture: input.moisture || null, acidity: input.acidity || null },
      unit_price: unitPrice, total_credit: totalCredit,
      received_at: new Date().toISOString(),
      received_by: input.receivedBy || (currentUser()||{}).name || '',
      note: input.note || '',
      status: 'available',   // available | consumed | partial
      qty_remaining: qty,
    };
    put('rawBatches', batch);

    // credit the member's cooperative account (append-only ledger)
    put('memberLedger', {
      id: uid('ml'), member_id: member.id, kind: 'CREDIT',
      amount: totalCredit, ref: batchCode, ref_id: batch.id,
      label: 'Apport ' + material.name + ' (' + qty + ' ' + material.unit + ', grade ' + grade + ')',
      created_at: new Date().toISOString(),
    });
    return batch;
  }

  /* ---------------- Phase 2: Transformation engine (BOM) ---------------
     runTransformation consumes raw batches (FIFO reservation),
     applies the recipe yield + loss %, and mints finished lots.      */
  function runTransformation(input) {
    // input: { recipeId, allocations: [{rawBatchId, qty}], note }
    requirePerm('production.run');
    const recipe = get('recipes', input.recipeId);
    if (!recipe) throw new Error('VALIDATION: unknown recipe');
    if (!input.allocations || !input.allocations.length) throw new Error('VALIDATION: no input batches');

    // 1) validate + reserve inputs (atomic: check everything first)
    let totalInputQty = 0;
    const reservations = input.allocations.map(a => {
      const b = get('rawBatches', a.rawBatchId);
      if (!b) throw new Error('VALIDATION: unknown batch ' + a.rawBatchId);
      if (b.status === 'consumed') throw new Error('STOCK: batch ' + b.batch_code + ' already consumed');
      const q = Number(a.qty);
      if (!(q > 0) || q > b.qty_remaining + 1e-9) throw new Error('STOCK: insufficient qty in ' + b.batch_code);
      totalInputQty += q;
      return { batch: b, qty: q };
    });

    // 2) compute outputs: recipe.output_per_input_unit * totalInput * (1 - loss)
    const lossPct = Number(recipe.loss_pct) || 0;
    const t = DB.tenants[activeTenantId()];
    const runCode = t.code + '-PR-' + new Date().getFullYear() + '-' + nextSeq('run');
    const producedAt = new Date().toISOString();

    const outputs = recipe.outputs.map(o => {
      const product = get('products', o.product_id);
      const grossQty = totalInputQty * o.per_input_unit;
      const netQty = round3(grossQty * (1 - lossPct / 100));
      const lotCode = t.code + '-LOT-' + new Date().getFullYear() + '-' + nextSeq('lot');
      const lot = {
        id: uid('lot'), lot_code: lotCode, product_id: product.id, product_name: product.name,
        run_id: null, qty_produced: netQty, qty_available: netQty, unit: product.unit,
        produced_at: producedAt, source_batches: reservations.map(r => r.batch.batch_code),
        source_members: [...new Set(reservations.map(r => r.batch.member_name))],
        status: 'in_stock',
      };
      return { lot, product, netQty };
    });

    // 3) commit: decrement raw batches, create run + lots + ledger entries
    reservations.forEach(r => {
      r.batch.qty_remaining = round3(r.batch.qty_remaining - r.qty);
      r.batch.status = r.batch.qty_remaining <= 1e-9 ? 'consumed' : 'partial';
      put('rawBatches', r.batch);
    });

    const run = {
      id: uid('run'), run_code: runCode, recipe_id: recipe.id, recipe_name: recipe.name,
      started_at: producedAt,
      inputs: reservations.map(r => ({ raw_batch_id: r.batch.id, batch_code: r.batch.batch_code, qty: r.qty })),
      total_input_qty: round3(totalInputQty),
      loss_pct: lossPct,
      outputs: outputs.map(o => ({ lot_id: o.lot.id, lot_code: o.lot.lot_code, product_id: o.product.id, qty: o.netQty })),
      checkpoints: recipe.checkpoints || [],
      note: input.note || '',
      created_by: (currentUser()||{}).name || '',
      status: 'completed',
    };
    put('runs', run);
    outputs.forEach(o => { o.lot.run_id = run.id; put('finishedLots', o.lot);
      put('invLedger', { id: uid('il'), lot_id: o.lot.id, change: o.netQty, reason: 'production',
        ref: runCode, ref_id: run.id, created_at: producedAt, actor: run.created_by });
    });
    return { run, lots: outputs.map(o => o.lot) };
  }

  /* ---------------- Phase 4: Inventory (concurrency-safe) --------------
     Pattern: validate-then-commit in one synchronous critical section,
     idempotency key per sale, append-only ledger as source of truth.  */
  function lotAvailable(lotId) {
    const lot = get('finishedLots', lotId);
    return lot ? lot.qty_available : 0;
  }

  function createSale(input) {
    // input: { items: [{lotId, qty}], channel, payment, idempotencyKey, note }
    requirePerm('sale.create');
    const key = input.idempotencyKey || uid('idem');
    const dup = scoped('sales').find(s => s.idempotency_key === key);
    if (dup) return { sale: dup, duplicate: true };   // safe retry

    // atomic check
    const lines = input.items.map(it => {
      const lot = get('finishedLots', it.lotId);
      if (!lot) throw new Error('VALIDATION: unknown lot');
      const q = Number(it.qty);
      if (!(q > 0)) throw new Error('VALIDATION: qty must be > 0');
      if (q > lot.qty_available + 1e-9) throw new Error('STOCK: only ' + lot.qty_available + ' ' + lot.unit + ' left of ' + lot.lot_code);
      const product = get('products', lot.product_id);
      return { lot, product, qty: q, unitPrice: product.sale_price, lineTotal: round2(q * product.sale_price) };
    });

    // commit
    const t = DB.tenants[activeTenantId()];
    const saleCode = t.code + '-V-' + new Date().getFullYear() + '-' + nextSeq('sale');
    const now = new Date().toISOString();
    lines.forEach(l => {
      l.lot.qty_available = round3(l.lot.qty_available - l.qty);
      if (l.lot.qty_available <= 1e-9) l.lot.status = 'sold_out';
      put('finishedLots', l.lot);
      put('invLedger', { id: uid('il'), lot_id: l.lot.id, change: -l.qty, reason: 'sale',
        ref: saleCode, ref_id: null, created_at: now, actor: (currentUser()||{}).name || '' });
    });
    const sale = {
      id: uid('sale'), sale_code: saleCode, idempotency_key: key,
      channel: input.channel || 'POS', payment: input.payment || 'CASH',
      items: lines.map(l => ({ lot_id: l.lot.id, lot_code: l.lot.lot_code, product_name: l.product.name, qty: l.qty, unit_price: l.unitPrice, line_total: l.lineTotal })),
      total: round2(lines.reduce((s, l) => s + l.lineTotal, 0)),
      status: input.payment === 'COD' ? 'pending_delivery' : 'paid',
      synced: navigator.onLine !== false,
      note: input.note || '',
      created_at: now, created_by: (currentUser()||{}).name || '',
    };
    put('sales', sale);
    // link ledger refs
    scoped('invLedger').filter(e => e.ref === saleCode).forEach(e => { e.ref_id = sale.id; });
    save();
    return { sale, duplicate: false };
  }

  function adjustInventory(lotId, change, reason) {
    requirePerm('inventory.adjust');
    const lot = get('finishedLots', lotId);
    const q = Number(change);
    if (lot.qty_available + q < -1e-9) throw new Error('STOCK: adjustment would go negative');
    lot.qty_available = round3(lot.qty_available + q);
    put('finishedLots', lot);
    put('invLedger', { id: uid('il'), lot_id: lotId, change: q, reason: reason || 'adjustment',
      ref: 'ADJ', ref_id: null, created_at: new Date().toISOString(), actor: (currentUser()||{}).name || '' });
    return lot;
  }

  /* ---------------- Phase 5: Patronage dividend engine -----------------
     Surplus allocated pro-rata on (qty × qualityFactor × priceFactor)
     summed over the member's raw contributions in the season.         */
  function allocateDividends(input) {
    // input: { season, surplus, note }
    requirePerm('dividend.run');
    const surplus = Number(input.surplus);
    if (!(surplus > 0)) throw new Error('VALIDATION: surplus must be > 0');
    const season = input.season || String(new Date().getFullYear());
    const existing = scoped('dividendCampaigns').find(c => c.season === season && c.status !== 'cancelled');
    if (existing) throw new Error('DIVIDEND: campaign for ' + season + ' already exists (' + existing.status + ')');

    const yearStart = season + '-01-01', yearEnd = season + '-12-31';
    const batches = scoped('rawBatches').filter(b => b.received_at >= yearStart && b.received_at <= yearEnd + 'T23:59');

    const points = {};   // memberId -> points
    batches.forEach(b => {
      const g = GRADE_TABLE[b.grade] || GRADE_TABLE.B;
      const p = b.qty * g.qualityFactor * g.priceFactor;
      points[b.member_id] = (points[b.member_id] || 0) + p;
    });
    const totalPoints = Object.values(points).reduce((s, p) => s + p, 0);
    if (!(totalPoints > 0)) throw new Error('DIVIDEND: no contributions in season ' + season);

    const allocations = Object.entries(points).map(([memberId, p]) => {
      const m = DB.members[memberId];
      return { member_id: memberId, member_name: m ? m.name : '?', points: round3(p),
               share_pct: round2(p / totalPoints * 100), amount: round2(surplus * p / totalPoints) };
    }).sort((a, b) => b.amount - a.amount);

    const campaign = {
      id: uid('div'), season, surplus: round2(surplus),
      total_points: round3(totalPoints),
      allocations, status: 'calculated',
      note: input.note || '',
      created_at: new Date().toISOString(), created_by: (currentUser()||{}).name || '',
    };
    put('dividendCampaigns', campaign);
    return campaign;
  }

  function confirmDividends(campaignId) {
    requirePerm('dividend.run');
    const c = get('dividendCampaigns', campaignId);
    if (!c || c.status !== 'calculated') throw new Error('DIVIDEND: campaign not in calculable state');
    c.status = 'confirmed';
    c.confirmed_at = new Date().toISOString();
    put('dividendCampaigns', c);
    c.allocations.forEach(a => put('memberLedger', {
      id: uid('ml'), member_id: a.member_id, kind: 'DIVIDEND', amount: a.amount,
      ref: 'DIV-' + c.season, ref_id: c.id,
      label: 'Excédent / فائض ' + c.season + ' (' + a.share_pct + '%)',
      created_at: new Date().toISOString(),
    }));
    return c;
  }

  /* ---------------- Passport (QR digital product passport) ------------- */
  function buildPassport(lotId) {
    const lot = get('finishedLots', lotId);
    if (!lot) throw new Error('VALIDATION: unknown lot');
    const t = DB.tenants[activeTenantId()];
    const product = get('products', lot.product_id);
    const run = lot.run_id ? get('runs', lot.run_id) : null;

    // fair-price breakdown: member credits behind this lot
    let memberCost = 0;
    const memberShares = {};
    (run ? run.inputs : []).forEach(inp => {
      const b = DB.rawBatches[inp.raw_batch_id];
      if (!b || b.tenant_id !== t.id) return;
      const share = inp.qty / (run.total_input_qty || 1);
      const cost = b.total_credit * share;
      memberCost += cost;
      memberShares[b.member_name] = round2((memberShares[b.member_name] || 0) + cost);
    });
    const saleValue = round2(lot.qty_produced * (product ? product.sale_price : 0));
    return {
      tenant: { code: t.code, name: t.name, name_ar: t.name_ar, region: t.region },
      lot: { code: lot.lot_code, product: product ? product.name : lot.product_name,
             product_ar: product ? product.name_ar : '', qty: lot.qty_produced, unit: lot.unit,
             produced_at: lot.produced_at },
      members: lot.source_members || [],
      member_fair_value: round2(memberCost),
      member_shares: memberShares,
      estimated_sale_value: saleValue,
      fair_share_pct: saleValue > 0 ? round2(memberCost / saleValue * 100) : 0,
      certifications: scoped('certifications').filter(c => c.status === 'valid')
        .map(c => ({ type: c.type, ref: c.ref_number, expires_at: c.expires_at })),
      verify_url: location.origin + location.pathname + '#/p/' + t.code + '/' + lot.lot_code,
    };
  }

  /* ---------------- Governance helpers -------------------------------- */
  function recordVote(voteId, choice) {
    requirePerm('vote.manage');
    const v = get('votes', voteId);
    if (!v || v.status !== 'open') throw new Error('VOTE: session not open');
    v.results[choice] = (v.results[choice] || 0) + 1;
    put('votes', v);
    return v;
  }

  /* ---------------- utils ---------------------------------------------- */
  const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const round3 = n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

  function exportTenant() {
    const t = activeTenantId();
    const out = { tenant: DB.tenants[t] };
    ['users','members','materials','rawBatches','recipes','products','runs','finishedLots',
     'invLedger','memberLedger','certifications','sales','assemblies','votes','dividendCampaigns']
      .forEach(c => { out[c] = Object.values(DB[c]).filter(r => r.tenant_id === t); });
    return out;
  }

  // public API
  return {
    DB: () => DB, save, resetDB, load,
    scoped, get, put, nextSeq,
    activeTenantId, currentUser, can, requirePerm, ROLES, PERMISSIONS,
    provisionTenant, listTenants,
    ingestContribution, GRADE_TABLE,
    runTransformation,
    lotAvailable, createSale, adjustInventory,
    allocateDividends, confirmDividends,
    buildPassport,
    recordVote,
    exportTenant,
    round2, round3,
    setSession(tenantId, userId) { DB.session = { tenantId, userId }; save(); },
  };
})();

// UMD-ish export for node tests
if (typeof module !== 'undefined') module.exports = Daira;
