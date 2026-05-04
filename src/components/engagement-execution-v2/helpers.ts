// ─── Engagement Execution V2 — Pure Helper Functions ──────────────────────
// All functions are pure: no side effects, no state mutations.
// No UI component should hardcode state logic — use these helpers.

import type {
  ExecutionControl, EngagementExecution, TestItem, Attribute,
} from './types';
import {
  ControlExecStatus, AutomationClass, AttributeType,
  SampleResult, AttrResult, ReviewStatus, ExecutionMode,
} from './types';

// ─── 1. deriveControlType ─────────────────────────────────────────────────

export type DerivedControlType = 'Automated' | 'Manual' | 'Hybrid';

export function deriveControlType(ctrl: ExecutionControl): DerivedControlType {
  if (ctrl.attributes.length === 0) return 'Manual';
  const hasAuto = ctrl.attributes.some(a => a.type === AttributeType.AUTOMATED);
  const hasManual = ctrl.attributes.some(a => a.type === AttributeType.MANUAL);
  if (hasAuto && hasManual) return 'Hybrid';
  if (hasAuto) return 'Automated';
  return 'Manual';
}

// ─── 2. deriveWorkflowCoverage ────────────────────────────────────────────

export interface WorkflowCoverage {
  linkedWorkflowCount: number;
  totalAttributes: number;
  mappedAttributes: number;
  unmappedAttributes: number;
  isReadyForExecution: boolean;
  displayText: string;
}

export function deriveWorkflowCoverage(ctrl: ExecutionControl): WorkflowCoverage {
  const totalAttributes = ctrl.attributes.length;
  const mappedAttrIds = new Set(ctrl.workflowMappings.flatMap(wm => wm.mappedAttributeIds));
  const mappedAttributes = ctrl.attributes.filter(a => mappedAttrIds.has(a.id)).length;
  const unmappedAttributes = totalAttributes - mappedAttributes;
  const linkedWorkflowCount = ctrl.workflowMappings.length;
  const isReadyForExecution = totalAttributes > 0 && unmappedAttributes === 0;

  const wfLabel = `${linkedWorkflowCount} workflow${linkedWorkflowCount !== 1 ? 's' : ''}`;
  const attrLabel = `${totalAttributes} attribute${totalAttributes !== 1 ? 's' : ''}`;
  const displayText = linkedWorkflowCount > 0 ? `${wfLabel} · ${attrLabel}` : 'No workflows mapped';

  return { linkedWorkflowCount, totalAttributes, mappedAttributes, unmappedAttributes, isReadyForExecution, displayText };
}

// ─── 3. deriveSampleResult ────────────────────────────────────────────────

export function deriveSampleResult(item: TestItem, attributes: Attribute[]): SampleResult {
  const requiredAttrIds = new Set(attributes.filter(a => a.required).map(a => a.id));
  const requiredResults = item.attributeResults.filter(r => requiredAttrIds.has(r.attributeId));

  // If no required attributes tested yet → PENDING
  if (requiredResults.length === 0) return SampleResult.PENDING;

  // If any required attribute has NOT_TESTED → PENDING
  if (requiredResults.some(r => r.result === AttrResult.NOT_TESTED)) return SampleResult.PENDING;

  // If any required attribute FAIL → FAIL
  if (requiredResults.some(r => r.result === AttrResult.FAIL)) return SampleResult.FAIL;

  // All required attributes tested and PASS → PASS
  const allRequiredTested = requiredAttrIds.size === requiredResults.length;
  if (allRequiredTested && requiredResults.every(r => r.result === AttrResult.PASS)) return SampleResult.PASS;

  return SampleResult.PENDING;
}

// ─── 4. deriveControlConclusion ───────────────────────────────────────────

export function deriveControlConclusion(ctrl: ExecutionControl): 'EFFECTIVE' | 'INEFFECTIVE' | null {
  // Conclusion is ONLY derived after reviewer approval
  if (ctrl.execution.review.status !== ReviewStatus.APPROVED) return null;

  const items = ctrl.execution.testItems;
  if (items.length === 0) return null;

  // If any sample FAIL → INEFFECTIVE
  const hasFail = items.some(i => i.sampleResult === SampleResult.FAIL);
  if (hasFail) return 'INEFFECTIVE';

  // If all required test items PASS → EFFECTIVE
  const allPass = items.every(i => i.sampleResult === SampleResult.PASS);
  if (allPass) return 'EFFECTIVE';

  // Otherwise not conclusive yet
  return null;
}

// ─── 5. deriveEvidenceStatus ──────────────────────────────────────────────

export type EvidenceStatus = 'NOT_UPLOADED' | 'PARTIAL' | 'READY';

