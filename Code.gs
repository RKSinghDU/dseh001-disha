/**
 * =============================================================================
 *  Project Disha — Apps Script Backend (Code.gs)
 *  DSEH001 Digital HR & People Analytics Simulation
 *  Course Coordinator: Prof. R. K. Singh, University of Delhi
 *
 *  v1.0 — Initial build for PGCF 2025 semester.
 *         Triple-currency resource model:
 *           Budget  (Rs Lakhs, cumulative pool Rs 600L across R1-R6)
 *           Change Capital  (100 pts, persists round-to-round, does NOT reset)
 *           Analyst Hours   (60 hrs per round, RESETS at the start of each round)
 *
 *  Modelled on DSEH004 Pratibha AppsScript_Backend.gs v2.5 —
 *  key differences: triple currency; five scoring axes; Debt Ledger;
 *  Shock Event triggers; Fairness Audit data capture; no Peer Eval.
 *
 *  REQUIRED SHEET TABS  (created by the bootstrap script in Step 1):
 *    Config · Teams · TeamMembers · Submissions · TeamBalances ·
 *    TeamMetrics · TeamState · Scoring · D1_Submissions · D2_Submissions ·
 *    Reflections
 *
 *  DEPLOYMENT:
 *    1. Open Master Sheet → Extensions → Apps Script.
 *    2. Replace all content with this file. Save (Ctrl+S).
 *    3. Run testSetup() to verify the script compiles and reads the sheet.
 *    4. Deploy → New deployment → Web App:
 *         Execute as: Me (rksingh@commerce.du.ac.in)
 *         Who has access: Anyone (or anyone in DU)
 *       Copy the Web App URL.
 *    5. Paste the Web App URL into simulation.js → SIM_CONFIG.apiUrl.
 *    6. Commit simulation.js to GitHub and push to GitHub Pages.
 *    7. ALWAYS deploy as a NEW VERSION when code changes.
 *
 *  STANDING RULES (from Runbook Part I):
 *    - ROUND_COSTS here is the authoritative deduction source.
 *      round-N-data.js is display only. Keep them IDENTICAL.
 *    - Never resetTeamForTesting() on live data.
 *    - Deploy as a NEW VERSION after every code change.
 * =============================================================================
 */

// =============================================================================
// SECTION 1 — CONSTANTS & CONFIGURATION
// =============================================================================

/** Master Sheet ID — set once, never change during the semester. */
const SHEET_ID = '1YWMU8ME2wrrTa5bBVjOsgia0nuqwFTr0XVV_pUsUxFo';

/** Starting resource values (also held in Config tab for reference). */
const STARTING = {
  budget:       600,   // Rs 600L total across all six rounds
  changeCapital: 100,  // 100 pts; persists; does NOT reset
  analystHours:   60,  // 60 hrs per round; RESETS each round
};

/** Change Capital thresholds (matching simulation.js). */
const CC_WARNING = 30;   // some options unavailable below this
const CC_DANGER  = 10;   // Board intervention scenario below this

/** Minimum Analyst Hours before a warning is appended to the outcome. */
const ANALYST_MIN = 20;

// Cache TTLs (seconds)
const CACHE_TTL_STATE  = 300;    // 5 min — round state, shock state
const CACHE_TTL_CONFIG = 3600;   // 1 hr  — config values
const CK_ROUND_STATE   = 'disha:roundState';
const CK_CONFIG_PFX    = 'disha:config:';

// =============================================================================
// SECTION 2 — AUTHORITATIVE ROUND COSTS (Runbook Part D)
// These values are the SINGLE SOURCE OF TRUTH for resource deductions.
// They must match the costs in every round-N-data.js file exactly.
// DO NOT change after students have started submitting.
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
// SECTION 3 — SCORING WEIGHTS (Runbook Part F)
// Each axis is scored 0-4 per round. computeScores() populates the Scoring tab.
// The engine computes an automatic score; instructor may override in the sheet.
// =============================================================================
const SCORING_AXES = [
  'Analytical_Rigour',
  'Financial_Discipline',
  'Equity_Compliance',
  'Adoption_Change',
  'Strategic_Coherence',
];

