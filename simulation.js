// ============================================================
// DSEH001 Project Disha — Shared Client-Side Logic
// v1.4 — Two navigation fixes:
//   FIX 1: After successful submission, redirect to home.html
//           after 3 seconds so teams are never stranded on a
//           submitted round page with no forward navigation.
//   FIX 2: Previous button always enabled for n > 1 — teams
//           can always review past submitted rounds.
//           Next remains gated: only OPEN or submitted rounds.
// v1.3 — lockRoundPage, buildRoundNav, scorecard enrichment.
// v1.2 — Auth logging, error surfacing, round-state key fix.
// ============================================================

// --- CONFIGURATION -------------------------------------------
const SIM_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxOLBFr8lxyoUD7IN_cWW7EdkWTnJjuT6pOfbBpvPpLKFxvwO8m0mjMJveKRHK3_DIE8Q/exec',
  startingResources: {
    budgetRemaining:       600,
    changeCapital:         100,
    analystHoursRemaining:  60,
  },
  totalRounds: 6,
  changeCapitalWarning: 30,
  changeCapitalDanger:  10,
  analystHoursMin:      20,
};

// --- LOCAL STORAGE KEYS --------------------------------------
const LS_KEYS = {
  teamCode:       'dseh001_team_code',
  teamName:       'dseh001_team_name',
  memberName:     'dseh001_member_name',
  memberPasscode: 'dseh001_member_passcode',
};

// --- STATE ---------------------------------------------------
const state = {
  team:           null,
  balance:        null,
  roundState:     null,
  selectedOption: null,
};

// --- INITIALISATION ------------------------------------------
function initSimulation() {
  state.team = {
    teamCode:       localStorage.getItem(LS_KEYS.teamCode),
    teamName:       localStorage.getItem(LS_KEYS.teamName),
    memberName:     localStorage.getItem(LS_KEYS.memberName),
    memberPasscode: localStorage.getItem(LS_KEYS.memberPasscode),
  };

  console.log('[Disha] initSimulation:',
    'teamCode=' + state.team.teamCode,
    'memberName=' + state.team.memberName,
    'memberPasscode=' + (state.team.memberPasscode ? '***SET***' : 'MISSING'));

  const path = window.location.pathname;
  const isPublicPage = path.endsWith('index.html')
    || path.endsWith('/')
    || path.endsWith('admin.html');

  if (!state.team.teamCode && !isPublicPage) {
    console.warn('[Disha] No teamCode — redirecting to login.');
    window.location.href = 'index.html';
    return;
  }

  const el = document.getElementById('team-name-display');
  if (el) el.textContent = state.team.teamName || '';
  const mel = document.getElementById('member-name-display');
  if (mel) mel.textContent = state.team.memberName || '';
  const tiles = document.getElementById('resource-tiles');
  if (tiles) renderResourceTiles(readCachedBalance() || {});
}

// --- API CALLS -----------------------------------------------
async function apiCall(action, params, opts) {
  params = params || {};
  opts   = opts   || {};
  if (!opts.silent) showLoading(true);
  try {
    const url = new URL(SIM_CONFIG.apiUrl);
    url.searchParams.set('action',        action);
    url.searchParams.set('teamCode',       state.team && state.team.teamCode       ? state.team.teamCode       : '');
    url.searchParams.set('memberName',     state.team && state.team.memberName     ? state.team.memberName     : '');
    url.searchParams.set('memberPasscode', state.team && state.team.memberPasscode ? state.team.memberPasscode : '');
    Object.entries(params).forEach(function([k, v]) {
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
    });
    console.log('[Disha] apiCall:', action,
      '| teamCode=' + url.searchParams.get('teamCode'),
      '| memberPasscode=' + (url.searchParams.get('memberPasscode') ? '***SET***' : 'MISSING'));
    const response = await fetch(url.toString(), { method: 'GET' });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    return data.data;
  } catch (err) {
    console.error('[Disha] apiCall error (' + action + '):', err.message);
    if (!opts.silent) showAlert('error', 'Request failed: ' + err.message + '. Please try again or contact Prof. R K Singh.');
    throw err;
  } finally {
    if (!opts.silent) showLoading(false);
  }
}

