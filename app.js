/* ============================================================
   DAIRA — App shell, router & views (mobile-first SPA)
   ============================================================ */
'use strict';

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let LANG = localStorage.getItem('daira_lang') || 'fr';
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.fr[k] || k;
const fmtD = iso => { try { return new Date(iso).toISOString().slice(0, 10); } catch(e){ return ''; } };
const fmtM = n => Number(n || 0).toLocaleString('fr-FR') + ' MAD';

function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.remove('hidden');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => el.classList.add('hidden'), 3200);
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('daira_lang', l);
  const meta = LANGS.find(x => x.code === l) || LANGS[0];
  document.documentElement.lang = l === 'ar' ? 'ar' : 'fr';
  document.documentElement.dir = meta.dir;
  buildLangSel();
  render();
}

function buildLangSel() {
  const sel = $('#langSel');
  sel.title = t('lang_toggle');
  sel.innerHTML = LANGS.map(l => `<option value="${l.code}" ${l.code===LANG?'selected':''}>${l.label}</option>`).join('');
  sel.onchange = e => setLang(e.target.value);
}

function applyBranding() {
  const s = Daira.DB().session;
  const tn = s.tenantId && Daira.DB().tenants[s.tenantId];
  const brand = (tn && tn.branding.primary) || '#0e6b4a';
  document.documentElement.style.setProperty('--brand', brand);
  document.documentElement.style.setProperty('--brand-soft', brand + '22');
  $('#brandEmoji').textContent = (tn && tn.branding.logo_emoji) || '🌿';
  $('#brandName').textContent = tn ? (LANG === 'fr' ? tn.name : tn.name_ar) : 'Daira';
}

/* ---------------- shell ---------------- */
const NAV = [
  ['dash', 'nav_dash', '📊', 'dash'],
  ['intake', 'nav_intake', '🧺', 'intake.create'],
  ['production', 'nav_prod', '🏭', 'production.run'],
  ['catalog', 'nav_catalog', '📦', 'recipe.manage'],
  ['stock', 'nav_stock', '💰', 'sale.create'],
  ['finance', 'nav_finance', '📒', 'finance.manage'],
  ['certs', 'nav_certs', '📜', 'cert.manage'],
  ['passport', 'nav_pass', '🔳', 'passport.generate'],
  ['gov', 'nav_gov', '🏛️', 'assembly.manage'],
  ['actes', 'nav_actes', '⚖️', 'legal.manage'],
  ['dividends', 'nav_div', '🤝', 'dividend.run'],
  ['docs', 'nav_docs', '📚', null],
  ['settings', 'nav_settings', '⚙️', null],
];

function renderShell(route) {
  const s = Daira.DB().session;
  const shU = Daira.currentUser();
  const logged = !!shU && (shU.role === 'super_admin' || !!s.tenantId);
  const isPublic = route[0] === 'p';
  $('#topbar').classList.toggle('hidden', !logged || isPublic);
  $('#sidenav').classList.toggle('hidden', !logged || isPublic);
  $('#foot').classList.toggle('hidden', !logged || isPublic);
  if (!logged || isPublic) return;
  const u = Daira.currentUser();
  const links = u && u.role === 'super_admin'
    ? [['platform', 'plat_t', '🖥️'], ['docs', 'nav_docs', '📚'], ['settings', 'nav_settings', '⚙️']]
    : NAV.filter(n => !n[3] || Daira.can(n[3])).map(n => [n[0], n[1], n[2]]);
  $('#sidenav').innerHTML = `<div class="nav-head">${esc(u ? u.name : '')}<br><span class="muted">${esc(t('role_' + (u?u.role:'')))}</span></div>` +
    links.map(([r, label, ico]) =>
      `<a class="nav-link ${route[0]===r?'active':''}" href="#/${r}"><span class="ico">${ico}</span>${esc(t(label))}</a>`).join('') +
    `<a class="nav-link" href="#/" id="logoutLink"><span class="ico">🚪</span>${esc(t('set_logout'))}</a>`;
  const lo = $('#logoutLink');
  if (lo) lo.onclick = e => { e.preventDefault(); Daira.setSession(null, null); location.hash = '#/'; };
  $('#foot').innerHTML = `${esc(t('made_in'))} · ${esc(t('law'))}`;
}

$('#menuBtn').onclick = () => { $('#sidenav').classList.add('open'); $('#scrim').classList.remove('hidden'); };
$('#scrim').onclick = () => { $('#sidenav').classList.remove('open'); $('#scrim').classList.add('hidden'); };
document.addEventListener('click', e => {
  if (e.target.closest('#sidenav a')) { $('#sidenav').classList.remove('open'); $('#scrim').classList.add('hidden'); }
});

function setNet() { $('#netDot').classList.toggle('off', !navigator.onLine); }
window.addEventListener('online', setNet); window.addEventListener('offline', setNet);

/* ---------------- pending access requests (platform scope) ------------
   Moderated onboarding: a cooperative submits a request instead of
   getting instant access. The request is sent to the platform owner
   via WhatsApp; the owner approves from the platform console, which
   provisions the isolated tenant. Keeps the tenant base clean.      */
const REQ_KEY = 'daira_requests_v1';
const WA_NUMBER = '212696672715';
function getRequests() { try { return JSON.parse(localStorage.getItem(REQ_KEY)) || []; } catch (e) { return []; } }
function saveRequest(r) { const a = getRequests(); a.unshift(r); try { localStorage.setItem(REQ_KEY, JSON.stringify(a)); } catch (e) {} }
function updateRequest(id, patch) { const a = getRequests().map(r => r.id === id ? Object.assign({}, r, patch) : r); try { localStorage.setItem(REQ_KEY, JSON.stringify(a)); } catch (e) {} }
/* Portable request code: lets the admin import a request submitted on another
   device/browser (localStorage is per-device). The code travels via WhatsApp. */
function reqCode(r) {
  try { return 'DREQ1.' + btoa(unescape(encodeURIComponent(JSON.stringify(r)))); } catch (e) { return ''; }
}
function reqFromCode(code) {
  const c = String(code || '').trim();
  if (!c.startsWith('DREQ1.')) throw new Error('bad code');
  const r = JSON.parse(decodeURIComponent(escape(atob(c.slice(6)))));
  if (!r || !r.name) throw new Error('bad code');
  return r;
}
/* ---------------- print engine (client-side, offline) ------------------
   Renders an official document in a new window with print-optimized CSS
   and triggers the browser print dialog (Save as PDF supported).        */
function printDoc(title, bodyHtml) {
  const css = `<style>
    *{box-sizing:border-box} body{font-family:'Cairo',Arial,'Noto Sans Arabic',sans-serif;color:#111;margin:0;padding:18px;font-size:13px}
    .doc{max-width:700px;margin:0 auto}
    .doc-head{text-align:center;border-bottom:3px solid #0e6b4a;padding-bottom:10px;margin-bottom:14px}
    .doc-head h1{margin:.2rem 0;font-size:20px;color:#0e6b4a}
    .doc-head .sub{color:#555;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
    th,td{border:1px solid #999;padding:6px 8px;text-align:right}
    th{background:#eef4f0}
    .row2{display:flex;justify-content:space-between;gap:10px;margin:8px 0}
    .sig{margin-top:34px;display:flex;justify-content:space-between}
    .sig div{border-top:1px solid #333;padding-top:4px;width:44%;text-align:center;font-size:12px;color:#555}
    .qr{text-align:center;margin:12px 0}
    .qr svg{width:220px;height:220px}
    .foot{margin-top:16px;font-size:11px;color:#666;text-align:center;border-top:1px solid #ccc;padding-top:8px}
    h2{font-size:15px;color:#0e6b4a;margin:14px 0 6px}
    .ltr-field{direction:ltr !important;text-align:left !important;font-family:'Cairo',sans-serif !important}
    @media print{
      @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
      body, .print-document { font-family: 'Amiri', 'Cairo', serif !important; -webkit-font-smoothing: antialiased; }
      body{padding:0} .no-print{display:none}
    }
  </style>`;
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">`;
  const toolbar = `<div class="no-print" style="text-align:center;padding:10px 0;display:flex;gap:8px;justify-content:center">
    <button onclick="window.print()" style="padding:.6rem 1.2rem;font-size:1rem;cursor:pointer">🖨️ Imprimer</button>
    <button id="dlPdf" style="padding:.6rem 1.2rem;font-size:1rem;cursor:pointer;background:#0e6b4a;color:#fff;border:none;border-radius:6px">📥 Télécharger PDF</button></div>
  <script>
    document.getElementById('dlPdf').onclick = function() {
      var btn = this; btn.textContent = '⏳…'; btn.disabled = true;
      var lib = (window.opener && window.opener.html2pdf) || window.html2pdf;
      if (!lib) { alert('PDF non disponible hors-ligne — utilisez Imprimer.'); btn.textContent = '📥 Télécharger PDF'; btn.disabled = false; return; }
      var opt = { margin: 10, filename: document.title.replace(/[^a-zA-Z0-9-_àâäéèêëîïôöùûüç ]/g, '') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      lib().set(opt).from(document.querySelector('.doc')).save()
        .then(function(){ btn.textContent = '📥 Télécharger PDF'; btn.disabled = false; })
        .catch(function(){ btn.textContent = '📥 Télécharger PDF'; btn.disabled = false; });
    };
  <\/script>`;
  const w = window.open('', '_blank');
  w.document.write('<!DOCTYPE html><html dir="' + (LANG === 'fr' ? 'ltr' : 'rtl') + '"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' + fonts + css + '</head><body><div class="doc">' + bodyHtml + '</div>' + toolbar + '</body></html>');
  w.document.close(); w.focus();
}

function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const wa = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
  return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
}

function tenantHeader() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()];
  return tn ? { name: tn.name, name_ar: tn.name_ar, odco: tn.odco || '—', region: tn.region || '' } : { name: t('coop_default_name'), name_ar: t('coop_default_name'), odco: '—', region: '' };
}

function waRequestLink(r) {
  const lines = ['🌿 Daira — Demande d\u2019accès / طلب ولوج',
    '🏢 ' + (r.name || '') + (r.name_ar ? ' — ' + r.name_ar : ''),
    '📍 ' + (r.region || '') + (r.province ? ' · ' + r.province : '') + ' · ' + (r.sector || '') + (r.category ? ' · صنف ' + r.category : ''),
    '📞 ' + (r.phone || ''),
    '👤 ' + (r.adminName || '') + (r.adminPhone ? ' (' + r.adminPhone + ')' : ''),
    '',
    'المرجو منحي حق الوصول إلى فضائي — Merci de m\u2019ouvrir mon espace.',
    '',
    '🔑 Code: ' + reqCode(r)];
  return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
}

/* ---------------- router ---------------- */
function route() { return (location.hash || '#/').slice(2).split('/').filter(Boolean); }

function guard(perm) {
  if (perm && !Daira.can(perm)) { toast(t('no_perm'), true); location.hash = '#/dash'; return false; }
  return true;
}

function render() {
  const r = route();
  applyBranding();
  renderShell(r);
  setNet();
  const s = Daira.DB().session;
  const V = $('#view');

  if (r[0] === 'p' && r[1] && r[2]) return void vPublicPassport(r[1], decodeURIComponent(r[2]));
  if (!r.length || r[0] === '') return void vLanding(V);
  if (r[0] === 'login') return void vLogin(V, r[1]);
  if (r[0] === 'onboard') return void vOnboard(V, 1);

  if (!s.userId) { location.hash = '#/login'; return; }
  const u = Daira.currentUser();
  if (!u) { Daira.setSession(null, null); location.hash = '#/login'; return; }
  if (u.role !== 'super_admin' && !s.tenantId) { location.hash = '#/login'; return; }
  if (u && u.role === 'super_admin' && r[0] !== 'platform' && r[0] !== 'docs' && r[0] !== 'settings') { location.hash = '#/platform'; return; }

  ({ dash: vDash, intake: vIntake, production: vProduction, catalog: vCatalog, stock: vStock, finance: vFinance, certs: vCerts, actes: vActes,
     passport: vPassport, gov: vGov, dividends: vDividends, docs: vDocs, settings: vSettings,
     platform: vPlatform }[r[0]] || vDash)(V, r.slice(1));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ---------------- landing ---------------- */
function vLanding(V) {
  const feats = [['f1t','f1d','🔍'],['f2t','f2d','🏭'],['f3t','f3d','🔳'],['f4t','f4d','💰'],['f5t','f5d','🏛️'],['f6t','f6d','🤝']];
  const photos = [['argan-nuts.jpg','ph_argan_t','ph_argan_d'],['coop-women.jpg','ph_coop_t','ph_coop_d'],['olive-oil.jpg','ph_olive_t','ph_olive_d']];
  V.innerHTML = `
  <div class="hero hero-photo">
    <img class="hero-img" src="hero.jpg" alt="">
    <div class="scrim"></div>
    <div class="hero-inner hero-anim">
    <div style="position:relative;z-index:1;font-weight:800;font-size:1.05rem;opacity:.95">${esc(t('hero_brand'))}</div>
    <h1>${esc(t('hero_sub2'))}</h1>
    <p style="font-size:.95rem"><i>"${esc(t('hero_tag'))}"</i></p>
    <div style="position:relative;z-index:1;margin:.8rem 0"><span class="badge" style="background:rgba(255,255,255,.2);color:#fff;font-size:.72rem">✅ ${esc(t('badge_trust'))}</span></div>
    <div class="cta-row">
      <button class="btn light" onclick="demoLogin()">🚀 ${esc(t('explore_demo'))}</button>
      <a class="btn outline" href="#/login/admin" style="text-decoration:none">🖥️ ${esc(t('admin_portal'))}</a>
      <a class="btn outline" href="#/onboard" style="text-decoration:none">${esc(t('request_access'))}</a>
    </div>
    <div style="position:relative;z-index:1;margin-top:1rem;display:flex;gap:.4rem;justify-content:center;flex-wrap:wrap">
      ${LANGS.map(l=>`<button class="btn sm ${l.code===LANG?'light':'outline'}" style="width:auto" onclick="setLang('${l.code}')">${l.label}</button>`).join('')}
    </div>
    </div>
  </div>
  <div class="stats reveal"><div class="stat"><b>14</b><span>${esc(t('st_docs'))}</span></div><div class="stat"><b>7</b><span>${esc(t('st_actes'))}</span></div><div class="stat"><b>6</b><span>${esc(t('st_sectors'))}</span></div><div class="stat"><b>2</b><span>${esc(t('st_lang'))}</span></div></div>
  <div class="grid c2">${feats.map(([a,b,ico],i) =>
    `<div class="card feat" style="animation-delay:${.1+i*.07}s"><span class="ico">${ico}</span><div><b>${esc(t(a))}</b><div class="muted">${esc(t(b))}</div></div></div>`).join('')}</div>
  <h2 class="reveal">${esc(t('ph_t'))}</h2>
  <div class="photo-grid reveal">${photos.map(([img,a,b]) =>
    `<div class="photo-card"><img src="${img}" alt="" loading="lazy"><div class="pc-body"><b>${esc(t(a))}</b><div class="muted">${esc(t(b))}</div></div></div>`).join('')}</div>
  <p class="muted reveal" style="font-size:.8rem;text-align:center">${esc(t('ph_credit'))}</p>
  <h2 class="reveal">${esc(t('how_t'))}</h2>
  ${[['how_1t','how_1d'],['how_2t','how_2d'],['how_3t','how_3d']].map(([a,b],i) =>
    `<div class="card step reveal"><span class="n">${i+1}</span><div><b>${esc(t(a))}</b><div class="muted">${esc(t(b))}</div></div></div>`).join('')}
  <div class="card reveal" style="text-align:center"><span class="badge ok">${esc(t('law'))}</span>
    <p class="muted">${esc(t('made_in'))}</p></div>`;
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 }) : null;
  V.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));
}

/* ---------------- login (credentials) ---------------- */
function demoLogin() {
  try {
    const DB = Daira.DB();
    const tn = Object.values(DB.tenants)[0];
    if (!tn) { toast(t('err'), true); return; }
    const u = Object.values(DB.users).find(x => x.tenant_id === tn.id && x.is_owner)
           || Object.values(DB.users).find(x => x.tenant_id === tn.id);
    if (!u) { toast(t('err'), true); return; }
    if (!localStorage.getItem('daira_lang') && tn.settings && tn.settings.locale) setLang(tn.settings.locale);
    Daira.setSession(tn.id, u.id);
    location.hash = '#/dash';
  } catch (e) { toast(t('err'), true); }
}
function vLogin(V, tab) {
  tab = tab === 'admin' ? 'admin' : 'coop';
  V.innerHTML = `<div class="card" style="max-width:440px;margin:2rem auto">
    <div style="text-align:center;font-size:2.4rem">🌿</div>
    <h1 style="text-align:center">${esc(t('login_t'))}</h1>
    <p class="muted" style="text-align:center">${esc(t('login_sub'))}</p>
    <div class="row" style="margin-bottom:1rem">
      <a href="#/login/coop" class="btn sm ${tab==='coop'?'':'ghost'}" style="flex:1;text-decoration:none">🏢 ${esc(t('login_coop'))}</a>
      <a href="#/login/admin" class="btn sm ${tab==='admin'?'':'ghost'}" style="flex:1;text-decoration:none">🖥️ ${esc(t('login_admin'))}</a>
    </div>
    ${tab==='admin'?`<p class="muted" style="text-align:center">🔒 ${esc(t('login_hint_admin'))}</p>`:''}
    <label class="f">${esc(t('login_user'))}<input id="lg_u" autocomplete="username" placeholder="${tab==='admin'?'admin':'T001'}" ${tab==='admin'?'value="admin"':''}></label>
    <label class="f">${esc(t('login_pin'))}<input id="lg_p" type="password" autocomplete="current-password"></label>
    <button class="btn" id="lg_go">🔑 ${esc(t('login_go'))}</button>
    ${tab==='admin'?`<button class="btn ghost" id="lg_fill" style="margin-top:.6rem">⚡ ${esc(t('quick_login'))}</button>`:''}
    <button class="btn ghost" onclick="demoLogin()" style="margin-top:.7rem">👀 ${esc(t('view_demo'))} <span class="muted">— T001 / 123456</span></button>
    <p style="text-align:center;margin-top:1rem" class="muted">${esc(t('login_noaccess'))} <a href="#/onboard">${esc(t('request_access'))}</a></p>
    <p style="text-align:center"><a href="#/">${esc(t('nav_home'))}</a></p></div>`;
  const go = () => {
    try {
      const uname = $('#lg_u').value.trim();
      const pin = $('#lg_p').value.trim();
      if (uname && !Object.values(Daira.DB().users).some(x => x.username === uname)) {
        toast('⛔ ' + t('login_err_nouser'), true); return;
      }
      const u = Daira.authenticate(uname, pin);
      const tn = u.tenant_id !== '*' && Daira.DB().tenants[u.tenant_id];
      if (!localStorage.getItem('daira_lang') && tn && tn.settings && tn.settings.locale) setLang(tn.settings.locale);
      Daira.setSession(u.tenant_id === '*' ? null : u.tenant_id, u.id);
      if (u.role === 'super_admin') { Daira.DB().session.tenantId = null; Daira.save(); location.hash = '#/platform'; }
      else location.hash = '#/dash';
    } catch (e) { toast('⛔ ' + t('login_err'), true); }
  };
  $('#lg_go').onclick = go;
  $('#lg_p').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  const lf = $('#lg_fill');
  if (lf) lf.onclick = () => { $('#lg_u').value = 'admin'; $('#lg_p').value = 'daira2026'; };
}

/* ---------------- onboarding wizard (validated) ---------------- */
const OB = { step: 1, data: { primaryColor: '#0e6b4a', logoEmoji: '🌿', locale: 'fr', sector: '', category: '', share_value: '100' } };
const OB_COLORS = ['#0e6b4a','#8a5a2b','#1f6f9e','#7b2d8b','#b03a2e','#2e4057'];
const OB_EMOJIS = ['🌿','🫒','🍯','🧶','🌵','🐝','🥜','🫘'];
const SECTORS = [['Oléicole','الزيتون'],['Argan','أركان'],['PAM','النباتات العطرية'],['Laitier','الحليب'],['Apicole','العسل'],['Artisanat','الصناعة التقليدية']];

const isPhoneMA = v => /^(05|06|07)\d{8}$/.test(String(v).replace(/[\s-]/g, ''));
const isCIN = v => /^[A-Z]{1,2}[0-9]{5,6}$/.test(String(v).trim().toUpperCase());
const isICE = v => /^\d{15}$/.test(String(v).trim());
const isEmail = v => /^\S+@\S+\.\S+$/.test(String(v).trim());