// =============================================================================
// SECTION 4 — SHEET COLUMN MAPS
// Maps column name → 0-based index for each tab.
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
      // ── Auth & reads ──────────────────────────────────────────────────────
      case 'verifyMember':      result = verifyMember(ctx);    break;
      case 'verifyAdmin':       result = verifyAdmin(ctx);     break;
      case 'getTeamBalance':    result = getTeamBalance(ctx);  break;
      case 'getRoundState':     result = getRoundState(ctx);   break;
      case 'getConfig':         result = getConfigAll(ctx);    break;
      case 'getLeaderboard':    result = getLeaderboard(ctx);  break;
      case 'getAllSubmissions':  result = getAllSubmissions(ctx); break;

      // ── Writes ───────────────────────────────────────────────────────────
      case 'submitRound':       result = submitRound(ctx);     break;

      // ── Admin ────────────────────────────────────────────────────────────
      case 'setRoundState':     result = setRoundState(ctx);   break;
      case 'triggerShock':      result = triggerShock(ctx);    break;
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
  if (!sh) throw new Error('Sheet not found: ' + name + '. Run the bootstrap script.');
  ctx.sheets[name] = sh;
  return sh;
}

/**
 * Read all data rows from a sheet, skipping the header row.
 * Results are memoised on ctx.rows[name] for the lifetime of the request.
 */
function getDataRows(ctx, name) {
  if (ctx.rows[name]) return ctx.rows[name];
  var sh = getSheet(ctx, name);
  var all = sh.getDataRange().getValues();
  // Skip row 0 (header)
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
  var hit = ctx.cache.get(cKey);
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
  var d = getDataRows(ctx, 'Config');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Config.Key]) === key) {
      sh.getRange(i + d.startRow, COL.Config.Value + 1).setValue(value);
      invalidate(ctx, 'Config');
      ctx.cache.remove(CK_CONFIG_PFX + key);
      return;
    }
  }
  // Key not found — append
  sh.appendRow([key, value]);
  invalidate(ctx, 'Config');
  ctx.cache.remove(CK_CONFIG_PFX + key);
}

/** Returns the entire Config tab as a key→value object (for getConfig action). */
function getConfigAll(ctx) {
  requireAdmin(ctx);
  var d = getDataRows(ctx, 'Config');
  var out = {};
  for (var i = 0; i < d.rows.length; i++) {
    out[String(d.rows[i][COL.Config.Key])] = String(d.rows[i][COL.Config.Value]);
  }
  return out;
}

// =============================================================================
// SECTION 8 — AUTHENTICATION
// =============================================================================

/** Find a team row by TeamID (case-insensitive). Returns row array or null. */
function findTeam(ctx, teamId) {
  var d = getDataRows(ctx, 'Teams');
  var target = String(teamId).toUpperCase();
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Teams.TeamID]).toUpperCase() === target) {
      return d.rows[i];
    }
  }
  return null;
}

/**
 * verifyMember: called by the login page.
 * Looks up memberName + teamCode in TeamMembers, validates passcode.
 * Returns { authenticated, memberName, teamCode, teamName }.
 */
function verifyMember(ctx) {
  var memberName = String(ctx.params.memberName || '').trim();
  var passcode   = String(ctx.params.passcode   || '').trim();
  var teamCode   = String(ctx.params.teamCode   || '').toUpperCase();
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

/**
 * requireMemberAuth: call at the start of any write action.
 * Throws if credentials do not match. Memoised on ctx._auth.
 */
function requireMemberAuth(ctx) {
  if (ctx._auth) return ctx._auth;
  var memberName = String(ctx.params.memberName     || '').trim();
  var passcode   = String(ctx.params.memberPasscode || '').trim();
  var teamCode   = String(ctx.params.teamCode       || '').toUpperCase();

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
  var given = String(ctx.params.passcode || '').trim();
  var stored = getConfigValue(ctx, 'AdminPasscode');
  return { authenticated: (given && given === stored) };
}

function requireAdmin(ctx) {
  if (!verifyAdmin(ctx).authenticated) {
    throw new Error('Admin authentication required.');
  }
}

// =============================================================================
// SECTION 9 — TEAM BALANCE (read)
// =============================================================================

/** Returns the balance row for a team (or null if never submitted). */
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

/** Returns the TeamState row for a team (or null if not yet created). */
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

/**
 * getTeamBalance: public action.
 * Returns { resources, submissions, debtLedger, teamName }.
 */
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

  var teamState = findState(ctx, teamCode);
  var debtLedger = '[]';
  if (teamState) {
    debtLedger = String(teamState.data[COL.TeamState.Debt_Ledger] || '[]');
  }

  var submissions = getTeamSubmissions(ctx, teamCode);

  return {
    teamName:    String(team[COL.Teams.TeamName]),
    resources:   resources,
    submissions: submissions,
    debtLedger:  debtLedger,
  };
}

