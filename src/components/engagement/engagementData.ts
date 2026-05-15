// ─── Engagement Module — Shared Types & Seeded Demo Data ─────────────────────
// Single source of truth for the engagement execution journey.
// All data is realistic and interconnected for demo purposes.

// ─── Types ───────────────────────────────────────────────────────────────────

export type ControlStatus = 'not-started' | 'population-pending' | 'in-progress' | 'pending-review' | 'effective' | 'partially-effective' | 'ineffective';
export type AttrResult = 'pass' | 'fail' | 'na' | 'pending';
export type SampleStatus = 'not-tested' | 'pass' | 'fail' | 'exception';
export type FindingSeverity = 'Material Weakness' | 'Significant Deficiency' | 'Control Deficiency';
export type FindingStatus = 'Open' | 'In Remediation' | 'Closed';

export interface WorkflowAttribute {
  id: string;
  name: string;
  description: string;
  requiredEvidence: string;
  /** New: which assertions this attribute covers */
  assertions?: string[];
  /** New: aggregate status across samples */
  testStatus?: 'pass' | 'fail' | 'pending' | 'not-tested';
  /** New: number of exceptions found for this attribute */
  exceptions?: number;
  /** New: which workflow owns this attribute */
  workflowId?: string;
}

/** A workflow linked to a control test instance */
export interface LinkedWorkflow {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'draft' | 'archived';
  owner: string;
  /** Attribute IDs covered by this workflow */
  attributeIds: string[];
  /** Derived/denormalized count of attributes */
  attributesCount: number;
  /** Which assertions this workflow's attributes cover */
  assertionCoverage: string[];
}

export interface SampleItem {
  id: string;
  label: string;
  referenceId: string;
  amount: string;
  status: SampleStatus;
  attributes: Record<string, AttrResult>;
  evidenceFiles: string[];
}

export interface WorkingPaperRound {
  round: number;
  date: string;
  tester: string;
  status: 'complete' | 'in-progress';
  populationSize: number;
  sampleSize: number;
  attributeResults: { attrId: string; passCount: number; failCount: number; naCount: number }[];
  evidenceRefs: string[];
  conclusion: string;
  reviewerNotes: string;
  reviewerStatus: 'approved' | 'pending' | 'rejected' | '';
}

export interface WorkingPaper {
  testInstanceId: string;
  controlId: string;
  controlName: string;
  workflowName: string;
  workflowVersion: string;
  rounds: WorkingPaperRound[];
  comments: { author: string; role: string; date: string; text: string }[];
}

