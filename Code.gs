/**
 * =============================================================================
 *  Project Disha — Apps Script Backend (Code.gs)
 *  DSEH001 Digital HR & People Analytics Simulation
 *  Course Coordinator: Prof. R. K. Singh, University of Delhi
 *
 *  v1.3 — Submission history enriched:
 *    getTeamSubmissions() now joins Submissions tab with Scoring tab
 *    so each submission entry includes budgetCost, changeCost,
 *    analystCost, and all five axis scores + round total.
 *    getTeamBalance() returns this enriched submissions object.
 *    home.html can now display a full per-round scorecard.
 *
 *  v1.2 — Leaderboard accumulation fix; round-state cache 60s.
 *  v1.1 — Auth param unification, getConfigAll public, error surfacing.
 *  v1.0 — Initial build.
 * =============================================================================
 */

// =============================================================================
// SECTION 1 — CONSTANTS & CONFIGURATION
// =============================================================================

const SHEET_ID = '1YWMU8ME2wrrTa5bBVjOsgia0nuqwFTr0XVV_pUsUxFo';

const STARTING = {
  budget:        600,
  changeCapital: 100,
  analystHours:   60,
};

const CC_WARNING  = 30;
const CC_DANGER   = 10;
const ANALYST_MIN = 20;

const CACHE_TTL_STATE  = 60;
const CACHE_TTL_CONFIG = 3600;
const CK_ROUND_STATE   = 'disha:roundState';
const CK_CONFIG_PFX    = 'disha:config:';

// =============================================================================
// SECTION 2 — AUTHORITATIVE ROUND COSTS (Runbook Part D)
// =============================================================================
const ROUND_COSTS = {
  1: {
    '1A': { budget:  40, analystHours:  8, changeDelta:   0 },
    '1B': { budget:  80, analystHours: 18, changeDelta:  -5 },
    '1C': { budget:  60, analystHours: 12, changeDelta:  +5 },
    '1D': { budget:  50, analystHours: 10, changeDelta:  +3 },
  },
  2: {
    '2A': { budget: 160, analystHours: 20, changeDelta: -10 },
    '2B': { budget: 120, analystHours: 14, changeDelta:  +5 },
    '2C': { budget:  90, analystHours: 12, changeDelta:   0 },
    '2D': { budget:  80, analystHours: 16, changeDelta:  +8 },
    '2E': { budget: 200, analystHours: 24, changeDelta: -20 },
  },
  3: {
    '3A': { budget:  60, analystHours: 10, changeDelta: +10 },
    '3B': { budget:  50, analystHours:  8, changeDelta:  +3 },
    '3C': { budget:  40, analystHours:  6, changeDelta:   0 },
    '3D': { budget:  70, analystHours: 12, changeDelta: +15 },
    '3E': { budget: 100, analystHours: 16, changeDelta: -15 },
  },
  4: {
    '4A': { budget:  30, analystHours: 14, changeDelta:   0 },
    '4B': { budget:  80, analystHours: 20, changeDelta:   0 },
    '4C': { budget:  45, analystHours: 18, changeDelta:  +3 },
    '4D': { budget:  50, analystHours: 22, changeDelta:   0 },
    '4E': { budget: 110, analystHours: 28, changeDelta:  -5 },
  },
  5: {
    '5A': { budget:  30, analystHours: 14, changeDelta:   0 },
    '5B': { budget:  35, analystHours: 16, changeDelta:   0 },
    '5C': { budget:  25, analystHours: 12, changeDelta:  +5 },
    '5D': { budget:  45, analystHours: 20, changeDelta:   0 },
    '5E': { budget:  35, analystHours: 16, changeDelta:   0 },
  },
  6: {
    '6A': { budget:  70, analystHours: 16, changeDelta:  +8 },
    '6B': { budget:  90, analystHours: 14, changeDelta:  +5 },
    '6C': { budget:  65, analystHours: 12, changeDelta:   0 },
    '6D': { budget:  55, analystHours: 18, changeDelta:   0 },
    '6E': { budget: 130, analystHours: 22, changeDelta:   0 },
  },
};

// =============================================================================
// SECTION 3 — SCORING AXES
// =============================================================================
const SCORING_AXES = [
  'Analytical_Rigour', 'Financial_Discipline', 'Equity_Compliance',
  'Adoption_Change',   'Strategic_Coherence',
];