/** Returns an object keyed by 'r1'…'r6' → submission summary. */
function getTeamSubmissions(ctx, teamCode) {
  var d = getDataRows(ctx, 'Submissions');
  var target = String(teamCode).toUpperCase();
  var subs = {};
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][COL.Submissions.TeamID]).toUpperCase() !== target) continue;
    var r = d.rows[i][COL.Submissions.Round];
    subs['r' + r] = {
      optionChosen: d.rows[i][COL.Submissions.OptionChosen],
      timestamp:    d.rows[i][COL.Submissions.Timestamp],
    };
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
  // Collect round lock rows and shock trigger rows
  for (var i = 0; i < d.rows.length; i++) {
    var key = String(d.rows[i][COL.Config.Key]);
    var val = String(d.rows[i][COL.Config.Value]);
    if (key.indexOf('RoundLock_R') === 0) {
      var rNum = key.replace('RoundLock_R', '');
      state['r' + rNum] = val;   // 'OPEN' or 'LOCKED'
    }
    if (key === 'ShockEvent1_Triggered') state.ShockEvent1_Triggered = val;
    if (key === 'ShockEvent2_Triggered') state.ShockEvent2_Triggered = val;
    if (key === 'CurrentOpenRound')      state.CurrentOpenRound = val;
  }
  ctx.cache.put(CK_ROUND_STATE, JSON.stringify(state), CACHE_TTL_STATE);
  return state;
}

/** Admin: open or lock a round. newState must be 'OPEN' or 'LOCKED'. */
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
    // Reset Analyst Hours for all teams when a new round opens
    resetAnalystHoursForAllTeams(ctx);
  }
  ctx.cache.remove(CK_ROUND_STATE);
  return { roundNumber: roundNumber, status: newState };
}

/**
 * triggerShock: admin action. Sets ShockEvent1_Triggered or
 * ShockEvent2_Triggered = 'Y' in Config. Irreversible.
 */
function triggerShock(ctx) {
  requireAdmin(ctx);
  var n = parseInt(ctx.params.shockNumber);
  if (n !== 1 && n !== 2) throw new Error('shockNumber must be 1 or 2.');
  var key = 'ShockEvent' + n + '_Triggered';
  setConfigValue(ctx, key, 'Y');
  ctx.cache.remove(CK_ROUND_STATE);
  Logger.log('Shock Event ' + n + ' triggered by admin.');
  return { shockNumber: n, triggered: true };
}

// =============================================================================
// SECTION 11 — SUBMIT ROUND (the core write action)
// =============================================================================

