// ─── Automation Runs — Types & Helpers ─────────────────────────────────────

export type AutoRunType = 'WORKFLOW' | 'DRAFT_WORKFLOW' | 'QA_ADHOC';
export type AutoRunStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type OutputType = 'REPORT_DATA' | 'EXCEPTION_LIST' | 'RECONCILIATION_OUTPUT' | 'DASHBOARD_METRICS' | 'CASE_CANDIDATES' | 'DOWNLOADABLE_FILE';
export type ExceptionCategory = 'RECONCILIATION_MISMATCH' | 'DUPLICATE' | 'MISSING_DOCUMENT' | 'POLICY_VIOLATION' | 'DATA_QUALITY' | 'OTHER';
export type ExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'CASE_CANDIDATE';
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface AutomationRunOutput { id: string; outputType: OutputType; name: string; description: string; recordCount: number | null; status: 'GENERATED' | 'NEEDS_REVIEW' | 'FAILED' }
export interface AutomationRunException { id: string; severity: ExceptionSeverity; title: string; description: string; sourceRecord: string; sourceFile: string; category: ExceptionCategory; status: ExceptionStatus }
export interface AutomationRunLog { id: string; timestamp: string; level: LogLevel; message: string }

export interface AutomationRun {
  id: string; runName: string; runType: AutoRunType; sourceSetupMode: string; workflowName: string;
  inputSourceIds: string[]; status: AutoRunStatus; startedAt: string | null; completedAt: string | null;
  runBy: string; summary: string; processedRecords: number; exceptionCount: number; outputCount: number;
  outputs: AutomationRunOutput[]; exceptions: AutomationRunException[]; logs: AutomationRunLog[];
}

export interface AutomationRunsState { runs: AutomationRun[] }