// =============================================================================
// SECTION 4 — SHEET COLUMN MAPS (0-based)
// =============================================================================
const COL = {
  Teams:        { TeamID: 0, TeamName: 1, MemberNames: 2 },
  TeamMembers:  { TeamID: 0, MemberName: 1, Passcode: 2 },
  TeamBalances: { TeamID: 0, Budget_Remaining: 1, Change_Capital: 2,
                  Analyst_Hours_Remaining: 3, Round_Last_Submitted: 4 },
  TeamState:    { TeamID: 0, Debt_Ledger: 1, Anchor_Statuses: 2, Latent_States: 3 },
  Submissions:  { TeamID: 0, Round: 1, Timestamp: 2, OptionChosen: 3,
                  Rationale: 4, BudgetCost: 5, ChangeCost: 6, AnalystCost: 7 },
  Scoring:      { TeamID: 0, Round: 1, Analytical_Rigour: 2, Financial_Discipline: 3,
                  Equity_Compliance: 4, Adoption_Change: 5, Strategic_Coherence: 6,
                  Round_Total: 7, Cumulative_Disha_Index: 8 },
  Config:       { Key: 0, Value: 1 },
};

// =============================================================================
// SECTION 5 — REQUEST CONTEXT & ENTRY POINTS
// =============================================================================

function buildCtx(params) {
  return {
    params: params || {},
    ss:     SpreadsheetApp.openById(SHEET_ID),
    sheets: {},
    rows:   {},
    cache:  CacheService.getScriptCache(),
  };
}

function doGet(e)  { return handleRequest(e.parameter); }
function doPost(e) { return handleRequest(e.parameter); }

function handleRequest(params) {
  try {
    var ctx = buildCtx(params);
    var action = params.action;
    var result;
    switch (action) {
      case 'verifyMember':        result = verifyMember(ctx);              break;
      case 'verifyAdmin':         result = verifyAdmin(ctx);               break;
      case 'getTeamBalance':      result = getTeamBalance(ctx);            break;
      case 'getRoundState':       result = getRoundState(ctx);             break;
      case 'getConfig':           result = getConfigAll(ctx);              break;
      case 'getLeaderboard':      result = getLeaderboard(ctx);            break;
      case 'getAllSubmissions':    result = getAllSubmissions(ctx);         break;
      case 'submitRound':         result = submitRound(ctx);               break;
      case 'setRoundState':       result = setRoundState(ctx);             break;
      case 'triggerShock':        result = triggerShock(ctx);              break;
      case 'resetTeamForTesting': result = resetTeamForTestingAction(ctx); break;
      default:
        return jsonOut({ success: false, error: 'Unknown action: ' + action });
    }
    return jsonOut({ success: true, data: result });
  } catch (err) {
    Logger.log('Disha backend error: ' + err + '\n' + err.stack);
    return jsonOut({ success: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// SECTION 6 — SHEET HELPERS
// =============================================================================

function getSheet(ctx, name) {
  if (ctx.sheets[name]) return ctx.sheets[name];
  var sh = ctx.ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" not found. Run the bootstrap script.');
  ctx.sheets[name] = sh;
  return sh;
}

function getDataRows(ctx, name) {
  if (ctx.rows[name]) return ctx.rows[name];
  var sh  = getSheet(ctx, name);
  var all = sh.getDataRange().getValues();
  var rows = all.length > 1 ? all.slice(1) : [];
  ctx.rows[name] = { rows: rows, sheet: sh, startRow: 2 };
  return ctx.rows[name];
}

function invalidate(ctx, name) { delete ctx.rows[name]; }

// =============================================================================
// SECTION 7 — CONFIG
// =============================================================================

function getConfigValue(ctx, key) {
  var cKey = CK_CONFIG_PFX + key;
  var hit  = ctx.cache.get(cKey);
  if (hit !== null) return hit === '__null__' ? null : hit;
  var d = getDataRows(ctx, 'Config');
  var val = null;
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Config.Key]) === key) {
      val = String(d.rows[i][COL.Config.Value]);
      break;
    }
  }
  ctx.cache.put(cKey, val === null ? '__null__' : val, CACHE_TTL_CONFIG);
  return val;
}

function setConfigValue(ctx, key, value) {
  var sh = getSheet(ctx, 'Config');
  var d  = getDataRows(ctx, 'Config');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Config.Key]) === key) {
      sh.getRange(i + d.startRow, COL.Config.Value + 1).setValue(value);
      invalidate(ctx, 'Config');
      ctx.cache.remove(CK_CONFIG_PFX + key);
      return;
    }
  }
  sh.appendRow([key, value]);
  invalidate(ctx, 'Config');
  ctx.cache.remove(CK_CONFIG_PFX + key);
}

function getConfigAll(ctx) {
  var d = getDataRows(ctx, 'Config');
  var out = {};
  for (var i = 0; i < d.rows.length; i++) {
    var k = String(d.rows[i][COL.Config.Key]);
    if (k === 'AdminPasscode') continue;
    out[k] = String(d.rows[i][COL.Config.Value]);
  }
  return out;
}

// =============================================================================
// SECTION 8 — AUTHENTICATION
// =============================================================================

function findTeam(ctx, teamId) {
  var d = getDataRows(ctx, 'Teams');
  var target = String(teamId).toUpperCase();
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Teams.TeamID]).toUpperCase() === target) return d.rows[i];
  }
  return null;
}