async function apiSubmit(roundNumber, payload) {
  showLoading(true);
  try {
    const formData = new FormData();
    formData.append('action',        'submitRound');
    formData.append('teamCode',       state.team.teamCode);
    formData.append('memberName',     state.team.memberName     || '');
    formData.append('memberPasscode', state.team.memberPasscode || '');
    formData.append('roundNumber',    roundNumber);
    formData.append('payload',        JSON.stringify(payload));
    const response = await fetch(SIM_CONFIG.apiUrl, { method: 'POST', body: formData });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Submission failed');
    return data.data;
  } catch (err) {
    console.error('[Disha] apiSubmit error:', err.message);
    showAlert('error', 'Submission failed: ' + err.message);
    throw err;
  } finally {
    showLoading(false);
  }
}

// --- BALANCE CACHE -------------------------------------------
function cacheBalance(data) {
  try {
    const code = state.team && state.team.teamCode ? state.team.teamCode : '';
    if (code && data) localStorage.setItem('dseh001_balance_' + code, JSON.stringify(data));
  } catch (e) {}
}
function readCachedBalance() {
  try {
    const code = state.team && state.team.teamCode ? state.team.teamCode : '';
    if (!code) return null;
    const raw = localStorage.getItem('dseh001_balance_' + code);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// --- BALANCE & ROUND STATE FETCH -----------------------------
async function fetchTeamBalance(opts) {
  opts = opts || {};
  renderResourceTiles(readCachedBalance() || {});
  const data = await apiCall('getTeamBalance', {}, { silent: opts.silent !== false });
  state.balance = data;
  cacheBalance(data);
  renderResourceTiles(data);
  renderDebtLedger(data);
  return data;
}

async function fetchRoundState() {
  const data = await apiCall('getRoundState', {}, { silent: true });
  state.roundState = data;
  return data;
}

// =============================================================
// LOCKED ROUND PAGE
// =============================================================
function lockRoundPage(roundNumber) {
  document.querySelectorAll('.container > .card, .container > .cost-calculator, .container > .shock-section, .container > .audit-section')
    .forEach(function(el) { el.style.display = 'none'; });

  const ac = document.getElementById('alert-container');
  if (ac) {
    ac.innerHTML =
      '<div style="text-align:center;padding:3rem 1rem;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">&#128274;</div>' +
        '<h2 style="color:var(--teal);margin-bottom:0.75rem;">Round ' + roundNumber + ' is not yet open</h2>' +
        '<p style="color:var(--text-muted);font-size:1rem;max-width:480px;margin:0 auto 1.5rem;">' +
          'This round will be opened by your instructor at the appropriate class session. ' +
          'You will see it appear on your dashboard when it is ready.' +
        '</p>' +
        '<a href="home.html" class="btn btn-primary btn-large">&#8592; Return to Dashboard</a>' +
      '</div>';
  }

  const navNext = document.getElementById('navNext');
  if (navNext) { navNext.classList.add('is-disabled'); navNext.removeAttribute('href'); }
}

// =============================================================
// ROUND NAV
// FIX 2: Previous always enabled for n > 1 (teams can always
//         review past rounds). Next gated to OPEN or submitted.
// =============================================================
function buildRoundNav(n, rs, submissions) {
  rs          = rs          || {};
  submissions = submissions || {};

  const prev = document.getElementById('navPrev');
  const next = document.getElementById('navNext');
  if (!prev || !next) return;

  // FIX 2: Previous — always navigable if n > 1
  if (n <= 1) {
    prev.classList.add('is-disabled');
    prev.removeAttribute('href');
  } else {
    prev.classList.remove('is-disabled');
    prev.href = 'round-' + (n - 1) + '.html';
  }

  // Next — only if next round is OPEN or already submitted by this team
  if (n >= 6) {
    next.classList.add('is-disabled');
    next.removeAttribute('href');
  } else {
    const nextKey       = 'r' + (n + 1);
    const nextOpen      = rs[nextKey] === 'OPEN';
    const nextSubmitted = !!submissions[nextKey];
    if (nextOpen || nextSubmitted) {
      next.classList.remove('is-disabled');
      next.href = 'round-' + (n + 1) + '.html';
    } else {
      next.classList.add('is-disabled');
      next.removeAttribute('href');
      next.title = 'Round ' + (n + 1) + ' is not yet open';
    }
  }
}

// --- RESOURCE TILE RENDERER ----------------------------------
function renderResourceTiles(balance) {
  const container = document.getElementById('resource-tiles');
  if (!container) return;
  const r = (balance && balance.resources) || SIM_CONFIG.startingResources;
  const budget  = r.budgetRemaining       != null ? r.budgetRemaining       : SIM_CONFIG.startingResources.budgetRemaining;
  const change  = r.changeCapital          != null ? r.changeCapital          : SIM_CONFIG.startingResources.changeCapital;
  const analyst = r.analystHoursRemaining  != null ? r.analystHoursRemaining  : SIM_CONFIG.startingResources.analystHoursRemaining;

  let bCls = 'budget';
  if (budget < 50) bCls = 'danger'; else if (budget < 120) bCls = 'warning';
  let cCls = 'change';
  if (change <= SIM_CONFIG.changeCapitalDanger) cCls = 'danger';
  else if (change <= SIM_CONFIG.changeCapitalWarning) cCls = 'warning';
  let aCls = 'analyst';
  if (analyst < SIM_CONFIG.analystHoursMin) aCls = 'warning';

  container.innerHTML =
    '<div class="resource-tile ' + bCls + '">' +
      '<div class="resource-label">Budget Remaining</div>' +
      '<div class="resource-value">&#8377;' + budget + 'L</div>' +
      '<div class="resource-sub">of &#8377;600L total (cumulative)</div>' +
    '</div>' +
    '<div class="resource-tile ' + cCls + '">' +
      '<div class="resource-label">Change Capital</div>' +
      '<div class="resource-value">' + change + '</div>' +
      '<div class="resource-sub">/ 100 pts &mdash; persists round-to-round</div>' +
    '</div>' +
    '<div class="resource-tile ' + aCls + '">' +
      '<div class="resource-label">Analyst Hours</div>' +
      '<div class="resource-value">' + analyst + '</div>' +
      '<div class="resource-sub">/ 60 hrs &mdash; resets each round</div>' +
    '</div>';

  if (change <= SIM_CONFIG.changeCapitalDanger) {
    const w = document.getElementById('change-capital-warning');
    if (w) w.classList.remove('hidden');
  }
}

// --- DEBT LEDGER RENDERER ------------------------------------
function renderDebtLedger(balance) {
  const container = document.getElementById('debt-ledger-container');
  if (!container) return;
  let debts = [];
  try { debts = JSON.parse((balance && balance.debtLedger) || '[]'); } catch (e) {}
  if (debts.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No deferred problems logged &mdash; your team is current.</p>';
    return;
  }
  container.innerHTML = debts.map(function(d) {
    return '<div class="debt-item">' +
      '<span class="debt-item-cost">+&#8377;' + d.cost + 'L if not resolved by R' + d.deadline + '</span>' +
      '<strong>' + d.label + '</strong><br>' +
      '<span style="font-size:0.85rem;color:var(--text-muted);">' + (d.description || '') + '</span>' +
      '</div>';
  }).join('');
}

// --- COST CALCULATOR -----------------------------------------
function updateCostCalculator(options) {
  const calc = document.getElementById('cost-calculator');
  if (!calc) return;
  const opt = options.find(function(o) { return o.code === state.selectedOption; });
  if (!opt) {
    calc.innerHTML = '<div class="cost-row"><em>Select an option above to see resource impact</em></div>';
    return;
  }
  const r = (state.balance && state.balance.resources) || SIM_CONFIG.startingResources;
  const newBudget  = (r.budgetRemaining       != null ? r.budgetRemaining       : 600) - opt.budgetCost;
  const newChange  = (r.changeCapital          != null ? r.changeCapital          : 100) + opt.changeDelta;
  const newAnalyst = (r.analystHoursRemaining  != null ? r.analystHoursRemaining  :  60) - opt.analystCost;

  let warns = '';
  if (newBudget  < 0) warns += '<div class="alert alert-danger" style="margin-top:0.75rem;">&#9888; Budget will be exceeded.</div>';
  if (newChange  <= SIM_CONFIG.changeCapitalDanger)  warns += '<div class="alert alert-danger" style="margin-top:0.75rem;">&#9888; Change Capital critical (&le;10). Board intervention next round.</div>';
  else if (newChange <= SIM_CONFIG.changeCapitalWarning) warns += '<div class="alert alert-warning" style="margin-top:0.75rem;">&#9888; Change Capital will fall below 30.</div>';
  if (newAnalyst < 0) warns += '<div class="alert alert-danger" style="margin-top:0.75rem;">&#9888; Analyst Hours exceeded.</div>';
  else if (newAnalyst < SIM_CONFIG.analystHoursMin) warns += '<div class="alert alert-warning" style="margin-top:0.75rem;">&#9888; Fewer than 20 Analyst Hours used &mdash; minimum-analysis warning will apply.</div>';

  const sign = function(n) { return n >= 0 ? '+' + n : '' + n; };
  calc.innerHTML =
    '<div style="font-weight:700;margin-bottom:0.5rem;color:var(--teal);">Option ' + opt.code + ' &mdash; ' + opt.name + '</div>' +
    '<div class="cost-row"><span>Budget cost</span><span>&#8377;' + opt.budgetCost + 'L &rarr; &#8377;' + newBudget + 'L remaining</span></div>' +
    '<div class="cost-row"><span>Change Capital</span><span>' + sign(opt.changeDelta) + ' &rarr; ' + newChange + ' pts</span></div>' +
    '<div class="cost-row total"><span>Analyst Hours</span><span>&minus;' + opt.analystCost + ' &rarr; ' + newAnalyst + ' hrs left this round</span></div>' +
    warns;
}

// --- OPTION SELECTION ----------------------------------------
function selectOption(optionCode, options) {
  state.selectedOption = optionCode;
  document.querySelectorAll('.option-card').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.code === optionCode);
  });
  updateCostCalculator(options);
  validateSubmitButton();
}