function submitRound(ctx) {
  var teamCode = String(ctx.params.teamCode || '').toUpperCase();
  if (!teamCode) throw new Error('Team code required.');
  requireMemberAuth(ctx);

  // Parse payload
  var p = {};
  if (ctx.params.payload) {
    try { p = JSON.parse(ctx.params.payload); } catch (e) { p = {}; }
  }
  var roundNumber   = parseInt(ctx.params.roundNumber);
  var optionChosen  = String(p.optionChosen  || '').toUpperCase().trim();
  var rationale     = String(p.rationale     || '').trim();
  var auditData     = p.auditData     || null;
  var shockResponse = String(p.shockResponse || '').trim();
  var scribeName    = String(p.scribeName    || '').trim();

  if (!roundNumber || roundNumber < 1 || roundNumber > 6) {
    throw new Error('Invalid round number.');
  }
  if (!optionChosen) throw new Error('An option must be selected.');
  if (!rationale || rationale.split(/\s+/).filter(Boolean).length < 200) {
    throw new Error('Evidence Rationale must be at least 200 words.');
  }

  // Verify round is open
  var roundState = getRoundState(ctx);
  if (roundState['r' + roundNumber] !== 'OPEN') {
    throw new Error('Round ' + roundNumber + ' is not currently open for submission.');
  }

  // Verify team exists
  var team = findTeam(ctx, teamCode);
  if (!team) throw new Error('Team not found: ' + teamCode);

  // Check for duplicate submission
  var existingSubs = getTeamSubmissions(ctx, teamCode);
  if (existingSubs['r' + roundNumber]) {
    throw new Error('Your team has already submitted Round ' + roundNumber + '.');
  }

  // Look up costs
  var costTable = ROUND_COSTS[roundNumber];
  if (!costTable) throw new Error('No cost table defined for Round ' + roundNumber + '.');
  var costs = costTable[optionChosen];
  if (!costs) {
    throw new Error('Option "' + optionChosen + '" is not recognised for Round ' + roundNumber + '.');
  }
  var budgetCost  = costs.budget       || 0;
  var analystCost = costs.analystHours || 0;
  var changeDelta = costs.changeDelta  || 0;

  // Load current balances
  var bal = findBalance(ctx, teamCode);
  var curBudget, curCC, curAH, curRound;
  if (!bal) {
    curBudget = STARTING.budget;
    curCC     = STARTING.changeCapital;
    curAH     = STARTING.analystHours;
    curRound  = 0;
  } else {
    curBudget = Number(bal.data[COL.TeamBalances.Budget_Remaining])       || 0;
    curCC     = Number(bal.data[COL.TeamBalances.Change_Capital])          || 0;
    curAH     = Number(bal.data[COL.TeamBalances.Analyst_Hours_Remaining]) || 0;
    curRound  = Number(bal.data[COL.TeamBalances.Round_Last_Submitted])    || 0;
  }

  // Hard guards: cannot overspend budget; cannot overspend analyst hours
  if (budgetCost > curBudget) {
    throw new Error(
      'Option ' + optionChosen + ' costs \u20B9' + budgetCost +
      'L but only \u20B9' + curBudget + 'L remains. Choose a lower-cost option.');
  }
  if (analystCost > curAH) {
    throw new Error(
      'Option ' + optionChosen + ' requires ' + analystCost +
      ' Analyst Hours but only ' + curAH + ' remain this round. Choose a less intensive option.');
  }
  if (curCC + changeDelta < 0) {
    throw new Error(
      'Option ' + optionChosen + ' would reduce Change Capital below 0. ' +
      'Your team does not have enough organisational goodwill for this option.');
  }

  // Compute new balances
  var newBudget = curBudget - budgetCost;
  var newCC     = Math.max(0, Math.min(100, curCC + changeDelta));
  var newAH     = Math.max(0, curAH - analystCost);

  // Minimum-analysis warning (not a block)
  var analysisWarning = null;
  if (analystCost < ANALYST_MIN) {
    analysisWarning =
      'Your team spent only ' + analystCost + ' Analyst Hours this round (minimum recommended: ' +
      ANALYST_MIN + '). This may reduce your Analytical Rigour score.';
  }

  // ── Write to Submissions tab ─────────────────────────────────────────────
  var subSh = getSheet(ctx, 'Submissions');
  var auditJSON  = auditData     ? JSON.stringify(auditData)     : '';
  var shockJSON  = shockResponse ? JSON.stringify(shockResponse) : '';
  // We pack auditData and shockResponse into the Rationale field
  // (as appended JSON blocks) so nothing is lost.
  var rationaleStored = rationale;
  if (auditJSON)  rationaleStored += '\n\n--- FAIRNESS_AUDIT ---\n' + auditJSON;
  if (shockJSON)  rationaleStored += '\n\n--- SHOCK_RESPONSE ---\n' + shockJSON;

  subSh.appendRow([
    teamCode,
    roundNumber,
    new Date(),
    optionChosen,
    rationaleStored,
    budgetCost,
    changeDelta,
    analystCost,
  ]);
  invalidate(ctx, 'Submissions');

  // ── Update or create TeamBalances row ───────────────────────────────────
  if (!bal) {
    var balSh = getSheet(ctx, 'TeamBalances');
    balSh.appendRow([teamCode, newBudget, newCC, newAH, roundNumber]);
    invalidate(ctx, 'TeamBalances');
  } else {
    bal.sheet.getRange(bal.rowIndex, COL.TeamBalances.Budget_Remaining + 1, 1, 4)
      .setValues([[newBudget, newCC, newAH, roundNumber]]);
    invalidate(ctx, 'TeamBalances');
  }

  // ── Compute and record scores ────────────────────────────────────────────
  var scores = computeAutoScores(roundNumber, optionChosen, analystCost, newBudget, newCC);
  recordScores(ctx, teamCode, roundNumber, scores);

  // ── Update Debt Ledger ───────────────────────────────────────────────────
  updateDebtLedger(ctx, teamCode, roundNumber, optionChosen, newCC, newBudget);

  return {
    submittedAt: new Date().toISOString(),
    optionChosen: optionChosen,
    costs: { budgetCost: budgetCost, changeDelta: changeDelta, analystCost: analystCost },
    newResources: {
      budgetRemaining:       newBudget,
      changeCapital:         newCC,
      analystHoursRemaining: newAH,
    },
    scores:          scores,
    analysisWarning: analysisWarning,
  };
}