function verifyMember(ctx) {
  var memberName = String(ctx.params.memberName || '').trim();
  var passcode   = String(ctx.params.memberPasscode || ctx.params.passcode || '').trim();
  var teamCode   = String(ctx.params.teamCode || '').toUpperCase();
  if (!memberName || !passcode) return { authenticated: false };

  var d = getDataRows(ctx, 'TeamMembers');
  for (var i = 0; i < d.rows.length; i++) {
    var rowTeam = String(d.rows[i][COL.TeamMembers.TeamID]).toUpperCase();
    var rowName = String(d.rows[i][COL.TeamMembers.MemberName]).trim();
    var rowPass = String(d.rows[i][COL.TeamMembers.Passcode]).trim();
    if (rowName.toLowerCase() !== memberName.toLowerCase()) continue;
    if (teamCode && rowTeam !== teamCode) continue;
    if (!rowPass || rowPass !== passcode) return { authenticated: false };
    var team = findTeam(ctx, rowTeam);
    return {
      authenticated: true,
      memberName:    rowName,
      teamCode:      rowTeam,
      teamName:      team ? String(team[COL.Teams.TeamName]) : rowTeam,
    };
  }
  return { authenticated: false };
}

function requireMemberAuth(ctx) {
  if (ctx._auth) return ctx._auth;
  var memberName = String(ctx.params.memberName || '').trim();
  var passcode   = String(ctx.params.memberPasscode || ctx.params.passcode || '').trim();
  var teamCode   = String(ctx.params.teamCode || '').toUpperCase();
  if (!memberName || !passcode || !teamCode) {
    throw new Error('Authentication required. Please log in again.');
  }
  var result = verifyMember(ctx);
  if (!result.authenticated) {
    throw new Error('Authentication failed. Please log in again.');
  }
  ctx._auth = result;
  return result;
}

function verifyAdmin(ctx) {
  var given  = String(ctx.params.passcode || '').trim();
  var stored = getConfigValue(ctx, 'AdminPasscode');
  return { authenticated: (given && given === stored) };
}

function requireAdmin(ctx) {
  if (!verifyAdmin(ctx).authenticated) throw new Error('Admin authentication required.');
}

// =============================================================================
// SECTION 9 — TEAM BALANCE (read)
// =============================================================================

function findBalance(ctx, teamId) {
  var d = getDataRows(ctx, 'TeamBalances');
  var target = String(teamId).toUpperCase();
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.TeamBalances.TeamID]).toUpperCase() === target) {
      return { rowIndex: i + d.startRow, data: d.rows[i], sheet: d.sheet };
    }
  }
  return null;
}

function findState(ctx, teamId) {
  var d = getDataRows(ctx, 'TeamState');
  var target = String(teamId).toUpperCase();
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.TeamState.TeamID]).toUpperCase() === target) {
      return { rowIndex: i + d.startRow, data: d.rows[i], sheet: d.sheet };
    }
  }
  return null;
}

function getTeamBalance(ctx) {
  var teamCode = String(ctx.params.teamCode || '').toUpperCase();
  if (!teamCode) throw new Error('Team code required.');
  requireMemberAuth(ctx);

  var team = findTeam(ctx, teamCode);
  if (!team) throw new Error('Team not found: ' + teamCode);

  var bal = findBalance(ctx, teamCode);
  var resources;
  if (!bal) {
    resources = {
      budgetRemaining:       STARTING.budget,
      changeCapital:         STARTING.changeCapital,
      analystHoursRemaining: STARTING.analystHours,
    };
  } else {
    resources = {
      budgetRemaining:       Number(bal.data[COL.TeamBalances.Budget_Remaining])       || 0,
      changeCapital:         Number(bal.data[COL.TeamBalances.Change_Capital])          || 0,
      analystHoursRemaining: Number(bal.data[COL.TeamBalances.Analyst_Hours_Remaining]) || 0,
    };
  }

  var teamState   = findState(ctx, teamCode);
  var debtLedger  = teamState ? String(teamState.data[COL.TeamState.Debt_Ledger] || '[]') : '[]';
  var submissions = getTeamSubmissions(ctx, teamCode);

  return {
    teamName:    String(team[COL.Teams.TeamName]),
    resources:   resources,
    submissions: submissions,
    debtLedger:  debtLedger,
  };
}

/**
 * v1.3 FIX: getTeamSubmissions joins Submissions with Scoring
 * so each round entry now includes:
 *   optionChosen, timestamp,
 *   budgetCost, changeCost, analystCost  (from Submissions tab)
 *   analyticalRigour, financialDiscipline, equityCompliance,
 *   adoptionChange, strategicCoherence, roundTotal  (from Scoring tab)
 */