export interface AuditTrailEntry {
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface Finding {
  id: string;
  title: string;
  engagementId: string;
  controlId: string;
  controlName: string;
  testInstanceId: string;
  failedAttribute: string;
  failedSamples: string[];
  evidenceRefs: string[];
  severity: FindingSeverity;
  status: FindingStatus;
  owner: string;
  rootCause: string;
  remediationDueDate: string;
  remediationPlan: string;
  raisedDate: string;
  raisedBy: string;
}

export interface ControlDetail {
  id: string;
  controlId: string;
  controlName: string;
  domain: string;
  isKey: boolean;
  objective: string;
  description: string;
  frequency: string;
  controlOwner: string;
  assertions: string[];
  /** Legacy single-workflow fields — kept for backward compatibility */
  workflowName: string;
  workflowVersion: string;
  workflowAttributes: WorkflowAttribute[];
  /** New: multiple workflows linked to this control instance */
  linkedWorkflows?: LinkedWorkflow[];
  populationRequired: boolean;
  populationStatus: 'none' | 'uploaded' | 'snapshot-created';
  populationSize: number;
  populationSource: string;
  samplingMethod: string;
  samples: SampleItem[];
  testingRound: number;
  assignee: string;
  reviewer: string;
  status: ControlStatus;
  result: 'Effective' | 'Partially Effective' | 'Ineffective' | 'Pending' | '';
  conclusion: string;
  workingPaper: WorkingPaper;
  auditTrail: AuditTrailEntry[];
  sampleCount: number;
  samplesTested: number;
  exceptions: number;
  evidenceCount: number;
  lastUpdated: string;
}

export interface EngagementMeta {
  id: string;
  name: string;
  auditType: string;
  framework: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  owner: string;
  reviewer: string;
  description: string;
  racmVersion: string;
  snapshotId: string;
  status: string;
  activatedAt: string;
  activatedBy: string;
}

// ─── Engagement ──────────────────────────────────────────────────────────────

export const ENGAGEMENT: EngagementMeta = {
  id: 'eng-sox-fy26',
  name: 'P2P — SOX Audit FY26',
  auditType: 'SOX',
  framework: 'COSO',
  auditPeriodStart: 'Apr 1, 2025',
  auditPeriodEnd: 'Mar 31, 2026',
  plannedStart: 'Apr 1, 2025',
  plannedEnd: 'Jun 30, 2025',
  actualStart: 'Apr 5, 2025',
  owner: 'Tushar Goel',
  reviewer: 'Karan Mehta',
  description: 'Comprehensive SOX audit covering Procure-to-Pay controls including vendor payment authorization, duplicate detection, purchase order approval, and segregation of duties. Linked to RACM v2.1 with 24 in-scope controls across 3 P2P sub-processes.',
  racmVersion: 'RACM v2.1 (Feb 2026)',
  snapshotId: 'SNAP-ENG-001',
  status: 'Active',
  activatedAt: 'Apr 5, 2025 09:12 AM',
  activatedBy: 'Karan Mehta',
};

// ─── Controls (realistic multi-state) ────────────────────────────────────────

export const CONTROLS: ControlDetail[] = [
  // ── Control 1: Three-Way Match — FULLY TESTED, EFFECTIVE (approved) ──
  {
    id: 'ec-001', controlId: 'CTR-003', controlName: 'Three-way PO/GRN/Invoice matching',
    domain: 'P2P — Vendor Payment', isKey: true,
    objective: 'Ensure all vendor payments are validated through a three-way match of Purchase Order, Goods Receipt Note, and Invoice before disbursement.',
    description: 'Automated matching of PO, GRN, and Invoice with tolerance-based escalation. Mismatches are flagged and routed to AP supervisor for manual review before payment release.',
    frequency: 'Per transaction', controlOwner: 'Rajiv Sharma (AP Manager)',
    assertions: ['Completeness', 'Accuracy', 'Authorization', 'Valuation'],
    workflowName: 'PO Validation Workflow', workflowVersion: 'v2.0',
    workflowAttributes: [
      { id: 'attr-1', name: 'PO Existence', description: 'Verify a valid, approved Purchase Order exists for the invoice', requiredEvidence: 'PO document or ERP screenshot', assertions: ['Existence', 'Authorization'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-001' },
      { id: 'attr-2', name: 'GRN Match', description: 'Confirm goods receipt quantity and description match PO line items', requiredEvidence: 'GRN document', assertions: ['Completeness', 'Accuracy'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-002' },
      { id: 'attr-3', name: 'Invoice Amount Match', description: 'Validate invoice amount matches PO and GRN within tolerance ($500 / 2%)', requiredEvidence: 'Invoice document', assertions: ['Accuracy'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-003' },
      { id: 'attr-4', name: 'Tolerance Verification', description: 'Verify any variance is within the approved threshold and properly documented', requiredEvidence: 'Tolerance exception report', assertions: ['Valuation', 'Accuracy'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-003' },
      { id: 'attr-5', name: 'Payment Approval', description: 'Confirm appropriate authorization for payment release per delegation matrix', requiredEvidence: 'Approval email or system workflow log', assertions: ['Authorization'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-001' },
    ],
    linkedWorkflows: [
      { id: 'lw-001', name: 'PO Validation Workflow', version: 'v2.0', status: 'active', owner: 'Tushar Goel', attributeIds: ['attr-1', 'attr-5'], attributesCount: 2, assertionCoverage: ['Existence', 'Authorization'] },
      { id: 'lw-002', name: 'GRN Matching Workflow', version: 'v1.6', status: 'active', owner: 'Deepak Bansal', attributeIds: ['attr-2'], attributesCount: 1, assertionCoverage: ['Completeness', 'Accuracy'] },
      { id: 'lw-003', name: 'Invoice Match Workflow', version: 'v2.3', status: 'active', owner: 'Neha Joshi', attributeIds: ['attr-3', 'attr-4'], attributesCount: 2, assertionCoverage: ['Accuracy', 'Valuation'] },
    ],
    populationRequired: true, populationStatus: 'snapshot-created', populationSize: 3891,
    populationSource: 'SAP ERP — AP Transactions Q1-Q3 FY26',
    samplingMethod: 'Statistical — MUS (Monetary Unit Sampling)',
    samples: [
      { id: 's-001', label: 'INV-2025-4521', referenceId: 'PO-88901', amount: '$24,500', status: 'pass', attributes: { 'attr-1': 'pass', 'attr-2': 'pass', 'attr-3': 'pass', 'attr-4': 'pass', 'attr-5': 'pass' }, evidenceFiles: ['po_88901.pdf', 'grn_88901.pdf', 'inv_4521.pdf'] },
      { id: 's-002', label: 'INV-2025-4522', referenceId: 'PO-88902', amount: '$8,200', status: 'pass', attributes: { 'attr-1': 'pass', 'attr-2': 'pass', 'attr-3': 'pass', 'attr-4': 'na', 'attr-5': 'pass' }, evidenceFiles: ['po_88902.pdf', 'inv_4522.pdf'] },
      { id: 's-003', label: 'INV-2025-4523', referenceId: 'PO-88903', amount: '$156,700', status: 'pass', attributes: { 'attr-1': 'pass', 'attr-2': 'pass', 'attr-3': 'pass', 'attr-4': 'pass', 'attr-5': 'pass' }, evidenceFiles: ['po_88903.pdf', 'grn_88903.pdf', 'inv_4523.pdf', 'approval_log.pdf'] },
      { id: 's-004', label: 'INV-2025-4524', referenceId: 'PO-88904', amount: '$3,100', status: 'pass', attributes: { 'attr-1': 'pass', 'attr-2': 'pass', 'attr-3': 'pass', 'attr-4': 'na', 'attr-5': 'pass' }, evidenceFiles: ['po_88904.pdf', 'grn_88904.pdf'] },
      { id: 's-005', label: 'INV-2025-4525', referenceId: 'PO-88905', amount: '$67,800', status: 'pass', attributes: { 'attr-1': 'pass', 'attr-2': 'pass', 'attr-3': 'pass', 'attr-4': 'pass', 'attr-5': 'pass' }, evidenceFiles: ['po_88905.pdf', 'grn_88905.pdf', 'inv_4525.pdf'] },
    ],
    testingRound: 1, assignee: 'Tushar Goel', reviewer: 'Karan Mehta',
    status: 'effective', result: 'Effective', conclusion: 'All 5 samples passed all applicable attributes. Control is operating effectively.',
    sampleCount: 5, samplesTested: 5, exceptions: 0, evidenceCount: 15, lastUpdated: 'Apr 12, 2026',
    workingPaper: {
      testInstanceId: 'TI-001', controlId: 'CTR-003', controlName: 'Three-way PO/GRN/Invoice matching',
      workflowName: 'PO Validation Workflow', workflowVersion: 'v2.0',
      rounds: [{
        round: 1, date: 'Apr 10, 2026', tester: 'Tushar Goel', status: 'complete',
        populationSize: 3891, sampleSize: 5,
        attributeResults: [
          { attrId: 'attr-1', passCount: 5, failCount: 0, naCount: 0 },
          { attrId: 'attr-2', passCount: 5, failCount: 0, naCount: 0 },
          { attrId: 'attr-3', passCount: 5, failCount: 0, naCount: 0 },
          { attrId: 'attr-4', passCount: 3, failCount: 0, naCount: 2 },
          { attrId: 'attr-5', passCount: 5, failCount: 0, naCount: 0 },
        ],
        evidenceRefs: ['po_88901.pdf', 'grn_88901.pdf', 'inv_4521.pdf', 'po_88902.pdf', 'inv_4522.pdf'],
        conclusion: 'All 5 samples passed all applicable attributes. Three-way match control is operating effectively for the test period.',
        reviewerNotes: 'Reviewed and concur. Sample selection methodology is sound, evidence is complete. Approved.',
        reviewerStatus: 'approved',
      }],
      comments: [
        { author: 'Tushar Goel', role: 'Tester', date: 'Apr 10, 2026', text: 'Round 1 testing complete. All samples matched within tolerance. Ready for review.' },
        { author: 'Karan Mehta', role: 'Reviewer', date: 'Apr 12, 2026', text: 'Reviewed — sample selection is representative. Evidence complete. Approved as Effective.' },
      ],
    },
    auditTrail: [
      { timestamp: 'Apr 5, 2026 09:15', actor: 'Tushar Goel', action: 'Population uploaded', detail: 'SAP AP Transactions — 3,891 records' },
      { timestamp: 'Apr 5, 2026 09:22', actor: 'System', action: 'Population snapshot created', detail: 'Immutable snapshot locked' },
      { timestamp: 'Apr 6, 2026 10:30', actor: 'System', action: 'Samples generated', detail: '5 samples via MUS method' },
      { timestamp: 'Apr 7, 2026 14:00', actor: 'Tushar Goel', action: 'Evidence uploaded', detail: '15 files attached across 5 samples' },
      { timestamp: 'Apr 10, 2026 16:45', actor: 'Tushar Goel', action: 'Testing completed', detail: '5/5 samples tested — 0 exceptions' },
      { timestamp: 'Apr 10, 2026 17:00', actor: 'Tushar Goel', action: 'Submitted for review', detail: 'Round 1 submitted to Karan Mehta' },
      { timestamp: 'Apr 12, 2026 11:30', actor: 'Karan Mehta', action: 'Review approved', detail: 'Conclusion: Effective' },
    ],
  },

  // ── Control 2: Duplicate Invoice Detection — IN PROGRESS (exceptions found) ──
  {
    id: 'ec-002', controlId: 'CTR-005', controlName: 'Duplicate invoice detection workflow',
    domain: 'P2P — Vendor Payment', isKey: true,
    objective: 'Prevent duplicate vendor payments by detecting and blocking invoices that match existing records on key fields.',
    description: 'System scans incoming invoices against historical data using fuzzy matching on vendor, amount, date, and invoice number. Flagged duplicates require AP supervisor override before payment.',
    frequency: 'Per transaction', controlOwner: 'Rajiv Sharma (AP Manager)',
    assertions: ['Completeness', 'Occurrence', 'Accuracy'],
    workflowName: 'Duplicate Invoice Detector', workflowVersion: 'v1.4',
    workflowAttributes: [
      { id: 'attr-d1', name: 'Duplicate Flag Active', description: 'Verify the duplicate detection system was active and scanning for the transaction', requiredEvidence: 'System configuration screenshot', assertions: ['Completeness', 'Occurrence'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-d01' },
      { id: 'attr-d2', name: 'Match Rule Coverage', description: 'Confirm matching rules cover vendor, amount, date, and invoice number fields', requiredEvidence: 'Rule configuration export', assertions: ['Accuracy', 'Completeness'], testStatus: 'fail', exceptions: 1, workflowId: 'lw-d01' },
      { id: 'attr-d3', name: 'Override Authorization', description: 'If override was used, verify supervisor-level approval was documented', requiredEvidence: 'Override approval log', assertions: ['Authorization'], testStatus: 'fail', exceptions: 2, workflowId: 'lw-d02' },
      { id: 'attr-d4', name: 'Timeliness', description: 'Confirm detection occurred before payment release', requiredEvidence: 'System timestamp comparison', assertions: ['Occurrence'], testStatus: 'pass', exceptions: 0, workflowId: 'lw-d03' },
    ],
    linkedWorkflows: [
      { id: 'lw-d01', name: 'Duplicate Invoice Detector', version: 'v1.4', status: 'active', owner: 'Deepak Bansal', attributeIds: ['attr-d1', 'attr-d2'], attributesCount: 2, assertionCoverage: ['Completeness', 'Occurrence', 'Accuracy'] },
      { id: 'lw-d02', name: 'Override Monitor', version: 'v1.2', status: 'active', owner: 'Sneha Desai', attributeIds: ['attr-d3'], attributesCount: 1, assertionCoverage: ['Authorization'] },
      { id: 'lw-d03', name: 'SLA Checker', version: 'v1.0', status: 'active', owner: 'Tushar Goel', attributeIds: ['attr-d4'], attributesCount: 1, assertionCoverage: ['Occurrence'] },
    ],
    populationRequired: true, populationStatus: 'snapshot-created', populationSize: 12450,
    populationSource: 'SAP ERP — All invoices processed Q1-Q3 FY26',
    samplingMethod: 'Statistical — Random',
    samples: [
      { id: 's-d01', label: 'INV-2025-7801', referenceId: 'VND-4401', amount: '$45,200', status: 'pass', attributes: { 'attr-d1': 'pass', 'attr-d2': 'pass', 'attr-d3': 'na', 'attr-d4': 'pass' }, evidenceFiles: ['sys_config_q1.pdf', 'detection_log_7801.xlsx'] },
      { id: 's-d02', label: 'INV-2025-7802', referenceId: 'VND-4402', amount: '$12,300', status: 'pass', attributes: { 'attr-d1': 'pass', 'attr-d2': 'pass', 'attr-d3': 'na', 'attr-d4': 'pass' }, evidenceFiles: ['detection_log_7802.xlsx'] },
      { id: 's-d03', label: 'INV-2025-7803', referenceId: 'VND-4403', amount: '$89,100', status: 'fail', attributes: { 'attr-d1': 'pass', 'attr-d2': 'pass', 'attr-d3': 'fail', 'attr-d4': 'pass' }, evidenceFiles: ['override_log_7803.pdf', 'detection_log_7803.xlsx', 'exception_memo.pdf'] },
      { id: 's-d04', label: 'INV-2025-7804', referenceId: 'VND-4404', amount: '$5,600', status: 'pass', attributes: { 'attr-d1': 'pass', 'attr-d2': 'pass', 'attr-d3': 'na', 'attr-d4': 'pass' }, evidenceFiles: ['detection_log_7804.xlsx'] },
      { id: 's-d05', label: 'INV-2025-7805', referenceId: 'VND-4405', amount: '$234,000', status: 'fail', attributes: { 'attr-d1': 'pass', 'attr-d2': 'fail', 'attr-d3': 'fail', 'attr-d4': 'pass' }, evidenceFiles: ['rule_config_export.pdf', 'override_log_7805.pdf'] },
      { id: 's-d06', label: 'INV-2025-7806', referenceId: 'VND-4406', amount: '$18,900', status: 'pass', attributes: { 'attr-d1': 'pass', 'attr-d2': 'pass', 'attr-d3': 'na', 'attr-d4': 'pass' }, evidenceFiles: ['detection_log_7806.xlsx'] },
      { id: 's-d07', label: 'INV-2025-7807', referenceId: 'VND-4407', amount: '$72,400', status: 'not-tested', attributes: { 'attr-d1': 'pending', 'attr-d2': 'pending', 'attr-d3': 'pending', 'attr-d4': 'pending' }, evidenceFiles: [] },
      { id: 's-d08', label: 'INV-2025-7808', referenceId: 'VND-4408', amount: '$9,800', status: 'not-tested', attributes: { 'attr-d1': 'pending', 'attr-d2': 'pending', 'attr-d3': 'pending', 'attr-d4': 'pending' }, evidenceFiles: [] },
    ],
    testingRound: 1, assignee: 'Deepak Bansal', reviewer: 'Karan Mehta',
    status: 'in-progress', result: 'Pending', conclusion: '',
    sampleCount: 8, samplesTested: 6, exceptions: 2, evidenceCount: 10, lastUpdated: 'Apr 18, 2026',
    workingPaper: {
      testInstanceId: 'TI-002', controlId: 'CTR-005', controlName: 'Duplicate invoice detection workflow',
      workflowName: 'Duplicate Invoice Detector', workflowVersion: 'v1.4',
      rounds: [{
        round: 1, date: 'Apr 18, 2026', tester: 'Deepak Bansal', status: 'in-progress',
        populationSize: 12450, sampleSize: 8,
        attributeResults: [
          { attrId: 'attr-d1', passCount: 6, failCount: 0, naCount: 0 },
          { attrId: 'attr-d2', passCount: 5, failCount: 1, naCount: 0 },
          { attrId: 'attr-d3', passCount: 0, failCount: 2, naCount: 4 },
          { attrId: 'attr-d4', passCount: 6, failCount: 0, naCount: 0 },
        ],
        evidenceRefs: ['sys_config_q1.pdf', 'detection_log_7801.xlsx', 'override_log_7803.pdf', 'exception_memo.pdf'],
        conclusion: '',
        reviewerNotes: '',
        reviewerStatus: '',
      }],
      comments: [
        { author: 'Deepak Bansal', role: 'Tester', date: 'Apr 15, 2026', text: 'Population uploaded — 12,450 invoices. Starting sampling.' },
        { author: 'Deepak Bansal', role: 'Tester', date: 'Apr 18, 2026', text: '6 of 8 samples tested. 2 exceptions found on override authorization — INV-7803 and INV-7805 had overrides without proper supervisor approval documentation.' },
      ],
    },
    auditTrail: [
      { timestamp: 'Apr 14, 2026 10:00', actor: 'Deepak Bansal', action: 'Population uploaded', detail: '12,450 invoices from SAP' },
      { timestamp: 'Apr 14, 2026 10:05', actor: 'System', action: 'Population snapshot created', detail: 'Immutable snapshot locked' },
      { timestamp: 'Apr 15, 2026 09:00', actor: 'System', action: 'Samples generated', detail: '8 samples via random selection' },
      { timestamp: 'Apr 16, 2026 14:30', actor: 'Deepak Bansal', action: 'Evidence uploaded', detail: '10 files across 6 samples' },
      { timestamp: 'Apr 18, 2026 16:00', actor: 'Deepak Bansal', action: 'Testing in progress', detail: '6/8 samples tested — 2 exceptions' },
    ],
  },

  // ── Control 3: PO Dual Sign-off — PENDING REVIEW ──
  {
    id: 'ec-003', controlId: 'CTR-001', controlName: 'PO dual sign-off approval workflow',
    domain: 'P2P — Purchase Order', isKey: false,
    objective: 'Ensure all purchase orders above $10K require dual approval from department head and procurement manager before vendor commitment.',
    description: 'System enforces two-level approval workflow for POs exceeding threshold. First approval from requestor\'s department head, second from central procurement.',
    frequency: 'Per transaction', controlOwner: 'Meera Patel (Procurement Head)',
    assertions: ['Authorization', 'Completeness'],
    workflowName: 'PO Approval Validator', workflowVersion: 'v1.2',
    workflowAttributes: [
      { id: 'attr-p1', name: 'Threshold Trigger', description: 'Verify PO amount correctly triggers dual-approval workflow', requiredEvidence: 'PO amount vs threshold config' },
      { id: 'attr-p2', name: 'First Approval', description: 'Confirm department head approval is documented', requiredEvidence: 'Approval workflow screenshot' },
      { id: 'attr-p3', name: 'Second Approval', description: 'Confirm procurement manager approval is documented', requiredEvidence: 'Approval workflow screenshot' },
    ],
    populationRequired: true, populationStatus: 'snapshot-created', populationSize: 842,
    populationSource: 'SAP ERP — POs > $10K, Q1-Q3 FY26',
    samplingMethod: 'Judgmental',
    samples: [
      { id: 's-p01', label: 'PO-2025-1201', referenceId: 'DEPT-Finance', amount: '$45,000', status: 'pass', attributes: { 'attr-p1': 'pass', 'attr-p2': 'pass', 'attr-p3': 'pass' }, evidenceFiles: ['po_1201_workflow.pdf'] },
      { id: 's-p02', label: 'PO-2025-1202', referenceId: 'DEPT-IT', amount: '$120,000', status: 'pass', attributes: { 'attr-p1': 'pass', 'attr-p2': 'pass', 'attr-p3': 'pass' }, evidenceFiles: ['po_1202_workflow.pdf', 'po_1202_approval.pdf'] },
      { id: 's-p03', label: 'PO-2025-1203', referenceId: 'DEPT-Ops', amount: '$28,500', status: 'exception', attributes: { 'attr-p1': 'pass', 'attr-p2': 'pass', 'attr-p3': 'fail' }, evidenceFiles: ['po_1203_workflow.pdf', 'exception_1203.pdf'] },
      { id: 's-p04', label: 'PO-2025-1204', referenceId: 'DEPT-Marketing', amount: '$15,200', status: 'pass', attributes: { 'attr-p1': 'pass', 'attr-p2': 'pass', 'attr-p3': 'pass' }, evidenceFiles: ['po_1204_workflow.pdf'] },
    ],
    testingRound: 1, assignee: 'Neha Joshi', reviewer: 'Karan Mehta',
    status: 'pending-review', result: 'Pending', conclusion: '3 of 4 samples passed. 1 exception on PO-1203 — procurement manager approval was backdated by 3 days. Recommending Partially Effective.',
    sampleCount: 4, samplesTested: 4, exceptions: 1, evidenceCount: 5, lastUpdated: 'Apr 16, 2026',
    workingPaper: {
      testInstanceId: 'TI-003', controlId: 'CTR-001', controlName: 'PO dual sign-off approval workflow',
      workflowName: 'PO Approval Validator', workflowVersion: 'v1.2',
      rounds: [{
        round: 1, date: 'Apr 16, 2026', tester: 'Neha Joshi', status: 'complete',
        populationSize: 842, sampleSize: 4,
        attributeResults: [
          { attrId: 'attr-p1', passCount: 4, failCount: 0, naCount: 0 },
          { attrId: 'attr-p2', passCount: 4, failCount: 0, naCount: 0 },
          { attrId: 'attr-p3', passCount: 3, failCount: 1, naCount: 0 },
        ],
        evidenceRefs: ['po_1201_workflow.pdf', 'po_1202_workflow.pdf', 'po_1203_workflow.pdf', 'exception_1203.pdf'],
        conclusion: '3 of 4 samples passed. 1 exception: PO-1203 second approval was backdated. Recommending Partially Effective.',
        reviewerNotes: '',
        reviewerStatus: 'pending',
      }],
      comments: [
        { author: 'Neha Joshi', role: 'Tester', date: 'Apr 16, 2026', text: 'Testing complete. PO-1203 had a backdated procurement approval — 3 business days after PO was already committed to vendor. Flagging as exception.' },
      ],
    },
    auditTrail: [
      { timestamp: 'Apr 11, 2026 11:00', actor: 'Neha Joshi', action: 'Population uploaded', detail: '842 POs > $10K' },
      { timestamp: 'Apr 11, 2026 11:05', actor: 'System', action: 'Population snapshot created', detail: 'Immutable snapshot locked' },
      { timestamp: 'Apr 12, 2026 09:00', actor: 'System', action: 'Samples generated', detail: '4 samples via judgmental selection' },
      { timestamp: 'Apr 14, 2026 15:00', actor: 'Neha Joshi', action: 'Evidence uploaded', detail: '5 files across 4 samples' },
      { timestamp: 'Apr 16, 2026 12:00', actor: 'Neha Joshi', action: 'Testing completed', detail: '4/4 tested — 1 exception (PO-1203)' },
      { timestamp: 'Apr 16, 2026 12:15', actor: 'Neha Joshi', action: 'Submitted for review', detail: 'Round 1 submitted to Karan Mehta' },
    ],
  },

  // ── Control 4: Credit Limit — INEFFECTIVE (deficiency raised) ──
  {
    id: 'ec-004', controlId: 'CTR-002', controlName: 'Automated credit limit monitoring',
    domain: 'O2C — Credit Management', isKey: true,
    objective: 'Prevent order fulfillment for customers exceeding approved credit limits without proper authorization.',
    description: 'System blocks sales orders when customer outstanding balance plus new order exceeds credit limit. Override requires credit manager approval with documented justification.',
    frequency: 'Per transaction', controlOwner: 'Anita Reddy (Credit Manager)',
    assertions: ['Authorization', 'Valuation'],
    workflowName: 'Credit Limit Validation', workflowVersion: 'v2.1',
    workflowAttributes: [
      { id: 'attr-c1', name: 'Credit Check Active', description: 'Verify credit check was performed before order release', requiredEvidence: 'System credit check log' },
      { id: 'attr-c2', name: 'Limit Accuracy', description: 'Confirm credit limit in system matches approved limit per credit committee', requiredEvidence: 'Credit committee minutes, system config' },
      { id: 'attr-c3', name: 'Block Enforcement', description: 'Verify orders exceeding limit were blocked or had authorized override', requiredEvidence: 'Order block/release log' },
      { id: 'attr-c4', name: 'Override Documentation', description: 'If override used, verify credit manager approval and justification exists', requiredEvidence: 'Override approval with justification' },
    ],
    populationRequired: true, populationStatus: 'snapshot-created', populationSize: 2156,
    populationSource: 'SAP ERP — Sales orders Q1-Q3 FY26 with credit check events',
    samplingMethod: 'Statistical — MUS (Monetary Unit Sampling)',
    samples: [
      { id: 's-c01', label: 'SO-2025-9001', referenceId: 'CUST-A101', amount: '$340,000', status: 'pass', attributes: { 'attr-c1': 'pass', 'attr-c2': 'pass', 'attr-c3': 'pass', 'attr-c4': 'na' }, evidenceFiles: ['credit_check_9001.pdf'] },
      { id: 's-c02', label: 'SO-2025-9002', referenceId: 'CUST-A205', amount: '$890,000', status: 'fail', attributes: { 'attr-c1': 'pass', 'attr-c2': 'fail', 'attr-c3': 'fail', 'attr-c4': 'fail' }, evidenceFiles: ['credit_check_9002.pdf', 'limit_mismatch.xlsx'] },
      { id: 's-c03', label: 'SO-2025-9003', referenceId: 'CUST-A310', amount: '$125,000', status: 'fail', attributes: { 'attr-c1': 'pass', 'attr-c2': 'pass', 'attr-c3': 'fail', 'attr-c4': 'fail' }, evidenceFiles: ['credit_check_9003.pdf', 'override_no_approval.pdf'] },
      { id: 's-c04', label: 'SO-2025-9004', referenceId: 'CUST-A112', amount: '$56,000', status: 'pass', attributes: { 'attr-c1': 'pass', 'attr-c2': 'pass', 'attr-c3': 'pass', 'attr-c4': 'na' }, evidenceFiles: ['credit_check_9004.pdf'] },
      { id: 's-c05', label: 'SO-2025-9005', referenceId: 'CUST-A450', amount: '$1,200,000', status: 'fail', attributes: { 'attr-c1': 'fail', 'attr-c2': 'pass', 'attr-c3': 'fail', 'attr-c4': 'fail' }, evidenceFiles: ['no_credit_check_evidence.pdf', 'order_release_log.xlsx'] },
    ],
    testingRound: 1, assignee: 'Sneha Desai', reviewer: 'Karan Mehta',
    status: 'ineffective', result: 'Ineffective',
    conclusion: '3 of 5 samples failed. Systemic issue: credit limit overrides lack proper authorization. Credit check was bypassed entirely for SO-9005 ($1.2M). Significant Deficiency raised.',
    sampleCount: 5, samplesTested: 5, exceptions: 3, evidenceCount: 7, lastUpdated: 'Apr 14, 2026',
    workingPaper: {
      testInstanceId: 'TI-004', controlId: 'CTR-002', controlName: 'Automated credit limit monitoring',
      workflowName: 'Credit Limit Validation', workflowVersion: 'v2.1',
      rounds: [{
        round: 1, date: 'Apr 13, 2026', tester: 'Sneha Desai', status: 'complete',
        populationSize: 2156, sampleSize: 5,
        attributeResults: [
          { attrId: 'attr-c1', passCount: 4, failCount: 1, naCount: 0 },
          { attrId: 'attr-c2', passCount: 4, failCount: 1, naCount: 0 },
          { attrId: 'attr-c3', passCount: 2, failCount: 3, naCount: 0 },
          { attrId: 'attr-c4', passCount: 0, failCount: 3, naCount: 2 },
        ],
        evidenceRefs: ['credit_check_9001.pdf', 'credit_check_9002.pdf', 'limit_mismatch.xlsx', 'no_credit_check_evidence.pdf'],
        conclusion: 'Ineffective. 3 of 5 samples failed — systemic override authorization gap. Deficiency raised as Significant Deficiency.',
        reviewerNotes: 'Concur with Ineffective conclusion. This is a systemic issue, not isolated. Escalating to Audit Director.',
        reviewerStatus: 'approved',
      }],
      comments: [
        { author: 'Sneha Desai', role: 'Tester', date: 'Apr 13, 2026', text: 'Critical finding: SO-9005 for $1.2M was released without any credit check. Two other overrides lacked proper approval. This appears systemic.' },
        { author: 'Karan Mehta', role: 'Reviewer', date: 'Apr 14, 2026', text: 'Agreed — this is a significant deficiency. The credit manager override process needs immediate remediation. Approved as Ineffective. Deficiency DEF-001 raised.' },
      ],
    },
    auditTrail: [
      { timestamp: 'Apr 8, 2026 09:00', actor: 'Sneha Desai', action: 'Population uploaded', detail: '2,156 sales orders with credit events' },
      { timestamp: 'Apr 8, 2026 09:05', actor: 'System', action: 'Population snapshot created', detail: 'Immutable snapshot locked' },
      { timestamp: 'Apr 9, 2026 10:00', actor: 'System', action: 'Samples generated', detail: '5 samples via MUS' },
      { timestamp: 'Apr 11, 2026 14:00', actor: 'Sneha Desai', action: 'Evidence uploaded', detail: '7 files across 5 samples' },
      { timestamp: 'Apr 13, 2026 11:00', actor: 'Sneha Desai', action: 'Testing completed', detail: '5/5 tested — 3 failures' },
      { timestamp: 'Apr 13, 2026 11:30', actor: 'Sneha Desai', action: 'Submitted for review', detail: 'Conclusion: Ineffective' },
      { timestamp: 'Apr 14, 2026 10:00', actor: 'Karan Mehta', action: 'Review approved', detail: 'Ineffective — Deficiency DEF-001 raised' },
    ],
  },

  // ── Control 5: SOD Violation Detector — NOT STARTED ──
  {
    id: 'ec-005', controlId: 'CTR-006', controlName: 'SOD violation detector real-time',
    domain: 'P2P — Access Controls', isKey: false,
    objective: 'Detect and prevent segregation of duties violations between payment creation and payment approval roles in real-time.',
    description: 'Real-time monitoring of user role assignments. Alerts compliance team when conflicting roles are assigned. Blocks conflicting transaction execution.',
    frequency: 'Continuous', controlOwner: 'IT Security Team',
    assertions: ['Authorization'],
    workflowName: 'SOD Violation Detector', workflowVersion: 'v1.1',
    workflowAttributes: [
      { id: 'attr-s1', name: 'Role Matrix Current', description: 'Verify SOD rule matrix is current and covers all critical transaction combinations', requiredEvidence: 'SOD matrix export' },
      { id: 'attr-s2', name: 'Detection Active', description: 'Confirm real-time detection was active during the test period', requiredEvidence: 'System uptime log' },
      { id: 'attr-s3', name: 'Alert Effectiveness', description: 'Verify alerts were generated and routed to appropriate personnel', requiredEvidence: 'Alert log with timestamps' },
      { id: 'attr-s4', name: 'Remediation Timeliness', description: 'Confirm violations were remediated within SLA (48 hours)', requiredEvidence: 'Remediation log' },
    ],
    populationRequired: true, populationStatus: 'none', populationSize: 0,
    populationSource: '',
    samplingMethod: '',
    samples: [],
    testingRound: 0, assignee: 'Tushar Goel', reviewer: 'Karan Mehta',
    status: 'not-started', result: '', conclusion: '',
    sampleCount: 0, samplesTested: 0, exceptions: 0, evidenceCount: 0, lastUpdated: '—',
    workingPaper: {
      testInstanceId: 'TI-005', controlId: 'CTR-006', controlName: 'SOD violation detector real-time',
      workflowName: 'SOD Violation Detector', workflowVersion: 'v1.1',
      rounds: [], comments: [],
    },
    auditTrail: [],
  },

  // ── Control 6: Journal Entry Review — POPULATION PENDING ──
  {
    id: 'ec-006', controlId: 'CTR-008', controlName: 'Journal entry management review',
    domain: 'R2R — Financial Close', isKey: true,
    objective: 'Ensure all manual journal entries are reviewed and approved by an independent reviewer before posting to the general ledger.',
    description: 'All manual JEs require approval from a reviewer who is independent of the preparer. System enforces segregation between preparer and approver.',
    frequency: 'Per transaction', controlOwner: 'Sunil Kumar (Controller)',
    assertions: ['Completeness', 'Accuracy', 'Authorization'],
    workflowName: 'Journal Entry Anomaly Detector', workflowVersion: 'v3.0',
    workflowAttributes: [
      { id: 'attr-j1', name: 'Preparer/Approver Segregation', description: 'Verify JE preparer and approver are different individuals', requiredEvidence: 'JE workflow log' },
      { id: 'attr-j2', name: 'Approval Before Posting', description: 'Confirm approval timestamp precedes posting timestamp', requiredEvidence: 'System timestamps' },
      { id: 'attr-j3', name: 'Supporting Documentation', description: 'Verify adequate supporting documentation exists for the entry', requiredEvidence: 'JE support package' },
    ],
    populationRequired: true, populationStatus: 'uploaded', populationSize: 4521,
    populationSource: 'SAP ERP — Manual journal entries Q1-Q3 FY26',
    samplingMethod: '',
    samples: [],
    testingRound: 0, assignee: 'Rohan Patel', reviewer: 'Karan Mehta',
    status: 'population-pending', result: '', conclusion: '',
    sampleCount: 0, samplesTested: 0, exceptions: 0, evidenceCount: 0, lastUpdated: 'Apr 19, 2026',
    workingPaper: {
      testInstanceId: 'TI-006', controlId: 'CTR-008', controlName: 'Journal entry management review',
      workflowName: 'Journal Entry Anomaly Detector', workflowVersion: 'v3.0',
      rounds: [], comments: [
        { author: 'Rohan Patel', role: 'Tester', date: 'Apr 19, 2026', text: 'Population uploaded — 4,521 manual JEs. Awaiting sampling method selection and snapshot creation.' },
      ],
    },
    auditTrail: [
      { timestamp: 'Apr 19, 2026 09:30', actor: 'Rohan Patel', action: 'Population uploaded', detail: '4,521 manual journal entries' },
    ],
  },
];

// ─── Findings ────────────────────────────────────────────────────────────────

export const FINDINGS: Finding[] = [
  {
    id: 'DEF-001',
    title: 'Credit limit overrides processed without proper authorization',
    engagementId: 'eng-sox-fy26',
    controlId: 'CTR-002',
    controlName: 'Automated credit limit monitoring',
    testInstanceId: 'TI-004',
    failedAttribute: 'Override Documentation / Block Enforcement',
    failedSamples: ['SO-2025-9002 ($890K)', 'SO-2025-9003 ($125K)', 'SO-2025-9005 ($1.2M)'],
    evidenceRefs: ['credit_check_9002.pdf', 'limit_mismatch.xlsx', 'override_no_approval.pdf', 'no_credit_check_evidence.pdf'],
    severity: 'Significant Deficiency',
    status: 'Open',
    owner: 'Anita Reddy',
    rootCause: 'Credit manager override process lacks system enforcement. Overrides can be performed without uploading approval documentation. Credit check can be bypassed entirely for certain order types.',
    remediationDueDate: 'Jun 30, 2026',
    remediationPlan: '1. Implement mandatory approval attachment for overrides. 2. Remove ability to bypass credit check for any order type. 3. Add daily exception report for credit manager review. 4. Conduct user access review for override privileges.',
    raisedDate: 'Apr 14, 2026',
    raisedBy: 'Sneha Desai',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getControlById(id: string): ControlDetail | undefined {
  return CONTROLS.find(c => c.id === id);
}

/** Get the primary (first) linked workflow, falling back to legacy fields */
export function getPrimaryWorkflow(ctrl: ControlDetail): LinkedWorkflow {
  if (ctrl.linkedWorkflows && ctrl.linkedWorkflows.length > 0) {
    return ctrl.linkedWorkflows[0];
  }
  // Fallback: synthesize from legacy single-workflow fields
  const allAssertions = new Set<string>();
  ctrl.workflowAttributes.forEach(a => { if (a.assertions) a.assertions.forEach(x => allAssertions.add(x)); });
  return {
    id: 'lw-legacy',
    name: ctrl.workflowName,
    version: ctrl.workflowVersion,
    status: 'active',
    owner: ctrl.assignee,
    attributeIds: ctrl.workflowAttributes.map(a => a.id),
    attributesCount: ctrl.workflowAttributes.length,
    assertionCoverage: Array.from(allAssertions),
  };
}

/** Summary of workflow coverage for a control */
export interface WorkflowSummary {
  linkedWorkflowCount: number;
  attributeCount: number;
  unmappedAttributeCount: number;
  displayText: string;
}

/** Get a compact summary of workflow ↔ attribute coverage */
export function getWorkflowSummary(ctrl: ControlDetail): WorkflowSummary {
  const workflows = getLinkedWorkflows(ctrl);
  const totalAttrs = ctrl.workflowAttributes.length;
  const isSingleLegacy = workflows.length === 1 && workflows[0].id === 'lw-legacy';
  const unmapped = isSingleLegacy ? 0 : ctrl.workflowAttributes.filter(a => !a.workflowId).length;
  const wfCount = workflows.length;

  return {
    linkedWorkflowCount: wfCount,
    attributeCount: totalAttrs,
    unmappedAttributeCount: unmapped,
    displayText: `${wfCount} workflow${wfCount !== 1 ? 's' : ''} · ${totalAttrs} attribute${totalAttrs !== 1 ? 's' : ''}`,
  };
}

/** Get all linked workflows for a control (with legacy fallback) */
export function getLinkedWorkflows(ctrl: ControlDetail): LinkedWorkflow[] {
  if (ctrl.linkedWorkflows && ctrl.linkedWorkflows.length > 0) {
    return ctrl.linkedWorkflows;
  }
  return [getPrimaryWorkflow(ctrl)];
}

/** Get attributes belonging to a specific workflow.
 *  For legacy controls (no workflowId on attrs), if workflowId matches
 *  the fallback 'lw-legacy', return all attributes. */
export function getAttributesForWorkflow(ctrl: ControlDetail, workflowId: string): WorkflowAttribute[] {
  const matched = ctrl.workflowAttributes.filter(a => a.workflowId === workflowId);
  if (matched.length > 0) return matched;
  // Legacy fallback: if asking for 'lw-legacy' (synthesized) and no attrs have workflowId, return all
  if (workflowId === 'lw-legacy' && ctrl.workflowAttributes.every(a => !a.workflowId)) {
    return ctrl.workflowAttributes;
  }
  return [];
}

/** Get the workflow that owns a specific attribute */
export function getWorkflowForAttribute(ctrl: ControlDetail, attrId: string): LinkedWorkflow | undefined {
  const attr = ctrl.workflowAttributes.find(a => a.id === attrId);
  if (!attr?.workflowId) return getPrimaryWorkflow(ctrl);
  return getLinkedWorkflows(ctrl).find(w => w.id === attr.workflowId);
}
