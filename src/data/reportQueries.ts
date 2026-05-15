export interface ReportQueryAtr {
  title: string;
  summary: string;
  findings: string[];
  observations: string[];
}

export const REPORT_QUERIES_ATR: Record<string, ReportQueryAtr> = {
  Q01: {
    title: 'Detects duplicate invoice entries by vendor, date, and amount to streamline audit review and assign case identifiers.',
    summary: 'The workflow identified 140 duplicate invoice entries across vendors, each grouped into case IDs. Duplicates represent ~95.6M in invoice value, with some cases exceeding 24.2M for a single vendor-date-amount combination.',
    findings: [
      '140 rows across 6 columns — 70 distinct duplicate cases (each with duplicate_count = 2).',
      'Total duplicated INVOICE_VALUE: 95,631,064.00 (mean: 683,079.00 per invoice).',
      'VENDOR_002: highest total at 32,676,258.0. VENDOR_006: most frequent with 16 records.',
      'Largest single case: CASE_000007 at 24,231,986.0 in duplicated value.',
      'Invoice values range from 62.79 to 12,115,993.00 — both small and very high-value invoices affected.',
    ],
    observations: [
      'Widespread duplicates across vendors — some with particularly high exposure in both frequency and value.',
      'Each case has exactly two matching invoices — auditors can quickly validate which to keep or reverse.',
      'Multi-million cases represent significant financial risk — should be prioritized in review workflows.',
    ],
  },
  Q02: {
    title: 'Identifies unauthorized vendor master changes without proper approval workflow in the last 90 days.',
    summary: 'Vendor master data analysis revealed 47 changes in 90 days. 12 lacked dual-approval — 8 involved bank account modifications (highest fraud risk category).',
    findings: [
      '12 changes made without approval records in the workflow system.',
      '8 changes involved bank account modifications — highest payment fraud risk.',
      'VENDOR_015: 4 unauthorized changes within a single week (potential control bypass).',
    ],
    observations: [
      'Bank account field changes represent critical payment fraud risk — requires immediate remediation.',
      'Control gaps may exist during off-hours processing windows.',
    ],
  },
  RA01: {
    title: 'Risk identification across P2P, O2C, R2R, and S2C business processes — 12 critical risks mapped to 87 controls.',
    summary: 'Enterprise risk assessment identified 12 risks across 4 business processes. 2 critical risks (RSK-004 Fictitious vendors, RSK-007 Malware via portals) remain uncontrolled with zero mapped controls. Estimated uncontrolled exposure: 18L.',
    findings: [
      'RSK-004 (Fictitious vendor registration) and RSK-007 (Malware via vendor portals) have zero controls mapped.',
      'P2P process carries 75% of total risk exposure — highest concentration in any single process.',
      'Risk RSK-003 (Duplicate payments) has 3 controls but effectiveness rating below 60%.',
      'S2C risks are under-assessed — only 3 of 14 controls tested to date.',
    ],
    observations: [
      'Uncontrolled critical risks represent highest-priority remediation items for Q1.',
      'P2P concentration risk suggests need for diversified control strategies.',
      'AI-powered detection workflows reduced false positive rate from 6.5% to 4.2% — recommend expansion.',
    ],
  },
  RA02: {
    title: 'Mitigation strategy effectiveness analysis — 3 partially mitigated high risks require additional compensating controls.',
    summary: '18 mitigation strategies reviewed. 3 classified as ineffective — all relate to manual detective controls in P2P that fail under high-volume processing (>500 transactions/day).',
    findings: [
      'Manual three-way match process fails at scale — 8% error rate above 500 daily transactions.',
      'Vendor onboarding KYC control relies on single-person verification — no dual-approval in place.',
      'Compensating control for SOD violations (monthly review) has 45-day average lag.',
    ],
    observations: [
      'Automation of manual detective controls could reduce error rates to below 1%.',
      'Real-time monitoring workflows would replace delayed monthly reviews.',
    ],
  },
  CE01: {
    title: 'Control testing results across 87 controls — 48/54 tested controls rated effective, 6 require remediation.',
    summary: 'Control effectiveness assessment across all business processes. 89% of tested controls rated effective. 2 material weaknesses identified in P2P journal entry approval and R2R reconciliation process.',
    findings: [
      'CTR-012 (Journal entry approval): Override detected in 7 instances — material weakness.',
      'CTR-031 (GL reconciliation): 3 accounts with unreconciled differences >30 days.',
      'P2P automated controls (CTR-001 to CTR-005) all rated highly effective — AI detection at 95.8% accuracy.',
      '33 controls still untested — S2C process has lowest coverage at 21%.',
    ],
    observations: [
      'Automated controls significantly outperform manual ones — 98% vs 82% effectiveness rate.',
      'S2C control testing must be prioritized before June 30 deadline.',
      'Recommend converting 5 manual detective controls to automated preventive controls.',
    ],
  },
  WA01: {
    title: 'Workflow execution performance metrics — 115 runs across 8 active workflows with 94.2% accuracy rate.',
    summary: '8 active AI workflows processed 115 runs this quarter. Duplicate Invoice Detector leads with 45 runs and 96% precision. Processing time improved 14% after model retrain. Vendor Master Monitor caught 2 critical unauthorized changes.',
    findings: [
      'Duplicate Invoice Detector: 45 runs, 96% precision, saved 2.4L this month.',
      'Three-Way PO Match: 87% auto-match rate, 5% unmatched requiring manual review.',
      'Vendor Master Monitor: 2 unauthorized bank changes blocked before payment.',
      'SOD Violation Detector: 12 violations found across 2,341 users — 4 critical.',
    ],
    observations: [
      'Model retrain reduced false positive rate from 6.5% to 4.2% — 35% reduction in auditor review time.',
      'Workflow scheduling optimization could reduce processing queue by 2 hours.',
      'Recommend adding anomaly detection layer to Three-Way PO Match for variance prediction.',
    ],
  },
  WA02: {
    title: 'Exception trend analysis — 23 exceptions flagged across workflows, 8 resolved automatically by AI.',
    summary: '23 exceptions flagged this quarter. AI auto-resolved 35% without human intervention. 3 escalated to senior audit — all related to vendor bank account modifications exceeding risk threshold.',
    findings: [
      '8 exceptions auto-resolved via AI confidence scoring (>95% match confidence).',
      '3 escalated cases all involved bank account field changes — pattern suggests targeted testing needed.',
      'Average exception resolution time: 4.2 hours (down from 8.1 hours last quarter).',
    ],
    observations: [
      'Auto-resolution rate trending upward — target 50% by Q2.',
      'Bank account modification exceptions should trigger enhanced verification workflow.',
    ],
  },
  EX01: {
    title: 'Board-level GRC posture summary — compliance at 94.2%, 2 material weaknesses, 18L uncontrolled exposure.',
    summary: 'Enterprise GRC posture is strong at 94.2% compliance with improving trajectory. Two material weaknesses require board attention. AI-powered workflows saved 24L YTD through automated detection and prevention.',
    findings: [
      'Compliance score improved from 91.8% to 94.2% quarter-over-quarter.',
      'DEF-002 (Journal entry approval override) — remediation due in 6 days.',
      'AI workflows saved 24L in cost avoidance — 2.4L from duplicate invoice blocking alone.',
      'Team utilization at 74% — Tushar Goel over-allocated at 120% in April.',
    ],
    observations: [
      'On track for Q1 SOX filing deadline March 31.',
      'Budget utilization at 67% — within planned range.',
      'Recommend board approval for additional AI workflow investment in S2C process.',
    ],
  },
};
