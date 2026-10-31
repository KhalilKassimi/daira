/* ============================================================
   DAIRA — Demo seed (runs once, idempotent via flag)
   Cooperative "Tafoukt" — argan oil, Tamanar / Souss-Massa.
   ============================================================ */
'use strict';

function dairaSeed() {
  const DB = Daira.DB();
  if (DB.tenants && Object.keys(DB.tenants).length) return; // already seeded

  // platform super-admin (platform scope, sees all tenants)
  const saId = 'usr_superadmin';
  DB.users[saId] = { id: saId, tenant_id: '*', name: 'Daira Platform', phone: '', role: 'super_admin', is_owner: false, created_at: new Date().toISOString() };

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
  });
  Daira.setSession(tenant.id, adminUserId);
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
  const memberIds = memberNames.map(([name, name_ar, village], i) => {
    const id = uid('mbr');
    put('members', { id, code: 'MBR-' + String(i + 1).padStart(3, '0'), name, name_ar, village,
      plot_ref: 'Parcelle ' + village + '-' + (i + 1), status: 'active',
      joined_at: '2023-03-15T00:00:00Z' });
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

  // --- extra users (roles demo) ----------------------------------------------
  const supId = uid('usr');
  put('users', { id: supId, name: 'Yasmine El Amrani', phone: '0622-000000', role: 'supervisor', created_at: new Date().toISOString() });

  Daira.save();
  Daira.setSession(null, null);
  return tenant.id;
}

if (typeof module !== 'undefined') module.exports = dairaSeed;
