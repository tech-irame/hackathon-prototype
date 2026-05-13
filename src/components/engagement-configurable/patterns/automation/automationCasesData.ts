// ─── Automation Cases — Types & Helpers ────────────────────────────────────

export type CaseStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseCategory = 'RECONCILIATION_MISMATCH' | 'DUPLICATE' | 'MISSING_DOCUMENT' | 'POLICY_VIOLATION' | 'DATA_QUALITY' | 'OTHER';

export interface CaseHistoryItem { id: string; action: string; actor: string; timestamp: string; comments: string }

export interface AutomationCase {
  id: string; title: string; description: string;
  sourceRunId: string; sourceExceptionId: string;
  severity: CasePriority; category: CaseCategory; owner: string;
  dueDate: string; status: CaseStatus; priority: CasePriority;
  evidenceRefs: string[]; comments: string;
  createdAt: string; updatedAt: string;
  history: CaseHistoryItem[];
}

export interface AutomationCasesState {
  cases: AutomationCase[];
  linkedExceptionIds: string[];
  caseNotes: string;
}

export const CASE_STATUS_CLS: Record<CaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', OPEN: 'bg-blue-50 text-blue-700', IN_PROGRESS: 'bg-purple-50 text-purple-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700', CLOSED: 'bg-gray-50 text-gray-500', CANCELLED: 'bg-gray-50 text-gray-400',
};
export const CASE_PRIORITY_CLS: Record<CasePriority, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700',
};
export const CASE_CAT_LABELS: Record<CaseCategory, string> = {
  RECONCILIATION_MISMATCH: 'Reconciliation Mismatch', DUPLICATE: 'Duplicate', MISSING_DOCUMENT: 'Missing Document',
  POLICY_VIOLATION: 'Policy Violation', DATA_QUALITY: 'Data Quality', OTHER: 'Other',
};

export function deriveCasesSummary(state: AutomationCasesState) {
  const c = state.cases;
  return {
    total: c.length,
    open: c.filter(x => x.status === 'OPEN').length,
    inProgress: c.filter(x => x.status === 'IN_PROGRESS').length,
    resolved: c.filter(x => x.status === 'RESOLVED' || x.status === 'CLOSED').length,
    criticalHigh: c.filter(x => (x.priority === 'CRITICAL' || x.priority === 'HIGH') && !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(x.status)).length,
  };
}