function obValidate(step) {
  const d = OB.data, errs = {};
  if (step === 1) {
    if (!d.name || !d.name.trim()) errs.name = t('v_required');
    if (!d.odco || !d.odco.trim()) errs.odco = t('v_required');
    else if (/^\d+$/.test(d.odco.trim()) && !isICE(d.odco)) errs.odco = t('v_ice');
    if (!d.sector) errs.sector = t('v_required');
    if (!d.category) errs.category = t('v_required');
    if (!d.region || !d.region.trim()) errs.region = t('v_required');
  }
  if (step === 2) {
    if (!d.adminName || !d.adminName.trim()) errs.adminName = t('v_required');
    if (!d.cin || !d.cin.trim()) errs.cin = t('v_required');
    else if (!isCIN(d.cin)) errs.cin = t('v_cin');
    if (!isPhoneMA(d.adminPhone)) errs.adminPhone = t('v_phone');
    if (!isEmail(d.email)) errs.email = t('v_email');
  }
  return errs;
}

function vOnboard(V, step) {
  OB.step = step || OB.step;
  const d = OB.data;
  const errs = OB['errs' + OB.step] || {};
  const stepsBar = `<div class="steps-ind">${[1,2,3].map(i =>
    `<div class="st ${i===OB.step?'on':(i<OB.step?'done':'')}"><div class="dot">${i<OB.step?'✓':i}</div>${esc(t('ob_st'+i))}</div>`).join('')}</div>`;
  const ferr = k => errs[k] ? `<div class="ferr">⚠️ ${esc(errs[k])}</div>` : '<div class="ferr"></div>';
  let body = '';
  if (OB.step === 1) body = `
    <label class="f">${esc(t('ob_name'))}<input id="o_name" value="${esc(d.name||'')}" placeholder="Coopérative …" class="${errs.name?'invalid':''}">${ferr('name')}</label>
    <label class="f">${esc(t('ob_odco'))}<input id="o_odco" value="${esc(d.odco||'')}" placeholder="ODCO-… / ICE …" class="${errs.odco?'invalid':''}">${ferr('odco')}</label>
    <label class="f">${esc(t('ob_sector'))}<select id="o_sector" class="${errs.sector?'invalid':''}">
      <option value="">—</option>${SECTORS.map(([fr,ar])=>`<option value="${fr}" ${d.sector===fr?'selected':''}>${fr} / ${ar}</option>`).join('')}</select>${ferr('sector')}</label>
    <label class="f">${esc(t('ob_category'))}<select id="o_category" class="${errs.category?'invalid':''}">
      <option value="">—</option>
      <option value="1" ${d.category==='1'?'selected':''}>${esc(t('ob_cat1'))}</option>
      <option value="2" ${d.category==='2'?'selected':''}>${esc(t('ob_cat2'))}</option>
      <option value="3" ${d.category==='3'?'selected':''}>${esc(t('ob_cat3'))}</option></select>${ferr('category')}</label>
    <label class="f">${esc(t('ob_purpose'))}<input id="o_purpose" value="${esc(d.purpose||'')}" placeholder="…"></label>
    <div class="grid c2">
      <label class="f">${esc(t('ob_region'))}<input id="o_region" value="${esc(d.region||'')}" placeholder="Souss-Massa" class="${errs.region?'invalid':''}">${ferr('region')}</label>
      <label class="f">${esc(t('ob_province'))}<input id="o_province" value="${esc(d.province||'')}"></label>
    </div>
    <div class="grid c2">
      <label class="f">${esc(t('ob_phone'))}<input id="o_phone" value="${esc(d.phone||'')}"></label>
      <label class="f">${esc(t('ob_denom_date'))}<input id="o_denom_cert_date" type="date" value="${esc(d.denom_cert_date||'')}"></label>
    </div>
    <div class="grid c2">
      <label class="f">${esc(t('ob_share_value'))}<input id="o_share_value" type="number" min="0" step="1" value="${esc(d.share_value||'100')}"></label>
      <label class="f">${esc(t('ob_capital_lib'))}<input id="o_capital_liberated" type="number" min="0" step="1" value="${esc(d.capital_liberated||'')}"></label>
    </div>`;
  if (OB.step === 2) body = `
    <label class="f">${esc(t('ob_president'))}<input id="o_adminName" value="${esc(d.adminName||'')}" class="${errs.adminName?'invalid':''}">${ferr('adminName')}</label>
    <div class="grid c2">
      <label class="f">${esc(t('ob_cin'))}<input id="o_cin" value="${esc(d.cin||'')}" class="${errs.cin?'invalid':''}">${ferr('cin')}</label>
      <label class="f">${esc(t('ob_admin_phone'))}<input id="o_adminPhone" value="${esc(d.adminPhone||'')}" placeholder="06…" class="${errs.adminPhone?'invalid':''}">${ferr('adminPhone')}</label>
    </div>
    <label class="f">${esc(t('ob_email'))}<input id="o_email" type="email" value="${esc(d.email||'')}" class="${errs.email?'invalid':''}">${ferr('email')}</label>`;
  if (OB.step === 3) body = `
    <label class="f">${esc(t('ob_color'))}<div class="swatches">${OB_COLORS.map(c=>`<span class="swatch ${d.primaryColor===c?'on':''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div></label>
    <label class="f">${esc(t('ob_emoji'))}<div class="swatches">${OB_EMOJIS.map(e=>`<span class="swatch ${d.logoEmoji===e?'on':''}" data-e="${e}" style="font-size:1.5rem;display:flex;align-items:center;justify-content:center;background:#f0f4f1">${e}</span>`).join('')}</div></label>
    <label class="f">${esc(t('set_lang'))}<select id="o_locale">${LANGS.map(l=>`<option value="${l.code}" ${d.locale===l.code?'selected':''}>${l.label}</option>`).join('')}</select></label>`;
  if (OB.step === 4) {
    const r = OB.lastReq || {};
    body = `<div style="text-align:center;padding:1rem"><div style="font-size:3rem">📩</div>
    <h2>${esc(t('ob_req_t'))}</h2><p class="muted">${esc(t('ob_req_d'))}</p>
    <div class="card" style="text-align:start"><b>${esc(r.logoEmoji || '🏢')} ${esc(r.name || '')}</b><br>
    <span class="muted">${esc(r.region || '')} · ${esc(r.sector || '')} · ${esc(r.phone || '')}</span></div>
    <a class="btn" style="text-decoration:none;background:#25D366" target="_blank" rel="noopener" href="${waRequestLink(r)}">💬 ${esc(t('ob_wa_btn'))}</a>
    <div><button class="btn ghost sm" id="o_copycode" style="margin-top:.6rem">📋 ${esc(t('ob_copy_code'))}</button></div>
    <p class="muted" style="margin-top:.8rem"><a href="#/">${esc(t('nav_home'))}</a></p></div>`;
  }

  V.innerHTML = `<div class="card" style="max-width:520px;margin:1.5rem auto">
    <h1>${esc(t('ob_t'))}</h1>${OB.step<4?stepsBar:''}${body}
    ${OB.step<4?`<div class="row" style="margin-top:1rem">
      ${OB.step>1?`<button class="btn ghost" id="o_back" style="flex:1">${esc(t('ob_back'))}</button>`:''}
      ${OB.step<3?`<button class="btn" id="o_next" style="flex:2">${esc(t('ob_next'))}</button>`:''}
      ${OB.step===3?`<button class="btn" id="o_finish" style="flex:2">📩 ${esc(t('ob_finish'))}</button>`:''}
    </div>`:''}</div>`;

  const grab = () => {
    ['name','odco','region','phone','province','purpose','denom_cert_date','adminName','cin','adminPhone','email'].forEach(k => {
      const el = document.getElementById('o_'+k); if (el) d[k] = el.value.trim();
    });
    ['share_value','capital_liberated'].forEach(k => {
      const el = document.getElementById('o_'+k); if (el) d[k] = el.value;
    });
    const sec = document.getElementById('o_sector'); if (sec) d.sector = sec.value;
    const cat = document.getElementById('o_category'); if (cat) d.category = cat.value;
    const loc = document.getElementById('o_locale'); if (loc) d.locale = loc.value;
  };
  const nx = $('#o_next');
  if (nx) nx.onclick = () => {
    grab();
    const e = obValidate(OB.step);
    if (Object.keys(e).length) { OB['errs'+OB.step] = e; vOnboard(V, OB.step); toast('⚠️ ' + t('v_required'), true); return; }
    OB['errs'+OB.step] = {};
    vOnboard(V, OB.step + 1);
  };
  const bk = $('#o_back'); if (bk) bk.onclick = () => { grab(); vOnboard(V, OB.step - 1); };
  document.querySelectorAll('.swatch[data-c]').forEach(s => s.onclick = () => { d.primaryColor = s.dataset.c; vOnboard(V, 3); });
  document.querySelectorAll('.swatch[data-e]').forEach(s => s.onclick = () => { d.logoEmoji = s.dataset.e; vOnboard(V, 3); });
  const fn = $('#o_finish');
  if (fn) fn.onclick = () => {    grab();
    const req = { id: 'req_' + Date.now().toString(36), created_at: new Date().toISOString(), status: 'pending',
      name: d.name, name_ar: d.name_ar, region: d.region, province: d.province, sector: d.sector, phone: d.phone,
      odco: d.odco, email: d.email, cin: d.cin,
      category: d.category, purpose: d.purpose, share_value: d.share_value,
      capital_liberated: d.capital_liberated, denom_cert_date: d.denom_cert_date,
      adminName: d.adminName, adminPhone: d.adminPhone,
      primaryColor: d.primaryColor, logoEmoji: d.logoEmoji, locale: d.locale };
    saveRequest(req);
    OB.lastReq = req;
    setLang(d.locale || 'fr');
    OB.data = { primaryColor: '#0e6b4a', logoEmoji: '🌿', locale: LANG, sector: '', category: '', share_value: '100' };
    vOnboard(V, 4);
  };
  const oc = $('#o_copycode');
  if (oc) oc.onclick = () => {
    const code = reqCode(OB.lastReq || {});
    if (navigator.clipboard && code) navigator.clipboard.writeText(code).then(() => toast(t('cred_copied'))).catch(() => prompt(t('ob_copy_code'), code));
    else if (code) prompt(t('ob_copy_code'), code);
  };
}


/* ---------------- platform console (super_admin) ---------------- */
let LAST_CRED = null;
function credWaLink(phone, username, pin, tenantName) {
  const digits = String(phone || '').replace(/\D/g, '');
  const wa = digits.startsWith('0') ? '212' + digits.slice(1) : digits;
  const msg = '🌿 Daira — ' + t('cred_t') + '\n🏢 ' + tenantName + '\n👤 ' + t('login_user') + ': ' + username + '\n🔑 ' + t('login_pin') + ': ' + pin + '\n🔗 https://khalilkassimi.github.io/daira/#/login';
  return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
}
function vPlatform(V) {
  if (!Daira.can('tenant.provision')) { toast(t('no_perm'), true); location.hash = '#/'; return; }
  const tenants = Daira.listTenants();
  const reqs = getRequests().filter(r => r.status === 'pending');
  V.innerHTML = `<div class="row between"><h1>🖥️ ${esc(t('plat_t'))}</h1>
    <a class="btn sm" href="#/onboard" style="text-decoration:none">${esc(t('plat_new'))}</a></div>
    <p class="muted">${esc(t('plat_sub'))}</p>
    ${LAST_CRED ? `<div class="card" style="border:2px solid var(--ok)">
      <h2 style="margin-top:0">🔑 ${esc(t('cred_t'))} — ${esc(LAST_CRED.tenantName)}</h2>
      <div class="row between"><span>${esc(t('login_user'))}</span><b style="font-size:1.2rem">${esc(LAST_CRED.username)}</b></div>
      <div class="row between"><span>${esc(t('login_pin'))}</span><b style="font-size:1.2rem">${esc(LAST_CRED.pin)}</b></div>
      <div class="row" style="margin-top:.6rem">
        <button class="btn sm ghost" id="credCopy" style="flex:1">📋 ${esc(t('cred_copied')).replace(' ✓','')}</button>
        <a class="btn sm" style="flex:2;text-decoration:none;background:#25D366" target="_blank" rel="noopener"
           href="${credWaLink(LAST_CRED.phone, LAST_CRED.username, LAST_CRED.pin, LAST_CRED.tenantName)}">💬 ${esc(t('cred_send'))}</a>
      </div></div>` : ''}
    <h2>📩 ${esc(t('plat_req'))} (${reqs.length})</h2>
    ${reqs.map(r => `<div class="card" style="border-inline-start:4px solid var(--amber)">
      <div><b>${esc(r.logoEmoji || '🏢')} ${esc(r.name)}</b><br>
      <span class="muted">${esc(r.name_ar || '')} · ${esc(r.region)} · ${esc(r.sector)}<br>
      📞 ${esc(r.phone)} · 👤 ${esc(r.adminName)} (${esc(r.adminPhone)})<br>🕐 ${fmtD(r.created_at)}</span></div>
      <div class="row" style="margin-top:.6rem">
        <button class="btn sm" data-approve="${r.id}" style="flex:1">✅ ${esc(t('plat_approve'))}</button>
        <button class="btn sm danger" data-reject="${r.id}">✖️ ${esc(t('plat_reject'))}</button>
      </div></div>`).join('') || `<p class="muted">—</p>`}
    <div class="card"><h2 style="margin-top:0">📥 ${esc(t('req_import_t'))}</h2>
      <p class="muted">${esc(t('req_import_d'))}</p>
      <textarea id="rq_code" rows="3" placeholder="DREQ1.…" style="width:100%"></textarea>
      <button class="btn sm" id="rq_imp" style="margin-top:.5rem">➕ ${esc(t('req_import_go'))}</button></div>
    <h2>🏢 ${esc(t('plat_sub'))}</h2>
    ${tenants.map(x => { const n = Object.values(Daira.DB().members).filter(m=>m.tenant_id===x.id).length;
      const ou = Object.values(Daira.DB().users).find(u => u.tenant_id === x.id && u.is_owner);
      return `<div class="card"><div class="row between"><div><b>${x.branding.logo_emoji} ${esc(x.name)}</b><br>
      <span class="muted">${esc(x.region)} · ${esc(x.sector)} · ${x.code} · ${n} ${esc(t('d_members'))}<br>👤 <b>${esc(ou ? ou.username || x.code : x.code)}</b></span></div>
      <span class="badge ok">${esc(x.status)}</span></div>
      <button class="btn sm ghost" data-resetpin="${x.id}" style="margin-top:.4rem">🔑 ${esc(t('plat_reset'))}</button></div>`; }).join('')}`;
  V.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => {
    const r = getRequests().find(x => x.id === b.dataset.approve);
    if (!r) return;
    try {
      const pin = String(Math.floor(100000 + Math.random() * 900000));  // issued at approval
      const { tenant } = Daira.provisionTenant(Object.assign({}, r, { pin }));
      updateRequest(r.id, { status: 'approved', tenant_id: tenant.id, tenant_code: tenant.code });
      LAST_CRED = { username: tenant.code, pin, tenantName: tenant.name, phone: r.adminPhone || r.phone };
      toast('✅ ' + tenant.code + ' — ' + tenant.name);
      render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  });
  V.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => { updateRequest(b.dataset.reject, { status: 'rejected' }); render(); });
  const ri = $('#rq_imp');
  if (ri) ri.onclick = () => {
    try {
      const r = reqFromCode($('#rq_code').value);
      r.id = 'req_' + Date.now().toString(36);
      r.status = 'pending';
      r.created_at = r.created_at || new Date().toISOString();
      saveRequest(r);
      toast('✅ ' + t('req_import_ok'));
      render();
    } catch (e) { toast(t('req_import_err'), true); }
  };
  const cc = $('#credCopy');
  if (cc) cc.onclick = () => {
    const txt = LAST_CRED.username + ' / ' + LAST_CRED.pin;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast(t('cred_copied')));
    else toast(txt);
  };
  // reset PIN per tenant
  V.querySelectorAll('[data-resetpin]').forEach(b => b.onclick = () => {
    const tid = b.dataset.resetpin;
    const u = Object.values(Daira.DB().users).find(x => x.tenant_id === tid && x.is_owner);
    if (!u) { toast(t('err'), true); return; }
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    Daira.setCredentials(u.id, null, pin);
    const tn = Daira.DB().tenants[tid];
    LAST_CRED = { username: u.username || tn.code, pin, tenantName: tn.name, phone: u.phone || tn.phone };
    render();
  });
  // ---- data toolbox ----
  const tb = document.createElement('div');
  tb.innerHTML = `<h2>💾 ${esc(t('data_t'))}</h2><div class="card">
    <button class="btn ghost" id="pf_x">📥 ${esc(t('data_export'))}</button>
    <div class="row" style="margin-top:.6rem"><input type="file" id="pf_i" accept=".json" style="margin:0">
    <button class="btn sm" id="pf_ig">📤 ${esc(t('data_import'))}</button></div>
    <button class="btn danger" id="pf_r" style="margin-top:.6rem">🧹 ${esc(t('data_reset'))}</button></div>`;
  V.appendChild(tb);
  $('#pf_x').onclick = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const data = { app: 'daira', exported_at: new Date().toISOString(),
      db: localStorage.getItem('daira_db_v1'), requests: localStorage.getItem('daira_requests_v1') };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'daira_backup_' + stamp + '.json'; a.click();
  };
  $('#pf_ig').onclick = () => {
    const f = $('#pf_i').files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (data.db) localStorage.setItem('daira_db_v1', data.db);
        if (data.requests) localStorage.setItem('daira_requests_v1', data.requests);
        location.reload();
      } catch (e) { toast(t('err'), true); }
    };
    r.readAsText(f);
  };
  $('#pf_r').onclick = () => { if (confirm('OK?')) { Daira.resetDB(); try { localStorage.removeItem('daira_requests_v1'); } catch (e) {} location.hash = '#/'; location.reload(); } };
}

/* ---------------- dashboard ---------------- */
function vDash(V) {
  const members = Daira.scoped('members');
  const batches = Daira.scoped('rawBatches');
  const lots = Daira.scoped('finishedLots');
  const sales = Daira.scoped('sales');
  const stock = lots.reduce((s, l) => s + (l.qty_available || 0), 0);
  const salesTot = sales.reduce((s, x) => s + (x.total || 0), 0);
  const low = lots.filter(l => l.qty_available > 0 && l.qty_available < 15);
  const recent = [...Daira.scoped('invLedger')].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6);
  const u = Daira.currentUser();
  const tn = Daira.DB().tenants[Daira.activeTenantId()];

  const acts = [
    ['intake', 'd_new_intake', '🧺', 'intake.create'], ['production', 'd_new_run', '🏭', 'production.run'],
    ['catalog', 'd_new_catalog', '📦', 'recipe.manage'],
    ['finance', 'nav_finance', '📒', 'finance.manage'],
    ['actes', 'nav_actes', '⚖️', 'legal.manage'],
    ['stock', 'd_new_sale', '💰', 'sale.create'], ['gov', 'd_new_assembly', '🏛️', 'assembly.manage'],
  ].filter(a => Daira.can(a[3]));

  V.innerHTML = `
  <h1>${tn.branding.logo_emoji} ${esc(t('d_welcome'))}, ${esc(u.name.split(' ')[0])}</h1>
  <p class="muted">${esc(LANG==='fr'?tn.name:tn.name_ar)} · ${esc(tn.region)}</p>
  <div class="grid c2" style="grid-template-columns:repeat(4,1fr)">
    <div class="kpi"><div class="n">${members.length}</div><div class="l">${esc(t('d_members'))}</div></div>
    <div class="kpi"><div class="n">${batches.length}</div><div class="l">${esc(t('d_batches'))}</div></div>
    <div class="kpi"><div class="n">${Math.round(stock)}</div><div class="l">${esc(t('d_stock'))}</div></div>
    <div class="kpi"><div class="n">${fmtM(salesTot)}</div><div class="l">${esc(t('d_sales'))}</div></div>
  </div>
  <h2>${esc(t('d_actions'))}</h2>
  <div class="action-grid">${acts.map(([r,l,ico])=>`<a class="action-card" href="#/${r}"><span class="ico">${ico}</span>${esc(t(l))}</a>`).join('')}</div>
  ${low.length?`<h2>⚠️ ${esc(t('d_lowstock'))}</h2>${low.map(l=>`<div class="card"><div class="row between"><div><b>${esc(l.product_name)}</b><br><span class="muted">${esc(l.lot_code)}</span></div><span class="badge warn">${Math.round(l.qty_available)} ${esc(l.unit)}</span></div></div>`).join('')}`:''}
  <h2>${esc(t('d_recent'))}</h2>
  ${recent.map(e=>{ const lot = Daira.DB().finishedLots[e.lot_id];
    return `<div class="card" style="padding:.7rem"><div class="row between"><div><b>${e.change>0?'+':''}${e.change}</b> · ${esc(lot?lot.product_name:'')}<br><span class="muted">${esc(e.reason)} · ${esc(e.ref)} · ${fmtD(e.created_at)}</span></div><span class="badge neutral">${esc(e.actor||'')}</span></div></div>`;}).join('') || `<p class="muted">—</p>`}`;
}

/* ---------------- print: bon de réception ---------------- */
let LAST_BATCH = null;
function ticketHtml(b) {
  const h = tenantHeader();
  const m = Daira.DB().members[b.member_id] || {};
  return `
  <div class="doc-head"><h1>🌿 ${esc(h.name)}</h1>
    <div class="sub">${esc(h.name_ar)} · N° ODCO: ${esc(h.odco)} · ${esc(h.region)}</div>
    <h1 style="font-size:17px;margin-top:8px">${esc(t('pr_ticket_t'))} — ${esc(b.batch_code)}</h1></div>
  <table>
    <tr><th style="width:45%">Adhérent / المنخرط</th><td>${esc(b.member_name)} (${esc(m.code || '')})</td></tr>
    <tr><th>Matière</th><td>${esc(b.material_name)}</td></tr>
    <tr><th>Poids net</th><td><b>${b.qty} ${esc(b.unit)}</b></td></tr>
    <tr><th>Grade</th><td>${esc(b.grade)}</td></tr>
    <tr><th>Humidité / Acidité</th><td>${esc(b.quality.moisture || '—')} / ${esc(b.quality.acidity || '—')}</td></tr>
    <tr><th>Prix unitaire</th><td>${b.unit_price} MAD / ${esc(b.unit)}</td></tr>
    <tr><th>Montant crédité</th><td><b>${b.total_credit} MAD</b></td></tr>
    <tr><th>Date & heure</th><td>${new Date(b.received_at).toLocaleString('fr-FR')}</td></tr>
    <tr><th>Reçu par</th><td>${esc(b.received_by || '')}</td></tr>
  </table>
  <div class="sig"><div>Signature du peseur<br><br><br></div><div>Signature / empreinte de l'adhérent<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
}
function printLastTicket() { if (LAST_BATCH) printDoc(t('pr_ticket_t'), ticketHtml(LAST_BATCH)); }
function waLastReceipt() {
  if (!LAST_BATCH) return;
  const b = LAST_BATCH, h = tenantHeader(), m = Daira.DB().members[b.member_id] || {};
  const msg = 'السلام عليكم،\nتأكيد استلام محصولكم لدى تعاونية ' + h.name +
    '\n📅 التاريخ: ' + String(b.received_at).slice(0, 10) +
    '\n⚖️ الكمية الصافية: ' + b.qty + ' ' + b.unit + ' (' + b.material_name + ')' +
    '\n💰 المبلغ المقيد في حسابكم: ' + b.total_credit + ' درهم' +
    '\n🏷️ رقم الحصة: ' + b.batch_code +
    '\nشكراً لمساهمتكم في نجاح تعاونيتنا!';
  window.open(waLink(m.phone, msg), '_blank');
}