export function deriveEvidenceStatus(item: TestItem, attributes: Attribute[]): EvidenceStatus {
  // Only check manual attributes that require evidence
  const manualAttrs = attributes.filter(a => a.type === AttributeType.MANUAL && a.required);
  if (manualAttrs.length === 0) {
    // No manual evidence required — if any evidence exists it's extra, consider READY
    return item.evidence.length > 0 ? 'READY' : 'READY';
  }

  if (item.evidence.length === 0) return 'NOT_UPLOADED';

  // Check how many manual attributes have at least one mapped evidence
  const mappedAttrIds = new Set(item.evidence.flatMap(e => e.mappedAttributeIds));
  const coveredManual = manualAttrs.filter(a => mappedAttrIds.has(a.id)).length;

  if (coveredManual === 0) return 'NOT_UPLOADED';
  if (coveredManual < manualAttrs.length) return 'PARTIAL';
  return 'READY';
}

// ─── 6. deriveTestingProgress ─────────────────────────────────────────────

export interface TestingProgress {
  totalAttributeChecks: number;
  completedAttributeChecks: number;
  failedAttributeChecks: number;
  manualPending: number;
  automatedPending: number;
  completionPercent: number;
}

export function deriveTestingProgress(ctrl: ExecutionControl): TestingProgress {
  const items = ctrl.execution.testItems;
  const attrs = ctrl.attributes;
  const totalAttributeChecks = items.length * attrs.length;

  if (totalAttributeChecks === 0) {
    return { totalAttributeChecks: 0, completedAttributeChecks: 0, failedAttributeChecks: 0, manualPending: 0, automatedPending: 0, completionPercent: 0 };
  }

  let completed = 0;
  let failed = 0;
  let manualPending = 0;
  let automatedPending = 0;

  const attrMap = new Map(attrs.map(a => [a.id, a]));

  for (const item of items) {
    for (const attr of attrs) {
      const result = item.attributeResults.find(r => r.attributeId === attr.id);
      if (!result || result.result === AttrResult.NOT_TESTED) {
        if (attr.type === AttributeType.MANUAL) manualPending++;
        else automatedPending++;
      } else {
        completed++;
        if (result.result === AttrResult.FAIL) failed++;
      }
    }
  }

  const completionPercent = Math.round((completed / totalAttributeChecks) * 100);

  return { totalAttributeChecks, completedAttributeChecks: completed, failedAttributeChecks: failed, manualPending, automatedPending, completionPercent };
}

// ─── 7. deriveNextAction ──────────────────────────────────────────────────

export function deriveNextAction(ctrl: ExecutionControl): string {
  const exec = ctrl.execution;
  const coverage = deriveWorkflowCoverage(ctrl);
  const controlType = deriveControlType(ctrl);
  const isManual = controlType === 'Manual';

  // Workflow coverage incomplete
  if (!coverage.isReadyForExecution && ctrl.attributes.length > 0) return 'Fix Workflow Mapping';

  // Manual: no test items → create samples
  if (isManual && exec.testItems.length === 0) return 'Create Samples';

  // Automated/Hybrid: no population → build population
  if (!isManual && exec.population === null) return 'Build Population';

  // Population exists but no execution mode
  if (!isManual && exec.population !== null && exec.executionMode === null) return 'Choose Execution Mode';

  // Execution mode is SAMPLING but no test items
  if (exec.executionMode === ExecutionMode.SAMPLING && exec.testItems.length === 0) return 'Generate Samples';

  // Full run but no test items
  if (exec.executionMode === ExecutionMode.FULL_RUN && exec.testItems.length === 0) return 'Run Full Population';

  // Test items exist — check evidence for manual attributes
  if (exec.testItems.length > 0) {
    const manualAttrs = ctrl.attributes.filter(a => a.type === AttributeType.MANUAL && a.required);
    if (manualAttrs.length > 0) {
      const anyMissingEvidence = exec.testItems.some(item => {
        const mapped = new Set(item.evidence.flatMap(e => e.mappedAttributeIds));
        return manualAttrs.some(a => !mapped.has(a.id));
      });
      if (anyMissingEvidence) return 'Collect Evidence';
    }
  }

  // Check testing status
  switch (exec.status) {
    case ControlExecStatus.NOT_STARTED:
    case ControlExecStatus.POPULATION_READY:
    case ControlExecStatus.TEST_ITEMS_READY:
    case ControlExecStatus.EVIDENCE_IN_PROGRESS:
    case ControlExecStatus.EVIDENCE_READY:
      return 'Start Testing';
    case ControlExecStatus.TESTING_IN_PROGRESS:
      return 'Continue Testing';
    case ControlExecStatus.TESTING_COMPLETE:
      return 'Submit for Review';
    case ControlExecStatus.PENDING_REVIEW:
      return 'Awaiting Review';
    case ControlExecStatus.REJECTED:
      return 'Fix Issues';
    case ControlExecStatus.CONCLUDED:
      return 'View Conclusion';
  }
}

/** Maps a next-action label to the internal step ID for navigation */
export function deriveNextStepId(actionLabel: string): string {
  const map: Record<string, string> = {
    'Fix Workflow Mapping': 'overview',
    'Create Samples': 'create-samples',
    'Build Population': 'population',
    'Choose Execution Mode': 'execution-mode',
    'Generate Samples': 'samples',
    'Run Full Population': 'execution-mode',
    'Collect Evidence': 'evidence',
    'Start Testing': 'attr-testing',
    'Continue Testing': 'attr-testing',
    'Submit for Review': 'review',
    'Awaiting Review': 'review',
    'Fix Issues': 'attr-testing',
    'View Conclusion': 'conclusion',
  };
  return map[actionLabel] || 'overview';
}