function getTeamSubmissions(ctx, teamCode) {
  var target = String(teamCode).toUpperCase();

  // ── Read Submissions tab ──────────────────────────────────────────────────
  var dSub = getDataRows(ctx, 'Submissions');
  var subs = {};
  for (var i = 0; i < dSub.rows.length; i++) {
    if (String(dSub.rows[i][COL.Submissions.TeamID]).toUpperCase() !== target) continue;
    var r = Number(dSub.rows[i][COL.Submissions.Round]);
    subs['r' + r] = {
      round:        r,
      optionChosen: String(dSub.rows[i][COL.Submissions.OptionChosen] || ''),
      timestamp:    dSub.rows[i][COL.Submissions.Timestamp],
      budgetCost:   Number(dSub.rows[i][COL.Submissions.BudgetCost]  || 0),
      changeCost:   Number(dSub.rows[i][COL.Submissions.ChangeCost]  || 0),
      analystCost:  Number(dSub.rows[i][COL.Submissions.AnalystCost] || 0),
      // Scores filled in below
      analyticalRigour:    null,
      financialDiscipline: null,
      equityCompliance:    null,
      adoptionChange:      null,
      strategicCoherence:  null,
      roundTotal:          null,
      cumulative:          null,
    };
  }

  // ── Join with Scoring tab ─────────────────────────────────────────────────
  var dScore = getDataRows(ctx, 'Scoring');
  for (var j = 0; j < dScore.rows.length; j++) {
    if (String(dScore.rows[j][COL.Scoring.TeamID]).toUpperCase() !== target) continue;
    var sr = Number(dScore.rows[j][COL.Scoring.Round]);
    var key = 'r' + sr;
    if (!subs[key]) continue;   // score row without a matching submission — skip
    subs[key].analyticalRigour    = Number(dScore.rows[j][COL.Scoring.Analytical_Rigour])    || 0;
    subs[key].financialDiscipline = Number(dScore.rows[j][COL.Scoring.Financial_Discipline])  || 0;
    subs[key].equityCompliance    = Number(dScore.rows[j][COL.Scoring.Equity_Compliance])     || 0;
    subs[key].adoptionChange      = Number(dScore.rows[j][COL.Scoring.Adoption_Change])       || 0;
    subs[key].strategicCoherence  = Number(dScore.rows[j][COL.Scoring.Strategic_Coherence])   || 0;
    subs[key].roundTotal          = Number(dScore.rows[j][COL.Scoring.Round_Total])            || 0;
    subs[key].cumulative          = Number(dScore.rows[j][COL.Scoring.Cumulative_Disha_Index]) || 0;
  }

  return subs;
}

// =============================================================================
// SECTION 10 — ROUND STATE & SHOCK EVENTS
// =============================================================================

function getRoundState(ctx) {
  var hit = ctx.cache.get(CK_ROUND_STATE);
  if (hit) return JSON.parse(hit);
  var d = getDataRows(ctx, 'Config');
  var state = {};
  for (var i = 0; i < d.rows.length; i++) {
    var key = String(d.rows[i][COL.Config.Key]);
    var val = String(d.rows[i][COL.Config.Value]);
    if (key.indexOf('RoundLock_R') === 0) {
      state['r' + key.replace('RoundLock_R', '')] = val;
    }
    if (key === 'ShockEvent1_Triggered') state.ShockEvent1_Triggered = val;
    if (key === 'ShockEvent2_Triggered') state.ShockEvent2_Triggered = val;
    if (key === 'CurrentOpenRound')      state.CurrentOpenRound = val;
  }
  ctx.cache.put(CK_ROUND_STATE, JSON.stringify(state), CACHE_TTL_STATE);
  return state;
}

function setRoundState(ctx) {
  requireAdmin(ctx);
  var roundNumber = parseInt(ctx.params.roundNumber);
  if (!roundNumber || roundNumber < 1 || roundNumber > 6) {
    throw new Error('roundNumber must be 1-6.');
  }
  var newState = String(ctx.params.newState || '').toUpperCase();
  if (newState !== 'OPEN' && newState !== 'LOCKED') {
    throw new Error('newState must be OPEN or LOCKED.');
  }
  setConfigValue(ctx, 'RoundLock_R' + roundNumber, newState);
  if (newState === 'OPEN') {
    setConfigValue(ctx, 'CurrentOpenRound', String(roundNumber));
    resetAnalystHoursForAllTeams(ctx);
  }
  ctx.cache.remove(CK_ROUND_STATE);
  return { roundNumber: roundNumber, status: newState };
}

function triggerShock(ctx) {
  requireAdmin(ctx);
  var n = parseInt(ctx.params.shockNumber);
  if (n !== 1 && n !== 2) throw new Error('shockNumber must be 1 or 2.');
  setConfigValue(ctx, 'ShockEvent' + n + '_Triggered', 'Y');
  ctx.cache.remove(CK_ROUND_STATE);
  Logger.log('Shock Event ' + n + ' triggered.');
  return { shockNumber: n, triggered: true };
}