// =============================================================================
// SECTION 12 — SCORING ENGINE
// =============================================================================

/**
 * computeAutoScores: produces provisional axis scores 0-4.
 * These represent the engine's automatic judgement only.
 * Instructors should review the Scoring tab and may override per the
 * grading rubric in Runbook Part F.
 */
function computeAutoScores(roundNumber, optionChosen, analystCost, newBudget, newCC) {

  // ── Analytical Rigour ─────────────────────────────────────────────────────
  // Proxy: full Analyst Hours usage → higher rigour possible.
  var rigour;
  if      (analystCost >= 20) rigour = 3;
  else if (analystCost >= 12) rigour = 2;
  else if (analystCost >=  6) rigour = 1;
  else                        rigour = 0;
  // R4 fairness audit round adds a bonus floor of 2 if the audit option
  // includes meaningful analyst spend.
  if (roundNumber === 4 && analystCost >= 14) rigour = Math.max(rigour, 3);

  // ── Financial Discipline ─────────────────────────────────────────────────
  // Simple heuristic: does the team have reasonable budget left?
  var finDisc;
  if      (newBudget >= 200) finDisc = 4;
  else if (newBudget >= 100) finDisc = 3;
  else if (newBudget >=  50) finDisc = 2;
  else if (newBudget >=   1) finDisc = 1;
  else                       finDisc = 0;

  // ── Equity & Compliance ──────────────────────────────────────────────────
  // R4: options 4B, 4C, 4D score higher on Equity axis.
  // R6: option 6A scores higher on Equity axis.
  // Other rounds: neutral start of 2; instructor adjusts.
  var equity = 2;
  var equityHighOpts = { '4B':3, '4C':3, '4D':3, '4E':2, '4A':1, '6A':3, '6D':2 };
  if (equityHighOpts[optionChosen] !== undefined) equity = equityHighOpts[optionChosen];

  // ── Adoption & Change ────────────────────────────────────────────────────
  // Options that earn Change Capital → better adoption outcome.
  var changeCosts = ROUND_COSTS[roundNumber] || {};
  var cd = (changeCosts[optionChosen] || {}).changeDelta || 0;
  var adoption;
  if      (cd >= 10) adoption = 4;
  else if (cd >=  5) adoption = 3;
  else if (cd >=  0) adoption = 2;
  else if (cd >=  -5) adoption = 1;
  else               adoption = 0;

  // ── Strategic Coherence ──────────────────────────────────────────────────
  // Cannot auto-assess coherence without full conversation state.
  // Default = 2; instructor reviews and overrides in the Scoring tab.
  var coherence = 2;

  var total = rigour + finDisc + equity + adoption + coherence;
  return {
    Analytical_Rigour:    rigour,
    Financial_Discipline: finDisc,
    Equity_Compliance:    equity,
    Adoption_Change:      adoption,
    Strategic_Coherence:  coherence,
    Round_Total:          total,
  };
}

/** Writes a scoring row and updates the Cumulative_Disha_Index column. */
function recordScores(ctx, teamCode, roundNumber, scores) {
  var sh = getSheet(ctx, 'Scoring');

  // Find or create team rows for cumulative calculation
  var allScores = sh.getDataRange().getValues();
  var cumulative = 0;
  // Sum Round_Total for all previous rounds of this team
  for (var i = 1; i < allScores.length; i++) {
    if (String(allScores[i][COL.Scoring.TeamID]).toUpperCase() === teamCode &&
        Number(allScores[i][COL.Scoring.Round]) !== roundNumber) {
      cumulative += Number(allScores[i][COL.Scoring.Round_Total]) || 0;
    }
  }
  cumulative += scores.Round_Total;

  sh.appendRow([
    teamCode,
    roundNumber,
    scores.Analytical_Rigour,
    scores.Financial_Discipline,
    scores.Equity_Compliance,
    scores.Adoption_Change,
    scores.Strategic_Coherence,
    scores.Round_Total,
    cumulative,
  ]);
}

