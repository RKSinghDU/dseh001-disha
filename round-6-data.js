// Round 6 — The Future (D2 due at close of this round)
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.

var ROUND_6_OPTIONS = [
  { code: '6A', name: 'Gig Equity and Compliance Reset',              budgetCost:  70, analystCost: 16, changeDelta:  8, description: 'Address the gig-worker crisis directly: review Bronze-tier earnings algorithm, enroll eligible gig workers for SS-2020 benefits, establish a grievance SLA. Earns Change Capital. Responds to Shock 2 in data.' },
  { code: '6B', name: 'Reskilling and Internal Mobility',              budgetCost:  90, analystCost: 14, changeDelta:  5, description: 'Build a reskilling programme for employees at automation risk. Create internal mobility pathways. Earns Change Capital. Addresses long-term workforce sustainability.' },
  { code: '6C', name: 'Hybrid Work and Employee Experience Strategy',  budgetCost:  65, analystCost: 12, changeDelta:  0, description: 'Design a hybrid work policy for eligible roles; invest in EX touchpoints. Lower Analyst Hours. Neutral Change Capital. Best for teams with high Change Capital already.' },
  { code: '6D', name: 'AI Governance and Responsible Automation Charter', budgetCost: 55, analystCost: 18, changeDelta: 0, description: 'Formalise AI governance: model cards for all deployed algorithms, quarterly fairness audits, employee appeal rights. Builds on R4 algorithmic work. High Analyst Hours.' },
  { code: '6E', name: 'Integrated Future-of-Work Strategy (Comprehensive)', budgetCost: 130, analystCost: 22, changeDelta: 0, description: 'Combine gig equity, reskilling, hybrid work, and AI governance into a single Board-level strategy. Most expensive. Neutral Change Capital. Best Disha Index score if budget remains.' }
];

var ROUND_6_DATA_BRIEF = [
  'From Gig_Workforce: Calculate mean Monthly_Earnings by Partner_Tier (Bronze, Silver, Gold). Compute the Bronze/Gold earnings ratio.',
  'From Gig_Workforce: What proportion of Bronze-tier gig workers are SS2020_Eligible but NOT Benefits_Enrolled? Compare with Gold tier.',
  'From Gig_Workforce: What is the Grievances_Filed rate for Bronze vs Gold? Compute the ratio.',
  'From Gig_Workforce: Find GL-1002 (Sunil K.). Report his tier, earnings, enrolment status, and grievance count.',
  'From PeopleAnalytics_Fact: Using the automation risk scores, which Job_Categories face the highest displacement risk? What reskilling investment does this imply?',
  'D2 (Future-of-Work Board Memo) is due at the close of this round. The Remediation Table in D2 must cite specific before/after figures from the dataset.'
];
