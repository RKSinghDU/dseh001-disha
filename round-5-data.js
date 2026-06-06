// Round 5 — The Story (Shock Event 2 mid-round)
// AUTHORITATIVE COSTS: must match Runbook Part D exactly.

var ROUND_5_OPTIONS = [
  { code: '5A', name: 'Engagement-Centred Narrative',           budgetCost: 30, analystCost: 14, changeDelta: 0, description: 'Tell the attrition story through engagement scores: leavers had lower scores than stayers. Accurate but misses manager effectiveness and pay compression as co-drivers.' },
  { code: '5B', name: 'Manager Effectiveness as the Single Lever', budgetCost: 35, analystCost: 16, changeDelta: 0, description: 'Attribute attrition primarily to poor manager quality. Accurate for some segments but risks over-simplifying a multi-driver problem.' },
  { code: '5C', name: 'The Model Correction Story',               budgetCost: 25, analystCost: 12, changeDelta: 5, description: 'Lead with the flight-risk model correction narrative: the old model was age-biased, we fixed it. Earns Change Capital through honesty. Lower cost; requires R4 to have done the recalibration.' },
  { code: '5D', name: 'Multi-Driver Scorecard Dashboard',         budgetCost: 45, analystCost: 20, changeDelta: 0, description: 'Build a dashboard showing all four attrition drivers (engagement, manager effectiveness, absenteeism, pay compression) with weights. Highest Analyst Hours. Best Analytical Rigour score.' },
  { code: '5E', name: 'Attrition Risk Heat Map by Business Unit', budgetCost: 35, analystCost: 16, changeDelta: 0, description: 'Visualise attrition risk by BU and location tier rather than individual drivers. Useful for resource allocation decisions. Good for R6 gig-worker strategy.' }
];

var ROUND_5_DATA_BRIEF = [
  'From PeopleAnalytics_Fact: Calculate mean Engagement_Score for Exit_Y1 = 1 vs Exit_Y1 = 0. What is the gap in standard deviation units?',
  'From PeopleAnalytics_Fact: Calculate mean Manager_Effectiveness for leavers vs stayers. Is this gap larger or smaller than the engagement gap?',
  'From PeopleAnalytics_Fact: What is the Absenteeism_Rate difference between leavers and stayers? Does it suggest absenteeism is a leading indicator of exit?',
  'From PeopleAnalytics_Fact: What proportion of leavers had Pay_Compression_Flag = 1? Compare to stayers.',
  'From PeopleAnalytics_Fact: Once you control for engagement and manager quality, is Age still a significant predictor of exit? (Test correlation or partial correlation.)',
  'SHOCK EVENT 2 (if triggered): A gig worker has posted publicly about algorithm-driven earnings manipulation. See the Public Response section below.'
];

// Shock Event 2 — Viral Gig-Worker Grievance
var SHOCK_2_TEXT = '"I have been a GreenLeaf delivery partner for two years. In the last six months my average monthly earnings have dropped from Rs 9,200 to Rs 6,800. The app changes my tier rating without explanation. I have filed three grievances. No one has responded. I am not alone \u2014 at least 40 of us in our city are in the same situation. We are not employees, so we have no HR. Who do we complain to? #GreenLeafGigFair #DPDP2023" \u2014 @GigWorkerDelhi, posted on X.' +
'\n\nAs GreenLeaf\'s DHTO, you must now respond publicly and internally. Address in your submission: (1) your immediate public statement on behalf of GreenLeaf; (2) what the data shows about Bronze-tier earnings and grievance rates; (3) whether DPDP Act 2023 and Code on Social Security 2020 create any obligations here; (4) what you commit to doing before Round 6.';