// =============================================================================
// SECTION 11 — SUBMIT ROUND
// =============================================================================

function submitRound(ctx) {
  var teamCode = String(ctx.params.teamCode || '').toUpperCase();
  if (!teamCode) throw new Error('Team code required.');
  requireMemberAuth(ctx);

  var p = {};
  if (ctx.params.payload) {
    try { p = JSON.parse(ctx.params.payload); } catch (e) { p = {}; }
  }
  var roundNumber   = parseInt(ctx.params.roundNumber);
  var optionChosen  = String(p.optionChosen  || '').toUpperCase().trim();
  var rationale     = String(p.rationale     || '').trim();
  var auditData     = p.auditData     || null;
  var shockResponse = String(p.shockResponse || '').trim();

  if (!roundNumber || roundNumber < 1 || roundNumber > 6) throw new Error('Invalid round number.');
  if (!optionChosen) throw new Error('An option must be selected.');
  if (!rationale || rationale.split(/\s+/).filter(Boolean).length < 200) {
    throw new Error('Evidence Rationale must be at least 200 words.');
  }

  var roundState = getRoundState(ctx);
  if (roundState['r' + roundNumber] !== 'OPEN') {
    throw new Error('Round ' + roundNumber + ' is not currently open. Your instructor must open it first.');
  }

  var team = findTeam(ctx, teamCode);
  if (!team) throw new Error('Team not found: ' + teamCode);

  var existingSubs = getTeamSubmissions(ctx, teamCode);
  if (existingSubs['r' + roundNumber]) {
    throw new Error('Your team has already submitted Round ' + roundNumber + '.');
  }

  var costTable = ROUND_COSTS[roundNumber];
  if (!costTable) throw new Error('No cost table for Round ' + roundNumber + '.');
  var costs = costTable[optionChosen];
  if (!costs) throw new Error('Option "' + optionChosen + '" not recognised for Round ' + roundNumber + '.');

  var budgetCost  = costs.budget       || 0;
  var analystCost = costs.analystHours || 0;
  var changeDelta = costs.changeDelta  || 0;

  var bal = findBalance(ctx, teamCode);
  var curBudget, curCC, curAH;
  if (!bal) {
    curBudget = STARTING.budget;
    curCC     = STARTING.changeCapital;
    curAH     = STARTING.analystHours;
  } else {
    curBudget = Number(bal.data[COL.TeamBalances.Budget_Remaining])       || 0;
    curCC     = Number(bal.data[COL.TeamBalances.Change_Capital])          || 0;
    curAH     = Number(bal.data[COL.TeamBalances.Analyst_Hours_Remaining]) || 0;
  }

  if (budgetCost  > curBudget) throw new Error('Option ' + optionChosen + ' costs \u20B9' + budgetCost + 'L but only \u20B9' + curBudget + 'L remains.');
  if (analystCost > curAH)     throw new Error('Option ' + optionChosen + ' needs ' + analystCost + ' Analyst Hours but only ' + curAH + ' remain.');
  if (curCC + changeDelta < 0) throw new Error('Option ' + optionChosen + ' would take Change Capital below 0.');

  var newBudget = curBudget - budgetCost;
  var newCC     = Math.max(0, Math.min(100, curCC + changeDelta));
  var newAH     = Math.max(0, curAH - analystCost);

  var analysisWarning = (analystCost < ANALYST_MIN)
    ? 'Only ' + analystCost + ' Analyst Hours used (minimum recommended: ' + ANALYST_MIN + '). Analytical Rigour score may be reduced.'
    : null;

  var rationaleStored = rationale;
  if (auditData)     rationaleStored += '\n\n--- FAIRNESS_AUDIT ---\n' + JSON.stringify(auditData);
  if (shockResponse) rationaleStored += '\n\n--- SHOCK_RESPONSE ---\n' + JSON.stringify(shockResponse);

  var subSh = getSheet(ctx, 'Submissions');
  subSh.appendRow([teamCode, roundNumber, new Date(), optionChosen,
                   rationaleStored, budgetCost, changeDelta, analystCost]);
  invalidate(ctx, 'Submissions');

  if (!bal) {
    var balSh = getSheet(ctx, 'TeamBalances');
    balSh.appendRow([teamCode, newBudget, newCC, newAH, roundNumber]);
    invalidate(ctx, 'TeamBalances');
  } else {
    bal.sheet.getRange(bal.rowIndex, COL.TeamBalances.Budget_Remaining + 1, 1, 4)
      .setValues([[newBudget, newCC, newAH, roundNumber]]);
    invalidate(ctx, 'TeamBalances');
  }

  var scores = computeAutoScores(roundNumber, optionChosen, analystCost, newBudget, newCC);
  recordScores(ctx, teamCode, roundNumber, scores);
  updateDebtLedger(ctx, teamCode, roundNumber, optionChosen, newCC, newBudget);

  return {
    submittedAt:  new Date().toISOString(),
    optionChosen: optionChosen,
    costs:        { budgetCost: budgetCost, changeDelta: changeDelta, analystCost: analystCost },
    newResources: { budgetRemaining: newBudget, changeCapital: newCC, analystHoursRemaining: newAH },
    scores:          scores,
    analysisWarning: analysisWarning,
  };
}

