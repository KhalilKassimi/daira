/* ============================================================
   DAIRA — Demo seed (runs once, idempotent via flag)
   Cooperative "Tafoukt" — argan oil, Tamanar / Souss-Massa.
   ============================================================ */
'use strict';

function dairaSeed() {
  const DB = Daira.DB();
  // migration: backfill credentials for DBs seeded before auth existed
  // migration 2 (Loi 112-12): compliance fields + member fonction
  try {
    const sa = DB.users['usr_superadmin'];
    if (sa && !sa.username) { sa.username = 'admin'; sa.pin_hash = Daira.hashPin('daira2026'); }
    Object.values(DB.tenants).forEach(tn => {
      const owner = Object.values(DB.users).find(u => u.tenant_id === tn.id && u.is_owner);
      if (owner && !owner.username) { owner.username = tn.code; owner.pin_hash = Daira.hashPin('123456'); }
      if (tn.category === undefined) tn.category = '';
      if (tn.purpose === undefined) tn.purpose = '';
      if (tn.province === undefined) tn.province = '';
      if (tn.share_value === undefined) tn.share_value = 100;
      if (tn.capital_liberated === undefined) tn.capital_liberated = 0;
      if (tn.denom_cert_date === undefined) tn.denom_cert_date = '';
      if (tn.legal_docs === undefined) tn.legal_docs = {};
    });
    Object.values(DB.members).forEach(m => { if (m.fonction === undefined) m.fonction = ''; });
    // migration 3 (Pillar 1): new collections for DBs seeded before finance/ops existed
    ['purchaseOrders','packaging','financeOps','equipment','loans','grants','budgets','proxies']
      .forEach(c => { if (DB[c] === undefined) DB[c] = {}; });
    Object.values(DB.members).forEach(m => { if (m.shares_paid === undefined) m.shares_paid = m.shares || 0; });
    Daira.save();
  } catch (e) {}
  if (DB.tenants && Object.keys(DB.tenants).length) return; // already seeded

  // platform super-admin (platform scope, sees all tenants)
  const saId = 'usr_superadmin';
  DB.users[saId] = { id: saId, tenant_id: '*', name: 'Daira Platform', phone: '', role: 'super_admin',
    is_owner: false, username: 'admin', pin_hash: Daira.hashPin('daira2026'),
    created_at: new Date().toISOString() };

  // --- provision demo tenant -----------------------------------------
  const { tenant, adminUserId } = Daira.provisionTenant({
    name: 'Coopérative Tafoukt',
    name_ar: 'تعاونية تفوكت',
    region: 'Souss-Massa · Tamanar',
    sector: 'Huile d’argan / زيت أركان',
    phone: '0528-000000',
    adminName: 'Fatima Zahra',
    adminPhone: '0611-000000',
    primaryColor: '#0e6b4a',
    logoEmoji: '🌿',
    locale: 'fr',
    category: '2',
    purpose: 'Production et commercialisation d’huile d’argan et de miel',
    province: 'Essaouira',
    share_value: 100,
    capital_liberated: 12000,
    denom_cert_date: '2023-02-10',
  });
  Daira.setSession(tenant.id, adminUserId);
  Daira.setCredentials(adminUserId, tenant.code, '123456');  // demo login: T001 / 123456
  const T = tenant.id;

  const put = (col, r) => { r.tenant_id = T; DB[col][r.id] = r; };
  const uid = (p) => p + '_seed_' + Math.random().toString(36).slice(2, 8);

  // --- members ---------------------------------------------------------
  const memberNames = [
    ['Aïcha Amzil', 'عائشة أمزيل', 'Tamanar'], ['Khadija Boussaid', 'خديجة بوسعيد', 'Tamanar'],
    ['Zahra El Fassi', 'زهرة الفاسي', 'Imi Ouaddar'], ['Mina Ouahbi', 'مينة وهبي', 'Tamanar'],
    ['Salma Idrissi', 'سلمى الإدريسي', 'Aït Milk'], ['Nadia Chraibi', 'نادية الشرايبي', 'Tamanar'],
    ['Rkia Aït Brahim', 'رقية آيت ابراهيم', 'Imi Ouaddar'], ['Hafida Mansouri', 'حفيظة المنصوري', 'Aït Milk'],
    ['Touria Belkacem', 'تورية بلقاسم', 'Tamanar'], ['Saïda Amrani', 'سعيدة العمراني', 'Imi Ouaddar'],
    ['Loubna Tazi', 'لبنى التازي', 'Aït Milk'], ['Meriem Bennani', 'مريم البناني', 'Tamanar'],
  ];
  const FONCTIONS = ['president', 'treasurer', 'secretary'];
  const memberIds = memberNames.map(([name, name_ar, village], i) => {
    const id = uid('mbr');
    put('members', { id, code: 'MBR-' + String(i + 1).padStart(3, '0'), name, name_ar, village,
      plot_ref: 'Parcelle ' + village + '-' + (i + 1), status: 'active',
      gender: 'f',
      cin: 'CD' + (100000 + i * 137), phone: '06' + String(10000000 + i * 7919).slice(0, 8),
      fonction: FONCTIONS[i] || 'member',
      shares: 10, joined_at: '2023-03-15T00:00:00Z' });
    return id;
  });

  // --- materials -------------------------------------------------------
  const matArgan = uid('mat');
  put('materials', { id: matArgan, name: 'Fruit d’argan brut', name_ar: 'ثمار أركان خام',
    unit: 'kg', base_price: 22, grades: ['A', 'B', 'C'] });
  const matHoney = uid('mat');
  put('materials', { id: matHoney, name: 'Miel brut', name_ar: 'عسل خام',
    unit: 'kg', base_price: 180, grades: ['A', 'B'] });

  // --- products + packaging BOM ----------------------------------------
  const prodOil50 = uid('prd');
  put('products', { id: prodOil50, name: 'Huile d’argan cosmétique 50ml', name_ar: 'زيت أركان تجميلي 50 مل',
    sku: 'ARG-50', unit: 'flacon', sale_price: 95,
    components: [ { item: 'Flacon verre 50ml', qty: 1 }, { item: 'Bouchon + capsule', qty: 1 },
                  { item: 'Étiquette FR/AR', qty: 1 }, { item: 'Scellé sanitaire', qty: 1 } ] });
  const prodOil100 = uid('prd');
  put('products', { id: prodOil100, name: 'Huile d’argan alimentaire 100ml', name_ar: 'زيت أركان غذائي 100 مل',
    sku: 'ARG-100', unit: 'flacon', sale_price: 140,
    components: [ { item: 'Flacon verre 100ml', qty: 1 }, { item: 'Bouchon + capsule', qty: 1 },
                  { item: 'Étiquette FR/AR', qty: 1 }, { item: 'Scellé sanitaire', qty: 1 } ] });

  // --- recipe: 100 kg fruit -> 1.1 L cosmetic oil -> ~22 bottles 50ml, 8% loss
  const recipeId = uid('rcp');
  put('recipes', { id: recipeId, name: 'Fruit → Huile cosmétique 50ml', name_ar: 'ثمار ← زيت تجميلي',
    inputs: [{ material_id: matArgan, qty_per_unit: 1 }],
    outputs: [{ product_id: prodOil50, per_input_unit: 0.22 }],
    loss_pct: 8, labor_cost: 350,
    checkpoints: ['Tri & lavage', 'Concassage', 'Torréfaction douce', 'Pression à froid', 'Filtration', 'Mise en flacon'] });

  // --- intake: contributions from members (this season) ------------------
  const year = new Date().getFullYear();
  const intakeData = [
    [0, 120, 'A'], [1, 95, 'B'], [2, 140, 'A'], [3, 80, 'B'], [4, 110, 'A'], [5, 70, 'C'],
    [6, 130, 'B'], [7, 90, 'A'], [8, 105, 'B'], [9, 85, 'B'], [10, 115, 'A'], [11, 75, 'C'],
  ];
  const batchIds = intakeData.map(([mi, qty, grade], i) => {
    const m = DB.members[memberIds[mi]];
    const g = Daira.GRADE_TABLE[grade];
    const unitPrice = Daira.round2(22 * g.priceFactor);
    const id = uid('rb');
    const code = tenant.code + '-MP-' + year + '-' + String(i + 1).padStart(4, '0');
    put('rawBatches', { id, batch_code: code, member_id: m.id, member_name: m.name,
      material_id: matArgan, material_name: 'Fruit d’argan brut', qty, unit: 'kg', grade,
      quality: { moisture: (8 + (i % 4)).toFixed(1) + '%', acidity: (0.4 + (i % 3) * 0.1).toFixed(1) + '%' },
      unit_price: unitPrice, total_credit: Daira.round2(unitPrice * qty),
      received_at: year + '-09-' + String(3 + (i % 20)).padStart(2, '0') + 'T09:00:00Z',
      received_by: 'Fatima Zahra', note: '', status: 'available', qty_remaining: qty });
    put('memberLedger', { id: uid('ml'), member_id: m.id, kind: 'CREDIT', amount: Daira.round2(unitPrice * qty),
      ref: code, ref_id: id, label: 'Apport fruit d’argan (' + qty + ' kg, grade ' + grade + ')',
      created_at: year + '-09-10T09:00:00Z' });
    return id;
  });

  // --- production run ----------------------------------------------------
  const { run, lots } = Daira.runTransformation({
    recipeId,
    allocations: batchIds.slice(0, 6).map(id => ({ rawBatchId: id, qty: 60 })),
    note: 'Campagne ' + year + ' — lot pilote',
  });

  // --- a cash sale at the souk (offline POS demo) --------------------------
  Daira.createSale({ items: [{ lotId: lots[0].id, qty: 10 }], channel: 'FAIR',
    payment: 'CASH', idempotencyKey: 'seed-sale-1', note: 'Souk hebdomadaire Tamanar' });

  // --- certifications ------------------------------------------------------
  const certs = [
    ['ONSSA', 'ONSSA-2024-8841', 'Autorisation sanitaire ONSSA', '2027-06-30'],
    ['BIO', 'ECOCERT-MA-2291', 'Certification Agriculture Biologique', '2026-12-31'],
    ['FAIR', 'WFTO-2025-117', 'Commerce équitable (membre WFTO)', '2027-03-31'],
  ];
  certs.forEach(([type, ref, label, exp], i) => put('certifications', {
    id: uid('crt'), type, ref_number: ref, label, issued_at: (year - 1) + '-01-15T00:00:00Z',
    expires_at: exp + 'T00:00:00Z', status: 'valid', file_ref: '' }));

  // --- governance: assembly + vote ------------------------------------------
  const asmId = uid('asm');
  put('assemblies', { id: asmId, type: 'AG', title: 'Assemblée Générale Ordinaire ' + year,
    title_ar: 'الجمع العام العادي', held_at: year + '-10-05T10:00:00Z',
    attendees: memberNames.slice(0, 9).map(m => m[0]),
    decisions: ['Approbation du rapport d’activité', 'Affectation de l’excédent ' + (year - 1),
                'Renouvellement du bureau (2 sièges)'],
    pv_ref: 'PV-AG-' + year + '-01', status: 'signed' });
  put('votes', { id: uid('vot'), assembly_id: asmId, question: 'Affecter 60% de l’excédent aux ristournes membres ?',
    question_ar: 'تخصيص 60٪ من الفائض لمنح الأعضاء؟',
    results: { yes: 8, no: 1, abstain: 0 }, status: 'closed', closed_at: year + '-10-05T12:00:00Z' });

  // --- finance & operations (Pillar 1) --------------------------------------
  // packaging stock
  [['Flacon verre 50ml', 'pièce', 320, 50, 1.8], ['Flacon verre 100ml', 'pièce', 180, 50, 2.4],
   ['Bouchon + capsule', 'pièce', 500, 100, 0.6], ['Étiquette FR/AR', 'pièce', 900, 200, 0.35],
   ['Carton d’expédition', 'pièce', 120, 30, 4.5], ['Pot miel 500g', 'pièce', 90, 30, 3.2]
  ].forEach(([name, unit, stock, min_stock, unit_cost]) =>
    put('packaging', { id: uid('pkg'), name, unit, stock, min_stock, unit_cost }));
  // purchase orders
  put('purchaseOrders', { id: uid('po'), po_code: 'BC-2026-001', vendor_name: 'Fournisseur Emballages Atlas',
    vendor_type: 'supplier', material_id: '', qty: 500, unit: 'pièce', unit_price: 1.8,
    total: 900, status: 'received', date: year + '-02-10T00:00:00Z', note: 'Flacons verre 50ml' });
  put('purchaseOrders', { id: uid('po'), po_code: 'BC-2026-002', vendor_name: 'Aïcha Amzil',
    vendor_type: 'member', member_id: memberIds[0], material_id: matArgan, qty: 120, unit: 'kg',
    unit_price: 22, total: 2640, status: 'received', date: year + '-03-05T00:00:00Z', note: 'Fruit d’argan brut' });
  // finance journal (caisse / banque / OD)
  [['cash','in','Vente marché Tamanar', 2450, year + '-06-14'], ['cash','out','Transport souk', 180, year + '-06-14'],
   ['cash','in','Vente foire Agadir', 6800, year + '-05-20'], ['bank','in','Virement client Marjane', 12500, year + '-05-25'],
   ['bank','out','Achat emballages (BC-2026-001)', 900, year + '-02-10'], ['bank','out','Électricité atelier', 640, year + '-06-01'],
   ['od','in','Subvention INDH reçue', 30000, year + '-03-15'], ['od','out','Dotation amortissement presse', 2400, year + '-12-31'],
   ['cash','out','تعويضات التسيير — bureau', 1200, year + '-06-30'], ['bank','out','Remboursement crédit (échéance)', 1850, year + '-06-15']
  ].forEach(([kind, type, label, amount, date], i) =>
    put('financeOps', { id: uid('fin'), kind, type, category: type === 'in' ? 'recette' : 'dépense',
      label, amount, date: date + 'T00:00:00Z', ref: 'JNL-' + year + '-' + String(i + 1).padStart(3, '0') }));
  // equipment & depreciation
  [['Presse à huile manuelle', year - 2 + '-01-20', 24000, 10], ['Concasseur argan', year - 2 + '-01-20', 15000, 10],
   ['Réfrigérateur stockage', year - 1 + '-06-10', 8000, 20], ['Balance électronique', year + '-01-05', 1200, 20]
  ].forEach(([name, acquired_at, value, dep_rate]) =>
    put('equipment', { id: uid('eqp'), name, acquired_at: acquired_at + 'T00:00:00Z', value, dep_rate, status: 'actif' }));
  // loans & grants
  put('loans', { id: uid('loa'), lender: 'Crédit Agricole du Maroc — Tamwil El Fellah',
    amount: 60000, rate: 5.5, start_date: year - 1 + '-03-01', duration_months: 36,
    monthly_payment: 1850, remaining: 42000, status: 'en cours' });
  put('grants', { id: uid('grn'), program: 'INDH — Appui aux coopératives féminines',
    source: 'INDH', amount_requested: 50000, amount_received: 30000, status: 'received',
    date: year + '-03-15', note: 'Équipement atelier' });
  put('grants', { id: uid('grn'), program: 'Génération Green — Plantation argan',
    source: 'Ministère de l’Agriculture', amount_requested: 80000, amount_received: 0,
    status: 'applied', date: year + '-05-02', note: 'En attente de décision' });
  // budget prévisionnel
  [['Ventes huile d’argan', 'rev', 180000], ['Ventes miel', 'rev', 45000], ['Subventions', 'rev', 30000],
   ['Achats matières premières', 'exp', 60000], ['Emballages', 'exp', 12000], ['Transport', 'exp', 9000],
   ['Énergie & maintenance', 'exp', 8000], ['تعويضات التسيير', 'exp', 14400], ['Formation membres', 'exp', 6000]
  ].forEach(([label, kind, planned]) =>
    put('budgets', { id: uid('bud'), year, label, kind, planned }));
  // proxy (Art. 39)
  put('proxies', { id: uid('prx'), assembly_id: asmId, member_id: memberIds[3],
    member_name: memberNames[3][0], proxy_to: memberNames[0][0], date: year + '-10-01T00:00:00Z' });

  // --- extra users (roles demo) ----------------------------------------------
  const supId = uid('usr');
  put('users', { id: supId, name: 'Yasmine El Amrani', phone: '0622-000000', role: 'supervisor', created_at: new Date().toISOString() });

  Daira.save();
  Daira.setSession(null, null);
  return tenant.id;
}

if (typeof module !== 'undefined') module.exports = dairaSeed;
