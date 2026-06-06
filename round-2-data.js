// Round 2 — The Architecture (D1 due at close of this round)
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.

var ROUND_2_OPTIONS = [
  { code: '2A', name: 'Cloud-First Migration (Consolidate)',  budgetCost: 160, analystCost: 20, changeDelta: -10, description: 'Migrate all HR systems to a single cloud HRIS. Fast consolidation but high cost and change resistance. Displaces the legacy dual-system without phasing.' },
  { code: '2B', name: 'Mobile-First Modular Stack',           budgetCost: 120, analystCost: 14, changeDelta:   5, description: 'Build a mobile-first modular stack optimised for frontline access. Lower cost; earns Change Capital through inclusivity. Requires careful API integration.' },
  { code: '2C', name: 'Minimum-Viable HRIS + Analytics Foundation', budgetCost: 90, analystCost: 12, changeDelta: 0, description: 'Deploy a lean HRIS core with a people-analytics data layer. Preserves budget for later rounds. Moderate scope; good platform for R3 rollout.' },
  { code: '2D', name: 'Privacy-by-Design Architecture',       budgetCost:  80, analystCost: 16, changeDelta:   8, description: 'Design the entire stack around DPDP Act 2023 compliance: data minimisation, consent management, purpose limitation. Earns significant Change Capital. High Analyst Hours.' },
  { code: '2E', name: 'Full Ecosystem Integration (Ambitious)', budgetCost: 200, analystCost: 24, changeDelta: -20, description: 'Integrate every HR sub-system end-to-end in one programme. Maximum capability but maximum cost and Change Capital drain. Risks budget collapse in later rounds.' }
];

var ROUND_2_DATA_BRIEF = [
  'From Employee_Master: What share of HQ employees use Desktop_Laptop vs Smartphone_Only? How does this compare with Frontline?',
  'From Employee_Master: How does Digital_Literacy_Score distribute across Job_Category? What does this imply for training burden in a cloud rollout?',
  'Recall your R1 choice: does the tech architecture you select this round logically follow from your R1 thesis? If not, what is the cost of contradiction?',
  'D1 is due at the close of this round. Your Maturity & Tech Blueprint must cite specific Employee_Master figures to justify the mobile-first or cloud-first decision.'
];
