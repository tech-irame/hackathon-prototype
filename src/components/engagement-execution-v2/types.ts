// ─── Engagement Execution V2 — Canonical Types ───────────────────────────
// Single source of truth. All statuses are lifecycle only.
// Readiness / derived values are computed in executionState.ts and helpers.ts.

// ─── Const Enums ──────────────────────────────────────────────────────────

export const ControlExecStatus = {
  NOT_STARTED: 'NOT_STARTED',
  POPULATION_READY: 'POPULATION_READY',
  TEST_ITEMS_READY: 'TEST_ITEMS_READY',
  EVIDENCE_IN_PROGRESS: 'EVIDENCE_IN_PROGRESS',
  EVIDENCE_READY: 'EVIDENCE_READY',
  TESTING_IN_PROGRESS: 'TESTING_IN_PROGRESS',
  TESTING_COMPLETE: 'TESTING_COMPLETE',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REJECTED: 'REJECTED',
  CONCLUDED: 'CONCLUDED',
} as const;
export type ControlExecStatus = typeof ControlExecStatus[keyof typeof ControlExecStatus];

export const ImportanceClass = { KEY: 'KEY', NON_KEY: 'NON_KEY' } as const;
export type ImportanceClass = typeof ImportanceClass[keyof typeof ImportanceClass];

export const NatureClass = { PREVENTIVE: 'PREVENTIVE', DETECTIVE: 'DETECTIVE', CORRECTIVE: 'CORRECTIVE' } as const;
export type NatureClass = typeof NatureClass[keyof typeof NatureClass];

export const AutomationClass = { MANUAL: 'MANUAL', IT_DEPENDENT: 'IT_DEPENDENT', AUTOMATED: 'AUTOMATED' } as const;
export type AutomationClass = typeof AutomationClass[keyof typeof AutomationClass];

export const AttributeType = { AUTOMATED: 'AUTOMATED', MANUAL: 'MANUAL' } as const;
export type AttributeType = typeof AttributeType[keyof typeof AttributeType];

export const ExecutionMode = { FULL_RUN: 'FULL_RUN', SAMPLING: 'SAMPLING' } as const;
export type ExecutionMode = typeof ExecutionMode[keyof typeof ExecutionMode];

export const SampleResult = { PENDING: 'PENDING', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type SampleResult = typeof SampleResult[keyof typeof SampleResult];

export const AttrResult = { NOT_TESTED: 'NOT_TESTED', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type AttrResult = typeof AttrResult[keyof typeof AttrResult];

export const AttrSource = { AUTO: 'AUTO', MANUAL: 'MANUAL' } as const;
export type AttrSource = typeof AttrSource[keyof typeof AttrSource];

export const ReviewStatus = { NOT_SUBMITTED: 'NOT_SUBMITTED', PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type ReviewStatus = typeof ReviewStatus[keyof typeof ReviewStatus];

export const ConclusionValue = { EFFECTIVE: 'EFFECTIVE', INEFFECTIVE: 'INEFFECTIVE' } as const;
export type ConclusionValue = typeof ConclusionValue[keyof typeof ConclusionValue];

export const WorkingPaperStatus = { NOT_GENERATED: 'NOT_GENERATED', DRAFT: 'DRAFT', GENERATED: 'GENERATED', FINAL: 'FINAL' } as const;
export type WorkingPaperStatus = typeof WorkingPaperStatus[keyof typeof WorkingPaperStatus];

export const EngagementStatus = { DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', IN_REVIEW: 'IN_REVIEW', COMPLETED: 'COMPLETED' } as const;
export type EngagementStatus = typeof EngagementStatus[keyof typeof EngagementStatus];

export const WorkflowMappingStatus = { DRAFT: 'DRAFT', READY: 'READY', ACTIVE: 'ACTIVE' } as const;
export type WorkflowMappingStatus = typeof WorkflowMappingStatus[keyof typeof WorkflowMappingStatus];

// ─── Core Interfaces ──────────────────────────────────────────────────────

export interface Assertion {
  id: string;
  name: string;
}

export interface Attribute {
  id: string;
  name: string;
  description: string;
  assertionId: string;
  assertionName: string;
  type: AttributeType;
  required: boolean;
  requiredEvidenceTypes: string[];
  workflowId?: string;
}

export interface WorkflowMapping {
  workflowId: string;
  workflowName: string;
  version: string;
  status: WorkflowMappingStatus;
  mappedAttributeIds: string[];
}

export interface PopulationSnapshot {
  id: string;
  source: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  locked: boolean;
  lockedAt: string | null;
  checksum: string;
  testUnit: string;
}

export interface Evidence {
  id: string;
  fileName: string;
  evidenceType: string;
  mappedAttributeIds: string[];
  uploadedAt: string;
  uploadedBy: string;
}

export interface AttributeResult {
  attributeId: string;
  result: AttrResult;
  source: AttrSource;
  evidenceIds: string[];
  notes: string;
  testedAt: string | null;
  testedBy: string | null;
}

export interface TestItem {
  id: string;
  referenceId: string;
  description: string;
  sourceRow: number | null;
  evidence: Evidence[];
  attributeResults: AttributeResult[];
  sampleResult: SampleResult;
}

export interface ReviewState {
  status: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewer: string;
  comments: string;
}

export interface Conclusion {
  value: ConclusionValue | null;
  reason: string;
  generatedAt: string | null;
}

export interface WorkingPaper {
  status: WorkingPaperStatus;
  generatedAt: string | null;
  finalDownloadEnabled: boolean;
}

export interface ControlExecutionState {
  status: ControlExecStatus;
  population: PopulationSnapshot | null;
  executionMode: ExecutionMode | null;
  testItems: TestItem[];
  review: ReviewState;
  workingPaper: WorkingPaper;
  conclusion: Conclusion;
}

export interface ExecutionControl {
  id: string;
  name: string;
  description: string;
  process: string;
  owner: string;
  importanceClass: ImportanceClass;
  natureClass: NatureClass;
  automationClass: AutomationClass;
  assertions: Assertion[];
  attributes: Attribute[];
  workflowMappings: WorkflowMapping[];
  execution: ControlExecutionState;
}

export interface EngagementExecution {
  id: string;
  name: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  framework: string;
  auditType: string;
  primaryProcess: string;
  owner: string;
  reviewer: string;
  status: EngagementStatus;
  controls: ExecutionControl[];
}
