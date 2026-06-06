// Round 4 — The Audit (Signature Round — algorithmic fairness)
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.

var ROUND_4_OPTIONS = [
  { code: '4A', name: 'Suspend and Human-Review',                        budgetCost:  30, analystCost: 14, changeDelta:   0, description: 'Immediately suspend the algorithmic hiring screen and flight-risk model. All decisions revert to human review. Lowest cost; breaks the harm. Does not fix the underlying models.' },
  { code: '4B', name: 'Bias Audit and Algorithmic Remediation',           budgetCost:  80, analystCost: 20, changeDelta:   0, description: 'Commission a full bias audit of both models. Remediate the hiring model to eliminate adverse impact. Rebuild flight-risk model with age-group fairness constraints. Takes one quarter.' },
  { code: '4C', name: 'HITL Override Layer + Monitoring Dashboard',       budgetCost:  45, analystCost: 18, changeDelta:   3, description: 'Keep models running but add a mandatory human-in-the-loop override at every decision point. Build a real-time fairness monitoring dashboard. Mid-cost; earns Change Capital through transparency.' },
  { code: '4D', name: 'Flight-Risk Model Recalibration (Parallel Track)', budgetCost:  50, analystCost: 22, changeDelta:   0, description: 'Run the existing flight-risk model in parallel with a recalibrated version that removes age as a predictor. Highest Analyst Hours; generates strong evidence for R5 attrition story.' },
  { code: '4E', name: 'Comprehensive Algorithmic Governance Programme',   budgetCost: 110, analystCost: 28, changeDelta:  -5, description: 'Build a full AI governance framework: model cards, impact assessments, appeal rights, independent audit cadence. Highest cost; most durable. Slight Change Capital drain from governance overhead.' }
];

var ROUND_4_DATA_BRIEF = [
  'From Recruitment_ATS: Calculate the selection rate for Female vs Male candidates where Algorithm_Flag = Y. Compute the adverse impact ratio (female/male). Does it fall below the EEOC 4/5ths threshold?',
  'From Recruitment_ATS: Repeat the above for Algorithm_Flag = N. What does the comparison tell you about whether the bias is in the algorithm or in the underlying applicant pool?',
  'From PeopleAnalytics_Fact: For Flight_Risk_Flag = High, calculate the false positive rate separately for Age_Group < 30 and Age_Group > 50. Cite the figures.',
  'From PeopleAnalytics_Fact: Find GL-1004 (Shreya Iyer). What does the model predict? What is her actual engagement score and did she leave in Y1?',
  'Your Fairness Audit Report (Sections A-D below) must cite the specific computed ratios, not estimates.'
];

// Fairness Audit Report sections (collected separately from rationale)
var AUDIT_SECTIONS = {
  A: { title: 'Section A: Hiring Algorithm — Adverse Impact Analysis', fields: [
    { id: 'audit-a1', label: 'A1. Female selection rate (algorithm-screened): computed figure from Recruitment_ATS' },
    { id: 'audit-a2', label: 'A2. Male selection rate (algorithm-screened): computed figure' },
    { id: 'audit-a3', label: 'A3. Adverse impact ratio (Female/Male): does it breach the 4/5ths rule? State the threshold value.' }
  ]},
  B: { title: 'Section B: Flight-Risk Model — Age-Group False Positive Rates', fields: [
    { id: 'audit-b1', label: 'B1. False positive rate, Age < 30: % flagged High who did NOT leave in Y1' },
    { id: 'audit-b2', label: 'B2. False positive rate, Age > 50: % flagged High who did NOT leave in Y1' }
  ]},
  C: { title: 'Section C: GL-1004 Case Study', fields: [
    { id: 'audit-c1', label: 'C1. Model prediction for GL-1004 (Shreya Iyer)' },
    { id: 'audit-c2', label: 'C2. Actual Engagement Score and Y1 exit outcome for GL-1004' },
    { id: 'audit-c3', label: 'C3. What remediation would correct her case?' }
  ]},
  D: { title: 'Section D: Recommended Remediation', fields: [
    { id: 'audit-d1', label: 'D1. Which option do you recommend and why? Specify the human-in-the-loop design element.' }
  ]}
};
