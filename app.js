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
  document.documentElement.lang = l === 'fr' ? 'fr' : 'ar';
  document.documentElement.dir = meta.dir;
  buildLangSel();
  render();
}

function buildLangSel() {
  const sel = $('#langSel');
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
  ['stock', 'nav_stock', '💰', 'sale.create'],
  ['certs', 'nav_certs', '📜', 'cert.manage'],
  ['passport', 'nav_pass', '🔳', 'passport.generate'],
  ['gov', 'nav_gov', '🏛️', 'assembly.manage'],
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
function waRequestLink(r) {
  const lines = ['🌿 Daira — Demande d\u2019accès / طلب ولوج',
    '🏢 ' + (r.name || '') + (r.name_ar ? ' — ' + r.name_ar : ''),
    '📍 ' + (r.region || '') + ' · ' + (r.sector || ''),
    '📞 ' + (r.phone || ''),
    '👤 ' + (r.adminName || '') + (r.adminPhone ? ' (' + r.adminPhone + ')' : ''),
    '',
    'المرجو منحي حق الوصول إلى فضائي — Merci de m\u2019ouvrir mon espace.'];
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

  ({ dash: vDash, intake: vIntake, production: vProduction, stock: vStock, certs: vCerts,
     passport: vPassport, gov: vGov, dividends: vDividends, docs: vDocs, settings: vSettings,
     platform: vPlatform }[r[0]] || vDash)(V, r.slice(1));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ---------------- landing ---------------- */
function vLanding(V) {
  const feats = [['f1t','f1d','🔍'],['f2t','f2d','🏭'],['f3t','f3d','🔳'],['f4t','f4d','💰'],['f5t','f5d','🏛️'],['f6t','f6d','🤝']];
  V.innerHTML = `
  <div class="hero">
    <div style="font-size:2.4rem;position:relative;z-index:1">🌿</div>
    <h1>${esc(t('hero_title'))}</h1>
    <p>${esc(t('hero_sub'))}</p>
    <div class="cta-row">
      <a class="btn light" href="#/onboard" style="text-decoration:none">${esc(t('cta_start'))}</a>
      <a class="btn outline" href="#/login" style="text-decoration:none">🔑 ${esc(t('login_btn'))}</a>
      <button class="btn outline" onclick="demoLogin()">👀 ${esc(t('cta_demo'))}</button>
    </div>
  </div>
  <div class="grid c2">${feats.map(([a,b,ico]) =>
    `<div class="card feat"><span class="ico">${ico}</span><div><b>${esc(t(a))}</b><div class="muted">${esc(t(b))}</div></div></div>`).join('')}</div>
  <h2>${esc(t('how_t'))}</h2>
  ${[['how_1t','how_1d'],['how_2t','how_2d'],['how_3t','how_3d']].map(([a,b],i) =>
    `<div class="card step"><span class="n">${i+1}</span><div><b>${esc(t(a))}</b><div class="muted">${esc(t(b))}</div></div></div>`).join('')}
  <div class="card" style="text-align:center"><span class="badge ok">${esc(t('law'))}</span>
    <p class="muted">${esc(t('made_in'))}</p>
    <div style="margin:.6rem auto;max-width:220px">${LANGS.map(l=>`<button class="btn sm ghost" style="margin:.2rem" onclick="setLang('${l.code}')">${l.label}</button>`).join('')}</div>
  </div>`;
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
    if (tn.settings && tn.settings.locale) setLang(tn.settings.locale);
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
    <label class="f">${esc(t('login_user'))}<input id="lg_u" autocomplete="username" placeholder="${tab==='admin'?'admin':'T001'}"></label>
    <label class="f">${esc(t('login_pin'))}<input id="lg_p" type="password" autocomplete="current-password"></label>
    <button class="btn" id="lg_go">🔑 ${esc(t('login_go'))}</button>
    <button class="btn ghost" onclick="demoLogin()" style="margin-top:.7rem">👀 ${esc(t('cta_demo'))} <span class="muted">— T001 / 123456</span></button>
    <p style="text-align:center;margin-top:1rem" class="muted">${esc(t('login_noaccess'))} <a href="#/onboard">${esc(t('cta_start'))}</a></p>
    <p style="text-align:center"><a href="#/">${esc(t('nav_home'))}</a></p></div>`;
  const go = () => {
    try {
      const u = Daira.authenticate($('#lg_u').value, $('#lg_p').value);
      const tn = u.tenant_id !== '*' && Daira.DB().tenants[u.tenant_id];
      if (tn && tn.settings && tn.settings.locale) setLang(tn.settings.locale);
      Daira.setSession(u.tenant_id === '*' ? null : u.tenant_id, u.id);
      if (u.role === 'super_admin') { Daira.DB().session.tenantId = null; Daira.save(); location.hash = '#/platform'; }
      else location.hash = '#/dash';
    } catch (e) { toast('⛔ ' + t('login_err'), true); }
  };
  $('#lg_go').onclick = go;
  $('#lg_p').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

/* ---------------- onboarding wizard ---------------- */
const OB = { step: 1, data: { primaryColor: '#0e6b4a', logoEmoji: '🌿', locale: LANG } };
const OB_COLORS = ['#0e6b4a','#8a5a2b','#1f6f9e','#7b2d8b','#b03a2e','#2e4057'];
const OB_EMOJIS = ['🌿','🫒','🍯','🧶','🌵','🐝','🥜','🫘'];

function vOnboard(V, step) {
  OB.step = step || OB.step;
  const d = OB.data;
  const dots = [1,2,3,4].map(i=>`<i class="${i<=OB.step?'on':''}"></i>`).join('');
  let body = '';
  if (OB.step === 1) body = `
    <label class="f">${esc(t('ob_name'))}<input id="o_name" value="${esc(d.name||'')}" placeholder="Coopérative …"></label>
    <label class="f">${esc(t('ob_name_ar'))}<input id="o_name_ar" value="${esc(d.name_ar||'')}" placeholder="تعاونية …"></label>
    <div class="grid c2">
      <label class="f">${esc(t('ob_region'))}<input id="o_region" value="${esc(d.region||'')}" placeholder="Souss-Massa"></label>
      <label class="f">${esc(t('ob_sector'))}<input id="o_sector" value="${esc(d.sector||'')}" placeholder="Argan"></label>
    </div>
    <label class="f">${esc(t('ob_phone'))}<input id="o_phone" value="${esc(d.phone||'')}" placeholder="06…"></label>`;
  if (OB.step === 2) body = `
    <label class="f">${esc(t('ob_admin'))}<input id="o_admin" value="${esc(d.adminName||'')}"></label>
    <label class="f">${esc(t('ob_admin_phone'))}<input id="o_admin_phone" value="${esc(d.adminPhone||'')}"></label>`;
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
    <p class="muted" style="margin-top:.8rem"><a href="#/">${esc(t('nav_home'))}</a></p></div>`;
  }

  V.innerHTML = `<div class="card" style="max-width:520px;margin:1.5rem auto">
    <h1>${esc(t('ob_t'))}</h1><div class="wizard-dots">${dots}</div>
    <p class="muted"><b>${esc(t('ob_s'+OB.step))}</b></p>${body}
    <div class="row" style="margin-top:1rem">
      ${OB.step>1&&OB.step<4?`<button class="btn ghost" id="o_back" style="flex:1">${esc(t('ob_back'))}</button>`:''}
      ${OB.step<3?`<button class="btn" id="o_next" style="flex:2">${esc(t('ob_next'))}</button>`:''}
      ${OB.step===3?`<button class="btn" id="o_finish" style="flex:2">📩 ${esc(t('ob_finish'))}</button>`:''}
    </div></div>`;

  const grab = () => {
    ['name','name_ar','region','sector','phone','admin','admin_phone'].forEach(k => {
      const el = document.getElementById('o_'+k); if (el) d[k==='admin'?'adminName':k==='admin_phone'?'adminPhone':k] = el.value.trim();
    });
    const loc = document.getElementById('o_locale'); if (loc) d.locale = loc.value;
  };
  document.querySelectorAll('.swatch[data-c]').forEach(s => s.onclick = () => { d.primaryColor = s.dataset.c; vOnboard(V, 3); });
  document.querySelectorAll('.swatch[data-e]').forEach(s => s.onclick = () => { d.logoEmoji = s.dataset.e; vOnboard(V, 3); });
  const nx = $('#o_next'); if (nx) nx.onclick = () => { grab(); vOnboard(V, OB.step + 1); };
  const bk = $('#o_back'); if (bk) bk.onclick = () => { grab(); vOnboard(V, OB.step - 1); };
  const fn = $('#o_finish');
  if (fn) fn.onclick = () => {
    grab();
    if (!d.name || !d.adminName) { toast(t('err') + ' — ' + t('ob_name') + ' / ' + t('ob_admin'), true); return; }
    // moderated onboarding: save an access REQUEST, do NOT provision yet
    const req = { id: 'req_' + Date.now().toString(36), created_at: new Date().toISOString(), status: 'pending',
      name: d.name, name_ar: d.name_ar, region: d.region, sector: d.sector, phone: d.phone,
      adminName: d.adminName, adminPhone: d.adminPhone,
      primaryColor: d.primaryColor, logoEmoji: d.logoEmoji, locale: d.locale };
    saveRequest(req);
    OB.lastReq = req;
    setLang(d.locale || 'fr');
    OB.data = { primaryColor: '#0e6b4a', logoEmoji: '🌿', locale: LANG };
    vOnboard(V, 4);
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

/* ---------------- intake ---------------- */
function vIntake(V) {
  if (!guard('intake.create')) return;
  const members = Daira.scoped('members').filter(m=>m.status==='active');
  const materials = Daira.scoped('materials');
  const grades = Object.keys(Daira.GRADE_TABLE);
  V.innerHTML = `<h1>🧺 ${esc(t('i_t'))}</h1>
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
        <p class="muted" style="text-align:center">${esc(b.member_name)} · ${b.qty} ${esc(b.unit)} · Grade ${b.grade}</p></div>`;
      toast('✅ ' + t('i_saved'));
      $('#in_q').value = ''; upd();
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
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
      const { sale, duplicate } = Daira.createSale({ items, channel: 'POS', payment: 'CASH',
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
  return [...Daira.scoped('sales')].reverse().map(s=>`<div class="card" style="padding:.7rem">
    <div class="row between"><b>${esc(s.sale_code)}</b><span class="badge ${s.status==='paid'?'ok':'warn'}">${esc(s.status)}</span></div>
    <div class="muted">${esc(s.channel)} · ${esc(s.payment)} · ${fmtD(s.created_at)} · ${esc(s.created_by)}</div>
    ${s.items.map(i=>`<div>· ${i.qty}× ${esc(i.product_name)} — ${i.line_total} MAD</div>`).join('')}
    <div class="row between" style="font-weight:800"><span>${esc(t('s_total'))}</span><span>${s.total} MAD</span></div></div>`).join('') || `<p class="muted">—</p>`;
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
    $('#q_out').innerHTML = passportCard(pp, true);
    drawQR('qrbox', pp.verify_url);
  };
  $('#q_go').onclick = show; show();
}

function passportCard(pp, interactive) {
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
      ${interactive?`<button class="btn ghost no-print" style="margin-top:.8rem" onclick="window.print()">🖨️ ${esc(t('q_print'))}</button>
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
  const tabs = [['members','g_members','👥'],['assemblies','g_asm','🏛️'],['votes','g_votes','🗳️']];
  let body = `<div class="row" style="margin-bottom:.8rem">${tabs.map(([k,l,ico])=>`<a href="#/gov/${k}" class="btn sm ${tab===k?'':'ghost'}" style="flex:1;text-decoration:none">${ico} ${esc(t(l))}</a>`).join('')}</div>`;
  if (tab === 'members') body += vGovMembers();
  if (tab === 'assemblies') body += vGovAsm();
  if (tab === 'votes') body += vGovVotes();
  V.innerHTML = `<h1>🏛️ ${esc(t('g_t'))}</h1>${body}`;
  bindGov(V, tab);
}
function vGovMembers() {
  const ms = Daira.scoped('members');
  return `<div class="card" style="overflow-x:auto"><table><tr><th>#</th><th>${esc(t('v_member'))}</th><th>Village</th><th></th></tr>
    ${ms.map(m=>`<tr><td>${esc(m.code)}</td><td><b>${esc(m.name)}</b><br><span class="muted">${esc(m.name_ar||'')}</span></td><td>${esc(m.village||'')}</td><td><span class="badge ok">${esc(m.status)}</span></td></tr>`).join('')}</table></div>
  <div class="card"><h2 style="margin-top:0">➕ ${esc(t('g_add_member'))}</h2>
    <div class="grid c2"><label class="f">Nom<input id="gm_n"></label><label class="f">الاسم<input id="gm_na"></label></div>
    <div class="grid c2"><label class="f">Village<input id="gm_v"></label><label class="f">Parcelle<input id="gm_p"></label></div>
    <button class="btn" id="gm_go">${esc(t('save'))}</button></div>`;
}
function vGovAsm() {
  const as = [...Daira.scoped('assemblies')].reverse();
  return as.map(a=>`<div class="card"><div class="row between"><b>${esc(a.title)}</b><span class="badge ${a.status==='signed'?'ok':'warn'}">${esc(a.status)}</span></div>
    <div class="muted">${fmtD(a.held_at)} · PV ${esc(a.pv_ref||'—')} · 👥 ${a.attendees.length} ${esc(t('g_attendees'))}</div>
    <div><b>${esc(t('g_decisions'))}:</b><ul>${a.decisions.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></div></div>`).join('') +
  `<div class="card"><h2 style="margin-top:0">➕ ${esc(t('g_new_asm'))}</h2>
    <label class="f">Titre<input id="ga_t"></label>
    <label class="f">Date<input id="ga_d" type="date"></label>
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
function bindGov(V, tab) {
  if (tab === 'members') $('#gm_go').onclick = () => {
    try { Daira.requirePerm('member.create');
      const ms = Daira.scoped('members');
      Daira.put('members', { id: 'mbr_' + Date.now().toString(36), code: 'MBR-' + String(ms.length+1).padStart(3,'0'),
        name: $('#gm_n').value.trim(), name_ar: $('#gm_na').value.trim(), village: $('#gm_v').value.trim(),
        plot_ref: $('#gm_p').value.trim(), status: 'active', joined_at: new Date().toISOString() });
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
    <table><tr><th>${esc(t('v_member'))}</th><th>${esc(t('v_points'))}</th><th>${esc(t('v_share'))}</th><th>${esc(t('v_amount'))}</th></tr>
    ${c.allocations.slice(0,6).map(a=>`<tr><td>${esc(a.member_name)}</td><td>${a.points}</td><td>${a.share_pct}%</td><td><b>${fmtM(a.amount)}</b></td></tr>`).join('')}
    ${c.allocations.length>6?`<tr><td colspan="4" class="muted">… +${c.allocations.length-6}</td></tr>`:''}</table></div>`).join('')}`;

  $('#dv_go').onclick = () => {
    try {
      const c = Daira.allocateDividends({ season: $('#dv_s').value.trim(), surplus: $('#dv_m').value });
      $('#dv_out').innerHTML = `<div class="card" style="border:2px solid var(--ok)"><h2 style="margin-top:0">🧮 ${esc(t('v_season'))} ${esc(c.season)} — ${fmtM(c.surplus)}</h2>
      <table><tr><th>${esc(t('v_member'))}</th><th>${esc(t('v_points'))}</th><th>${esc(t('v_share'))}</th><th>${esc(t('v_amount'))}</th></tr>
      ${c.allocations.map(a=>`<tr><td>${esc(a.member_name)}</td><td>${a.points}</td><td>${a.share_pct}%</td><td><b>${fmtM(a.amount)}</b></td></tr>`).join('')}</table>
      <button class="btn" id="dv_cf" style="margin-top:.8rem">✅ ${esc(t('v_confirm'))}</button></div>`;
      $('#dv_cf').onclick = () => { try { Daira.confirmDividends(c.id); toast('✅ ' + t('v_confirmed')); render(); } catch (e) { toast(e.message, true); } };
      window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { toast(t('err') + ': ' + e.message, true); }
  };
}

/* ---------------- docs ---------------- */
function vDocs(V) {
  const ents = [
    ['tenants', 'pk: id', 'name, region, sector, branding{primary}, settings{locale,currency}'],
    ['users', 'pk: id · fk: tenant_id', 'name, phone, role ∈ {super_admin, manager, supervisor, member}'],
    ['members', 'pk: id · fk: tenant_id', 'code, name, village, plot_ref, status'],
    ['materials', 'pk: id · fk: tenant_id', 'name, unit, base_price, grades[]'],
    ['raw_batches', 'pk: id · fk: tenant_id, member_id, material_id', 'batch_code, qty, grade, quality{moisture,acidity}, unit_price, total_credit, qty_remaining, status'],
    ['recipes', 'pk: id · fk: tenant_id', 'inputs[{material_id, qty_per_unit}], outputs[{product_id, per_input_unit}], loss_pct, checkpoints[]'],
    ['products', 'pk: id · fk: tenant_id', 'name, sku, unit, sale_price, components[] (packaging BOM)'],
    ['runs', 'pk: id · fk: tenant_id, recipe_id', 'run_code, inputs[{raw_batch_id,qty}], total_input_qty, loss_pct, outputs[{lot_id,qty}]'],
    ['finished_lots', 'pk: id · fk: tenant_id, product_id, run_id', 'lot_code, qty_produced, qty_available, source_batches[], source_members[]'],
    ['inv_ledger', 'append-only · fk: tenant_id, lot_id', 'change, reason ∈ {production,sale,adjustment}, ref, actor'],
    ['member_ledger', 'append-only · fk: tenant_id, member_id', 'kind ∈ {CREDIT,PAYOUT,DIVIDEND}, amount, ref'],
    ['certifications', 'pk: id · fk: tenant_id', 'type ∈ {ONSSA,AOP,IGP,BIO,FAIR}, ref_number, expires_at, status'],
    ['sales', 'pk: id · fk: tenant_id', 'sale_code, channel, payment, items[{lot_id,qty,price}], total, idempotency_key, synced'],
    ['assemblies', 'pk: id · fk: tenant_id', 'type ∈ {AG,AGE,CA}, held_at, attendees[], decisions[], pv_ref, status'],
    ['votes', 'pk: id · fk: tenant_id, assembly_id', 'question, results{yes,no,abstain}, status'],
    ['dividend_campaigns', 'pk: id · fk: tenant_id', 'season, surplus, allocations[{member_id,points,share_pct,amount}], status'],
  ];
  const api = [
    ['POST', '/api/v1/tenants', 'Provisioning (super_admin)'],
    ['GET', '/api/v1/tenants', 'Liste espaces (super_admin)'],
    ['POST', '/api/v1/:tenant/members', 'Créer membre'],
    ['POST', '/api/v1/:tenant/intake', 'Réception apport → lot tracé + crédit membre'],
    ['POST', '/api/v1/:tenant/recipes', 'Définir recette / BOM'],
    ['POST', '/api/v1/:tenant/runs', 'Lancer transformation (moteur de rendement)'],
    ['GET', '/api/v1/:tenant/lots/:code', 'Traçabilité lot'],
    ['POST', '/api/v1/:tenant/sales', 'Vente (idempotente, anti-survente)'],
    ['GET', '/api/v1/:tenant/inventory', 'État stock temps réel'],
    ['POST', '/api/v1/:tenant/certifications', 'Ajouter certificat'],
    ['GET', '/api/v1/:tenant/passport/:lotCode', 'Passeport produit public (QR)'],
    ['POST', '/api/v1/:tenant/assemblies', 'Créer AG / PV'],
    ['POST', '/api/v1/:tenant/votes', 'Ouvrir vote'],
    ['POST', '/api/v1/:tenant/votes/:id/cast', 'Voter'],
    ['POST', '/api/v1/:tenant/dividends', 'Calculer ristournes'],
    ['POST', '/api/v1/:tenant/dividends/:id/confirm', 'Confirmer & créditer'],
  ];
  V.innerHTML = `<h1>📚 ${esc(t('doc_t'))}</h1>
  <div class="card"><h2 style="margin-top:0">🏗️ ${esc(t('doc_arch'))}</h2>
    <p class="muted">Multi-tenant SaaS · isolation <code>tenant_id</code> (RLS en production) · RBAC 4 rôles ·
    moteur de transformation (rendement − pertes) · grand livre d’inventaire append-only ·
    ventes idempotentes anti-survente · caisse offline-first (file de synchro) · QR passeport public.</p>
    <p class="muted">Démo statique : <code>domain.js</code> = logique métier · <code>localStorage</code> namespacé par tenant =
    isolation ligne. Production : même domaine derrière <code>/api/v1/:tenant/…</code> (Postgres + RLS).</p></div>
  <h2>🗄️ ${esc(t('doc_model'))}</h2>
  ${ents.map(([n,k,f])=>`<div class="doc-ent"><b>${n}</b><br><span class="pk">${esc(k)}</span><br><span class="muted">${esc(f)}</span></div>`).join('')}
  <h2>🔌 ${esc(t('doc_api'))}</h2>
  <div class="card"><table>${api.map(([m,p,d])=>`<tr><td><code>${m}</code></td><td><code>${esc(p)}</code></td><td class="muted">${esc(d)}</td></tr>`).join('')}</table>
  <p class="muted">Auth: JWT · tenant résolu via sous-domaine <code>{code}.daira.ma</code> ou header <code>X-Tenant-ID</code>. Version complète : <code>docs/API-SPEC.md</code>.</p></div>`;
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
    <button class="btn ghost" id="s_x">📥 ${esc(t('set_export'))}</button>
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
  if (s.tenantId) { const tn = Daira.DB().tenants[s.tenantId]; if (tn && tn.settings && tn.settings.locale) LANG = tn.settings.locale; }
  const meta = LANGS.find(x => x.code === LANG) || LANGS[0];
  document.documentElement.lang = LANG === 'fr' ? 'fr' : 'ar';
  document.documentElement.dir = meta.dir;
  buildLangSel();
  if (!location.hash) location.hash = '#/';
  render();
})();