// =============================================================================
// SECTION 12 — SCORING ENGINE
// =============================================================================

function computeAutoScores(roundNumber, optionChosen, analystCost, newBudget, newCC) {
  var rigour;
  if      (analystCost >= 20) rigour = 3;
  else if (analystCost >= 12) rigour = 2;
  else if (analystCost >=  6) rigour = 1;
  else                        rigour = 0;
  if (roundNumber === 4 && analystCost >= 14) rigour = Math.max(rigour, 3);

  var finDisc;
  if      (newBudget >= 200) finDisc = 4;
  else if (newBudget >= 100) finDisc = 3;
  else if (newBudget >=  50) finDisc = 2;
  else if (newBudget >=   1) finDisc = 1;
  else                       finDisc = 0;

  var equity = 2;
  var equityMap = { '4B':3, '4C':3, '4D':3, '4E':2, '4A':1, '6A':3, '6D':2 };
  if (equityMap[optionChosen] !== undefined) equity = equityMap[optionChosen];

  var cd = ((ROUND_COSTS[roundNumber] || {})[optionChosen] || {}).changeDelta || 0;
  var adoption;
  if      (cd >= 10) adoption = 4;
  else if (cd >=  5) adoption = 3;
  else if (cd >=  0) adoption = 2;
  else if (cd >= -5) adoption = 1;
  else               adoption = 0;

  var coherence = 2;
  var total = rigour + finDisc + equity + adoption + coherence;
  return {
    Analytical_Rigour: rigour, Financial_Discipline: finDisc,
    Equity_Compliance: equity, Adoption_Change: adoption,
    Strategic_Coherence: coherence, Round_Total: total,
  };
}

function recordScores(ctx, teamCode, roundNumber, scores) {
  var sh  = getSheet(ctx, 'Scoring');
  var all = sh.getDataRange().getValues();
  var cumulative = 0;
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][COL.Scoring.TeamID]).toUpperCase() === teamCode &&
        Number(all[i][COL.Scoring.Round]) !== roundNumber) {
      cumulative += Number(all[i][COL.Scoring.Round_Total]) || 0;
    }
  }
  cumulative += scores.Round_Total;
  sh.appendRow([
    teamCode, roundNumber,
    scores.Analytical_Rigour, scores.Financial_Discipline,
    scores.Equity_Compliance, scores.Adoption_Change,
    scores.Strategic_Coherence, scores.Round_Total, cumulative,
  ]);
}

// =============================================================================
// SECTION 13 — DEBT LEDGER
// =============================================================================

function updateDebtLedger(ctx, teamCode, roundNumber, optionChosen, newCC, newBudget) {
  var stateRow = findState(ctx, teamCode);
  var debts = [];
  if (stateRow) {
    try { debts = JSON.parse(String(stateRow.data[COL.TeamState.Debt_Ledger] || '[]')); }
    catch (e) { debts = []; }
  }

  if (newCC < CC_WARNING && newCC > CC_DANGER && !debts.some(function(d){ return d.label === 'Low Change Capital'; })) {
    debts.push({ label: 'Low Change Capital', description: 'Change Capital below 30.', cost: 20, deadline: Math.min(roundNumber + 2, 6) });
  }
  if (newCC <= CC_DANGER && !debts.some(function(d){ return d.label === 'Board Intervention'; })) {
    debts.push({ label: 'Board Intervention', description: 'Change Capital critical. Board intervention triggered.', cost: 40, deadline: Math.min(roundNumber + 1, 6) });
  }
  if (roundNumber === 2 && (optionChosen === '2E' || optionChosen === '2A') && !debts.some(function(d){ return d.label === 'DPDP Compliance Exposure'; })) {
    debts.push({ label: 'DPDP Compliance Exposure', description: 'No privacy-by-design. Higher breach cost if Shock 1 fires.', cost: 50, deadline: 3 });
  }
  if (roundNumber === 3 && optionChosen === '3E') {
    debts.push({ label: 'Frontline Adoption Backlog', description: 'Simultaneous launch caused Tier-3 resistance.', cost: 30, deadline: 5 });
  }
  if (roundNumber === 4 && optionChosen === '4A') {
    debts.push({ label: 'Unresolved Algorithmic Bias', description: 'Model suspended but not remediated. GL-1004 unresolved.', cost: 25, deadline: 5 });
  }
  if (newBudget < 50 && !debts.some(function(d){ return d.label === 'Budget Stress'; })) {
    debts.push({ label: 'Budget Stress', description: 'Fewer than \u20B950L remaining.', cost: 0, deadline: 6 });
  }

  var debtJSON = JSON.stringify(debts);
  if (!stateRow) {
    var stateSh = getSheet(ctx, 'TeamState');
    stateSh.appendRow([teamCode, debtJSON, '{}', '{}']);
    invalidate(ctx, 'TeamState');
  } else {
    stateRow.sheet.getRange(stateRow.rowIndex, COL.TeamState.Debt_Ledger + 1).setValue(debtJSON);
    invalidate(ctx, 'TeamState');
  }
}