/* ---------------- intake ---------------- */
function vIntake(V, args) {
  if (!guard('intake.create')) return;
  const tab = (args && args[0]) || 'reception';
  if (tab === 'orders') { V.innerHTML = `<h1>🧺 ${esc(t('i_t'))}</h1>
  <div class="row" style="margin-bottom:.8rem"><a href="#/intake/reception" class="btn sm ghost" style="flex:1;text-decoration:none">🧺 ${esc(t('i_t'))}</a><a href="#/intake/orders" class="btn sm" style="flex:1;text-decoration:none">📋 ${esc(t('po_t'))}</a></div>${vPO()}`;
    bindPO(V); return; }
  const members = Daira.scoped('members').filter(m=>m.status==='active');
  const materials = Daira.scoped('materials');
  const grades = Object.keys(Daira.GRADE_TABLE);
  V.innerHTML = `<h1>🧺 ${esc(t('i_t'))}</h1>
  <div class="row" style="margin-bottom:.8rem"><a href="#/intake/reception" class="btn sm" style="flex:1;text-decoration:none">🧺 ${esc(t('i_t'))}</a><a href="#/intake/orders" class="btn sm ghost" style="flex:1;text-decoration:none">📋 ${esc(t('po_t'))}</a></div>
  <div class="card">
    <label class="f">${esc(t('i_member'))}<select id="in_m">${members.map(m=>`<option value="${m.id}">${esc(m.name)} · ${esc(m.code)}</option>`).join('')}</select></label>
    <label class="f">${esc(t('i_material'))}<select id="in_mat">${materials.map(m=>`<option value="${m.id}">${esc(LANG==='fr'?m.name:m.name_ar)} (${m.base_price} MAD/${m.unit})</option>`).join('')}</select></label>
    <div class="grid c2">
      <label class="f">${esc(t('i_qty'))}<input id="in_q" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"></label>
      <label class="f">${esc(t('i_grade'))}<select id="in_g">${grades.map(g=>`<option value="${g}">Grade ${g}</option>`).join('')}</select></label>
    </div>
    <div class="grid c2">
      <label class="f">${esc(t('i_moisture'))}<input id="in_mo" placeholder="8.5%"></label>
      <label class="f">${esc(t('i_acidity'))}<input id="in_ac" placeholder="0.5%"></label>
    </div>
    <label class="f">${esc(t('i_note'))}<input id="in_n"></label>
    <div class="card" style="background:var(--brand-soft)"><div class="row between"><span>${esc(t('i_price'))}</span><b id="in_pv">—</b></div>
    <div class="row between"><span>${esc(t('i_credit'))}</span><b id="in_cv">—</b></div></div>
    <button class="btn" id="in_go" style="font-size:1.15rem;padding:1rem">✅ ${esc(t('i_save'))}</button>
  </div>
  <div id="in_done"></div>`;

  const upd = () => {
    const mat = Daira.get('materials', $('#in_mat').value);
    const g = Daira.GRADE_TABLE[$('#in_g').value];
    const q = Number($('#in_q').value) || 0;
    if (!mat || !g) return;
    const up = Daira.round2(mat.base_price * g.priceFactor);
    $('#in_pv').textContent = up + ' MAD/' + mat.unit;
    $('#in_cv').textContent = fmtM(Daira.round2(up * q));
  };
  ['in_mat','in_g','in_q'].forEach(id => document.getElementById(id).addEventListener('input', upd)); upd();

  $('#in_go').onclick = () => {
    try {
      const b = Daira.ingestContribution({ memberId: $('#in_m').value, materialId: $('#in_mat').value,
        qty: $('#in_q').value, grade: $('#in_g').value, moisture: $('#in_mo').value, acidity: $('#in_ac').value, note: $('#in_n').value });
      $('#in_done').innerHTML = `<div class="card" style="border:2px solid var(--ok)">
        <div style="font-size:2rem;text-align:center">🎉</div>
        <div class="row between"><span>${esc(t('i_batch'))}</span><b>${esc(b.batch_code)}</b></div>
        <div class="row between"><span>${esc(t('i_credit'))}</span><b>${fmtM(b.total_credit)}</b></div>
        <p class="muted" style="text-align:center">${esc(b.member_name)} · ${b.qty} ${esc(b.unit)} · Grade ${b.grade}</p>
        <div class="row" style="margin-top:.6rem">
          <button class="btn sm ghost" onclick="printLastTicket()" style="flex:1">${esc(t('pr_print'))}</button>
          <button class="btn sm" onclick="waLastReceipt()" style="flex:1;background:#25D366">💬 ${esc(t('wa_receipt'))}</button>
        </div></div>`;
      LAST_BATCH = b;
      toast('✅ ' + t('i_saved'));
      $('#in_q').value = ''; upd();
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- purchase orders (bons de commande) ---------------- */
function vPO() {
  const pos = [...Daira.scoped('purchaseOrders')].reverse();
  const mats = Daira.scoped('materials');
  const mName = id => { const m = Daira.get('materials', id); return m ? (LANG === 'fr' ? m.name : m.name_ar || m.name) : '—'; };
  return `${pos.map(p=>`<div class="card" style="padding:.7rem"><div class="row between"><b>${esc(p.po_code)}</b><span class="badge ${p.status==='received'?'ok':'warn'}">${esc(p.status)}</span></div>
    <div class="muted">${esc(p.vendor_name)} · ${esc(mName(p.material_id))} · ${p.qty} ${esc(p.unit||'')} × ${p.unit_price} MAD = <b>${fmtM(p.total)}</b> · ${fmtD(p.date)}</div>
    ${p.status !== 'received' ? `<button class="btn sm" data-po-recv="${p.id}" style="margin-top:.4rem">✅ ${esc(t('po_received'))}</button>` : ''}</div>`).join('') || '<p class="muted">—</p>'}
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('po_t'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('po_vendor'))}<input id="po_v"></label>
    <label class="f">${esc(t('po_vendor'))} — type<select id="po_vt"><option value="supplier">${esc(t('po_supplier'))}</option><option value="member">${esc(t('po_member'))}</option></select></label></div>
    <div class="grid c2"><label class="f">${esc(t('cat_mat'))}<select id="po_m"><option value="">—</option>${mats.map(m=>`<option value="${m.id}">${esc(LANG==='fr'?m.name:m.name_ar||m.name)}</option>`).join('')}</select></label>
    <label class="f">${esc(t('cat_qty'))}<input id="po_q" type="number" min="0" step="0.1"></label></div>
    <div class="grid c2"><label class="f">${esc(t('fin_amount'))} / unité<input id="po_p" type="number" min="0" step="0.1"></label>
    <label class="f">${esc(t('fin_date'))}<input id="po_d" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div>
    <label class="f">${esc(t('po_status'))}<select id="po_s"><option value="draft">${esc(t('po_draft'))}</option><option value="received">${esc(t('po_received'))}</option></select></label>
    <button class="btn" id="po_go">${esc(t('save'))}</button></div>`;
}
function bindPO(V) {
  V.querySelectorAll('[data-po-recv]').forEach(b => b.onclick = () => {
    const p = Daira.get('purchaseOrders', b.dataset.poRecv);
    if (!p || p.status === 'received') return;
    p.status = 'received';
    Daira.put('purchaseOrders', p);
    if (!p.expense_id) {
      const fin = Daira.put('financeOps', { id: 'fin_' + Date.now().toString(36), kind: 'cash', type: 'out',
        category: 'dépense', label: 'Achat: ' + p.vendor_name + ' — ' + p.po_code, amount: p.total,
        date: new Date().toISOString(), ref: p.po_code });
      p.expense_id = fin.id; Daira.put('purchaseOrders', p);
    }
    toast('✅'); render();
  });
  $('#po_go').onclick = () => {
    const vendor = $('#po_v').value.trim(), qty = Number($('#po_q').value), price = Number($('#po_p').value);
    if (!vendor || !(qty > 0) || !(price >= 0)) { toast(t('v_required'), true); return; }
    const code = 'BC-' + new Date().getFullYear() + '-' + String(Daira.scoped('purchaseOrders').length + 1).padStart(3, '0');
    const po = { id: 'po_' + Date.now().toString(36), po_code: code, vendor_name: vendor,
      vendor_type: $('#po_vt').value, material_id: $('#po_m').value, qty, unit: 'kg',
      unit_price: price, total: Daira.round2(qty * price), status: $('#po_s').value,
      date: ($('#po_d').value || new Date().toISOString().slice(0,10)) + 'T00:00:00Z', note: '' };
    Daira.put('purchaseOrders', po);
    if (po.status === 'received') {
      const fin = Daira.put('financeOps', { id: 'fin_' + Date.now().toString(36), kind: 'cash', type: 'out',
        category: 'dépense', label: 'Achat: ' + vendor + ' — ' + code, amount: po.total,
        date: new Date().toISOString(), ref: code });
      po.expense_id = fin.id; Daira.put('purchaseOrders', po);
    }
    toast('✅ ' + code); render();
  };
}

/* ---------------- production ---------------- */
function vProduction(V, args) {
  if (!guard('production.run')) return;
  const recipes = Daira.scoped('recipes');
  if (!recipes.length) { V.innerHTML = `<h1>🏭 ${esc(t('p_t'))}</h1><p class="muted">${esc(t('p_no_recipe'))}</p>`; return; }
  const rid = args[0] || recipes[0].id;
  const recipe = Daira.get('recipes', rid);
  const avail = Daira.scoped('rawBatches').filter(b => b.qty_remaining > 0 &&
    recipe.inputs.some(i => i.material_id === b.material_id));

  V.innerHTML = `<h1>🏭 ${esc(t('p_t'))}</h1>
  <div class="card"><label class="f">${esc(t('p_recipe'))}<select id="pr_r">${recipes.map(r=>`<option value="${r.id}" ${r.id===rid?'selected':''}>${esc(LANG==='fr'?r.name:r.name_ar||r.name)} (${esc(t('p_loss'))} ${r.loss_pct}%)</option>`).join('')}</select></label>
  <div class="muted">✓ ${esc(t('p_checkpoints'))}: ${(recipe.checkpoints||[]).join(' → ')}</div></div>
  <h2>${esc(t('p_inputs'))}</h2>
  ${avail.map(b=>`<div class="card" style="padding:.7rem"><label class="row between" style="font-weight:600">
    <span><input type="checkbox" class="pr_b" value="${b.id}" style="width:auto;margin:0 .5rem"> ${esc(b.batch_code)}<br><span class="muted">${esc(b.member_name)} · ${esc(b.material_name)}</span></span>
    <span class="badge info">${b.qty_remaining} ${esc(b.unit)}</span></label>
    <input type="number" class="pr_q" data-id="${b.id}" min="0" max="${b.qty_remaining}" step="0.1" placeholder="${esc(t('p_qty_use'))} (max ${b.qty_remaining})"></div>`).join('') || `<p class="muted">—</p>`}
  <button class="btn" id="pr_go">⚙️ ${esc(t('p_run'))}</button>
  <div id="pr_done"></div>
  <h2>${esc(t('p_runs'))}</h2>
  ${[...Daira.scoped('runs')].reverse().map(r=>`<div class="card"><div class="row between"><b>${esc(r.run_code)}</b><span class="badge ok">${esc(r.status)}</span></div>
    <div class="muted">${esc(r.recipe_name)} · ${fmtD(r.started_at)} · ${esc(t('p_loss'))} ${r.loss_pct}%</div>
    ${r.outputs.map(o=>`<div>📦 <b>${esc(o.lot_code)}</b> — ${o.qty}</div>`).join('')}</div>`).join('')}`;

  $('#pr_r').onchange = e => { location.hash = '#/production/' + e.target.value; };
  $('#pr_go').onclick = () => {
    try {
      const allocs = [];
      document.querySelectorAll('.pr_b:checked').forEach(cb => {
        const q = Number(document.querySelector(`.pr_q[data-id="${cb.value}"]`).value);
        if (q > 0) allocs.push({ rawBatchId: cb.value, qty: q });
      });
      if (!allocs.length) throw new Error(t('p_inputs') + ' !');
      const { run, lots } = Daira.runTransformation({ recipeId: rid, allocations: allocs });
      $('#pr_done').innerHTML = `<div class="card" style="border:2px solid var(--ok)"><div style="font-size:2rem;text-align:center">🏭✅</div>
        <div class="row between"><b>${esc(run.run_code)}</b><span class="badge warn">${esc(t('p_loss'))} ${run.loss_pct}%</span></div>
        <h2>${esc(t('p_outputs'))}</h2>${lots.map(l=>`<div class="row between"><span>📦 <b>${esc(l.lot_code)}</b><br><span class="muted">${esc(l.product_name)}</span></span><b>${l.qty_produced} ${esc(l.unit)}</b></div>`).join('')}
        <div class="muted">${esc(t('q_members'))}: ${esc(lots[0].source_members.join(', '))}</div></div>`;
      toast('✅ ' + run.run_code);
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- catalog: materials / products / recipes ---------------- */
function vCatalog(V, args) {
  if (!guard('recipe.manage')) return;
  const tab = args[0] || 'materials';
  const tabs = [['materials','cat_mat','🌿'],['products','cat_prod','🫙'],['recipes','cat_rec','📋'],['packaging','pkg_t','📦']];
  let body = `<h1>📦 ${esc(t('cat_t'))}</h1>
  <div class="row" style="margin-bottom:.8rem;flex-wrap:wrap">${tabs.map(([k,l,ico])=>`<a href="#/catalog/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none;min-width:90px">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'materials') body += vCatMaterials();
  if (tab === 'products') body += vCatProducts();
  if (tab === 'recipes') body += vCatRecipes();
  if (tab === 'packaging') body += vCatPackaging();
  V.innerHTML = body;
  bindCatalog(V, tab);
}
function catName(x) { return esc(LANG === 'fr' ? x.name : (x.name_ar || x.name)); }
function catDelBtn(col, id) { return `<button class="btn sm danger" data-delcol="${col}" data-delid="${id}">${esc(t('cat_del'))}</button>`; }

function vCatMaterials() {
  const ms = Daira.scoped('materials');
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('cat_name'))}</th><th>${esc(t('cat_unit'))}</th><th>${esc(t('cat_price'))}</th><th></th></tr>
    ${ms.map(m=>`<tr><td><b>${catName(m)}</b></td><td>${esc(m.unit)}</td><td>${m.base_price} MAD</td><td>${catDelBtn('materials', m.id)}</td></tr>`).join('')
    || `<tr><td colspan="4" class="muted">${esc(t('cat_empty'))}</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('cat_mat'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('cat_name'))}<input id="cm_n"></label>
    <label class="f">${esc(t('cat_name_ar'))}<input id="cm_na"></label></div>
    <div class="grid c2"><label class="f">${esc(t('cat_unit'))}<select id="cm_u"><option value="kg">kg</option><option value="L">L</option><option value="pièce">pièce</option></select></label>
    <label class="f">${esc(t('cat_price'))}<input id="cm_p" type="number" min="0" step="0.1"></label></div>
    <button class="btn" id="cm_go">${esc(t('cat_add'))}</button></div>`;
}

function vCatProducts() {
  const ps = Daira.scoped('products');
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('cat_name'))}</th><th>${esc(t('cat_sku'))}</th><th>${esc(t('cat_sale_price'))}</th><th></th></tr>
    ${ps.map(p=>`<tr><td><b>${catName(p)}</b><br><span class="muted">${esc(p.unit)}</span></td><td class="muted">${esc(p.sku||'—')}</td><td>${p.sale_price} MAD</td><td>${catDelBtn('products', p.id)}</td></tr>`).join('')
    || `<tr><td colspan="4" class="muted">${esc(t('cat_empty'))}</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('cat_prod'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('cat_name'))}<input id="cp_n"></label>
    <label class="f">${esc(t('cat_name_ar'))}<input id="cp_na"></label></div>
    <div class="grid c2"><label class="f">${esc(t('cat_sku'))}<input id="cp_sku"></label>
    <label class="f">${esc(t('cat_unit'))}<select id="cp_u"><option value="kg">kg</option><option value="L">L</option><option value="pièce">pièce</option></select></label></div>
    <label class="f">${esc(t('cat_sale_price'))}<input id="cp_p" type="number" min="0" step="0.1"></label>
    <button class="btn" id="cp_go">${esc(t('cat_add'))}</button></div>`;
}

function crRow(kind) {
  const items = kind === 'in' ? Daira.scoped('materials') : Daira.scoped('products');
  const cls = kind === 'in' ? 'cr-in' : 'cr-out';
  return `<div class="row ${cls}" style="margin-bottom:.4rem">
    <select class="${cls}-id" style="flex:2">${items.map(x=>`<option value="${x.id}">${catName(x)}</option>`).join('')}</select>
    <input class="${cls}-q" type="number" min="0" step="0.1" placeholder="${esc(t('cat_qty'))}" style="flex:1">
    <button class="btn sm danger cr-x" type="button">✕</button></div>`;
}
function vCatRecipes() {
  const rs = Daira.scoped('recipes');
  const mName = id => { const m = Daira.DB().materials[id]; return m ? catName(m) : '?'; };
  const pName = id => { const p = Daira.DB().products[id]; return p ? catName(p) : '?'; };
  return rs.map(r=>`<div class="card"><div class="row between"><b>${catName(r)}</b><span class="badge warn">${esc(t('cat_loss'))}: ${r.loss_pct}%</span></div>
    <div class="muted">${esc(t('cat_inputs'))}: ${(r.inputs||[]).map(i=>mName(i.material_id)+' × '+i.qty_per_unit).join(' + ')}</div>
    <div class="muted">${esc(t('cat_outputs'))}: ${(r.outputs||[]).map(o=>pName(o.product_id)+' × '+o.per_input_unit).join(' + ')}</div>
    <div style="margin-top:.4rem">${catDelBtn('recipes', r.id)}</div></div>`).join('')
  + `<div class="card"><h2 style="margin-top:0">➕ ${esc(t('cat_rec'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('cat_name'))}<input id="cr_n"></label>
    <label class="f">${esc(t('cat_name_ar'))}<input id="cr_na"></label></div>
    <label class="f">${esc(t('cat_loss'))}<input id="cr_loss" type="number" min="0" max="100" value="5" step="0.1"></label>
    <h3 style="margin-bottom:.3rem">${esc(t('cat_inputs'))}</h3><div id="cr_ins"></div>
    <button class="btn sm ghost" id="cr_addin" type="button">${esc(t('cat_add_row'))}</button>
    <h3 style="margin-bottom:.3rem">${esc(t('cat_outputs'))}</h3><div id="cr_outs"></div>
    <button class="btn sm ghost" id="cr_addout" type="button">${esc(t('cat_add_row'))}</button>
    <label class="f" style="margin-top:.6rem">${esc(t('cat_checkpoints'))}<textarea id="cr_cp" rows="2"></textarea></label>
    <button class="btn" id="cr_go" style="margin-top:.6rem">${esc(t('cat_add'))}</button></div>`;
}

function vCatPackaging() {
  const pk = Daira.scoped('packaging');
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('fin_equip_name'))}</th><th>${esc(t('pkg_stock'))}</th><th>${esc(t('pkg_min'))}</th><th>${esc(t('fin_amount'))}</th><th></th></tr>
    ${pk.map(p=>`<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.unit)}</span></td>
      <td><span class="badge ${p.stock <= p.min_stock ? 'warn' : 'ok'}">${p.stock}</span>${p.stock <= p.min_stock ? ' ⚠️ ' + esc(t('pkg_low')) : ''}</td>
      <td>${p.min_stock}</td><td>${p.unit_cost} MAD</td>
      <td><button class="btn sm danger" data-delcol="packaging" data-delid="${p.id}">${esc(t('cat_del'))}</button></td></tr>`).join('')
    || `<tr><td colspan="5" class="muted">${esc(t('cat_empty'))}</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('pkg_t'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_equip_name'))}<input id="pk_n"></label>
    <label class="f">${esc(t('cat_unit'))}<select id="pk_u"><option value="pièce">pièce</option><option value="kg">kg</option><option value="L">L</option></select></label></div>
    <div class="grid c2"><label class="f">${esc(t('pkg_stock'))}<input id="pk_s" type="number" min="0" step="1"></label>
    <label class="f">${esc(t('pkg_min'))}<input id="pk_m" type="number" min="0" step="1" value="50"></label></div>
    <label class="f">${esc(t('fin_amount'))} / unité<input id="pk_c" type="number" min="0" step="0.1"></label>
    <button class="btn" id="pk_go">${esc(t('cat_add'))}</button></div>`;
}

function bindCatalog(V, tab) {
  V.querySelectorAll('[data-delcol]').forEach(b => b.onclick = () => {
    try { Daira.requirePerm('recipe.manage'); } catch (e) { toast(t('no_perm'), true); return; }
    const col = b.dataset.delcol, id = b.dataset.delid;
    const used = col === 'materials'
      ? Object.values(Daira.DB().recipes).some(r => r.tenant_id === Daira.activeTenantId() && (r.inputs||[]).some(i => i.material_id === id))
        || Daira.scoped('rawBatches').some(x => x.material_id === id)
      : col === 'products'
      ? Object.values(Daira.DB().recipes).some(r => r.tenant_id === Daira.activeTenantId() && (r.outputs||[]).some(o => o.product_id === id))
        || Daira.scoped('finishedLots').some(x => x.product_id === id)
      : false;
    if (used) { toast(t('cat_used'), true); return; }
    if (!confirm('OK?')) return;
    delete Daira.DB()[col][id];
    Daira.save(); render();
  });
  if (tab === 'materials') $('#cm_go').onclick = () => {
    const name = $('#cm_n').value.trim(); if (!name) { toast(t('v_required'), true); return; }
    Daira.put('materials', { id: 'mat_' + Date.now().toString(36), name, name_ar: $('#cm_na').value.trim(),
      unit: $('#cm_u').value, base_price: Number($('#cm_p').value) || 0 });
    toast('✅'); render();
  };
  if (tab === 'products') $('#cp_go').onclick = () => {
    const name = $('#cp_n').value.trim(); if (!name) { toast(t('v_required'), true); return; }
    Daira.put('products', { id: 'prd_' + Date.now().toString(36), name, name_ar: $('#cp_na').value.trim(),
      sku: $('#cp_sku').value.trim(), unit: $('#cp_u').value, sale_price: Number($('#cp_p').value) || 0 });
    toast('✅'); render();
  };
  if (tab === 'recipes') {
    $('#cr_addin').onclick = () => $('#cr_ins').insertAdjacentHTML('beforeend', crRow('in'));
    $('#cr_addout').onclick = () => $('#cr_outs').insertAdjacentHTML('beforeend', crRow('out'));
    V.addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('cr-x')) e.target.closest('.row').remove(); });
    $('#cr_ins').insertAdjacentHTML('beforeend', crRow('in'));
    $('#cr_outs').insertAdjacentHTML('beforeend', crRow('out'));
    $('#cr_go').onclick = () => {
      const name = $('#cr_n').value.trim(); if (!name) { toast(t('v_required'), true); return; }
      const inputs = [...V.querySelectorAll('.cr-in')].map(row => ({
        material_id: row.querySelector('.cr-in-id').value, qty_per_unit: Number(row.querySelector('.cr-in-q').value) || 0 })).filter(i => i.material_id && i.qty_per_unit > 0);
      const outputs = [...V.querySelectorAll('.cr-out')].map(row => ({
        product_id: row.querySelector('.cr-out-id').value, per_input_unit: Number(row.querySelector('.cr-out-q').value) || 0 })).filter(o => o.product_id && o.per_input_unit > 0);
      if (!inputs.length || !outputs.length) { toast(t('v_required'), true); return; }
      Daira.put('recipes', { id: 'rcp_' + Date.now().toString(36), name, name_ar: $('#cr_na').value.trim(),
        loss_pct: Number($('#cr_loss').value) || 0, inputs, outputs,
        checkpoints: $('#cr_cp').value.split('\n').map(s => s.trim()).filter(Boolean) });
      toast('✅'); render();
    };
  }
  if (tab === 'packaging') $('#pk_go').onclick = () => {
    const name = $('#pk_n').value.trim(); if (!name) { toast(t('v_required'), true); return; }
    Daira.put('packaging', { id: 'pkg_' + Date.now().toString(36), name, unit: $('#pk_u').value,
      stock: Number($('#pk_s').value) || 0, min_stock: Number($('#pk_m').value) || 0,
      unit_cost: Number($('#pk_c').value) || 0 });
    toast('✅'); render();
  };
}