// ─── 8. deriveStepAvailability ────────────────────────────────────────────

export interface StepState {
  enabled: boolean;
  reason: string;
}

export interface StepAvailability {
  overview: StepState;
  population: StepState;
  executionMode: StepState;
  samples: StepState;
  createSamples: StepState;
  evidence: StepState;
  attributeTesting: StepState;
  workingPaper: StepState;
  review: StepState;
  conclusion: StepState;
}

const STATUS_ORDER: ControlExecStatus[] = [
  ControlExecStatus.NOT_STARTED,
  ControlExecStatus.POPULATION_READY,
  ControlExecStatus.TEST_ITEMS_READY,
  ControlExecStatus.EVIDENCE_IN_PROGRESS,
  ControlExecStatus.EVIDENCE_READY,
  ControlExecStatus.TESTING_IN_PROGRESS,
  ControlExecStatus.TESTING_COMPLETE,
  ControlExecStatus.PENDING_REVIEW,
  ControlExecStatus.REJECTED,
  ControlExecStatus.CONCLUDED,
];

function statusAtLeast(current: ControlExecStatus, threshold: ControlExecStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

export function deriveStepAvailability(ctrl: ExecutionControl): StepAvailability {
  const s = ctrl.execution.status;
  const controlType = deriveControlType(ctrl);
  const isManual = controlType === 'Manual';
  const hasPopulation = ctrl.execution.population !== null;
  const hasTestItems = ctrl.execution.testItems.length > 0;
  const hasMode = ctrl.execution.executionMode !== null;

  return {
    overview: { enabled: true, reason: '' },

    population: {
      enabled: !isManual,
      reason: isManual ? 'Manual controls do not require population' : '',
    },

    executionMode: {
      enabled: !isManual && hasPopulation,
      reason: !hasPopulation ? 'Upload population first' : isManual ? 'Manual controls skip execution mode' : '',
    },

    samples: {
      enabled: !isManual && hasMode && statusAtLeast(s, ControlExecStatus.TEST_ITEMS_READY),
      reason: !hasMode ? 'Choose execution mode first' : '',
    },

    createSamples: {
      enabled: isManual,
      reason: !isManual ? 'Use population + sampling for automated controls' : '',
    },

    evidence: {
      enabled: hasTestItems,
      reason: !hasTestItems ? 'Generate or create test items first' : '',
    },

    attributeTesting: {
      enabled: hasTestItems,
      reason: !hasTestItems ? 'No test items available' : '',
    },

    workingPaper: {
      enabled: hasTestItems && (statusAtLeast(s, ControlExecStatus.TESTING_COMPLETE) || s === ControlExecStatus.REJECTED),
      reason: !hasTestItems ? 'No test items' : 'Complete all attribute testing first',
    },

    review: {
      enabled: hasTestItems && (statusAtLeast(s, ControlExecStatus.TESTING_COMPLETE) || s === ControlExecStatus.REJECTED),
      reason: !hasTestItems ? 'No test items' : 'Testing must be complete before review',
    },

    conclusion: {
      enabled: s === ControlExecStatus.CONCLUDED,
      reason: s !== ControlExecStatus.CONCLUDED ? 'Reviewer must approve before conclusion is set' : '',
    },
  };
}

// ─── 9. deriveEngagementKpis ──────────────────────────────────────────────

export interface EngagementKPIs {
  totalControls: number;
  notStarted: number;
  inProgress: number;
  pendingReview: number;
  concluded: number;
  effective: number;
  ineffective: number;
  rejected: number;
}

export function deriveEngagementKpis(eng: EngagementExecution): EngagementKPIs {
  const cs = eng.controls;
  const inProgressStatuses: ControlExecStatus[] = [
    ControlExecStatus.POPULATION_READY,
    ControlExecStatus.TEST_ITEMS_READY,
    ControlExecStatus.EVIDENCE_IN_PROGRESS,
    ControlExecStatus.EVIDENCE_READY,
    ControlExecStatus.TESTING_IN_PROGRESS,
    ControlExecStatus.TESTING_COMPLETE,
  ];
  return {
    totalControls: cs.length,
    notStarted: cs.filter(c => c.execution.status === ControlExecStatus.NOT_STARTED).length,
    inProgress: cs.filter(c => inProgressStatuses.includes(c.execution.status)).length,
    pendingReview: cs.filter(c => c.execution.status === ControlExecStatus.PENDING_REVIEW).length,
    concluded: cs.filter(c => c.execution.status === ControlExecStatus.CONCLUDED).length,
    effective: cs.filter(c => c.execution.conclusion.value === 'EFFECTIVE').length,
    ineffective: cs.filter(c => c.execution.conclusion.value === 'INEFFECTIVE').length,
    rejected: cs.filter(c => c.execution.status === ControlExecStatus.REJECTED).length,
  };
}