// =============================================================================
// SECTION 14 — ANALYST HOURS RESET
// =============================================================================

function resetAnalystHoursForAllTeams(ctx) {
  var d = getDataRows(ctx, 'TeamBalances');
  for (var i = 0; i < d.rows.length; i++) {
    if (!d.rows[i][COL.TeamBalances.TeamID]) continue;
    d.sheet.getRange(i + d.startRow, COL.TeamBalances.Analyst_Hours_Remaining + 1)
      .setValue(STARTING.analystHours);
  }
  invalidate(ctx, 'TeamBalances');
  Logger.log('Analyst Hours reset to ' + STARTING.analystHours + ' for all teams.');
}

// =============================================================================
// SECTION 15 — LEADERBOARD & SUBMISSIONS (admin)
// =============================================================================

function getLeaderboard(ctx) {
  requireAdmin(ctx);
  var sh  = getSheet(ctx, 'Scoring');
  var all = sh.getDataRange().getValues();
  if (all.length < 2) return { leaderboard: [] };

  var teamRows = {};
  for (var i = 1; i < all.length; i++) {
    var tid = String(all[i][COL.Scoring.TeamID]).toUpperCase();
    if (!tid) continue;
    if (!teamRows[tid]) teamRows[tid] = [];
    teamRows[tid].push({
      round:               Number(all[i][COL.Scoring.Round]),
      analyticalRigour:    Number(all[i][COL.Scoring.Analytical_Rigour])    || 0,
      financialDiscipline: Number(all[i][COL.Scoring.Financial_Discipline])  || 0,
      equityCompliance:    Number(all[i][COL.Scoring.Equity_Compliance])     || 0,
      adoptionChange:      Number(all[i][COL.Scoring.Adoption_Change])       || 0,
      strategicCoherence:  Number(all[i][COL.Scoring.Strategic_Coherence])   || 0,
      roundTotal:          Number(all[i][COL.Scoring.Round_Total])            || 0,
      cumulative:          Number(all[i][COL.Scoring.Cumulative_Disha_Index]) || 0,
    });
  }

  var teams   = getDataRows(ctx, 'Teams').rows;
  var nameMap = {};
  for (var t = 0; t < teams.length; t++) {
    nameMap[String(teams[t][COL.Teams.TeamID]).toUpperCase()] = String(teams[t][COL.Teams.TeamName]);
  }

  var lb = Object.keys(teamRows).map(function(tid) {
    var rows = teamRows[tid];
    var totAR=0, totFD=0, totEC=0, totAC=0, totSC=0;
    rows.forEach(function(r) {
      totAR += r.analyticalRigour; totFD += r.financialDiscipline;
      totEC += r.equityCompliance; totAC += r.adoptionChange;
      totSC += r.strategicCoherence;
    });
    var latestRow = rows.reduce(function(a, b) { return b.round > a.round ? b : a; }, rows[0]);
    return {
      teamID: tid, teamName: nameMap[tid] || tid,
      analyticalRigour: totAR, financialDiscipline: totFD,
      equityCompliance: totEC, adoptionChange: totAC,
      strategicCoherence: totSC, roundsPlayed: rows.length,
      dishaIndex: latestRow.cumulative,
      roundBreakdown: rows.sort(function(a, b) { return a.round - b.round; }),
    };
  });

  lb.sort(function(a, b) { return b.dishaIndex - a.dishaIndex; });
  return { leaderboard: lb };
}