export const RUN_STATUS_CLS: Record<AutoRunStatus, string> = {
  READY: 'bg-blue-50 text-blue-700', RUNNING: 'bg-purple-50 text-purple-700', COMPLETED: 'bg-emerald-50 text-emerald-700', FAILED: 'bg-red-50 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500',
};
export const EX_SEVERITY_CLS: Record<ExceptionSeverity, string> = { LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-blue-50 text-blue-700', HIGH: 'bg-amber-50 text-amber-700', CRITICAL: 'bg-red-50 text-red-700' };
export const EX_STATUS_CLS: Record<ExceptionStatus, string> = { OPEN: 'bg-amber-50 text-amber-700', REVIEWED: 'bg-blue-50 text-blue-700', DISMISSED: 'bg-gray-100 text-gray-500', CASE_CANDIDATE: 'bg-purple-50 text-purple-700' };
export const EX_CAT_LABELS: Record<ExceptionCategory, string> = { RECONCILIATION_MISMATCH: 'Reconciliation Mismatch', DUPLICATE: 'Duplicate', MISSING_DOCUMENT: 'Missing Document', POLICY_VIOLATION: 'Policy Violation', DATA_QUALITY: 'Data Quality', OTHER: 'Other' };

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

// ─── Run Simulation ───────────────────────────────────────────────────────

import type { AutomationSetupState } from './automationSetupData';
import type { AutomationInputDataState } from './automationInputData';

export function simulateRun(run: AutomationRun, setup: AutomationSetupState, inputData: AutomationInputDataState, actor: string): AutomationRun {
  const ts = now();
  const records = inputData.dataSources.filter(d => run.inputSourceIds.includes(d.id)).reduce((s, d) => s + (d.recordCount || d.pageCount || d.imageCount || 0), 0);
  const wfName = (setup.selectedWorkflowName || setup.draftWorkflow?.name || '').toLowerCase();
  const qaQ = (setup.qaSetup?.questions || []).join(' ').toLowerCase();

  const outputs: AutomationRunOutput[] = [];
  const exceptions: AutomationRunException[] = [];
  const logs: AutomationRunLog[] = [
    { id: `log-${Date.now()}-1`, timestamp: ts, level: 'INFO', message: 'Input validation completed.' },
    { id: `log-${Date.now()}-2`, timestamp: ts, level: 'INFO', message: 'Automation logic executed.' },
  ];

  // Determine exceptions based on workflow/Q&A
  const isRecon = wfName.includes('reconcil') || wfName.includes('vendor') || wfName.includes('match') || qaQ.includes('unmatched') || qaQ.includes('reconcil') || qaQ.includes('payment');
  const isDupe = wfName.includes('duplicate') || wfName.includes('expense') || qaQ.includes('duplicate');
  const isDoc = wfName.includes('document') || wfName.includes('image') || qaQ.includes('document') || qaQ.includes('support');

  if (isRecon) {
    exceptions.push(
      { id: `ex-${Date.now()}-1`, severity: 'HIGH', title: 'Vendor payment mismatch', description: 'Payment for Vendor A invoice INV-1003 does not match ledger amount. Ledger: 45,000 vs Payment: 44,500.', sourceRecord: 'INV-1003', sourceFile: 'vendor_ledger_april.xlsx', category: 'RECONCILIATION_MISMATCH', status: 'OPEN' },
      { id: `ex-${Date.now()}-2`, severity: 'MEDIUM', title: 'Duplicate invoice pattern detected', description: 'Vendor A has two invoices for identical amount 45,000 within 4 days.', sourceRecord: 'INV-1001, INV-1003', sourceFile: 'vendor_ledger_april.xlsx', category: 'DUPLICATE', status: 'OPEN' },
    );
    outputs.push(
      { id: `out-${Date.now()}-1`, outputType: 'RECONCILIATION_OUTPUT', name: 'Reconciliation Summary', description: `${records} records processed. 2 mismatches found.`, recordCount: records, status: 'GENERATED' },
      { id: `out-${Date.now()}-2`, outputType: 'EXCEPTION_LIST', name: 'Exception Report', description: '2 exceptions identified.', recordCount: 2, status: 'GENERATED' },
      { id: `out-${Date.now()}-3`, outputType: 'DASHBOARD_METRICS', name: 'Dashboard Metrics', description: 'Match rate, exception rate, vendor summary.', recordCount: null, status: 'GENERATED' },
    );
  } else if (isDupe) {
    exceptions.push(
      { id: `ex-${Date.now()}-3`, severity: 'MEDIUM', title: 'Duplicate reimbursement claim', description: 'Expense claim EXP-442 appears twice with same amount and date.', sourceRecord: 'EXP-442', sourceFile: '', category: 'DUPLICATE', status: 'OPEN' },
    );
    outputs.push({ id: `out-${Date.now()}-4`, outputType: 'EXCEPTION_LIST', name: 'Duplicate Detection Report', description: '1 duplicate found.', recordCount: 1, status: 'GENERATED' });
  } else if (isDoc) {
    exceptions.push(
      { id: `ex-${Date.now()}-4`, severity: 'HIGH', title: 'Missing supporting document', description: 'Asset image batch missing 3 expected images for verification.', sourceRecord: '', sourceFile: 'asset_images_batch1.zip', category: 'MISSING_DOCUMENT', status: 'OPEN' },
    );
    outputs.push({ id: `out-${Date.now()}-5`, outputType: 'REPORT_DATA', name: 'Document Review Report', description: 'Review completed with 1 exception.', recordCount: null, status: 'GENERATED' });
  } else {
    exceptions.push(
      { id: `ex-${Date.now()}-5`, severity: 'MEDIUM', title: 'Data quality issue', description: 'Minor formatting inconsistency detected in source data.', sourceRecord: '', sourceFile: '', category: 'DATA_QUALITY', status: 'OPEN' },
    );
    outputs.push({ id: `out-${Date.now()}-6`, outputType: 'REPORT_DATA', name: 'Analysis Output', description: 'Analysis completed.', recordCount: records || null, status: 'GENERATED' });
  }

  // Always add case candidates output if exceptions exist
  if (exceptions.length > 0) {
    outputs.push({ id: `out-${Date.now()}-7`, outputType: 'CASE_CANDIDATES', name: 'Case Candidates', description: `${exceptions.length} potential case(s).`, recordCount: exceptions.length, status: 'NEEDS_REVIEW' });
  }

  logs.push(
    { id: `log-${Date.now()}-3`, timestamp: ts, level: 'INFO', message: `${outputs.length} output(s) generated.` },
    { id: `log-${Date.now()}-4`, timestamp: ts, level: exceptions.length > 0 ? 'WARNING' : 'INFO', message: `${exceptions.length} exception(s) identified.` },
  );

  const summary = `${records} record(s) processed. ${outputs.length} output(s) generated. ${exceptions.length} exception(s) found.`;

  return { ...run, status: 'COMPLETED', startedAt: ts, completedAt: ts, runBy: actor, summary, processedRecords: records, exceptionCount: exceptions.length, outputCount: outputs.length, outputs, exceptions, logs };
}

export function deriveRunsSummary(state: AutomationRunsState) {
  return {
    total: state.runs.length,
    completed: state.runs.filter(r => r.status === 'COMPLETED').length,
    failed: state.runs.filter(r => r.status === 'FAILED').length,
    openExceptions: state.runs.flatMap(r => r.exceptions).filter(e => e.status === 'OPEN').length,
    outputs: state.runs.reduce((s, r) => s + r.outputs.length, 0),
    lastStatus: state.runs.length > 0 ? state.runs[state.runs.length - 1].status : 'READY' as AutoRunStatus,
  };
}