// =============================================================================
// SECTION 13 — DEBT LEDGER
// =============================================================================

/**
 * updateDebtLedger: adds a Debt Ledger entry when certain conditions are met.
 * Entries are JSON arrays stored in TeamState.Debt_Ledger.
 * Format: [{ label, description, cost, deadline }, ...]
 */
function updateDebtLedger(ctx, teamCode, roundNumber, optionChosen, newCC, newBudget) {
  var stateRow = findState(ctx, teamCode);
  var debts = [];
  if (stateRow) {
    try { debts = JSON.parse(String(stateRow.data[COL.TeamState.Debt_Ledger] || '[]')); }
    catch (e) { debts = []; }
  }

  // Rule 1: If Change Capital falls below CC_WARNING, log a governance debt
  if (newCC < CC_WARNING && newCC > CC_DANGER) {
    var alreadyCC = debts.some(function (d) { return d.label === 'Low Change Capital'; });
    if (!alreadyCC) {
      debts.push({
        label:       'Low Change Capital',
        description: 'Change Capital below 30. Some high-impact options may be unavailable next round.',
        cost:        20,
        deadline:    Math.min(roundNumber + 2, 6),
      });
    }
  }

  // Rule 2: If Change Capital falls to/below CC_DANGER, escalate
  if (newCC <= CC_DANGER) {
    var alreadyDanger = debts.some(function (d) { return d.label === 'Board Intervention'; });
    if (!alreadyDanger) {
      debts.push({
        label:       'Board Intervention',
        description: 'Change Capital at critical level. Mandatory advisory round triggered. Cost if unresolved.',
        cost:        40,
        deadline:    Math.min(roundNumber + 1, 6),
      });
    }
  }

  // Rule 3: R2 option 2E (Full Ecosystem) or 2A (Cloud-First) without Privacy-by-Design
  // → logs a DPDP compliance debt (to be tested in R3 shock)
  if (roundNumber === 2 && (optionChosen === '2E' || optionChosen === '2A')) {
    var alreadyDPDP = debts.some(function (d) { return d.label === 'DPDP Compliance Exposure'; });
    if (!alreadyDPDP) {
      debts.push({
        label:       'DPDP Compliance Exposure',
        description: 'Architecture did not include privacy-by-design. Breach response cost will be higher if Shock 1 occurs.',
        cost:        50,
        deadline:    3,
      });
    }
  }

  // Rule 4: R3 option 3E (Full-Throttle) → adoption debt
  if (roundNumber === 3 && optionChosen === '3E') {
    debts.push({
      label:       'Frontline Adoption Backlog',
      description: 'Simultaneous launch created adoption resistance at Tier-3. Recovery cost if not addressed in R5.',
      cost:        30,
      deadline:    5,
    });
  }

  // Rule 5: R4 option 4A (Suspend only) → model still broken, debt in R5
  if (roundNumber === 4 && optionChosen === '4A') {
    debts.push({
      label:       'Unresolved Algorithmic Bias',
      description: 'Flight-risk model was suspended but not remediated. GL-1004 case unresolved. Equity score penalty in R5.',
      cost:        25,
      deadline:    5,
    });
  }

  // Rule 6: Budget below Rs 50L after any round → financial stress flag
  if (newBudget < 50) {
    var alreadyBudget = debts.some(function (d) { return d.label === 'Budget Stress'; });
    if (!alreadyBudget) {
      debts.push({
        label:       'Budget Stress',
        description: 'Fewer than \u20B950L remaining. Options in later rounds will be limited.',
        cost:        0,
        deadline:    6,
      });
    }
  }

  // Write back
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
// Called when a new round is opened. Resets analystHoursRemaining for all teams.
// =============================================================================

function resetAnalystHoursForAllTeams(ctx) {
  var d = getDataRows(ctx, 'TeamBalances');
  var sh = d.sheet;
  for (var i = 0; i < d.rows.length; i++) {
    if (!d.rows[i][COL.TeamBalances.TeamID]) continue;
    // Column index 3 (0-based) = Analyst_Hours_Remaining = column D (1-based = 4)
    sh.getRange(i + d.startRow, COL.TeamBalances.Analyst_Hours_Remaining + 1)
      .setValue(STARTING.analystHours);
  }
  invalidate(ctx, 'TeamBalances');
  Logger.log('Analyst Hours reset to ' + STARTING.analystHours + ' for all teams.');
}

// =============================================================================
// SECTION 15 — LEADERBOARD & SUBMISSIONS (admin reads)
// =============================================================================

function getLeaderboard(ctx) {
  requireAdmin(ctx);
  var sh = getSheet(ctx, 'Scoring');
  var all = sh.getDataRange().getValues();
  if (all.length < 2) return { leaderboard: [] };

  // Aggregate cumulative Disha Index per team
  var byTeam = {};
  for (var i = 1; i < all.length; i++) {
    var tid  = String(all[i][COL.Scoring.TeamID]).toUpperCase();
    if (!tid) continue;
    var cum = Number(all[i][COL.Scoring.Cumulative_Disha_Index]) || 0;
    byTeam[tid] = {
      teamID:              tid,
      analyticalRigour:    Number(all[i][COL.Scoring.Analytical_Rigour])    || 0,
      financialDiscipline: Number(all[i][COL.Scoring.Financial_Discipline])  || 0,
      equityCompliance:    Number(all[i][COL.Scoring.Equity_Compliance])     || 0,
      adoptionChange:      Number(all[i][COL.Scoring.Adoption_Change])       || 0,
      strategicCoherence:  Number(all[i][COL.Scoring.Strategic_Coherence])   || 0,
      dishaIndex:          cum,
    };
  }

  // Get team names
  var teams = getDataRows(ctx, 'Teams').rows;
  var nameMap = {};
  for (var t = 0; t < teams.length; t++) {
    nameMap[String(teams[t][COL.Teams.TeamID]).toUpperCase()] =
      String(teams[t][COL.Teams.TeamName]);
  }

  var lb = Object.values(byTeam).map(function (row) {
    row.teamName = nameMap[row.teamID] || row.teamID;
    return row;
  });
  lb.sort(function (a, b) { return b.dishaIndex - a.dishaIndex; });
  return { leaderboard: lb };
}

function getAllSubmissions(ctx) {
  requireAdmin(ctx);
  var d = getDataRows(ctx, 'Submissions');
  var subs = [];
  for (var i = 0; i < d.rows.length; i++) {
    if (!d.rows[i][COL.Submissions.TeamID]) continue;
    subs.push({
      teamName:     d.rows[i][COL.Submissions.TeamID],  // TeamID used as identifier
      roundNumber:  d.rows[i][COL.Submissions.Round],
      optionChosen: d.rows[i][COL.Submissions.OptionChosen],
      submittedAt:  d.rows[i][COL.Submissions.Timestamp],
      scribeName:   '',   // scribeName not stored separately; extractable from rationale
    });
  }
  subs.sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
  return { submissions: subs };
}

// =============================================================================
// SECTION 16 — TESTING & MAINTENANCE UTILITIES
// =============================================================================

/**
 * testSetup: run manually from the Apps Script editor to verify the script
 * compiles, the sheet exists, and Config is readable.
 */
function testSetup() {
  var ctx = buildCtx({});
  Logger.log('=== Project Disha Backend v1.0 — Self-Test ===');
  Logger.log('Sheet ID:         ' + SHEET_ID);
  Logger.log('AdminPasscode:    ' + (getConfigValue(ctx, 'AdminPasscode') ? 'SET' : 'NOT SET'));
  Logger.log('CurrentOpenRound: ' + (getConfigValue(ctx, 'CurrentOpenRound') || 'none'));
  Logger.log('Shock1 Triggered: ' + (getConfigValue(ctx, 'ShockEvent1_Triggered') || 'N'));
  Logger.log('Shock2 Triggered: ' + (getConfigValue(ctx, 'ShockEvent2_Triggered') || 'N'));
  Logger.log('Round state: ' + JSON.stringify(getRoundState(ctx)));

  // Check all required tabs
  var required = ['Config','Teams','TeamMembers','Submissions','TeamBalances',
                  'TeamMetrics','TeamState','Scoring','D1_Submissions',
                  'D2_Submissions','Reflections'];
  required.forEach(function (name) {
    var sh = ctx.ss.getSheetByName(name);
    Logger.log(name + ': ' + (sh ? 'OK (' + (sh.getLastRow() - 1) + ' data rows)' : 'MISSING'));
  });
  Logger.log('=== Self-test complete ===');
}

/**
 * resetTeamForTestingAction: called via admin panel POST.
 * Clears Submissions rows and resets TeamBalances for the given team.
 * USE ONLY during pre-semester testing. Never on live student data.
 */
function resetTeamForTestingAction(ctx) {
  requireAdmin(ctx);
  var teamCode = String(ctx.params.teamCode || '').toUpperCase();
  if (!teamCode) throw new Error('Team code required.');
  resetTeamForTesting(teamCode);
  return { reset: true, teamCode: teamCode };
}

/**
 * resetTeamForTesting: callable from the Apps Script console directly.
 * e.g. resetTeamForTesting('T1')
 */
function resetTeamForTesting(teamCode) {
  if (!teamCode) { Logger.log('Usage: resetTeamForTesting("T1")'); return; }
  teamCode = String(teamCode).toUpperCase();
  var ctx = buildCtx({});

  // Reset TeamBalances
  var bal = findBalance(ctx, teamCode);
  if (bal) {
    bal.sheet.getRange(bal.rowIndex, COL.TeamBalances.Budget_Remaining + 1, 1, 4)
      .setValues([[STARTING.budget, STARTING.changeCapital, STARTING.analystHours, 0]]);
    Logger.log('Reset TeamBalances for ' + teamCode);
  } else {
    Logger.log('No TeamBalances row for ' + teamCode + ' (was never submitted).');
  }

  // Delete Submission rows for this team
  var subSh = getSheet(ctx, 'Submissions');
  var all = subSh.getDataRange().getValues();
  var toDelete = [];
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][COL.Submissions.TeamID]).toUpperCase() === teamCode) {
      toDelete.push(i + 1);  // 1-based row number
    }
  }
  toDelete.sort(function (a, b) { return b - a; });  // delete from bottom up
  toDelete.forEach(function (row) { subSh.deleteRow(row); });
  Logger.log('Deleted ' + toDelete.length + ' submission row(s) for ' + teamCode + '.');

  // Clear TeamState (Debt Ledger)
  var stateRow = findState(ctx, teamCode);
  if (stateRow) {
    stateRow.sheet.getRange(stateRow.rowIndex, COL.TeamState.Debt_Ledger + 1)
      .setValue('[]');
    Logger.log('Cleared Debt Ledger for ' + teamCode + '.');
  }

  // Clear Scoring rows for this team
  var scoreSh = getSheet(ctx, 'Scoring');
  var scoreAll = scoreSh.getDataRange().getValues();
  var toDeleteScore = [];
  for (var s = 1; s < scoreAll.length; s++) {
    if (String(scoreAll[s][COL.Scoring.TeamID]).toUpperCase() === teamCode) {
      toDeleteScore.push(s + 1);
    }
  }
  toDeleteScore.sort(function (a, b) { return b - a; });
  toDeleteScore.forEach(function (row) { scoreSh.deleteRow(row); });
  Logger.log('Deleted ' + toDeleteScore.length + ' scoring row(s) for ' + teamCode + '.');

  Logger.log(teamCode + ' is back to a clean slate. Re-run testSetup() to verify.');
}