function getAllSubmissions(ctx) {
  requireAdmin(ctx);
  var d = getDataRows(ctx, 'Submissions');
  var subs = [];
  for (var i = 0; i < d.rows.length; i++) {
    if (!d.rows[i][COL.Submissions.TeamID]) continue;
    subs.push({
      teamName:     d.rows[i][COL.Submissions.TeamID],
      roundNumber:  d.rows[i][COL.Submissions.Round],
      optionChosen: d.rows[i][COL.Submissions.OptionChosen],
      submittedAt:  d.rows[i][COL.Submissions.Timestamp],
    });
  }
  subs.sort(function(a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
  return { submissions: subs };
}

// =============================================================================
// SECTION 16 — TESTING & MAINTENANCE
// =============================================================================

function testSetup() {
  var ctx = buildCtx({});
  Logger.log('=== Project Disha Backend v1.3 — Self-Test ===');
  Logger.log('Sheet ID:         ' + SHEET_ID);
  Logger.log('AdminPasscode:    ' + (getConfigValue(ctx, 'AdminPasscode') ? 'SET' : 'NOT SET'));
  Logger.log('CurrentOpenRound: ' + (getConfigValue(ctx, 'CurrentOpenRound') || 'none'));
  Logger.log('Shock1 Triggered: ' + (getConfigValue(ctx, 'ShockEvent1_Triggered') || 'N'));
  Logger.log('Shock2 Triggered: ' + (getConfigValue(ctx, 'ShockEvent2_Triggered') || 'N'));
  Logger.log('Round state: '      + JSON.stringify(getRoundState(ctx)));
  var required = ['Config','Teams','TeamMembers','Submissions','TeamBalances',
                  'TeamMetrics','TeamState','Scoring','D1_Submissions','D2_Submissions','Reflections'];
  required.forEach(function(name) {
    var sh = ctx.ss.getSheetByName(name);
    Logger.log(name + ': ' + (sh ? 'OK (' + (sh.getLastRow() - 1) + ' data rows)' : 'MISSING'));
  });
  Logger.log('=== Self-test complete ===');
}

function resetTeamForTestingAction(ctx) {
  requireAdmin(ctx);
  var teamCode = String(ctx.params.teamCode || '').toUpperCase();
  if (!teamCode) throw new Error('Team code required.');
  resetTeamForTesting(teamCode);
  return { reset: true, teamCode: teamCode };
}

function resetTeamForTesting(teamCode) {
  if (!teamCode) { Logger.log('Usage: resetTeamForTesting("T1")'); return; }
  teamCode = String(teamCode).toUpperCase();
  var ctx  = buildCtx({});

  var bal = findBalance(ctx, teamCode);
  if (bal) {
    bal.sheet.getRange(bal.rowIndex, COL.TeamBalances.Budget_Remaining + 1, 1, 4)
      .setValues([[STARTING.budget, STARTING.changeCapital, STARTING.analystHours, 0]]);
    Logger.log('Reset TeamBalances for ' + teamCode);
  }

  var subSh = getSheet(ctx, 'Submissions');
  var all   = subSh.getDataRange().getValues();
  var toDelete = [];
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][COL.Submissions.TeamID]).toUpperCase() === teamCode) toDelete.push(i + 1);
  }
  toDelete.sort(function(a, b) { return b - a; });
  toDelete.forEach(function(row) { subSh.deleteRow(row); });
  Logger.log('Deleted ' + toDelete.length + ' submission row(s) for ' + teamCode + '.');

  var stateRow = findState(ctx, teamCode);
  if (stateRow) {
    stateRow.sheet.getRange(stateRow.rowIndex, COL.TeamState.Debt_Ledger + 1).setValue('[]');
    Logger.log('Cleared Debt Ledger for ' + teamCode + '.');
  }

  var scoreSh  = getSheet(ctx, 'Scoring');
  var scoreAll = scoreSh.getDataRange().getValues();
  var toDel2   = [];
  for (var s = 1; s < scoreAll.length; s++) {
    if (String(scoreAll[s][COL.Scoring.TeamID]).toUpperCase() === teamCode) toDel2.push(s + 1);
  }
  toDel2.sort(function(a, b) { return b - a; });
  toDel2.forEach(function(row) { scoreSh.deleteRow(row); });
  Logger.log('Deleted ' + toDel2.length + ' scoring row(s) for ' + teamCode + '.');
  Logger.log(teamCode + ' is clean. Re-run testSetup() to verify.');
}

function resetT1() { resetTeamForTesting('T1'); }
function resetT2() { resetTeamForTesting('T2'); }
function resetT3() { resetTeamForTesting('T3'); }

function addTeamMember(teamCode, memberName, passcode) {
  var ctx = buildCtx({});
  var sh  = getSheet(ctx, 'TeamMembers');
  sh.appendRow([teamCode.toUpperCase(), memberName.trim(), passcode.trim()]);
  Logger.log('Added: ' + memberName + ' (Team ' + teamCode + ').');
}

function openRound(n) {
  var ctx = buildCtx({ passcode: getConfigValue(buildCtx({}), 'AdminPasscode'),
                       roundNumber: String(n), newState: 'OPEN' });
  var r = setRoundState(ctx);
  Logger.log('Round ' + n + ' is now ' + r.status + '. Analyst Hours reset for all teams.');
}

function lockRound(n) {
  var ctx = buildCtx({ passcode: getConfigValue(buildCtx({}), 'AdminPasscode'),
                       roundNumber: String(n), newState: 'LOCKED' });
  var r = setRoundState(ctx);
  Logger.log('Round ' + n + ' is now ' + r.status + '.');
}
