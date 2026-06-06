// Round 1 — The Diagnosis
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.
// Display only — ROUND_COSTS in Code.gs is the deduction source.

var ROUND_1_OPTIONS = [
  {
    code: '1A', name: 'Foundations First',
    budgetCost: 40, analystCost: 8, changeDelta: 0,
    description: 'Commission a device and connectivity audit across all 1,000 employees before any platform decisions. Produces an infrastructure baseline. Slower but de-risks future investment. Theory anchor: Kavanagh HR Technology Maturity Model (Stage 1 assessment).'
  },
  {
    code: '1B', name: 'Analytics-First Leap',
    budgetCost: 80, analystCost: 18, changeDelta: -5,
    description: 'Skip infrastructure baseline; deploy a people-analytics platform immediately to start generating insights. Fast but risks building on digital-divide blind spots. High Analyst Hours cost. Theory anchor: HR Analytics maturity (Bersin tiers).'
  },
  {
    code: '1C', name: 'Mobile-First Equity Lens',
    budgetCost: 60, analystCost: 12, changeDelta: 5,
    description: 'Conduct a mobile-device and digital-literacy survey segmented by Location Tier and Job Category. Directly surfaces the frontline digital divide. Earns Change Capital through participatory design. Theory anchor: Digital inclusion frameworks.'
  },
  {
    code: '1D', name: 'Regulatory Alignment Thesis',
    budgetCost: 50, analystCost: 10, changeDelta: 3,
    description: 'Begin with a DPDP Act 2023 and Code on Social Security 2020 compliance gap analysis. Identifies regulatory risk before any system build. Earns Change Capital through governance credibility. Theory anchor: HR compliance and risk management.'
  }
];

var ROUND_1_DATA_BRIEF = [
  'From Employee_Master: Calculate mean Digital_Literacy_Score for Frontline vs non-Frontline employees. What is the gap?',
  'From Employee_Master: What percentage of employees in each Location_Tier (Metro, Tier-2, Tier-3) have Device_Access = Smartphone_Only?',
  'From Employee_Master: Frontline employees as a % of total workforce?',
  'Based on the above: which option is most grounded in the data you have just analysed? Cite specific figures in your rationale.'
];