// --- VALIDATION ----------------------------------------------
function validateSubmitButton() {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  const rationale = (document.getElementById('rationale') || {}).value || '';
  const wordCount = rationale.trim().split(/\s+/).filter(Boolean).length;
  const hasOption = !!state.selectedOption;
  const hasWords  = wordCount >= 200;
  const wcEl = document.getElementById('word-count');
  if (wcEl) {
    wcEl.textContent = wordCount + ' words (minimum 200)';
    wcEl.classList.remove('warning', 'success');
    if (wordCount < 100)       wcEl.classList.add('warning');
    else if (wordCount >= 200) wcEl.classList.add('success');
  }
  btn.disabled = !(hasOption && hasWords);
}

// --- UI HELPERS ----------------------------------------------
function showLoading(visible) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('active', visible);
}
function showAlert(type, message) {
  const container = document.getElementById('alert-container');
  if (!container) return;
  const cls = { success: 'alert-success', error: 'alert-danger', warning: 'alert-warning', info: 'alert-info' }[type] || 'alert-info';
  container.innerHTML = '<div class="alert ' + cls + '">' + message + '</div>';
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- ROUND SUBMISSION ----------------------------------------
// FIX 1: After successful submission, show success message
// then redirect to home.html after 3 seconds.
// Teams are never stranded on a submitted page.
async function submitRound(roundNumber) {
  const rationaleEl = document.getElementById('rationale');
  const rationale   = rationaleEl ? rationaleEl.value.trim() : '';
  const wordCount   = rationale.split(/\s+/).filter(Boolean).length;

  if (!state.selectedOption) { showAlert('error', 'Please select an option.'); return; }
  if (wordCount < 200) { showAlert('error', 'Evidence Rationale must be at least 200 words.'); return; }
  if (!confirm('Submit Round ' + roundNumber + ' for ' + state.team.teamName + '? This cannot be undone.')) return;

  const auditData     = collectAuditData();
  const shockResponse = (document.getElementById('shock-response') || {}).value || '';

  try {
    const result = await apiSubmit(roundNumber, {
      optionChosen:  state.selectedOption,
      rationale:     rationale,
      auditData:     auditData,
      shockResponse: shockResponse,
      submittedAt:   new Date().toISOString(),
      scribeName:    state.team.memberName,
    });

    // Lock the form immediately
    document.querySelectorAll('.option-card, #rationale, #submit-btn, .audit-section input, .audit-section textarea, #shock-response').forEach(function(el) {
      if (['BUTTON','TEXTAREA','INPUT'].includes(el.tagName)) el.disabled = true;
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.6';
    });

    // FIX 1: Success message with countdown redirect to home
    let msg = 'Round ' + roundNumber + ' submitted successfully.';
    if (result && result.analysisWarning) msg += ' Note: ' + result.analysisWarning;
    const ac = document.getElementById('alert-container');
    if (ac) {
      ac.innerHTML =
        '<div class="alert alert-success" style="text-align:center;padding:1.5rem;">' +
          '<div style="font-size:2rem;margin-bottom:0.5rem;">&#10003;</div>' +
          '<strong>' + msg + '</strong><br>' +
          '<span style="font-size:0.9rem;color:var(--text-muted);">Returning to dashboard in <span id="countdown">3</span> seconds&hellip;</span><br>' +
          '<a href="home.html" class="btn btn-primary" style="margin-top:1rem;">Go to Dashboard now</a>' +
        '</div>';
      ac.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Countdown and redirect
    var count = 3;
    var timer = setInterval(function() {
      count--;
      var el = document.getElementById('countdown');
      if (el) el.textContent = count;
      if (count <= 0) {
        clearInterval(timer);
        window.location.href = 'home.html';
      }
    }, 1000);

  } catch (err) {
    console.error('[Disha] submitRound caught:', err.message);
  }
}

// --- FAIRNESS AUDIT DATA COLLECTOR (R4) ----------------------
function collectAuditData() {
  const ids = ['audit-a1','audit-a2','audit-a3','audit-b1','audit-b2','audit-c1','audit-c2','audit-c3','audit-d1'];
  const data = {};
  ids.forEach(function(id) { const el = document.getElementById(id); if (el) data[id] = el.value; });
  return Object.keys(data).length > 0 ? data : null;
}

// --- SHOCK EVENT VISIBILITY ----------------------------------
async function checkShockEvents() {
  try {
    const data = await apiCall('getConfig', {}, { silent: true });
    if (data && data.ShockEvent1_Triggered === 'Y') showShockSection('shock-section-1');
    if (data && data.ShockEvent2_Triggered === 'Y') showShockSection('shock-section-2');
  } catch (e) {
    console.warn('[Disha] checkShockEvents failed silently:', e.message);
  }
}
function showShockSection(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  validateSubmitButton();
}

// --- LOGIN ---------------------------------------------------
async function handleLogin() {
  const teamCode   = ((document.getElementById('team-code-input')      || {}).value || '').trim().toUpperCase();
  const memberName = ((document.getElementById('member-name-input')     || {}).value || '').trim();
  const passcode   = ((document.getElementById('member-passcode-input') || {}).value || '').trim();

  if (!teamCode || !memberName || !passcode) {
    showAlert('error', 'Please enter your team code, full name, and personal passcode.');
    return;
  }
  state.team = { teamCode: teamCode, memberName: memberName, memberPasscode: passcode };
  try {
    const data = await apiCall('verifyMember', { passcode: passcode, memberPasscode: passcode }, {});
    if (!data || !data.authenticated) {
      showAlert('error', 'Incorrect credentials. Please check with Prof. R K Singh.');
      state.team = null;
      return;
    }
    localStorage.setItem(LS_KEYS.teamCode,       data.teamCode);
    localStorage.setItem(LS_KEYS.teamName,        data.teamName);
    localStorage.setItem(LS_KEYS.memberName,      data.memberName);
    localStorage.setItem(LS_KEYS.memberPasscode,  passcode);
    console.log('[Disha] Login success:', data.teamCode, data.memberName);
    window.location.href = 'home.html';
  } catch (err) {
    state.team = null;
    console.error('[Disha] Login error:', err.message);
  }
}

function logout() {
  Object.values(LS_KEYS).forEach(function(k) { localStorage.removeItem(k); });
  const code = (state.team || {}).teamCode || '';
  if (code) localStorage.removeItem('dseh001_balance_' + code);
  window.location.href = 'index.html';
}
