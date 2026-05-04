// ─── Engagement Execution V2 — Mock Data ──────────────────────────────────
// All controls start fresh: NOT_STARTED, no population, no test items,
// no evidence, no attribute results, no review, no conclusion.

import type { EngagementExecution, ExecutionControl, ControlExecutionState } from './types';
import {
  ControlExecStatus, ImportanceClass, NatureClass, AutomationClass,
  AttributeType, ReviewStatus, WorkingPaperStatus,
} from './types';

// ─── Helper: create fresh execution state ─────────────────────────────────

function freshExecution(): ControlExecutionState {
  return {
    status: ControlExecStatus.NOT_STARTED,
    population: null,
    executionMode: null,
    testItems: [],
    review: {
      status: ReviewStatus.NOT_SUBMITTED,
      submittedAt: null,
      reviewedAt: null,
      reviewer: '',
      comments: '',
    },
    workingPaper: {
      status: WorkingPaperStatus.NOT_GENERATED,
      generatedAt: null,
      finalDownloadEnabled: false,
    },
    conclusion: {
      value: null,
      reason: '',
      generatedAt: null,
    },
  };
}

// ─── Controls ─────────────────────────────────────────────────────────────

const CONTROLS: ExecutionControl[] = [
  // ── C001: Manual Control ────────────────────────────────────────────────
  {
    id: 'exec-c001',
    name: 'Budget Planning and Allocation',
    description: 'Each department head prepares a detailed procurement budget covering anticipated OPEX and CAPEX requirements, referencing historical spending data, approved project plans, and strategic priorities.',
    process: 'PLM',
    owner: 'Rajiv Sharma',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.PREVENTIVE,
    automationClass: AutomationClass.MANUAL,
    assertions: [
      { id: 'asr-c001-acc', name: 'Accuracy' },
      { id: 'asr-c001-comp', name: 'Completeness' },
      { id: 'asr-c001-val', name: 'Validity' },
    ],
    attributes: [
      {
        id: 'attr-c001-01', name: 'Budget reflects historical spending data',
        description: 'Verify budget references prior year actuals and trend analysis.',
        assertionId: 'asr-c001-acc', assertionName: 'Accuracy',
        type: AttributeType.MANUAL, required: true,
        requiredEvidenceTypes: ['Budget workbook', 'Prior year actuals'],
        workflowId: 'wf-budget-review',
      },
      {
        id: 'attr-c001-02', name: 'Budget includes anticipated OPEX and CAPEX requirements',
        description: 'Confirm both operating and capital expenditure categories are present.',
        assertionId: 'asr-c001-comp', assertionName: 'Completeness',
        type: AttributeType.MANUAL, required: true,
        requiredEvidenceTypes: ['Budget workbook'],
        workflowId: 'wf-budget-review',
      },
      {
        id: 'attr-c001-03', name: 'Budget aligns with approved project plans',
        description: 'Cross-reference budget line items against approved project charters.',
        assertionId: 'asr-c001-val', assertionName: 'Validity',
        type: AttributeType.MANUAL, required: true,
        requiredEvidenceTypes: ['Project charter', 'Budget workbook'],
        workflowId: 'wf-budget-review',
      },
      {
        id: 'attr-c001-04', name: 'Budget aligns with strategic priorities',
        description: 'Verify budget allocations reflect board-approved strategic objectives.',
        assertionId: 'asr-c001-val', assertionName: 'Validity',
        type: AttributeType.MANUAL, required: true,
        requiredEvidenceTypes: ['Strategic plan', 'Budget workbook'],
        workflowId: 'wf-budget-review',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-budget-review',
        workflowName: 'Annual Procurement Budget Review Workflow',
        version: 'v1.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c001-01', 'attr-c001-02', 'attr-c001-03', 'attr-c001-04'],
      },
    ],
    execution: freshExecution(),
  },

  // ── C002: Hybrid Control ────────────────────────────────────────────────
  {
    id: 'exec-c002',
    name: 'Three-way PO/GRN/Invoice Matching',
    description: 'System-enforced three-way matching of Purchase Order, Goods Receipt Note, and Invoice before payment release, with manual approval for payments above threshold.',
    process: 'PLM',
    owner: 'Deepak Bansal',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.PREVENTIVE,
    automationClass: AutomationClass.IT_DEPENDENT,
    assertions: [
      { id: 'asr-c002-exist', name: 'Existence' },
      { id: 'asr-c002-acc', name: 'Accuracy' },
      { id: 'asr-c002-comp', name: 'Completeness' },
      { id: 'asr-c002-auth', name: 'Authorization' },
    ],
    attributes: [
      {
        id: 'attr-c002-01', name: 'PO exists for invoice',
        description: 'Verify a valid, approved Purchase Order exists for every invoice submitted for payment.',
        assertionId: 'asr-c002-exist', assertionName: 'Existence',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['PO document'],
        workflowId: 'wf-po-validation',
      },
      {
        id: 'attr-c002-02', name: 'GRN exists for invoice',
        description: 'Confirm a Goods Receipt Note exists matching the invoice line items.',
        assertionId: 'asr-c002-comp', assertionName: 'Completeness',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['GRN document'],
        workflowId: 'wf-grn-matching',
      },
      {
        id: 'attr-c002-03', name: 'Invoice amount matches PO amount',
        description: 'Validate invoice total matches PO total within configured tolerance.',
        assertionId: 'asr-c002-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['Invoice document', 'PO document'],
        workflowId: 'wf-invoice-match',
      },
      {
        id: 'attr-c002-04', name: 'Payment approval exists',
        description: 'Confirm appropriate payment approval was obtained before release per delegation matrix.',
        assertionId: 'asr-c002-auth', assertionName: 'Authorization',
        type: AttributeType.MANUAL, required: true,
        requiredEvidenceTypes: ['Approval log'],
        workflowId: 'wf-payment-approval',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-po-validation',
        workflowName: 'PO Validation Workflow',
        version: 'v2.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-01'],
      },
      {
        workflowId: 'wf-grn-matching',
        workflowName: 'GRN Matching Workflow',
        version: 'v1.6',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-02'],
      },
      {
        workflowId: 'wf-invoice-match',
        workflowName: 'Invoice Match Workflow',
        version: 'v2.3',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-03'],
      },
      {
        workflowId: 'wf-payment-approval',
        workflowName: 'Payment Approval Review Workflow',
        version: 'v1.0',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c002-04'],
      },
    ],
    execution: freshExecution(),
  },

  // ── C003: Automated Control ─────────────────────────────────────────────
  {
    id: 'exec-c003',
    name: 'Duplicate Invoice Detection',
    description: 'Automated scanning of invoices against historical data to identify and flag potential duplicate submissions before payment processing.',
    process: 'PLM',
    owner: 'Rajiv Sharma',
    importanceClass: ImportanceClass.KEY,
    natureClass: NatureClass.DETECTIVE,
    automationClass: AutomationClass.AUTOMATED,
    assertions: [
      { id: 'asr-c003-acc', name: 'Accuracy' },
      { id: 'asr-c003-val', name: 'Validity' },
    ],
    attributes: [
      {
        id: 'attr-c003-01', name: 'Duplicate invoice number check',
        description: 'System scans for exact invoice number matches across vendors and periods.',
        assertionId: 'asr-c003-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['System log'],
        workflowId: 'wf-dup-detector',
      },
      {
        id: 'attr-c003-02', name: 'Vendor + amount duplicate check',
        description: 'System flags invoices with matching vendor ID and amount within configurable window.',
        assertionId: 'asr-c003-acc', assertionName: 'Accuracy',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['System log'],
        workflowId: 'wf-dup-detector',
      },
      {
        id: 'attr-c003-03', name: 'Duplicate override authorization',
        description: 'Verify that any duplicate override was authorized by an appropriate approver.',
        assertionId: 'asr-c003-val', assertionName: 'Validity',
        type: AttributeType.AUTOMATED, required: true,
        requiredEvidenceTypes: ['Override log', 'Approval log'],
        workflowId: 'wf-override-monitor',
      },
    ],
    workflowMappings: [
      {
        workflowId: 'wf-dup-detector',
        workflowName: 'Duplicate Invoice Detector',
        version: 'v1.4',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c003-01', 'attr-c003-02'],
      },
      {
        workflowId: 'wf-override-monitor',
        workflowName: 'Override Monitor',
        version: 'v1.2',
        status: 'ACTIVE',
        mappedAttributeIds: ['attr-c003-03'],
      },
    ],
    execution: freshExecution(),
  },
];

// ─── Engagement ───────────────────────────────────────────────────────────

export const MOCK_ENGAGEMENT_V2: EngagementExecution = {
  id: 'eng-v2-001',
  name: 'FY26 Procurement Controls Testing',
  auditPeriodStart: 'Apr 1, 2025',
  auditPeriodEnd: 'Mar 31, 2026',
  framework: 'SOX ICFR',
  auditType: 'Financial Internal Control',
  primaryProcess: 'Procurement Lifecycle Management',
  owner: 'SOX Manager',
  reviewer: 'Audit Lead',
  status: 'ACTIVE',
  controls: CONTROLS,
};
