// Round 3 — The Rollout (Shock Event 1 mid-round)
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.

var ROUND_3_OPTIONS = [
  { code: '3A', name: 'Store Champion Network',                 budgetCost: 60, analystCost: 10, changeDelta:  10, description: 'Train 50 frontline store champions to lead peer adoption in their locations. High Change Capital gain. Slower but sustainable. Works especially well if R1 choice surfaced digital divide data.' },
  { code: '3B', name: 'Mobile Microlearning Redesign',          budgetCost: 50, analystCost:  8, changeDelta:   3, description: 'Replace the existing e-learning with 3-minute mobile microlearning modules in regional languages. Lower cost; addresses literacy and device constraints.' },
  { code: '3C', name: 'Phased Rollout by Location Tier',        budgetCost: 40, analystCost:  6, changeDelta:   0, description: 'Roll out Metro first, then Tier-2, then Tier-3 over six months. Lowest cost; conservative. Tier-3 employees wait longest — equity risk if digital divide is severe.' },
  { code: '3D', name: 'Change Management & HR Ambassador',       budgetCost: 70, analystCost: 12, changeDelta:  15, description: 'Deploy a dedicated HR Ambassador programme with structured change management (Kotter 8-step). Highest Change Capital gain. Best for teams that spent Change Capital in R2.' },
  { code: '3E', name: 'Full-Throttle Simultaneous Launch',       budgetCost: 100, analystCost: 16, changeDelta: -15, description: 'Launch all systems simultaneously across all locations. Fastest time-to-live but severe Change Capital drain. High risk of adoption failure at Tier-3.' }
];

var ROUND_3_DATA_BRIEF = [
  'From Employee_Master: What is the Training_Completion_Rate for Frontline vs non-Frontline? Does this suggest existing L&D infrastructure supports a simultaneous rollout?',
  'From Employee_Master: How does Absenteeism_Rate vary by Location_Tier? What does high Tier-3 absenteeism imply for in-person champion programmes?',
  'From Employee_Master: Is there a correlation between Digital_Literacy_Score and Training_Completion_Rate? What does this mean for microlearning vs classroom training?',
  'SHOCK EVENT 1 (if triggered): A vendor server containing GreenLeaf employee data was accessed without authorisation. As DHTO you must respond. See the Breach Response section below.'
];

// Shock Event 1 — DPDP Data Breach
var SHOCK_1_TEXT = 'URGENT — DPDP DATA INCIDENT: A third-party HR-tech vendor has reported an unauthorised access event affecting approximately 340 GreenLeaf employee records (names, salary bands, device information). Under the DPDP Act 2023, GreenLeaf has reporting obligations. As the DHTO, you must respond in your submission. Address: (1) immediate containment steps; (2) notification obligations under DPDP; (3) whether your R2 architecture choice contributed to or mitigated this exposure; (4) remediation steps for the next 30 days.';