function resetT1() { resetTeamForTesting('T1'); }
function resetT2() { resetTeamForTesting('T2'); }
function resetT3() { resetTeamForTesting('T3'); }

/**
 * addTeamMember: helper to add a student to the TeamMembers tab from the console.
 * Usage: addTeamMember('T1', 'Priya Sharma', 'priya2025')
 */
function addTeamMember(teamCode, memberName, passcode) {
  var ctx = buildCtx({});
  var sh = getSheet(ctx, 'TeamMembers');
  sh.appendRow([teamCode.toUpperCase(), memberName.trim(), passcode.trim()]);
  Logger.log('Added member: ' + memberName + ' (Team ' + teamCode + ').');
}

/**
 * openRound: console shortcut. Usage: openRound(1)
 * Equivalent to admin panel Open Round, but callable without a browser.
 */
function openRound(n) {
  var ctx = buildCtx({ passcode: getConfigValue(buildCtx({}), 'AdminPasscode'),
                       roundNumber: String(n), newState: 'OPEN' });
  var result = setRoundState(ctx);
  Logger.log('Round ' + n + ' is now ' + result.status + '.');
  Logger.log('Analyst Hours reset for all teams.');
}

function lockRound(n) {
  var ctx = buildCtx({ passcode: getConfigValue(buildCtx({}), 'AdminPasscode'),
                       roundNumber: String(n), newState: 'LOCKED' });
  var result = setRoundState(ctx);
  Logger.log('Round ' + n + ' is now ' + result.status + '.');
}