/* ---------------- finance: journals / budget / funding / equipment / surplus 69 ---------------- */
function vFinance(V, args) {
  if (!guard('finance.manage')) return;
  const tab = args[0] || 'journal';
  const tabs = [['journal','fin_journal','📒'],['budget','fin_budget','📊'],['funding','fin_funding','🏦'],['equip','fin_equip','🧰'],['surplus','fin_surplus','⚖️']];
  let body = `<h1>📒 ${esc(t('fin_t'))}</h1>
  <div class="row" style="margin-bottom:.8rem;flex-wrap:wrap">${tabs.map(([k,l,ico])=>`<a href="#/finance/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none;min-width:90px">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'journal') body += vFinJournal(args[1] || 'cash');
  if (tab === 'budget') body += vFinBudget();
  if (tab === 'funding') body += vFinFunding();
  if (tab === 'equip') body += vFinEquip();
  if (tab === 'surplus') body += vFinSurplus();
  V.innerHTML = body;
  bindFinance(V, tab, args[1] || 'cash');
}
function finYearOps(y) {
  return Daira.scoped('financeOps').filter(f => String(f.date).startsWith(String(y)));
}
function vFinJournal(kind) {
  const kinds = [['cash','fin_cash','💵'],['bank','fin_bank','🏦'],['od','fin_od','📋']];
  const ops = Daira.scoped('financeOps').filter(f => f.kind === kind)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let bal = 0;
  const rows = ops.map(f => { bal += f.type === 'in' ? f.amount : -f.amount;
    return `<tr><td>${fmtD(f.date)}</td><td>${esc(f.label)}</td><td class="muted">${esc(f.ref||'')}</td>
    <td style="color:var(--ok)">${f.type==='in'?fmtM(f.amount):''}</td>
    <td style="color:var(--danger)">${f.type==='out'?fmtM(f.amount):''}</td>
    <td><b>${fmtM(bal)}</b></td></tr>`; }).join('');
  const totIn = ops.filter(f=>f.type==='in').reduce((s,f)=>s+f.amount,0);
  const totOut = ops.filter(f=>f.type==='out').reduce((s,f)=>s+f.amount,0);
  return `<div class="row" style="margin-bottom:.8rem">${kinds.map(([k,l,ico])=>`<a href="#/finance/journal/${k}" class="btn sm ${kind===k?'':'ghost'}" style="flex:1;text-decoration:none">${ico} ${esc(t(l))}</a>`).join('')}</div>
  <div class="grid c2" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><div class="n">${fmtM(totIn)}</div><div class="l">${esc(t('fin_total_in'))}</div></div>
    <div class="kpi"><div class="n">${fmtM(totOut)}</div><div class="l">${esc(t('fin_total_out'))}</div></div>
    <div class="kpi"><div class="n">${fmtM(bal)}</div><div class="l">${esc(t('fin_balance'))}</div></div>
  </div>
  <div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('fin_date'))}</th><th>${esc(t('fin_label'))}</th><th>Réf.</th><th>${esc(t('fin_in'))}</th><th>${esc(t('fin_out'))}</th><th>${esc(t('fin_balance'))}</th></tr>
    ${rows || `<tr><td colspan="6" class="muted">—</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('fin_journal'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_kind'))}<select id="fj_k"><option value="cash">${esc(t('fin_cash'))}</option><option value="bank">${esc(t('fin_bank'))}</option><option value="od">${esc(t('fin_od'))}</option></select></label>
    <label class="f">${esc(t('fin_status'))}<select id="fj_ty"><option value="in">${esc(t('fin_in'))}</option><option value="out">${esc(t('fin_out'))}</option></select></label></div>
    <label class="f">${esc(t('fin_label'))}<input id="fj_l"></label>
    <div class="grid c2"><label class="f">${esc(t('fin_amount'))}<input id="fj_a" type="number" min="0" step="0.1"></label>
    <label class="f">${esc(t('fin_date'))}<input id="fj_d" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div>
    <button class="btn" id="fj_go">${esc(t('save'))}</button></div>`;
}
function vFinBudget() {
  const y = new Date().getFullYear();
  const lines = Daira.scoped('budgets').filter(b => Number(b.year) === y);
  const s = Daira.computeSurplus(y);
  const plannedRev = lines.filter(l=>l.kind==='rev').reduce((a,l)=>a+l.planned,0);
  const plannedExp = lines.filter(l=>l.kind==='exp').reduce((a,l)=>a+l.planned,0);
  const actualRev = s.sales + s.otherIncome, actualExp = s.expenses;
  const row = (l) => `<tr><td>${esc(l.label)}</td><td>${l.kind==='rev'?esc(t('fin_in')):esc(t('fin_out'))}</td><td>${fmtM(l.planned)}</td><td>—</td><td>—</td></tr>`;
  return `<div class="card"><h2 style="margin-top:0">📊 ${esc(t('fin_budget'))} — ${y}</h2>
  <div class="grid c2" style="grid-template-columns:repeat(2,1fr)">
    <div class="kpi"><div class="n">${fmtM(plannedRev)}</div><div class="l">${esc(t('fin_planned'))} · ${esc(t('fin_in'))}</div><div class="muted">${esc(t('fin_actual'))}: ${fmtM(actualRev)} (${fmtM(actualRev-plannedRev)})</div></div>
    <div class="kpi"><div class="n">${fmtM(plannedExp)}</div><div class="l">${esc(t('fin_planned'))} · ${esc(t('fin_out'))}</div><div class="muted">${esc(t('fin_actual'))}: ${fmtM(actualExp)} (${fmtM(actualExp-plannedExp)})</div></div>
  </div></div>
  <div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('fin_label'))}</th><th>${esc(t('fin_kind'))}</th><th>${esc(t('fin_planned'))}</th><th>${esc(t('fin_actual'))}</th><th>${esc(t('fin_variance'))}</th></tr>
    ${lines.map(row).join('') || `<tr><td colspan="5" class="muted">—</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_label'))}<input id="fb_l"></label>
    <label class="f">${esc(t('fin_kind'))}<select id="fb_k"><option value="rev">${esc(t('fin_in'))}</option><option value="exp">${esc(t('fin_out'))}</option></select></label></div>
    <label class="f">${esc(t('fin_planned'))} (MAD)<input id="fb_p" type="number" min="0" step="1"></label>
    <button class="btn" id="fb_go">${esc(t('save'))}</button></div>`;
}
function vFinFunding() {
  const y = new Date().getFullYear();
  const caf = Daira.computeCAF(y);
  const loans = Daira.scoped('loans'), grants = Daira.scoped('grants');
  return `<div class="grid c2" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><div class="n">${fmtM(caf.net)}</div><div class="l">${esc(t('fin_net'))} ${y}</div></div>
    <div class="kpi"><div class="n">${fmtM(caf.depreciation)}</div><div class="l">${esc(t('fin_dep'))}</div></div>
    <div class="kpi"><div class="n">${fmtM(caf.caf)}</div><div class="l">${esc(t('fin_caf'))}</div></div>
  </div>
  <h2>🏦 ${esc(t('fin_loan'))}</h2>
  ${loans.map(l=>`<div class="card"><div class="row between"><b>${esc(l.lender)}</b><span class="badge info">${esc(l.status)}</span></div>
    <div class="muted">${fmtM(l.amount)} · ${l.rate}% · ${l.duration_months} mois · ${esc(t('fin_monthly'))} ${fmtM(l.monthly_payment||0)} · ${esc(t('fin_remaining'))} <b>${fmtM(l.remaining)}</b></div></div>`).join('') || '<p class="muted">—</p>'}
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('fin_loan'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_lender'))}<input id="fl_org" placeholder="Crédit Agricole…"></label>
    <label class="f">${esc(t('fin_amount'))}<input id="fl_a" type="number" min="0" step="1"></label></div>
    <div class="grid c2"><label class="f">${esc(t('fin_rate'))}<input id="fl_r" type="number" min="0" step="0.1"></label>
    <label class="f">${esc(t('fin_monthly'))}<input id="fl_m" type="number" min="0" step="1"></label></div>
    <label class="f">${esc(t('fin_remaining'))}<input id="fl_rem" type="number" min="0" step="1"></label>
    <button class="btn" id="fl_go">${esc(t('save'))}</button></div>
  <h2>🎁 ${esc(t('fin_grant'))}</h2>
  ${grants.map(g=>`<div class="card"><div class="row between"><b>${esc(g.program)}</b><span class="badge ${g.status==='received'?'ok':'warn'}">${esc(g.status)}</span></div>
    <div class="muted">${esc(g.source)} · ${esc(t('fin_requested'))} ${fmtM(g.amount_requested)} · ${esc(t('fin_received'))} ${fmtM(g.amount_received)}</div></div>`).join('') || '<p class="muted">—</p>'}
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('fin_grant'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_grant'))}<input id="fg_p" placeholder="INDH…"></label>
    <label class="f">${esc(t('fin_source'))}<input id="fg_s" placeholder="INDH / ADA / Région…"></label></div>
    <div class="grid c2"><label class="f">${esc(t('fin_requested'))}<input id="fg_rq" type="number" min="0" step="1"></label>
    <label class="f">${esc(t('fin_received'))}<input id="fg_rc" type="number" min="0" step="1"></label></div>
    <label class="f">${esc(t('fin_status'))}<select id="fg_st"><option value="applied">applied</option><option value="approved">approved</option><option value="received">received</option><option value="rejected">rejected</option></select></label>
    <button class="btn" id="fg_go">${esc(t('save'))}</button></div>`;
}
function vFinEquip() {
  const y = new Date().getFullYear();
  const eqs = Daira.scoped('equipment');
  const netVal = e => {
    const years = Math.max(0, y - new Date(e.acquired_at).getFullYear());
    return Math.max(0, Daira.round2(e.value * (1 - (e.dep_rate || 0) * years / 100)));
  };
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>${esc(t('fin_equip_name'))}</th><th>${esc(t('fin_acquired'))}</th><th>${esc(t('fin_value'))}</th><th>${esc(t('fin_dep_rate'))}</th><th>${esc(t('fin_net_value'))}</th></tr>
    ${eqs.map(e=>`<tr><td><b>${esc(e.name)}</b></td><td>${fmtD(e.acquired_at)}</td><td>${fmtM(e.value)}</td><td>${e.dep_rate}%</td><td><b>${fmtM(netVal(e))}</b></td></tr>`).join('') || `<tr><td colspan="5" class="muted">—</td></tr>`}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('fin_equip'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('fin_equip_name'))}<input id="fe_n"></label>
    <label class="f">${esc(t('fin_acquired'))}<input id="fe_d" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div>
    <div class="grid c2"><label class="f">${esc(t('fin_value'))}<input id="fe_v" type="number" min="0" step="1"></label>
    <label class="f">${esc(t('fin_dep_rate'))}<input id="fe_r" type="number" min="0" max="100" step="1" value="10"></label></div>
    <button class="btn" id="fe_go">${esc(t('save'))}</button></div>`;
}
function vFinSurplus() {
  const y = new Date().getFullYear();
  const s = Daira.computeSurplus(y);
  const capital = Daira.capitalSubscribed();
  const built = Daira.legalReserveBuilt();
  const room = Math.max(0, Daira.round2(capital - built));
  const last = [...Daira.scoped('dividendCampaigns')].reverse()[0];
  return `<div class="card"><h2 style="margin-top:0">⚖️ ${esc(t('fin_surplus_t'))} — ${y}</h2>
    <div class="row between"><span>Ventes</span><b>${fmtM(s.sales)}</b></div>
    <div class="row between"><span>${esc(t('fin_total_in'))} (hors ventes)</span><b>${fmtM(s.otherIncome)}</b></div>
    <div class="row between"><span>${esc(t('fin_total_out'))}</span><b>${fmtM(s.expenses)}</b></div>
    <div class="row between" style="font-size:1.15rem"><span>${esc(t('fin_net'))}</span><b>${fmtM(s.net)}</b></div>
    <div class="row between"><span>${esc(t('fin_capital'))}</span><b>${fmtM(capital)}</b></div>
    <div class="row between"><span>${esc(t('fin_legal_reserve'))} — ${esc(t('fin_reserve_room'))}</span><b>${fmtM(room)}</b></div>
  </div>
  <div class="card"><h2 style="margin-top:0">${esc(t('fin_surplus_t'))}</h2>
    <div class="grid c2">
      <label class="f">${esc(t('fin_special'))}<input id="fs_sp" type="number" min="0" max="100" value="5" step="1"></label>
      <label class="f">${esc(t('fin_training'))}<input id="fs_tr" type="number" min="0" max="100" value="5" step="1"></label>
    </div>
    <label class="f">${esc(t('fin_reinvest'))}<input id="fs_ri" type="number" min="0" max="100" value="10" step="1"></label>
    <p class="muted">10% ${esc(t('fin_legal_reserve'))} + 2% ${esc(t('fin_levy'))} — ${esc(t('fin_ristournes'))} = reste, ${esc(t('fin_ristournes'))}.</p>
    <button class="btn" id="fs_go">⚖️ ${esc(t('fin_run_wizard'))}</button>
    <div id="fs_done"></div>
  </div>
  ${last && last.legal_reserve !== undefined ? `<div class="card"><h2 style="margin-top:0">${esc(t('fin_surplus_t'))} — ${esc(last.season)}</h2>
    <div class="row between"><span>${esc(t('fin_net'))}</span><b>${fmtM(last.net_surplus)}</b></div>
    <div class="row between"><span>${esc(t('fin_legal_reserve'))}</span><b>${fmtM(last.legal_reserve)}</b></div>
    <div class="row between"><span>${esc(t('fin_levy'))}</span><b>${fmtM(last.levy_dev)}</b></div>
    <div class="row between"><span>${esc(t('fin_special'))}</span><b>${fmtM(last.special_reserve)}</b></div>
    <div class="row between"><span>${esc(t('fin_training'))}</span><b>${fmtM(last.training_fund)}</b></div>
    <div class="row between"><span>${esc(t('fin_reinvest'))}</span><b>${fmtM(last.reinvestment)}</b></div>
    <div class="row between"><span>${esc(t('fin_ristournes'))}</span><b>${fmtM(last.ristourne_total)}</b></div>
    <a class="btn ghost sm" href="#/dividends" style="text-decoration:none">${esc(t('nav_div'))} →</a></div>` : ''}`;
}
function bindFinance(V, tab, kind) {
  if (tab === 'journal') $('#fj_go').onclick = () => {
    const label = $('#fj_l').value.trim(), amount = Number($('#fj_a').value);
    if (!label || !(amount > 0)) { toast(t('v_required'), true); return; }
    Daira.put('financeOps', { id: 'fin_' + Date.now().toString(36), kind: $('#fj_k').value,
      type: $('#fj_ty').value, category: $('#fj_ty').value === 'in' ? 'recette' : 'dépense',
      label, amount, date: ($('#fj_d').value || new Date().toISOString().slice(0,10)) + 'T00:00:00Z',
      ref: 'JNL-' + new Date().getFullYear() + '-' + String(Daira.scoped('financeOps').length + 1).padStart(3, '0') });
    toast('✅'); render();
  };
  if (tab === 'budget') $('#fb_go').onclick = () => {
    const label = $('#fb_l').value.trim(), planned = Number($('#fb_p').value);
    if (!label || !(planned >= 0)) { toast(t('v_required'), true); return; }
    Daira.put('budgets', { id: 'bud_' + Date.now().toString(36), year: new Date().getFullYear(),
      label, kind: $('#fb_k').value, planned });
    toast('✅'); render();
  };
  if (tab === 'funding') {
    $('#fl_go').onclick = () => {
      const lender = $('#fl_org').value.trim(), amount = Number($('#fl_a').value);
      if (!lender || !(amount > 0)) { toast(t('v_required'), true); return; }
      Daira.put('loans', { id: 'loa_' + Date.now().toString(36), lender, amount,
        rate: Number($('#fl_r').value) || 0, monthly_payment: Number($('#fl_m').value) || 0,
        remaining: Number($('#fl_rem').value) || amount, duration_months: 36,
        start_date: new Date().toISOString(), status: 'en cours' });
      toast('✅'); render();
    };
    $('#fg_go').onclick = () => {
      const program = $('#fg_p').value.trim();
      if (!program) { toast(t('v_required'), true); return; }
      Daira.put('grants', { id: 'grn_' + Date.now().toString(36), program, source: $('#fg_s').value.trim(),
        amount_requested: Number($('#fg_rq').value) || 0, amount_received: Number($('#fg_rc').value) || 0,
        status: $('#fg_st').value, date: new Date().toISOString() });
      toast('✅'); render();
    };
  }
  if (tab === 'equip') $('#fe_go').onclick = () => {
    const name = $('#fe_n').value.trim(), value = Number($('#fe_v').value);
    if (!name || !(value > 0)) { toast(t('v_required'), true); return; }
    Daira.put('equipment', { id: 'eqp_' + Date.now().toString(36), name,
      acquired_at: ($('#fe_d').value || new Date().toISOString().slice(0,10)) + 'T00:00:00Z',
      value, dep_rate: Number($('#fe_r').value) || 0, status: 'actif' });
    toast('✅'); render();
  };
  if (tab === 'surplus') $('#fs_go').onclick = () => {
    try {
      const c = Daira.allocateSurplus69({ season: new Date().getFullYear(),
        specialPct: Number($('#fs_sp').value) || 0, trainingPct: Number($('#fs_tr').value) || 0,
        reinvestPct: Number($('#fs_ri').value) || 0 });
      toast('✅ ' + t('fin_ristournes') + ': ' + fmtM(c.ristourne_total));
      render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- actes officiels (Loi 112-12 / ODCO) ---------------- */
function vActes(V, args) {
  if (!guard('legal.manage')) return;
  const tab = args[0] || 'denom';
  const tabs = [['denom','act_denom','📝'],['statuts','act_statuts','📜'],['subs','act_subs','📋'],['shares','act_shares','🎫'],['greffe','act_greffe','🏛️'],['ag','act_ag','👥'],['register','act_register','📖']];
  let body = `<h1>⚖️ ${esc(t('act_t'))}</h1>
  <div class="row" style="margin-bottom:.8rem;flex-wrap:wrap">${tabs.map(([k,l,ico])=>`<a href="#/actes/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none;min-width:110px">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'denom') body += vActDenom();
  if (tab === 'statuts') body += vActStatuts();
  if (tab === 'subs') body += vActSubs();
  if (tab === 'shares') body += vActShares();
  if (tab === 'greffe') body += vActGreffe();
  if (tab === 'ag') body += vActAG();
  if (tab === 'register') body += vActRegister();
  V.innerHTML = body;
  bindActes(V, tab);
}
function vActDenom() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const nameRow = (n) => `<div class="grid c2"><label class="f">${esc(t('act_name'+n))} (ar)<input id="dn_a${n}" value="${n===1?esc(tn.name_ar||''):''}"></label>
    <label class="f">${esc(t('act_name'+n))} · ${esc(t('act_name_lat'))}<input id="dn_l${n}" value="${n===1?esc(tn.name||''):''}"></label></div>`;
  return `<div class="card"><h2 style="margin-top:0">📝 ${esc(t('act_denom'))}</h2>
    ${nameRow(1)}${nameRow(2)}${nameRow(3)}
    <div class="grid c2"><label class="f">${esc(t('ob_sector'))}<select id="dn_sec">${SECTORS.map(([fr,ar])=>`<option value="${fr}" ${tn.sector===fr?'selected':''}>${fr} / ${ar}</option>`).join('')}</select></label>
    <label class="f">${esc(t('ob_province'))}<input id="dn_prov" value="${esc(tn.province||'')}"></label></div>
    <div class="grid c2"><label class="f">${esc(t('act_applicant'))}<input id="dn_app" value="${esc(tn.adminName||'')}"></label>
    <label class="f">${esc(t('gm_cin'))}<input id="dn_cin" value="${esc(tn.cin||'')}"></label></div>
    <div class="grid c2"><label class="f">${esc(t('ob_phone'))}<input id="dn_ph" value="${esc(tn.phone||'')}"></label>
    <label class="f">${esc(t('ob_capital_lib'))}<input id="dn_cap" type="number" min="0" value="${esc(tn.capital_liberated||'')}"></label></div>
    <p class="muted">Min. 5 membres fondateurs — ${Daira.scoped('members').length} inscrits.</p>
    <button class="btn" id="dn_go">🖨️ ${esc(t('act_print'))}</button></div>`;
}
function vActStatuts() {
  return `<div class="card"><h2 style="margin-top:0">📜 ${esc(t('act_statuts'))}</h2>
    <label class="f">${esc(t('act_coop_type'))}<select id="st_ty">
      <option value="general">${esc(t('act_type_general'))}</option>
      <option value="housing">${esc(t('act_type_housing'))}</option>
      <option value="harmon">${esc(t('act_type_harmon'))}</option></select></label>
    <p class="muted">29 articles — modèle ODCO conforme à la Loi 112-12 (Dahir 1.14.189).</p>
    <button class="btn" id="st_go">🖨️ ${esc(t('act_print'))}</button></div>`;
}
function vActSubs() {
  const ms = Daira.scoped('members');
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const sv = tn.share_value || 100;
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>#</th><th>${esc(t('gm_lastname'))}</th><th>${esc(t('gm_cin'))}</th><th>${esc(t('act_shares_sub'))}</th><th>${esc(t('act_shares_paid'))}</th><th>${esc(t('fin_amount'))}</th></tr>
    ${ms.map(m=>`<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname||'')}</td><td>${esc(m.cin||'—')}</td><td>${m.shares||0}</td><td>${m.shares_paid||0}</td><td>${fmtM((m.shares_paid||0)*sv)}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">—</td></tr>`}</table></div>
  <button class="btn" id="sb_go">🖨️ ${esc(t('act_print'))}</button>`;
}
function vActShares() {
  const ms = Daira.scoped('members');
  return `<div class="card"><h2 style="margin-top:0">🎫 ${esc(t('act_share_cert'))}</h2>
    <label class="f">${esc(t('v_member'))}<select id="sc_m">${ms.map(m=>`<option value="${m.id}">${esc(m.name)} ${esc(m.firstname||'')} — ${m.shares||0} parts</option>`).join('')}</select></label>
    <button class="btn" id="sc_go">🖨️ ${esc(t('act_print'))}</button></div>`;
}
function vActGreffe() {
  return `<div class="card"><h2 style="margin-top:0">🏛️ ${esc(t('act_greffe'))} — Arrêté 1369.16</h2>
    <div class="grid c2"><label class="f">${esc(t('act_greffe_mod'))}<input id="gr_mod" placeholder="Nature de la modification…"></label>
    <label class="f">${esc(t('act_greffe_rad'))}<input id="gr_rad" placeholder="Motif de la radiation…"></label></div>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn" id="gr_imm">🖨️ ${esc(t('act_greffe_imm'))}</button>
      <button class="btn ghost" id="gr_mod_go">🖨️ ${esc(t('act_greffe_mod'))}</button>
      <button class="btn ghost" id="gr_rad_go">🖨️ ${esc(t('act_greffe_rad'))}</button>
    </div></div>`;
}
function vActAG() {
  const asms = Daira.scoped('assemblies');
  const ms = Daira.scoped('members');
  const px = Daira.scoped('proxies');
  return `<div class="card"><h2 style="margin-top:0">👥 ${esc(t('act_ag'))}</h2>
    <label class="f">${esc(t('g_assembly'))}<select id="ag_a">${asms.map(a=>`<option value="${a.id}">${esc(a.title)} — ${fmtD(a.held_at)}</option>`).join('')}</select></label>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn" id="ag_conv">🖨️ ${esc(t('act_ag_conv'))}</button>
      <button class="btn ghost" id="ag_att">🖨️ ${esc(t('act_ag_att'))}</button>
      <button class="btn ghost" id="ag_pv">🖨️ ${esc(t('act_ag_pv'))}</button>
    </div></div>
  <div class="card"><h2 style="margin-top:0">📝 ${esc(t('act_ag_proxy'))}</h2>
    ${px.map(p=>`<div class="row between"><span>${esc(p.member_name)} → <b>${esc(p.proxy_to)}</b> · ${fmtD(p.date)}</span></div>`).join('') || '<p class="muted">—</p>'}
    <div class="grid c2"><label class="f">${esc(t('v_member'))}<select id="px_m">${ms.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>
    <label class="f">${esc(t('act_applicant'))} (mandataire)<input id="px_to"></label></div>
    <button class="btn" id="px_go">${esc(t('save'))}</button>
    <button class="btn ghost" id="px_print" style="margin-top:.5rem">🖨️ ${esc(t('act_print'))}</button></div>`;
}
function vActRegister() {
  const ms = Daira.scoped('members');
  return `<div class="card" style="overflow-x:auto"><table>
    <tr><th>#</th><th>${esc(t('gm_lastname'))}</th><th>${esc(t('gm_cin'))}</th><th>${esc(t('gm_fonction'))}</th><th>${esc(t('act_shares_sub'))}</th><th>${esc(t('gm_status'))}</th></tr>
    ${ms.map(m=>`<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname||'')}</td><td>${esc(m.cin||'—')}</td><td>${m.fonction&&m.fonction!=='member'?esc(t('fo_'+m.fonction)):'—'}</td><td>${m.shares||0}</td><td>${esc(m.status)}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">—</td></tr>`}</table></div>
  <p class="muted">Art. 17 & 97 — Loi 112-12 : registre tenu à jour (adhésions, cessions, sorties).</p>
  <button class="btn" id="rg_go">🖨️ ${esc(t('act_print'))}</button>`;
}
function bindActes(V, tab) {
  if (tab === 'denom') $('#dn_go').onclick = () => printDenom();
  if (tab === 'statuts') $('#st_go').onclick = () => printStatuts($('#st_ty').value);
  if (tab === 'subs') $('#sb_go').onclick = () => printSubs();
  if (tab === 'shares') $('#sc_go').onclick = () => printShareCert($('#sc_m').value);
  if (tab === 'greffe') {
    $('#gr_imm').onclick = () => printGreffe('imm');
    $('#gr_mod_go').onclick = () => printGreffe('mod', $('#gr_mod').value);
    $('#gr_rad_go').onclick = () => printGreffe('rad', $('#gr_rad').value);
  }
  if (tab === 'ag') {
    $('#ag_conv').onclick = () => printConvocation($('#ag_a').value);
    $('#ag_att').onclick = () => printAttendance($('#ag_a').value);
    $('#ag_pv').onclick = () => printPV($('#ag_a').value);
    $('#px_go').onclick = () => {
      const mid = $('#px_m').value, to = $('#px_to').value.trim();
      if (!mid || !to) { toast(t('v_required'), true); return; }
      const m = Daira.get('members', mid);
      Daira.put('proxies', { id: 'prx_' + Date.now().toString(36), assembly_id: $('#ag_a').value,
        member_id: mid, member_name: m ? m.name : '', proxy_to: to, date: new Date().toISOString() });
      toast('✅'); render();
    };
    $('#px_print').onclick = () => printProxyForm();
  }
  if (tab === 'register') $('#rg_go').onclick = () => printRegister();
}

/* --- Actes print templates --- */
function printDenom() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const g = id => (document.getElementById(id) || {}).value || '';
  const ms = Daira.scoped('members').filter(m => m.status === 'active').slice(0, 8);
  const names = [1, 2, 3].map(n => ({ ar: g('dn_a' + n), lat: g('dn_l' + n) }));
  const html = `
  <div class="doc-head"><h1>طلب المصادقة على تسمية التعاونية</h1>
    <div class="sub">مكتب تنمية التعاون (ODCO) — القانون رقم 112-12</div></div>
  <h2>1 — التسميات المقترحة</h2>
  <table>${names.map((n, i) => `<tr><th>مقترح ${i + 1}</th><td>${esc(n.ar || '—')}</td><td class="ltr-field">${esc(n.lat || '—')}</td></tr>`).join('')}</table>
  <h2>2 — معلومات حول التعاونية</h2>
  <table>
    <tr><th>القطاع</th><td>${esc(g('dn_sec') || tn.sector || '—')}</td></tr>
    <tr><th>الإقليم</th><td>${esc(g('dn_prov') || tn.province || '—')}</td></tr>
    <tr><th>الغرض الرئيسي</th><td>${esc(tn.purpose || '—')}</td></tr>
    <tr><th>رأس المال المحرر</th><td>${fmtM(Number(g('dn_cap')) || tn.capital_liberated || 0)}</td></tr>
  </table>
  <h2>3 — الأعضاء الموقعون (5 على الأقل)</h2>
  <table><tr><th>الاسم الكامل</th><th>العنوان</th><th>وثيقة التعريف</th><th>التوقيع</th></tr>
  ${ms.map(m => `<tr><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>${esc(m.village || '—')}</td><td>${esc(m.cin || '—')}</td><td></td></tr>`).join('')}</table>
  <h2>4 — المودع</h2>
  <table>
    <tr><th>الاسم الكامل</th><td>${esc(g('dn_app') || tn.adminName || '—')}</td></tr>
    <tr><th>وثيقة التعريف</th><td>${esc(g('dn_cin') || tn.cin || '—')}</td></tr>
    <tr><th>الهاتف</th><td>${esc(g('dn_ph') || tn.phone || '—')}</td></tr>
  </table>
  <p class="muted">تبقى المصادقة على التسمية سارية المفعول لمدة ستين (60) يوما ابتداء من تاريخ إصدارها، قابلة للتجديد مرة واحدة لنفس المدة.</p>
  <div style="border:2px dashed #999;padding:12px;margin-top:16px">
    <b>${esc(t('act_receipt'))} — وصل الإيداع</b><br>
    <span class="muted">رقم الإيداع: ……………… · التاريخ: ${fmtD(new Date())} · ختم مكتب تنمية التعاون</span>
  </div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_denom'), html);
}
const STATUTS_ARTICLES = [
  ['التأسيس والتسمية', 'تأسست التعاونية المسماة أعلاه طبقا لأحكام القانون رقم 112-12 المتعلق بالتعاونيات، الصادر بتنفيذه الظهير الشريف رقم 1.14.189 بتاريخ 21 نونبر 2014.'],
  ['المقر', 'يوجد المقر الرسمي للتعاونية بالعنوان المبين أعلاه، ويمكن نقله بقرار من الجمع العام.'],
  ['المدة', 'حددت مدة التعاونية في 99 سنة ابتداء من تاريخ تسجيلها بالسجل المحلي للتعاونيات، قابلة للتجديد بقرار من الجمع العام الاستثنائي.'],
  ['الغرض', 'تهدف التعاونية إلى ممارسة النشاط المبين في الغرض الرئيسي لفائدة أعضائها، وفق مبادئ التعاون والتضامن.'],
  ['رأس المال', 'يتكون رأس المال المكتتب من حصص اسمية، قيمة كل حصة كما هي مبينة في لائحة المكتتبين، ويحرر نقدا أو عينا.'],
  ['الحصص', 'الحصص اسمية وغير قابلة للتجزئة، ولا يجوز التنازل عنها إلا وفق أحكام المواد 11 و12 و13 من القانون 112-12.'],
  ['تحرير الحصص', 'يحرر رأس المال المكتتب نقدا لدى مؤسسة بنكية مقابل شهادة، أو عينا بعد تقييم الحصص العينية من طرف خبير.'],
  ['الانخراط', 'الانخراط حر ومفتوح لكل شخص طبيعي أو اعتباري تتوفر فيه الشروط القانونية ويقبل أحكام هذا النظام الأساسي.'],
  ['حقوق وواجبات الأعضاء', 'لكل عضو صوت واحد مهما كان عدد حصصه، ويلتزم بالمشاركة في نشاط التعاونية واحترام قرارات أجهزتها.'],
  ['الاستقالة والفصل', 'يفقد العضو صفته بالاستقالة أو الوفاة أو الفصل بقرار من الجمع العام، وفق الشروط المنصوص عليها قانونا.'],
  ['الجمع العام', 'الجمع العام هو أعلى هيئة تقريرية في التعاونية، ويتكون من جميع الأعضاء.'],
  ['استدعاء الجمع العام', 'يستدعى الجمع العام برسالة مضمونة أو بأي وسيلة تثبت التوصل، خمسة عشر يوما على الأقل قبل تاريخ انعقاده.'],
  ['النصاب', 'لا يصح انعقاد الجمع العام العادي إلا بحضور نصف الأعضاء على الأقل، وإلا استدعي لجمع ثان يصح بمن حضر.'],
  ['مداولات الجمع العام', 'تتخذ قرارات الجمع العام بأغلبية أصوات الأعضاء الحاضرين أو الممثلين، ما لم ينص القانون على أغلبية خاصة.'],
  ['مجلس الإدارة', 'يسير التعاونية مجلس إدارة يتكون من أعضاء منتخبين من طرف الجمع العام لمدة ثلاث سنوات قابلة للتجديد.'],
  ['الرئيس', 'يمثل الرئيس التعاونية أمام الغير، ويسهر على تنفيذ قرارات الجمع العام ومجلس الإدارة.'],
  ['المسير', 'يعين مجلس الإدارة مسيرا يتولى التسيير اليومي للتعاونية تحت مراقبته.'],
  ['مراقب الحسابات', 'يعين الجمع العام مراقبا للحسابات يتولى مراقبة حسابات التعاونية وتقديم تقرير سنوي.'],
  ['السنة المالية', 'تبدأ السنة المالية في فاتح يناير وتنتهي في 31 دجنبر من كل سنة.'],
  ['الحسابات السنوية', 'يعد مجلس الإدارة الحسابات السنوية والجرد، ويعرضها على الجمع العام للمصادقة داخل ستة أشهر من اختتام السنة المالية.'],
  ['سندات الحصص', 'تسلم لكل عضو سندات حصص تثبت عدد الحصص المكتتبة والمحررة، طبقا للمادة 21 من القانون 112-12.'],
  ['الاحتياطي القانوني', 'يقتطع 10% من الفائض الصافي السنوي لفائدة الاحتياطي القانوني إلى أن يساوي رأس مال التعاونية.'],
  ['توزيع الفائض', 'يوزع الفائض الصافي وفق أحكام المادة 69 من القانون 112-12: الاحتياطي القانوني، رسم التنمية التعاونية (2%)، الاحتياطيات الخاصة، التكوين، إعادة الاستثمار، ثم المنح حسب العمليات المنجزة.'],
  ['صندوق التكوين', 'يخصص جزء من الفائض لتكوين الأعضاء وتحسين قدراتهم، بما فيها التكوين في الجودة والشهادات.'],
  ['مراقبة مكتب تنمية التعاون', 'تخضع التعاونية لمراقبة مكتب تنمية التعاون، وتلتزم بموافاته بالتقارير والوثائق القانونية.'],
  ['الاندماج', 'يجوز للتعاونية الاندماج مع تعاونية أخرى أو أكثر بقرار من الجمع العام الاستثنائي.'],
  ['الحل', 'تحل التعاونية بقرار من الجمع العام الاستثنائي أو بحكم قضائي، وفق أحكام القانون.'],
  ['التصفية', 'عند الحل، يعين الجمع العام مصفيا أو أكثر يتولون تصفية أموال التعاونية وتوزيع صافي الأصول.'],
  ['أحكام عامة', 'كل ما لم ينص عليه هذا النظام الأساسي يخضع لأحكام القانون رقم 112-12 والنصوص التنظيمية المتخذة لتطبيقه.'],
];
function printStatuts(type) {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const sv = tn.share_value || 100;
  const cap = Daira.capitalSubscribed();
  const titles = { general: 'النظام الأساسي النموذجي', housing: 'النظام الأساسي — تعاونية سكن', harmon: 'ملاءمة النظام الأساسي وفق القانون 112-12' };
  const html = `
  <div class="doc-head"><h1>${titles[type] || titles.general}</h1>
    <div class="sub">${esc(tn.name || '')} — ${esc(tn.name_ar || '')} · ${esc(tn.region || '')}${tn.province ? ' · ' + esc(tn.province) : ''}</div>
    <div class="sub">القانون رقم 112-12 · الظهير الشريف 1.14.189 (21 نونبر 2014)${type === 'harmon' ? ' · الجمع العام الاستثنائي للملاءمة' : ''}</div></div>
  <table>
    <tr><th>التسمية</th><td>${esc(tn.name_ar || tn.name || '—')}</td></tr>
    <tr><th>المقر</th><td>${esc(tn.region || '—')}</td></tr>
    <tr><th>القطاع / الصنف</th><td>${esc(tn.sector || '—')} · ${tn.category ? 'صنف ' + esc(tn.category) : '—'}</td></tr>
    <tr><th>رأس المال المكتتب</th><td>${fmtM(cap)} (${fmtM(sv)} / حصة)</td></tr>
  </table>
  ${STATUTS_ARTICLES.map(([ti, body], i) => `<h2>المادة ${i + 1} — ${ti}</h2><p>${body}</p>`).join('')}
  <div class="sig"><div>توقيع الرئيس<br><br><br></div><div>توقيع الكاتب العام<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_statuts'), html);
}
function printSubs() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const ms = Daira.scoped('members');
  const sv = tn.share_value || 100;
  const total = ms.reduce((s, m) => s + (Number(m.shares_paid) || 0) * sv, 0);
  const html = `
  <div class="doc-head"><h1>لائحة الأعضاء المكتتبين</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')} · المادة 11 — القانون 112-12</div></div>
  <table><tr><th>#</th><th>الاسم الكامل</th><th>بطاقة التعريف</th><th>حصص مكتتبة</th><th>حصص محررة</th><th>المبلغ (درهم)</th></tr>
  ${ms.map(m => `<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>${esc(m.cin || '—')}</td><td>${m.shares || 0}</td><td>${m.shares_paid || 0}</td><td>${fmtM((m.shares_paid || 0) * sv)}</td></tr>`).join('')}</table>
  <div class="row2"><b>مجموع رأس المال المحرر: ${fmtM(total)}</b><span>عدد الأعضاء: ${ms.length}</span></div>
  <p>${esc(t('act_certify'))}.</p>
  <div class="sig"><div>الرئيس<br><br><br></div><div>المسير<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_subs'), html);
}
function printShareCert(memberId) {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const m = Daira.get('members', memberId);
  if (!m) return;
  const sv = tn.share_value || 100;
  const html = `
  <div class="doc-head"><h1>سند الحصص — المادة 21</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')} · ${esc(tn.region || '')}</div></div>
  <table>
    <tr><th>صاحب السند</th><td>${esc(m.name)} ${esc(m.firstname || '')}</td></tr>
    <tr><th>بطاقة التعريف</th><td>${esc(m.cin || '—')}</td></tr>
    <tr><th>رقم العضو</th><td>${esc(m.code)}</td></tr>
    <tr><th>عدد الحصص المكتتبة</th><td>${m.shares || 0}</td></tr>
    <tr><th>عدد الحصص المحررة</th><td>${m.shares_paid || 0}</td></tr>
    <tr><th>القيمة الاسمية للحصة</th><td>${fmtM(sv)}</td></tr>
    <tr><th>القيمة الإجمالية</th><td><b>${fmtM((m.shares_paid || 0) * sv)}</b></td></tr>
    <tr><th>تاريخ الانخراط</th><td>${fmtD(m.joined_at)}</td></tr>
  </table>
  <p class="muted">هذا السند غير قابل للتداول إلا وفق أحكام المواد 11 و12 و13 من القانون 112-12.</p>
  <div class="sig"><div>الرئيس<br><br><br></div><div>ختم التعاونية<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_share_cert'), html);
}
function greffeBody(kind, extra) {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const ms = Daira.scoped('members');
  const bureau = ms.filter(m => m.fonction && m.fonction !== 'member');
  const titles = { imm: 'طلب التسجيل بالسجل المحلي للتعاونيات', mod: 'التقييد المعدل', rad: 'طلب التشطيب من السجل المحلي' };
  return `
  <div class="doc-head"><h1>${titles[kind]}</h1>
    <div class="sub">المملكة المغربية — وزارة العدل · المحكمة الابتدائية · كتابة الضبط — المرسوم 2.15.617 / القرار 1369.16</div></div>
  <p>إلى السيد(ة) رئيس(ة) كتابة الضبط بالمحكمة الابتدائية،</p>
  <table>
    <tr><th>التسمية</th><td>${esc(tn.name_ar || tn.name || '—')}</td></tr>
    <tr><th>المقر</th><td>${esc(tn.region || '—')}${tn.province ? ' · ' + esc(tn.province) : ''}</td></tr>
    <tr><th>القطاع / الصنف</th><td>${esc(tn.sector || '—')} · ${tn.category ? 'صنف ' + esc(tn.category) : '—'}</td></tr>
    <tr><th>شهادة التسمية (ODCO)</th><td>${tn.denom_cert_date ? fmtD(tn.denom_cert_date) : '—'}</td></tr>
    <tr><th>رأس المال</th><td>${fmtM(Daira.capitalSubscribed())}</td></tr>
    ${kind === 'mod' ? `<tr><th>التعديل</th><td>${esc(extra || '—')}</td></tr>` : ''}
    ${kind === 'rad' ? `<tr><th>سبب التشطيب</th><td>${esc(extra || '—')}</td></tr>` : ''}
  </table>
  <h2>أعضاء أجهزة الإدارة والتسيير</h2>
  <table><tr><th>الاسم الكامل</th><th>الجنسية</th><th>وثيقة التعريف</th><th>الصفة</th><th>العنوان</th></tr>
  ${bureau.map(m => `<tr><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>مغربية</td><td>${esc(m.cin || '—')}</td><td>${esc(t('fo_' + m.fonction))}</td><td>${esc(m.village || '—')}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">—</td></tr>`}</table>
  <h2>الوثائق المرفقة (3 نسخ)</h2>
  <p>النظام الأساسي موقع · لائحة الأعضاء · نسخ بطائق التعريف · الشهادة البنكية · وصل السلطة الإدارية · شهادة التسمية · محضر تقييم الحصص العينية.</p>
  <div class="sig"><div>توقيع المودع<br><br><br></div><div>ختم كتابة الضبط<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
}
function printGreffe(kind, extra) { printDoc(t('act_greffe'), greffeBody(kind, extra)); }
function printConvocation(asmId) {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const a = Daira.get('assemblies', asmId);
  if (!a) return;
  const html = `
  <div class="doc-head"><h1>استدعاء الجمع العام</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')}</div></div>
  <p>إلى السيد(ة) العضو(ة)،</p>
  <p>يشرفني أن أدعوكم لحضور ${esc(a.title)} المزمع انعقاده يوم <b>${fmtD(a.held_at)}</b> بمقر التعاونية (${esc(tn.region || '')}).</p>
  <h2>جدول الأعمال</h2>
  <ol>${(a.decisions || []).map(d => `<li>${esc(d)}</li>`).join('') || '<li>المصادقة على التقرير السنوي</li>'}</ol>
  <p class="muted">في حالة تعذر الحضور، يمكن توكيل عضو آخر بموجب وكالة مكتوبة (المادة 39).</p>
  <div class="sig"><div>الرئيس<br><br><br></div><div>ختم التعاونية<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_ag_conv'), html);
}
function printAttendance(asmId) {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const a = Daira.get('assemblies', asmId);
  const ms = Daira.scoped('members');
  const att = new Set(a ? (a.attendees || []) : []);
  const html = `
  <div class="doc-head"><h1>ورقة الحضور — المادة 45</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')} · ${a ? esc(a.title) + ' — ' + fmtD(a.held_at) : ''}</div></div>
  <table><tr><th>#</th><th>الاسم الكامل</th><th>بطاقة التعريف</th><th>الحضور</th><th>التوقيع</th></tr>
  ${ms.map(m => `<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>${esc(m.cin || '—')}</td><td>${att.has(m.name) ? 'حاضر' : 'غائب'}</td><td></td></tr>`).join('')}</table>
  <div class="row2"><span>الحاضرون: ${att.size} / ${ms.length}</span><span>الوكالات: ${Daira.scoped('proxies').length}</span></div>
  <div class="sig"><div>الرئيس<br><br><br></div><div>الكاتب العام<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_ag_att'), html);
}
function printProxyForm() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const px = Daira.scoped('proxies');
  const html = `
  <div class="doc-head"><h1>وكالة — المادة 39</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')}</div></div>
  <p>أنا الموقع(ة) أسفله، عضو(ة) بالتعاونية، أوكل بموجب هذه الوكالة السيد(ة) المذكور(ة) أدناه لتمثيلي والتصويت باسمي في الجمع العام.</p>
  <table><tr><th>الموكل(ة)</th><th>الوكيل(ة)</th><th>التاريخ</th></tr>
  ${px.map(p => `<tr><td>${esc(p.member_name)}</td><td>${esc(p.proxy_to)}</td><td>${fmtD(p.date)}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">—</td></tr>`}</table>
  <div class="sig"><div>توقيع الموكل(ة)<br><br><br></div><div>توقيع الوكيل(ة)<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_ag_proxy'), html);
}
function printRegister() {
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const ms = Daira.scoped('members');
  const sv = tn.share_value || 100;
  const html = `
  <div class="doc-head"><h1>سجل الأعضاء — المادتان 17 و97</h1>
    <div class="sub">${esc(tn.name_ar || tn.name || '')} · القانون 112-12</div></div>
  <table><tr><th>#</th><th>الاسم الكامل</th><th>بطاقة التعريف</th><th>الهاتف</th><th>الصفة</th><th>حصص</th><th>تاريخ الانخراط</th><th>الحالة</th></tr>
  ${ms.map(m => `<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>${esc(m.cin || '—')}</td><td>${esc(m.phone || '—')}</td><td>${m.fonction && m.fonction !== 'member' ? esc(t('fo_' + m.fonction)) : '—'}</td><td>${m.shares || 0}</td><td>${fmtD(m.joined_at)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>
  <p class="muted">يسجل في هذا السجل كل انخراط جديد، كل تفويت للحصص، وكل خروج من التعاونية، مع تاريخه.</p>
  <div class="sig"><div>الرئيس<br><br><br></div><div>ختم التعاونية<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('act_register'), html);
}

/* ---------------- stock & POS ---------------- */
const CART = {};
function vStock(V, args) {
  if (!guard('sale.create')) return;
  const tab = args[0] || 'pos';
  const tabs = [['pos','s_pos','🧾'],['inv','s_inv','📦'],['sales','s_sales','🧮']];
  let body = `<div class="row" style="margin-bottom:.8rem">${tabs.map(([k,l,ico])=>`<a href="#/stock/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'pos') body += vPOS();
  if (tab === 'inv') body += vInventory();
  if (tab === 'sales') body += vSalesList();
  V.innerHTML = `<h1>💰 ${esc(t('s_t'))}</h1>${body}
    <div class="muted" style="text-align:center;margin-top:.6rem">${navigator.onLine?'🟢 '+esc(t('s_sync')):'🟠 '+esc(t('s_offline'))}</div>`;
  if (tab === 'pos') bindPOS(V);
  if (tab === 'inv') bindInv(V);
}

function vPOS() {
  const lots = Daira.scoped('finishedLots').filter(l => l.qty_available > 0);
  return `<div class="pos-grid">${lots.map(l=>{ const p = Daira.get('products', l.product_id);
    return `<div class="pos-item" data-lot="${l.id}"><div style="font-size:1.8rem">🫙</div><b>${esc(l.product_name)}</b><div class="pr">${p?p.sale_price:0} MAD</div><div class="muted">${Math.round(l.qty_available)} ${esc(l.unit)}</div></div>`;}).join('')}</div>
  <div class="card" style="margin-top:.8rem"><h2 style="margin-top:0">🧾</h2><div id="cart"></div>
  <div class="row between" style="font-size:1.2rem;font-weight:800"><span>${esc(t('s_total'))}</span><span id="cartTot">0 MAD</span></div>
  <label class="f" style="margin-top:.6rem">${esc(t('fin_kind'))}<select id="cartCh">
    <option value="POS">${esc(t('ch_pos'))}</option><option value="local">${esc(t('ch_local'))}</option>
    <option value="fair">${esc(t('ch_fair'))}</option><option value="shop">${esc(t('ch_shop'))}</option>
    <option value="social">${esc(t('ch_social'))}</option><option value="ecom">${esc(t('ch_ecom'))}</option>
    <option value="b2b">${esc(t('ch_b2b'))}</option></select></label>
  <div class="grid c2" style="margin-top:.6rem">
    <button class="btn ghost" id="cartClear">🗑️</button>
    <button class="btn" id="cartPay">💵 ${esc(t('s_pay_cash'))}</button></div></div>`;
}
function drawCart() {
  const el = $('#cart'); if (!el) return;
  const ids = Object.keys(CART).filter(id => CART[id] > 0);
  if (!ids.length) { el.innerHTML = `<p class="muted">${esc(t('s_empty'))}</p>`; $('#cartTot').textContent = '0 MAD'; return; }
  let tot = 0;
  el.innerHTML = ids.map(id => { const l = Daira.get('finishedLots', id); const p = Daira.get('products', l.product_id);
    const lt = Daira.round2(CART[id] * p.sale_price); tot += lt;
    return `<div class="cart-line"><div><b>${esc(l.product_name)}</b><br><span class="muted">${p.sale_price} MAD</span></div>
    <div class="qty-ctl"><button data-a="m" data-id="${id}">−</button><b>${CART[id]}</b><button data-a="p" data-id="${id}">+</button></div>
    <b>${lt} MAD</b></div>`; }).join('');
  $('#cartTot').textContent = Daira.round2(tot) + ' MAD';
  el.querySelectorAll('button').forEach(b => b.onclick = () => {
    const id = b.dataset.id; const l = Daira.get('finishedLots', id);
    CART[id] = Math.max(0, Math.min(l.qty_available, (CART[id]||0) + (b.dataset.a==='p'?1:-1)));
    if (!CART[id]) delete CART[id]; drawCart();
  });
}
function bindPOS(V) {
  V.querySelectorAll('.pos-item').forEach(el => el.onclick = () => {
    const l = Daira.get('finishedLots', el.dataset.lot);
    CART[el.dataset.lot] = Math.min(l.qty_available, (CART[el.dataset.lot]||0) + 1); drawCart();
  });
  drawCart();
  $('#cartClear').onclick = () => { Object.keys(CART).forEach(k=>delete CART[k]); drawCart(); };
  $('#cartPay').onclick = () => {
    const items = Object.keys(CART).map(id => ({ lotId: id, qty: CART[id] }));
    if (!items.length) { toast(t('s_empty'), true); return; }
    try {
      const { sale, duplicate } = Daira.createSale({ items, channel: ($('#cartCh') || {}).value || 'POS', payment: 'CASH',
        idempotencyKey: 'pos_' + Date.now() });
      Object.keys(CART).forEach(k=>delete CART[k]);
      toast('✅ ' + t('s_sold') + ' — ' + sale.sale_code + (duplicate?' (dup)':'') + ' · ' + sale.total + ' MAD');
      render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}
function vInventory() {
  const lots = Daira.scoped('finishedLots');
  return lots.map(l=>`<div class="card" style="padding:.7rem"><div class="row between">
    <div><b>${esc(l.product_name)}</b><br><span class="muted">${esc(l.lot_code)} · ${fmtD(l.produced_at)}</span></div>
    <span class="badge ${l.qty_available<15?'warn':'ok'}">${Math.round(l.qty_available)} ${esc(l.unit)}</span></div>
    <div class="row" style="margin-top:.4rem"><input id="adj_${l.id}" type="number" step="1" placeholder="+/-" style="max-width:110px;margin:0">
    <input id="adjr_${l.id}" placeholder="${esc(t('s_reason'))}" style="margin:0"><button class="btn sm" data-adj="${l.id}">${esc(t('s_adjust'))}</button></div></div>`).join('')
    || `<p class="muted">—</p>`;
}
function bindInv(V) {
  V.querySelectorAll('[data-adj]').forEach(b => b.onclick = () => {
    const id = b.dataset.adj;
    try { Daira.adjustInventory(id, $('#adj_'+id).value, $('#adjr_'+id).value); toast('✅'); render(); }
    catch (e) { toast(t('err') + ': ' + e.message, true); }
  });
}
function vSalesList() {
  const sales = [...Daira.scoped('sales')].reverse();
  const chLabel = c => ({ POS: t('ch_pos'), local: t('ch_local'), fair: t('ch_fair'), shop: t('ch_shop'), social: t('ch_social'), ecom: t('ch_ecom'), b2b: t('ch_b2b') }[c] || c);
  const byCh = {};
  sales.forEach(s => { byCh[s.channel] = (byCh[s.channel] || 0) + s.total; });
  const badges = Object.entries(byCh).map(([c, tot]) =>
    '<span class="badge info" style="margin:.2rem">' + esc(chLabel(c)) + ': <b>' + fmtM(tot) + '</b></span>').join('') || '<span class="muted">—</span>';
  const cards = sales.map(s => {
    const items = s.items.map(i => '<div>· ' + i.qty + '× ' + esc(i.product_name) + ' — ' + i.line_total + ' MAD</div>').join('');
    return '<div class="card" style="padding:.7rem">'
      + '<div class="row between"><b>' + esc(s.sale_code) + '</b><span class="badge ' + (s.status === 'paid' ? 'ok' : 'warn') + '">' + esc(s.status) + '</span></div>'
      + '<div class="muted">' + esc(chLabel(s.channel)) + ' · ' + esc(s.payment) + ' · ' + fmtD(s.created_at) + ' · ' + esc(s.created_by) + '</div>'
      + items
      + '<div class="row between" style="font-weight:800"><span>' + esc(t('s_total')) + '</span><span>' + s.total + ' MAD</span></div></div>';
  }).join('') || '<p class="muted">—</p>';
  return '<div class="card"><div class="row" style="flex-wrap:wrap">' + badges + '</div></div>' + cards;
}

/* ---------------- certifications ---------------- */
function vCerts(V) {
  if (!guard('cert.manage')) return;
  const certs = Daira.scoped('certifications');
  const now = Date.now();
  const badge = c => {
    const exp = new Date(c.expires_at).getTime();
    if (exp < now) return `<span class="badge bad">${esc(t('c_expired'))}</span>`;
    if (exp - now < 60*864e5) return `<span class="badge warn">${esc(t('c_soon'))}</span>`;
    return `<span class="badge ok">${esc(t('c_valid'))}</span>`;
  };
  V.innerHTML = `<h1>📜 ${esc(t('c_t'))}</h1>
  ${certs.map(c=>`<div class="card"><div class="row between"><div><b>${esc(c.type)}</b> — ${esc(c.label||'')}<br>
    <span class="muted">${esc(t('c_ref'))}: ${esc(c.ref_number)} · ${esc(t('c_exp'))} ${fmtD(c.expires_at)}</span></div>${badge(c)}</div></div>`).join('')}
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('c_add'))}</h2>
    <div class="grid c2">
      <label class="f">${esc(t('c_type'))}<select id="c_ty"><option>ONSSA</option><option>AOP</option><option>IGP</option><option>BIO</option><option>FAIR</option></select></label>
      <label class="f">${esc(t('c_ref'))}<input id="c_rf"></label></div>
    <label class="f">Label<input id="c_lb"></label>
    <label class="f">${esc(t('c_exp'))}<input id="c_ex" type="date"></label>
    <button class="btn" id="c_go">${esc(t('c_save'))}</button></div>`;
  $('#c_go').onclick = () => {
    try {
      Daira.requirePerm('cert.manage');
      Daira.put('certifications', { id: 'crt_' + Date.now().toString(36), type: $('#c_ty').value,
        ref_number: $('#c_rf').value.trim(), label: $('#c_lb').value.trim(),
        issued_at: new Date().toISOString(), expires_at: new Date($('#c_ex').value || Date.now()).toISOString(),
        status: 'valid', file_ref: '' });
      toast('✅'); render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- print: affiche passeport QR ---------------- */
function printAffiche(lotId) {
  let pp;
  try { pp = Daira.buildPassport(lotId); } catch (e) { toast(t('err'), true); return; }
  let svg = '';
  try { const qr = qrcode(0, 'M'); qr.addData(pp.verify_url); qr.make(); svg = qr.createSvgTag({ scalable: true }); } catch (e) {}
  const html = `
  <div class="doc-head"><h1>🌿 ${esc(pp.tenant.name)}</h1>
    <div class="sub">${esc(pp.tenant.name_ar)} · ${esc(pp.tenant.region)}</div>
    <h1 style="font-size:17px;margin-top:8px">${esc(t('pr_affiche_t'))}</h1></div>
  <div class="qr">${svg}</div>
  <p style="text-align:center" class="muted">${esc(t('q_scan'))}</p>
  <table>
    <tr><th style="width:45%">Produit</th><td><b>${esc(pp.lot.product)}</b></td></tr>
    <tr><th>Lot</th><td>${esc(pp.lot.code)}</td></tr>
    <tr><th>Produit le</th><td>${fmtD(pp.lot.produced_at)}</td></tr>
    <tr><th>Terroir / région</th><td>${esc(pp.tenant.region)}</td></tr>
    <tr><th>Contributeurs</th><td>${pp.members.map(esc).join(', ')}</td></tr>
    <tr><th>Certifications</th><td>${pp.certifications.map(c => esc(c.type)).join(' · ') || '—'}</td></tr>
  </table>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('pr_affiche_t'), html);
}

/* ---------------- passport / QR ---------------- */
function drawQR(elId, text) {
  const el = document.getElementById(elId); if (!el) return;
  el.innerHTML = '';
  try { const qr = qrcode(0, 'M'); qr.addData(text); qr.make(); el.innerHTML = qr.createSvgTag({ scalable: true }); }
  catch (e) { el.innerHTML = `<p class="muted" style="word-break:break-all">${esc(text)}</p>`; }
}

function vPassport(V, args) {
  if (!guard('passport.generate')) return;
  const lots = Daira.scoped('finishedLots');
  const lotId = args[0] || (lots[0] && lots[0].id);
  V.innerHTML = `<h1>🔳 ${esc(t('q_t'))}</h1>
  <div class="card"><label class="f">${esc(t('q_pick'))}<select id="q_l">${lots.map(l=>`<option value="${l.id}" ${l.id===lotId?'selected':''}>${esc(l.lot_code)} — ${esc(l.product_name)}</option>`).join('')}</select></label>
  <button class="btn" id="q_go">${esc(t('q_gen'))}</button></div><div id="q_out"></div>`;
  $('#q_l').onchange = e => { location.hash = '#/passport/' + e.target.value; };
  const show = () => {
    if (!lotId) return;
    const pp = Daira.buildPassport(lotId);
    $('#q_out').innerHTML = passportCard(pp, true, lotId);
    drawQR('qrbox', pp.verify_url);
  };
  $('#q_go').onclick = show; show();
}

function passportCard(pp, interactive, lotId) {
  return `<div class="passport card" style="padding:0">
    <div class="ph"><div style="font-size:2rem">🌿</div><b>${esc(pp.tenant.name)}</b><br><span>${esc(pp.tenant.name_ar)} · ${esc(pp.tenant.region)}</span></div>
    <div style="padding:1rem">
      <div class="row between"><div><b>${esc(pp.lot.product)}</b><br><span class="muted">${esc(pp.lot.code)} · ${esc(t('q_produced'))} ${fmtD(pp.lot.produced_at)}</span></div>
      ${interactive?'<span class="qr-wrap" style="padding:.4rem"><span id="qrbox" style="display:block;width:110px;height:110px"></span></span>':''}</div>
      <h2>👩‍🌾 ${esc(t('q_members'))}</h2>
      <div>${pp.members.map(m=>`<span class="badge info" style="margin:.15rem">${esc(m)}</span>`).join('')}</div>
      <div class="card" style="background:var(--brand-soft);margin-top:.8rem">
        <div class="row between"><span>${esc(t('q_fair'))}</span><b>${fmtM(pp.member_fair_value)}</b></div>
        <div class="bar" style="margin:.5rem 0"><i style="width:${Math.min(100,pp.fair_share_pct)}%"></i></div>
        <div class="muted">${pp.fair_share_pct}% ${esc(t('q_of_sale'))}</div></div>
      ${pp.certifications.length?`<h2>📜 ${esc(t('q_certs'))}</h2>${pp.certifications.map(c=>`<div>✅ <b>${esc(c.type)}</b> <span class="muted">${esc(c.ref)}</span></div>`).join('')}`:''}
      ${interactive?`<div class="row no-print" style="margin-top:.8rem">
      <button class="btn ghost" style="flex:1" onclick="window.print()">${esc(t('q_print'))}</button>
      <button class="btn ghost" style="flex:1" onclick="printAffiche('${lotId || ''}')">${esc(t('pr_affiche_t'))}</button></div>
      <p class="muted no-print">🔗 <span style="word-break:break-all">${esc(pp.verify_url)}</span><br>${esc(t('q_scan'))}</p>`:''}
    </div></div>`;
}

/* public passport — no session needed (read-only) */
function vPublicPassport(code, lotCode) {
  const V = $('#view');
  const DB = Daira.DB();
  const tn = Object.values(DB.tenants).find(x => x.code === code);
  const lot = tn && Object.values(DB.finishedLots).find(l => l.tenant_id === tn.id && l.lot_code === lotCode);
  if (!tn || !lot) {
    V.innerHTML = `<div class="card" style="text-align:center;margin-top:2rem"><div style="font-size:2.5rem">🔍</div>
      <h1>Daira</h1><p class="muted">Lot introuvable / الحصة غير موجودة</p><a href="#/">${esc(t('nav_home'))}</a></div>`;
    return;
  }
  const product = DB.products[lot.product_id];
  const run = lot.run_id && DB.runs[lot.run_id];
  let memberCost = 0; const shares = {};
  (run ? run.inputs : []).forEach(inp => { const b = DB.rawBatches[inp.raw_batch_id]; if (!b) return;
    const c = b.total_credit * (inp.qty / (run.total_input_qty || 1)); memberCost += c;
    shares[b.member_name] = Daira.round2((shares[b.member_name] || 0) + c); });
  const saleValue = Daira.round2(lot.qty_produced * (product ? product.sale_price : 0));
  const pp = { tenant: { name: tn.name, name_ar: tn.name_ar, region: tn.region },
    lot: { code: lot.lot_code, product: product ? product.name : lot.product_name, qty: lot.qty_produced, unit: lot.unit, produced_at: lot.produced_at },
    members: lot.source_members || [], member_fair_value: Daira.round2(memberCost),
    fair_share_pct: saleValue > 0 ? Daira.round2(memberCost / saleValue * 100) : 0,
    certifications: Object.values(DB.certifications).filter(c => c.tenant_id === tn.id && c.status === 'valid')
      .map(c => ({ type: c.type, ref: c.ref_number })) };
  V.innerHTML = passportCard(pp, false);
}

/* ---------------- governance ---------------- */
function vGov(V, args) {
  if (!guard('assembly.manage')) return;
  const tab = args[0] || 'members';
  const tabs = [['members','g_members','👥'],['assemblies','g_asm','🏛️'],['votes','g_votes','🗳️'],['odco','odco_t','📊']];
  let body = `<div class="row" style="margin-bottom:.8rem;flex-wrap:wrap">${tabs.map(([k,l,ico])=>`<a href="#/gov/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none;min-width:70px">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'members') body += vGovMembers();
  if (tab === 'assemblies') body += vGovAsm();
  if (tab === 'votes') body += vGovVotes();
  if (tab === 'odco') body += vGovOdco();
  V.innerHTML = `<h1>🏛️ ${esc(t('g_t'))}</h1>${body}`;
  bindGov(V, tab);
}
function memberStatusBadge(st) {
  if (st === 'pending') return `<span class="badge warn">${esc(t('st_pending'))}</span>`;
  if (st === 'left') return `<span class="badge neutral">${esc(t('st_left'))}</span>`;
  return `<span class="badge ok">${esc(t('st_active'))}</span>`;
}
function fonctionBadge(f) {
  if (!f || f === 'member') return `<span class="muted">${esc(t('fo_member'))}</span>`;
  const k = 'fo_' + ({ president: 'president', vp: 'vp', secretary: 'secretary', vsecretary: 'vsecretary', treasurer: 'treasurer', vtreasurer: 'vtreasurer', advisor: 'advisor' }[f] || 'member');
  return `<span class="badge info">${esc(t(k))}</span>`;
}
const FONCTIONS = ['member','president','vp','secretary','vsecretary','treasurer','vtreasurer','advisor'];
function vGovMembers() {
  const ms = Daira.scoped('members');
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const sv = tn.share_value || 100;
  return `<div class="card" style="overflow-x:auto"><table><tr><th>#</th><th>${esc(t('v_member'))}</th><th>${esc(t('gm_phone'))}</th><th></th></tr>
    ${ms.map(m=>`<tr><td>${esc(m.code)}</td><td><b>${esc(m.name)}</b> ${esc(m.firstname||'')}<br><span class="muted">${esc(m.village||'')} · ${esc(m.shares||0)} × ${sv} MAD</span><br>${fonctionBadge(m.fonction)}</td><td class="muted">${esc(m.phone||'—')}</td><td>${memberStatusBadge(m.status)}</td></tr>`).join('')}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('g_add_member'))}</h2>
    <div class="grid c2"><label class="f">${esc(t('gm_lastname'))}<input id="gm_n"></label>
    <label class="f">${esc(t('gm_firstname'))}<input id="gm_fn" placeholder="${esc(t('ph_firstname'))}"></label></div>
    <div class="grid c2"><label class="f">${esc(t('gm_cin'))}<input id="gm_cin"></label>
    <label class="f">${esc(t('gm_phone'))}<input id="gm_ph" placeholder="06…"></label></div>
    <div class="grid c2"><label class="f">${esc(t('gm_gender'))}<select id="gm_g"><option value="f">${esc(t('gender_f'))}</option><option value="m">${esc(t('gender_m'))}</option></select></label>
    <label class="f">${esc(t('gm_fonction'))}<select id="gm_f">${FONCTIONS.map(f=>`<option value="${f}">${esc(t('fo_'+f))}</option>`).join('')}</select></label></div>
    <div class="grid c2"><label class="f">${esc(t('gm_shares'))}<input id="gm_sh" type="number" value="1" min="0"></label>
    <label class="f">${esc(t('act_shares_paid'))}<input id="gm_sp" type="number" value="1" min="0"></label></div>
    <div class="grid c2"><label class="f">${esc(t('gm_joindate'))}<input id="gm_jd" type="date" value="${new Date().toISOString().slice(0,10)}"></label></div>
    <div class="grid c2"><label class="f">${esc(t('gm_status'))}<select id="gm_st"><option value="active">${esc(t('st_active'))}</option><option value="pending">${esc(t('st_pending'))}</option><option value="left">${esc(t('st_left'))}</option></select></label></div>
    <button class="btn" id="gm_go">${esc(t('save'))}</button></div>`;
}
function vGovAsm() {
  const as = [...Daira.scoped('assemblies')].reverse();
  return as.map(a=>`<div class="card"><div class="row between"><b>${esc(a.title)}</b><span class="badge ${a.status==='signed'?'ok':'warn'}">${esc(a.status)}</span></div>
    <div class="muted">${fmtD(a.held_at)} · PV ${esc(a.pv_ref||'—')} · 👥 ${a.attendees.length} ${esc(t('g_attendees'))}</div>
    <div><b>${esc(t('g_decisions'))}:</b><ul>${a.decisions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></div>
    <button class="btn sm ghost" onclick="printPV('${a.id}')" style="margin-top:.4rem">🖨️ ${esc(t('print_pv'))}</button></div>`).join('') +
  `<div class="card"><h2 style="margin-top:0">➕ ${esc(t('g_new_asm'))}</h2>
    <label class="f">${esc(t('ga_title'))}<input id="ga_t"></label>
    <label class="f">${esc(t('ga_date'))}<input id="ga_d" type="date"></label>
    <label class="f">${esc(t('g_attendees'))} (1/ligne)<textarea id="ga_a" rows="3"></textarea></label>
    <label class="f">${esc(t('g_decisions'))} (1/ligne)<textarea id="ga_dc" rows="3"></textarea></label>
    <button class="btn" id="ga_go">${esc(t('save'))}</button></div>`;
}
function vGovVotes() {
  const vs = [...Daira.scoped('votes')].reverse();
  return vs.map(v=>{ const tot = v.results.yes + v.results.no + v.results.abstain || 1;
    return `<div class="card"><b>🗳️ ${esc(LANG==='fr'?v.question:v.question_ar||v.question)}</b><br>
    <span class="badge ${v.status==='open'?'warn':'neutral'}">${esc(v.status==='open'?t('g_open'):t('g_close'))}</span>
    <div style="margin:.6rem 0"><div class="row between"><span>✅ ${esc(t('g_yes'))} ${v.results.yes}</span><span>${Math.round(v.results.yes/tot*100)}%</span></div><div class="bar"><i style="width:${v.results.yes/tot*100}%"></i></div></div>
    <div class="row between"><span>❌ ${esc(t('g_no'))} ${v.results.no}</span><span>⚪ ${esc(t('g_abs'))} ${v.results.abstain}</span></div>
    ${v.status==='open'?`<div class="grid c3" style="margin-top:.6rem">
      <button class="btn sm" data-v="${v.id}" data-c="yes">✅</button><button class="btn sm warn" data-v="${v.id}" data-c="no">❌</button><button class="btn sm ghost" data-v="${v.id}" data-c="abstain">⚪</button></div>
      <button class="btn sm danger" data-close="${v.id}" style="margin-top:.4rem">${esc(t('g_close'))}</button>`:''}</div>`;}).join('') +
  `<div class="card"><h2 style="margin-top:0">➕ ${esc(t('g_new_vote'))}</h2>
    <label class="f">Question (FR)<input id="gv_q"></label><label class="f">السؤال (AR)<input id="gv_qa"></label>
    <button class="btn" id="gv_go">${esc(t('g_open'))} 🗳️</button></div>`;
}
/* ---------------- print: PV d'AG ---------------- */
function printPV(asmId) {
  const a = Daira.get('assemblies', asmId); if (!a) return;
  const h = tenantHeader();
  const ms = Daira.scoped('members');
  const pct = ms.length ? Math.round(a.attendees.length / ms.length * 100) : 0;
  const html = `
  <div class="doc-head"><h1>🌿 ${esc(h.name)}</h1>
    <div class="sub">${esc(h.name_ar)} · N° ODCO: ${esc(h.odco)} · ${esc(h.region)}</div>
    <h1 style="font-size:17px;margin-top:8px">${esc(t('pr_pv_t'))}</h1>
    <div class="sub">${esc(a.title)} — ${esc(a.pv_ref || '')}</div></div>
  <table>
    <tr><th style="width:45%">Date / heure / lieu</th><td>${new Date(a.held_at).toLocaleString('fr-FR')} — ${esc(h.region)}</td></tr>
    <tr><th>Quorum constaté</th><td>${a.attendees.length} présents / ${ms.length} membres (${pct}%)</td></tr>
  </table>
  <h2>Ordre du jour & résolutions</h2>
  <ul>${a.decisions.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
  <h2>${esc(t('g_attendees'))} (${a.attendees.length}) — émargement</h2>
  <table><tr><th style="width:60%">${esc(t('gm_lastname'))}</th><th>${esc(t('pr_sign'))}</th></tr>
  ${a.attendees.map(n => `<tr><td>${esc(n)}</td><td></td></tr>`).join('')}</table>
  <div class="sig"><div>Le président<br><br><br></div><div>Le secrétaire<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('pr_pv_t'), html);
}

/* ---------------- ODCO compliance dashboard ---------------- */
/* Loi 112-12: denomination certificate valid 60 days from issuance (ODCO form) */
function denomValidity(tn) {
  if (!tn.denom_cert_date) return null;
  const issued = new Date(tn.denom_cert_date + 'T00:00:00');
  if (isNaN(issued)) return null;
  const left = 60 - Math.floor((Date.now() - issued.getTime()) / 864e5);
  return { left, expired: left < 0, until: new Date(issued.getTime() + 60 * 864e5).toISOString().slice(0, 10) };
}
const LEGAL_DOCS = ['doc_statuts','doc_members','doc_ids','doc_denom','doc_admin','doc_bank','doc_inkind'];
function toggleDoc(key) {
  try { Daira.requirePerm('assembly.manage'); } catch (e) { toast(t('no_perm'), true); return; }
  const tn = Daira.DB().tenants[Daira.activeTenantId()];
  if (!tn) return;
  tn.legal_docs = tn.legal_docs || {};
  tn.legal_docs[key] = !tn.legal_docs[key];
  Daira.save(); render();
}
function vGovOdco() {
  const ms = Daira.scoped('members');
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const nM = ms.filter(m => m.gender === 'm').length, nF = ms.filter(m => m.gender !== 'm').length;
  const asms = [...Daira.scoped('assemblies')].reverse();
  const last = asms[0];
  const particip = last && ms.length ? Math.round(last.attendees.length / ms.length * 100) : 0;
  const y = new Date().getFullYear();
  const vol = ms.length ? Daira.scoped('rawBatches').filter(b => String(b.received_at).startsWith(y)).reduce((s, b) => s + b.qty, 0) : 0;
  const volPrev = Daira.scoped('rawBatches').filter(b => String(b.received_at).startsWith(y - 1)).reduce((s, b) => s + b.qty, 0);
  const dVol = volPrev ? Math.round((vol - volPrev) / volPrev * 100) : null;
  const lastDiv = [...Daira.scoped('dividendCampaigns')].reverse()[0];
  const reserve = lastDiv ? Daira.round2(lastDiv.surplus * 0.10) : 0;
  // Loi 112-12 — capital: parts × valeur nominale
  const sv = tn.share_value || 100;
  const capSub = ms.reduce((s, m) => s + (Number(m.shares) || 0), 0) * sv;
  const dv = denomValidity(tn);
  const docs = tn.legal_docs || {};
  const docsDone = LEGAL_DOCS.filter(k => docs[k]).length;
  const kpi = (l, v, sub) => `<div class="kpi"><div class="n">${v}</div><div class="l">${l}</div>${sub ? `<div class="muted">${sub}</div>` : ''}</div>`;
  return `
  <div class="grid c2" style="grid-template-columns:repeat(2,1fr)">
    ${kpi(esc(t('odco_members')), ms.length, `👨 ${nM} · 👩 ${nF}`)}
    ${kpi(esc(t('odco_particip')), particip + '%', last ? esc(last.title) : '—')}
    ${kpi(esc(t('odco_volume')), Math.round(vol) + ' kg', dVol === null ? y : (dVol >= 0 ? '+' : '') + dVol + '% vs ' + (y - 1))}
    ${kpi(esc(t('odco_reserve')), fmtM(reserve), lastDiv ? esc(t('v_season')) + ' ' + esc(lastDiv.season) : '—')}
  </div>
  <div class="card"><h2 style="margin-top:0">⚖️ Loi 112-12</h2>
    <div class="row between"><span>${esc(t('odco_category'))}</span><b>${tn.category ? 'صنف ' + esc(tn.category) : '—'}</b></div>
    <div class="row between"><span>${esc(t('odco_capital_sub'))}</span><b>${fmtM(capSub)}</b></div>
    <div class="muted" style="margin-bottom:.4rem">${esc(t('gm_shares'))}: ${ms.reduce((s, m) => s + (Number(m.shares) || 0), 0)} × ${sv} MAD</div>
    <div class="row between"><span>${esc(t('odco_capital_lib'))}</span><b>${fmtM(tn.capital_liberated || 0)}</b></div>
    <div class="row between"><span>${esc(t('odco_founders'))}</span><b class="${ms.length >= 5 ? '' : ''}">${ms.length} / 5 ${ms.length >= 5 ? '✅' : '⚠️'}</b></div>
    <div class="row between"><span>${esc(t('odco_denom'))}</span><b>${
      dv ? (dv.expired
        ? `<span style="color:var(--danger)">⚠️ ${esc(t('odco_denom_expired'))}</span>`
        : `${fmtD(dv.until)} · ${dv.left} ${esc(t('odco_denom_days'))} ✅`)
      : '—'}</b></div>
  </div>
  <div class="card"><h2 style="margin-top:0">📁 ${esc(t('odco_docs'))} <span class="muted">(${docsDone}/${LEGAL_DOCS.length})</span></h2>
    ${LEGAL_DOCS.map(k => `<label class="row between" style="padding:.45rem 0;border-bottom:1px solid var(--line);cursor:pointer">
      <span>${docs[k] ? '✅' : '⬜'} ${esc(t(k))}</span>
      <input type="checkbox" ${docs[k] ? 'checked' : ''} onchange="toggleDoc('${k}')" style="width:auto;margin:0"></label>`).join('')}
  </div>
  <button class="btn" onclick="printOdco()" style="margin-top:.8rem">${esc(t('odco_export'))}</button>`;
}

function printOdco() {
  const h = tenantHeader();
  const tn = Daira.DB().tenants[Daira.activeTenantId()] || {};
  const ms = Daira.scoped('members');
  const y = new Date().getFullYear();
  const vol = Daira.scoped('rawBatches').filter(b => String(b.received_at).startsWith(y)).reduce((s, b) => s + b.qty, 0);
  const sales = Daira.scoped('sales').filter(s => String(s.created_at).startsWith(y)).reduce((s, x) => s + x.total, 0);
  const lastDiv = [...Daira.scoped('dividendCampaigns')].reverse()[0];
  const sv = tn.share_value || 100;
  const capSub = ms.reduce((s, m) => s + (Number(m.shares) || 0), 0) * sv;
  const dv = denomValidity(tn);
  const docs = tn.legal_docs || {};
  const html = `
  <div class="doc-head"><h1>🌿 ${esc(h.name)}</h1>
    <div class="sub">${esc(h.name_ar)} · N° ODCO: ${esc(h.odco)} · ${esc(h.region)}${tn.province ? ' · ' + esc(tn.province) : ''}</div>
    <h1 style="font-size:17px;margin-top:8px">${esc(t('odco_t'))} — ${esc(t('odco_export'))} ${y}</h1></div>
  <table>
    <tr><th style="width:55%">${esc(t('odco_category'))}</th><td>${tn.category ? 'صنف ' + esc(tn.category) : '—'}</td></tr>
    <tr><th>${esc(t('ob_purpose'))}</th><td>${esc(tn.purpose || '—')}</td></tr>
    <tr><th>${esc(t('odco_capital_sub'))}</th><td>${fmtM(capSub)} (${ms.reduce((s, m) => s + (Number(m.shares) || 0), 0)} × ${sv} MAD)</td></tr>
    <tr><th>${esc(t('odco_capital_lib'))}</th><td>${fmtM(tn.capital_liberated || 0)}</td></tr>
    <tr><th>${esc(t('odco_denom'))}</th><td>${dv ? (dv.expired ? '⚠️ ' + esc(t('odco_denom_expired')) : fmtD(dv.until) + ' (' + dv.left + ' ' + esc(t('odco_denom_days')) + ')') : '—'}</td></tr>
    <tr><th>${esc(t('odco_members'))}</th><td>${ms.length} (👨 ${ms.filter(m => m.gender === 'm').length} · 👩 ${ms.filter(m => m.gender !== 'm').length})</td></tr>
    <tr><th>${esc(t('odco_volume'))} ${y}</th><td>${Math.round(vol)} kg</td></tr>
    <tr><th>Ventes ${y}</th><td>${fmtM(sales)}</td></tr>
    <tr><th>${esc(t('odco_reserve'))}</th><td>${lastDiv ? fmtM(Daira.round2(lastDiv.surplus * 0.10)) : '—'}</td></tr>
    <tr><th>Assemblées tenues</th><td>${Daira.scoped('assemblies').length}</td></tr>
    <tr><th>Certifications valides</th><td>${Daira.scoped('certifications').filter(c => c.status === 'valid').length}</td></tr>
  </table>
  <h2>${esc(t('odco_docs'))}</h2>
  <table>${LEGAL_DOCS.map(k => `<tr><th style="width:55%">${esc(t(k))}</th><td>${docs[k] ? '✅' : '⬜'}</td></tr>`).join('')}</table>
  <h2>Registre des membres</h2>
  <table><tr><th>#</th><th>${esc(t('gm_lastname'))}</th><th>${esc(t('gm_cin'))}</th><th>${esc(t('gm_fonction'))}</th><th>${esc(t('pr_parts'))}</th><th>${esc(t('gm_status'))}</th></tr>
  ${ms.map(m => `<tr><td>${esc(m.code)}</td><td>${esc(m.name)} ${esc(m.firstname || '')}</td><td>${esc(m.cin || '—')}</td><td>${esc(m.fonction && m.fonction !== 'member' ? t('fo_' + m.fonction) : '—')}</td><td>${esc(m.shares || 0)}</td><td>${esc(m.status)}</td></tr>`).join('')}</table>
  <div class="sig"><div>Le président<br><br><br></div><div>Cachet de la coopérative<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
  printDoc(t('odco_export'), html);
}

function bindGov(V, tab) {
  if (tab === 'members') $('#gm_go').onclick = () => {
    try { Daira.requirePerm('member.create');
      const cin = $('#gm_cin').value.trim();
      if (cin && !isCIN(cin)) { toast(t('v_cin'), true); return; }
      const phone = $('#gm_ph').value.trim();
      if (phone && !isPhoneMA(phone)) { toast(t('v_phone'), true); return; }
      const ms = Daira.scoped('members');
      Daira.put('members', { id: 'mbr_' + Date.now().toString(36), code: 'MBR-' + String(ms.length+1).padStart(3,'0'),
        name: $('#gm_n').value.trim(), firstname: $('#gm_fn').value.trim(),
        cin: $('#gm_cin').value.trim(), phone: $('#gm_ph').value.trim(),
        gender: $('#gm_g').value, fonction: $('#gm_f').value, shares: Number($('#gm_sh').value) || 0,
        shares_paid: Number($('#gm_sp').value) || 0,
        joined_at: new Date($('#gm_jd').value || Date.now()).toISOString(),
        status: $('#gm_st').value });
      toast('✅'); render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
  if (tab === 'assemblies') $('#ga_go').onclick = () => {
    try { Daira.requirePerm('assembly.manage');
      const y = new Date().getFullYear();
      Daira.put('assemblies', { id: 'asm_' + Date.now().toString(36), type: 'AG', title: $('#ga_t').value.trim(),
        held_at: new Date($('#ga_d').value || Date.now()).toISOString(),
        attendees: $('#ga_a').value.split('\n').map(s=>s.trim()).filter(Boolean),
        decisions: $('#ga_dc').value.split('\n').map(s=>s.trim()).filter(Boolean),
        pv_ref: 'PV-AG-' + y + '-' + Daira.nextSeq('pv', 2), status: 'draft' });
      toast('✅'); render();
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
  if (tab === 'votes') {
    $('#gv_go').onclick = () => {
      try { Daira.requirePerm('vote.manage');
        Daira.put('votes', { id: 'vot_' + Date.now().toString(36), assembly_id: '', question: $('#gv_q').value.trim(),
          question_ar: $('#gv_qa').value.trim(), results: { yes: 0, no: 0, abstain: 0 }, status: 'open' });
        toast('✅'); render();
      } catch (e) { toast(t('err') + ': ' + e.message, true); }
    };
    V.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { try { Daira.recordVote(b.dataset.v, b.dataset.c); render(); } catch (e) { toast(e.message, true); } });
    V.querySelectorAll('[data-close]').forEach(b => b.onclick = () => {
      const v = Daira.get('votes', b.dataset.close); v.status = 'closed'; v.closed_at = new Date().toISOString();
      Daira.put('votes', v); render();
    });
  }
}

/* ---------------- print: fiche individuelle de ristournes ---------------- */
function ficheHtml(c, a) {
  const h = tenantHeader();
  const m = Daira.DB().members[a.member_id] || {};
  const batches = Daira.scoped('rawBatches').filter(b => b.member_id === a.member_id && String(b.received_at).startsWith(c.season));
  const totalQty = Daira.round2(batches.reduce((s, b) => s + b.qty, 0));
  const legal = Daira.round2(a.amount * 0.10);
  const net = Daira.round2(a.amount - legal);
  return `
  <div class="doc-head"><h1>🌿 ${esc(h.name)}</h1>
    <div class="sub">${esc(h.name_ar)} · N° ODCO: ${esc(h.odco)}</div>
    <h1 style="font-size:17px;margin-top:8px">${esc(t('pr_fiche_t'))} — ${esc(c.season)}</h1>
    ${c.status !== 'confirmed' ? '<div class="sub">⚠️ PROVISOIRE / مؤقت</div>' : ''}</div>
  <table>
    <tr><th style="width:55%">Adhérent</th><td>${esc(a.member_name)} (${esc(m.code || '')}) — CIN ${esc(m.cin || '—')}</td></tr>
    <tr><th>Total apports livrés</th><td><b>${totalQty} kg</b></td></tr>
    <tr><th>Quote-part activité</th><td>${a.share_pct}%</td></tr>
    <tr><th>Ristourne brute</th><td><b>${fmtM(a.amount)}</b></td></tr>
    <tr><th>Réserve légale (10%)</th><td>− ${fmtM(legal)}</td></tr>
    <tr><th>Net à payer</th><td><b>${fmtM(net)}</b></td></tr>
    <tr><th>Date de versement</th><td>${c.confirmed_at ? fmtD(c.confirmed_at) : '—'}</td></tr>
  </table>
  <div class="sig"><div>Le trésorier<br><br><br></div><div>L'adhérent (reçu)<br><br><br></div></div>
  <div class="foot">${esc(t('made_in'))} · Daira</div>`;
}
function printFiche(cid, mid) {
  const c = Daira.get('dividendCampaigns', cid); if (!c) return;
  const a = c.allocations.find(x => x.member_id === mid); if (!a) return;
  printDoc(t('pr_fiche_t'), ficheHtml(c, a));
}
function waDividend(cid, mid) {
  const c = Daira.get('dividendCampaigns', cid); if (!c) return;
  const a = c.allocations.find(x => x.member_id === mid); if (!a) return;
  const m = Daira.DB().members[mid] || {}, h = tenantHeader();
  const msg = 'السلام عليكم،\nتنهي إدارة تعاونية ' + h.name + ' إلى علمكم أنه تم حصر الفوائض السنوية (' + c.season +
    ')، وبلغت قيمة مردوداتكم الصافية: ' + a.amount + ' درهم.\nيرجى الحضور لمقر التعاونية لاستلام مستحقاتكم مصحوبين ببطاقة التعريف الوطنية.';
  window.open(waLink(m.phone, msg), '_blank');
}

/* ---------------- dividends ---------------- */
function vDividends(V) {
  if (!guard('dividend.run')) return;
  const camps = [...Daira.scoped('dividendCampaigns')].reverse();
  const year = new Date().getFullYear();
  V.innerHTML = `<h1>🤝 ${esc(t('v_t'))}</h1>
  <p class="muted">ℹ️ ${esc(t('v_how'))}</p>
  <div class="card"><div class="grid c2">
    <label class="f">${esc(t('v_season'))}<input id="dv_s" value="${year}"></label>
    <label class="f">${esc(t('v_surplus'))}<input id="dv_m" type="number" min="0" placeholder="0"></label></div>
    <button class="btn" id="dv_go">🧮 ${esc(t('v_calc'))}</button></div>
  <div id="dv_out"></div>
  ${camps.map(c=>`<div class="card"><div class="row between"><b>${esc(t('v_season'))} ${esc(c.season)}</b><span class="badge ${c.status==='confirmed'?'ok':'warn'}">${esc(c.status)}</span></div>
    <div class="muted">${esc(t('v_surplus'))}: ${fmtM(c.surplus)}</div>
    <div style="overflow-x:auto"><table><tr><th>${esc(t('v_member'))}</th><th>${esc(t('v_points'))}</th><th>${esc(t('v_share'))}</th><th>${esc(t('v_amount'))}</th><th></th></tr>
    ${c.allocations.slice(0,6).map(a=>`<tr><td>${esc(a.member_name)}</td><td>${a.points}</td><td>${a.share_pct}%</td><td><b>${fmtM(a.amount)}</b></td>
    <td style="white-space:nowrap"><button class="btn sm ghost" onclick="printFiche('${c.id}','${a.member_id}')">🖨️</button>
    <button class="btn sm" style="background:#25D366" onclick="waDividend('${c.id}','${a.member_id}')">💬</button></td></tr>`).join('')}
    ${c.allocations.length>6?`<tr><td colspan="5" class="muted">… +${c.allocations.length-6}</td></tr>`:''}</table></div></div>`).join('')}`;

  $('#dv_go').onclick = () => {
    try {
      const c = Daira.allocateDividends({ season: $('#dv_s').value.trim(), surplus: $('#dv_m').value });
      $('#dv_out').innerHTML = `<div class="card" style="border:2px solid var(--ok)"><h2 style="margin-top:0">🧮 ${esc(t('v_season'))} ${esc(c.season)} — ${fmtM(c.surplus)}</h2>
      <div style="overflow-x:auto"><table><tr><th>${esc(t('v_member'))}</th><th>${esc(t('v_points'))}</th><th>${esc(t('v_share'))}</th><th>${esc(t('v_amount'))}</th><th></th></tr>
      ${c.allocations.map(a=>`<tr><td>${esc(a.member_name)}</td><td>${a.points}</td><td>${a.share_pct}%</td><td><b>${fmtM(a.amount)}</b></td>
      <td style="white-space:nowrap"><button class="btn sm ghost" onclick="printFiche('${c.id}','${a.member_id}')">🖨️</button>
      <button class="btn sm" style="background:#25D366" onclick="waDividend('${c.id}','${a.member_id}')">💬</button></td></tr>`).join('')}</table></div>
      <button class="btn" id="dv_cf" style="margin-top:.8rem">✅ ${esc(t('v_confirm'))}</button></div>`;
      $('#dv_cf').onclick = () => { try { Daira.confirmDividends(c.id); toast('✅ ' + t('v_confirmed')); render(); } catch (e) { toast(e.message, true); } };
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- docs ---------------- */
function vDocs(V) {
  const guides = [['doc_g1','doc_g1_d'],['doc_g2','doc_g2_d'],['doc_g3','doc_g3_d'],['doc_g4','doc_g4_d']];
  V.innerHTML = `<h1>📚 ${esc(t('docs_guide_t'))}</h1>
  <p class="muted">${esc(t('docs_guide_d'))}</p>
  ${guides.map(([h, d]) => `<div class="card"><h2 style="margin-top:0">${esc(t(h))}</h2><p>${esc(t(d))}</p></div>`).join('')}
  <div class="card"><h2 style="margin-top:0">📥 ${esc(t('doc_templates'))}</h2>
    <div class="row" style="flex-wrap:wrap">
      <a class="btn sm" href="#/actes/denom" style="text-decoration:none">📝 ${esc(t('act_denom'))}</a>
      <a class="btn sm" href="#/actes/statuts" style="text-decoration:none">📜 ${esc(t('act_statuts'))}</a>
      <a class="btn sm" href="#/actes/subs" style="text-decoration:none">📋 ${esc(t('act_subs'))}</a>
      <a class="btn sm" href="#/actes/greffe" style="text-decoration:none">🏛️ ${esc(t('act_greffe'))}</a>
      <a class="btn sm" href="#/actes/ag" style="text-decoration:none">👥 ${esc(t('act_ag'))}</a>
      <a class="btn sm" href="#/actes/register" style="text-decoration:none">📖 ${esc(t('act_register'))}</a>
    </div></div>`;
}

/* ---------------- settings ---------------- */
function vSettings(V) {
  V.innerHTML = `<h1>⚙️ ${esc(t('set_t'))}</h1>
  <div class="card"><label class="f">${esc(t('set_lang'))}<select id="s_l">${LANGS.map(l=>`<option value="${l.code}" ${l.code===LANG?'selected':''}>${l.label}</option>`).join('')}</select></label></div>
  <div class="card"><h2 style="margin-top:0">🔑 ${esc(t('set_pin_t'))}</h2>
    <label class="f">${esc(t('set_oldpin'))}<input id="s_op" type="password"></label>
    <label class="f">${esc(t('set_newpin'))}<input id="s_np" type="password"></label>
    <button class="btn" id="s_pg">${esc(t('save'))}</button></div>
  <div class="card"><h2 style="margin-top:0">💾</h2>
    <button class="btn ghost" id="s_x">📥 ${esc(t('download_backup'))}</button>
    <div class="row" style="margin-top:.6rem"><input type="file" id="s_i" accept=".json" style="margin:0"><button class="btn sm" id="s_ig">📤 ${esc(t('set_import'))}</button></div></div>
  <div class="card"><a class="btn ghost" href="#/login" style="text-decoration:none">🔄 ${esc(t('set_tenant'))}</a></div>
  <div class="card"><h2 style="margin-top:0;color:var(--danger)">⚠️ ${esc(t('set_danger'))}</h2>
    <button class="btn danger" id="s_r">🧹 ${esc(t('set_reset'))}</button></div>`;
  $('#s_l').onchange = e => setLang(e.target.value);
  $('#s_pg').onclick = () => {
    const u = Daira.currentUser();
    if (!u || Daira.hashPin($('#s_op').value) !== u.pin_hash) { toast('⛔ ' + t('login_err'), true); return; }
    if (!$('#s_np').value) { toast(t('err'), true); return; }
    Daira.setCredentials(u.id, null, $('#s_np').value);
    toast('✅ ' + t('pin_changed'));
  };
  $('#s_x').onclick = () => {
    const blob = new Blob([JSON.stringify(Daira.exportTenant(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'daira-export.json'; a.click();
  };
  $('#s_ig').onclick = () => {
    const f = $('#s_i').files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { localStorage.setItem('daira_db_v1', r.result); location.reload(); } catch (e) { toast(t('err'), true); } };
    r.readAsText(f);
  };
  $('#s_r').onclick = () => { if (confirm('OK?')) { Daira.resetDB(); location.hash = '#/'; location.reload(); } };
}

/* ---------------- boot ---------------- */
(function boot() {
  try { dairaSeed(); } catch (e) { console.warn('seed:', e); }
  buildLangSel();
  const s = Daira.DB().session;
  // Tenant locale is only a default: an explicit user choice (daira_lang) always wins.
  if (!localStorage.getItem('daira_lang') && s.tenantId) { const tn = Daira.DB().tenants[s.tenantId]; if (tn && tn.settings && tn.settings.locale) LANG = tn.settings.locale; }
  const meta = LANGS.find(x => x.code === LANG) || LANGS[0];
  document.documentElement.lang = LANG === 'fr' ? 'fr' : (LANG === 'zgh' ? 'zgh' : 'ar');
  document.documentElement.dir = meta.dir;
  buildLangSel();
  if (!location.hash) location.hash = '#/';
  render();
})();
