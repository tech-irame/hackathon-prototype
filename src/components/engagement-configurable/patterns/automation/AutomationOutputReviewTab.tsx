// ─── Automation Project — Output Review Tab ──────────────────────────────
// Review run outputs and exceptions grouped by workflow.

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, XCircle, ChevronRight, ChevronDown, Lock, Eye, X,
  Workflow, FileText, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState, AutomationRunException, AutomationRunOutput, ExceptionStatus } from './automationRunsData';
import { EX_SEVERITY_CLS, EX_STATUS_CLS, EX_CAT_LABELS } from './automationRunsData';
import {
  deriveOutputReviewStatus, deriveOutputReviewSummary, REVIEW_STATUS_CLS,
  type AutomationOutputReviewState,
} from './automationOutputReviewData';
import { DEFICIENCY_LABELS, DEFICIENCY_CLS, type DeficiencyType } from './automationCasesData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function futureDate(days: number): string { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  outputReview: AutomationOutputReviewState;
  onUpdateOutputReview: (state: AutomationOutputReviewState) => void;
  onUpdateRunException: (runId: string, exId: string, status: ExceptionStatus, triageData?: Record<string, unknown>) => void;
  onNavigateTab?: (tabId: string) => void;
}

// Group outputs/exceptions by workflow name
interface WorkflowGroup {
  workflowName: string;
  workflowId?: string;
  outputs: AutomationRunOutput[];
  exceptions: AutomationRunException[];
  lastRunDate: string | null;
  runStatus: string;
}

function groupByWorkflow(runsState: AutomationRunsState): WorkflowGroup[] {
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const map = new Map<string, WorkflowGroup>();

  for (const run of completedRuns) {
    for (const out of run.outputs) {
      const name = out.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, workflowId: out.sourceWorkflowId, outputs: [], exceptions: [], lastRunDate: run.completedAt, runStatus: run.status });
      map.get(name)!.outputs.push(out);
      if (run.completedAt && (!map.get(name)!.lastRunDate || run.completedAt > map.get(name)!.lastRunDate!)) map.get(name)!.lastRunDate = run.completedAt;
    }
    for (const ex of run.exceptions) {
      const name = ex.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, workflowId: ex.sourceWorkflowId, outputs: [], exceptions: [], lastRunDate: run.completedAt, runStatus: run.status });
      map.get(name)!.exceptions.push(ex);
    }
  }

  return Array.from(map.values());
}

export default function AutomationOutputReviewTab({ engagement, runsState, outputReview, onUpdateOutputReview, onUpdateRunException, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedExIds, setSelectedExIds] = useState<Set<string>>(new Set());
  const [showTriageForm, setShowTriageForm] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [detailWorkflow, setDetailWorkflow] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ type: 'output'; item: AutomationRunOutput } | { type: 'exception'; item: AutomationRunException } | null>(null);

  // Locked
  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Output Review</h3><p className="text-[12px] text-text-muted">Review generated outputs and exceptions.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Output Review Locked</h4>
          <p className="text-[12px] text-text-muted">Complete at least one automation run before reviewing outputs.</p>
          <button onClick={() => onNavigateTab?.('workflows')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Workflows <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  const status = deriveOutputReviewStatus(runsState, outputReview, cfg);
  const summary = deriveOutputReviewSummary(runsState, outputReview, cfg);
  const workflowGroups = useMemo(() => groupByWorkflow(runsState), [runsState]);
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);

  const getOutputReviewState = (outputId: string) => {
    if (outputReview.approvedOutputIds.includes(outputId)) return 'Approved';
    if (outputReview.rejectedOutputIds.includes(outputId)) return 'Excluded';
    if (outputReview.reviewedOutputIds.includes(outputId)) return 'Reviewed';
    return 'Not Reviewed';
  };
  const outputReviewCls = (s: string) => s === 'Approved' ? 'bg-emerald-50 text-emerald-700' : s === 'Excluded' ? 'bg-red-50 text-red-700' : s === 'Reviewed' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500';

  const markOutput = (outputId: string, action: 'reviewed' | 'approved' | 'rejected') => {
    const clean = {
      reviewedOutputIds: outputReview.reviewedOutputIds.filter(id => id !== outputId),
      approvedOutputIds: outputReview.approvedOutputIds.filter(id => id !== outputId),
      rejectedOutputIds: outputReview.rejectedOutputIds.filter(id => id !== outputId),
    };
    const history = [...outputReview.history, { id: `orh-${Date.now()}`, action: `OUTPUT_${action.toUpperCase()}`, actor: engagement.owner, timestamp: now(), comments: outputReview.outputComments[outputId] || '' }];
    if (action === 'reviewed') onUpdateOutputReview({ ...outputReview, ...clean, reviewedOutputIds: [...clean.reviewedOutputIds, outputId], history });
    if (action === 'approved') onUpdateOutputReview({ ...outputReview, ...clean, approvedOutputIds: [...clean.approvedOutputIds, outputId], history });
    if (action === 'rejected') onUpdateOutputReview({ ...outputReview, ...clean, rejectedOutputIds: [...clean.rejectedOutputIds, outputId], history });
  };

  const saveComment = (outputId: string) => {
    onUpdateOutputReview({ ...outputReview, outputComments: { ...outputReview.outputComments, [outputId]: commentText } });
    setCommentTarget(null);
    setCommentText('');
  };

  // ── Exception selection ──
  const toggleExSelect = (id: string) => setSelectedExIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllEx = () => { const openIds = allExceptions.filter(e => e.status === 'OPEN').map(e => e.id); setSelectedExIds(new Set(openIds)); };
  const clearExSelection = () => setSelectedExIds(new Set());

  const bulkUpdateStatus = (newStatus: ExceptionStatus) => {
    selectedExIds.forEach(exId => {
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      if (parentRun) onUpdateRunException(parentRun.id, exId, newStatus);
    });
    clearExSelection();
  };

  const handleTriageSave = (triage: { owner: string; reviewer: string; dueDate: string; notes: string }) => {
    const ts = now();
    selectedExIds.forEach(exId => {
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      if (parentRun) {
        onUpdateRunException(parentRun.id, exId, 'CASE_CANDIDATE', {
          assignedOwner: triage.owner, reviewer: triage.reviewer,
          dueDate: triage.dueDate, triageNotes: triage.notes, caseCandidateMarkedAt: ts, caseCandidateMarkedBy: engagement.owner,
        });
      }
    });
    clearExSelection();
    setShowTriageForm(false);
  };

  const openTriageForSingle = (exId: string) => {
    setSelectedExIds(new Set([exId]));
    setShowTriageForm(true);
  };

  const toggleExpand = (wfName: string) => {
    setExpandedWorkflows(prev => { const n = new Set(prev); n.has(wfName) ? n.delete(wfName) : n.add(wfName); return n; });
  };

  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const hasReport = cfg.outputTypes.includes('REPORT');
  const canContinueCases = hasCaseMgmt && summary.caseCandidates > 0;
  const canContinueReports = hasReport && summary.approved > 0;
  const selectedCount = selectedExIds.size;

  // ── Detail view for a specific workflow ──
  if (detailWorkflow) {
    const group = workflowGroups.find(g => g.workflowName === detailWorkflow);
    if (!group) { setDetailWorkflow(null); return null; }
    return (
      <WorkflowDetailPanel
        group={group}
        engagement={engagement}
        outputReview={outputReview}
        completedRuns={completedRuns}
        getOutputReviewState={getOutputReviewState}
        outputReviewCls={outputReviewCls}
        markOutput={markOutput}
        onUpdateRunException={onUpdateRunException}
        openTriageForSingle={openTriageForSingle}
        onBack={() => setDetailWorkflow(null)}
        onNavigateTab={onNavigateTab}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Output Review</h3>
          <p className="text-[12px] text-text-muted">Review generated outputs and exceptions grouped by workflow.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${REVIEW_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Top Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Total Runs', value: summary.completedRuns },
          { label: 'Workflows Run', value: workflowGroups.length },
          { label: 'Outputs', value: summary.totalOutputs },
          { label: 'Approved', value: summary.approved, cls: 'text-emerald-600' },
          { label: 'Open Exc.', value: summary.openExceptions, cls: summary.openExceptions > 0 ? 'text-amber-600' : '' },
          { label: 'Case Cand.', value: summary.caseCandidates, cls: summary.caseCandidates > 0 ? 'text-purple-600' : '' },
          { label: 'Report', value: summary.reportReady ? 'Ready' : '—', cls: summary.reportReady ? 'text-emerald-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk exception bar */}
      {selectedCount > 0 && !showTriageForm && (
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50/30 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-purple-700">{selectedCount} exception{selectedCount !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => bulkUpdateStatus('REVIEWED')} className="px-2.5 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Mark Reviewed</button>
            <button onClick={() => bulkUpdateStatus('DISMISSED')} className="px-2.5 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
            <button onClick={() => setShowTriageForm(true)} className="px-2.5 py-1 rounded text-[9px] font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 cursor-pointer transition-colors">Mark as Case Candidate</button>
            <button onClick={clearExSelection} className="px-2 py-1 rounded text-[9px] font-semibold text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">Clear</button>
          </div>
        </div>
      )}

      {/* Triage form */}
      {showTriageForm && (
        <TriageForm
          selectedExceptions={allExceptions.filter(e => selectedExIds.has(e.id))}
          defaultOwner={engagement.owner}
          onSave={handleTriageSave}
          onCancel={() => { setShowTriageForm(false); }}
        />
      )}

      {/* Workflow Result Sections */}
      <div className="space-y-3">
        {workflowGroups.map(group => {
          const isExpanded = expandedWorkflows.has(group.workflowName);
          const openEx = group.exceptions.filter(e => e.status === 'OPEN').length;
          const caseCands = group.exceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
          const approvedCount = group.outputs.filter(o => outputReview.approvedOutputIds.includes(o.id)).length;

          return (
            <div key={group.workflowName} className="rounded-xl border border-border-light bg-white overflow-hidden">
              {/* Accordion header */}
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-surface-2/30 transition-colors"
                onClick={() => toggleExpand(group.workflowName)}
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Workflow size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[13px] font-semibold text-text truncate">{group.workflowName}</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold shrink-0">COMPLETED</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted">
                    <span>{group.outputs.length} output{group.outputs.length !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <button onClick={e => { e.stopPropagation(); if (!isExpanded) toggleExpand(group.workflowName); }} className={`${group.exceptions.length > 0 ? 'text-amber-600' : ''} hover:underline cursor-pointer bg-transparent border-none p-0 text-[11px]`}>{group.exceptions.length} exception{group.exceptions.length !== 1 ? 's' : ''}</button>
                    {openEx > 0 && <><span className="text-gray-300">|</span><span className="text-amber-600 font-medium">{openEx} open</span></>}
                    {caseCands > 0 && <><span className="text-gray-300">|</span><span className="text-purple-600 font-medium">{caseCands} case candidate{caseCands !== 1 ? 's' : ''}</span></>}
                    {group.lastRunDate && <><span className="text-gray-300">|</span><span>Last run: {group.lastRunDate}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">{approvedCount} approved</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setDetailWorkflow(group.workflowName); }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary/10 cursor-pointer transition-colors"
                  >
                    View Details
                  </button>
                  {isExpanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                </div>
              </div>

              {/* Expanded content — merged outputs + exceptions */}
              {isExpanded && (
                <div className="border-t border-border-light">
                  <div className="px-5 py-3">
                    <p className="text-[10px] text-gray-400 mb-2">Approve outputs to include in the report. Click the exceptions row to view workflow findings.</p>
                    {group.outputs.length === 0 && group.exceptions.length === 0 ? (
                      <div className="text-[11px] text-gray-400 italic py-2 flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-500" />No outputs or exceptions — clean run.</div>
                    ) : (
                      <table className="w-full text-[10px]">
                        <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                          <th className="px-3 py-1.5 text-left">Output / Exception</th><th className="px-3 py-1.5 text-center">Type</th><th className="px-3 py-1.5 text-center">Records</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Review</th><th className="px-3 py-1.5 text-center">Action</th>
                        </tr></thead>
                        <tbody>
                          {/* Output rows */}
                          {group.outputs.map(o => {
                            const rs = getOutputReviewState(o.id);
                            return (
                              <tr key={o.id} className="border-b border-border-light/50">
                                <td className="px-3 py-2"><div className="font-medium text-text">{o.name}</div><div className="text-[9px] text-gray-400">{o.description}</div></td>
                                <td className="px-3 py-2 text-center text-gray-500">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                                <td className="px-3 py-2 text-center tabular-nums text-gray-500">{o.recordCount || '—'}</td>
                                <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${o.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${outputReviewCls(rs)}`}>{rs}</span></td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setPreviewItem({ type: 'output', item: o })} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"><Eye size={8} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {/* Exceptions expandable row */}
                          {group.exceptions.length > 0 && (() => {
                            const exOpen = group.exceptions.filter(e => e.status === 'OPEN').length;
                            const isExExpanded = expandedWorkflows.has(`${group.workflowName}__ex`);
                            const toggleExExpand = () => setExpandedWorkflows(prev => { const n = new Set(prev); const key = `${group.workflowName}__ex`; n.has(key) ? n.delete(key) : n.add(key); return n; });
                            return (
                              <>
                                <tr className="border-b border-border-light/50 bg-amber-50/30 cursor-pointer hover:bg-amber-50/50 transition-colors" onClick={toggleExExpand}>
                                  <td className="px-3 py-2.5" colSpan={6}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {isExExpanded ? <ChevronDown size={13} className="text-amber-600" /> : <ChevronRight size={13} className="text-amber-600" />}
                                        <AlertTriangle size={12} className="text-amber-500" />
                                        <span className="text-[11px] font-semibold text-amber-700">{group.exceptions.length} Exception{group.exceptions.length !== 1 ? 's' : ''}</span>
                                        {exOpen > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-bold">{exOpen} open</span>}
                                      </div>
                                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                {isExExpanded && group.exceptions.map(ex => {
                                  const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === ex.id));
                                  const isChecked = selectedExIds.has(ex.id);
                                  return (
                                    <tr key={ex.id} className={`border-b border-border-light/50 ${isChecked ? 'bg-purple-50/30' : 'bg-surface-2/10'}`}>
                                      <td className="px-3 py-2 pl-8">
                                        <div className="flex items-center gap-2">
                                          {ex.status === 'OPEN' && <input type="checkbox" checked={isChecked} onChange={() => toggleExSelect(ex.id)} className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />}
                                          <div><div className="font-medium text-text">{ex.title}</div><div className="text-[9px] text-gray-400">{ex.description.slice(0, 60)}...</div></div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></td>
                                      <td className="px-3 py-2 text-center text-[9px] text-gray-500">{EX_CAT_LABELS[ex.category]}</td>
                                      <td className="px-3 py-2 text-center">{ex.deficiencyType ? <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DEFICIENCY_CLS[ex.deficiencyType as DeficiencyType] || 'bg-gray-100 text-gray-600'}`}>{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span> : <span className="text-gray-400">—</span>}</td>
                                      <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></td>
                                      <td className="px-3 py-2 text-center">
                                        {ex.status === 'OPEN' && parentRun && (
                                          <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'REVIEWED')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                                            <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'DISMISSED')} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                                            <button onClick={() => openTriageForSingle(ex.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 cursor-pointer transition-colors">→ Case</button>
                                          </div>
                                        )}
                                        {ex.status !== 'OPEN' && <span className="text-[9px] text-gray-400">{ex.status.replace(/_/g, ' ')}</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}

      {/* Review notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Output Review Notes</h4>
        <textarea value={outputReview.reviewNotes} onChange={e => onUpdateOutputReview({ ...outputReview, reviewNotes: e.target.value })}
          rows={2} placeholder="Overall review notes, assumptions, output limitations..." className={inputCls + ' resize-none'} />
      </div>

      {/* Downstream readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Downstream Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${REVIEW_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
        </div>
        <div className="space-y-1">
          {[
            { label: 'At least one completed run', ok: summary.completedRuns > 0 },
            { label: 'Outputs reviewed', ok: summary.reviewed > 0 },
            ...(hasReport ? [{ label: 'Report output approved', ok: summary.approved > 0 }] : []),
            ...(hasCaseMgmt ? [{ label: 'Case candidates marked', ok: summary.caseCandidates > 0 }] : []),
            { label: 'Critical exceptions reviewed', ok: summary.openExceptions === 0 },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {hasCaseMgmt && (
            <button onClick={() => onNavigateTab?.('cases')} disabled={!canContinueCases}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Continue to Cases <ChevronRight size={11} />
            </button>
          )}
          {hasReport && (
            <button onClick={() => onNavigateTab?.('reports')} disabled={!canContinueReports}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Continue to Reports <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Detail Panel ────────────────────────────────────────────────

function WorkflowDetailPanel({ group, engagement, outputReview, completedRuns, getOutputReviewState, outputReviewCls, markOutput, onUpdateRunException, openTriageForSingle, onBack, onNavigateTab }: {
  group: WorkflowGroup;
  engagement: ConfigurableEngagement;
  outputReview: AutomationOutputReviewState;
  completedRuns: ReturnType<typeof Array.prototype.filter>;
  getOutputReviewState: (id: string) => string;
  outputReviewCls: (s: string) => string;
  markOutput: (id: string, action: 'reviewed' | 'approved' | 'rejected') => void;
  onUpdateRunException: (runId: string, exId: string, status: ExceptionStatus, triageData?: Record<string, unknown>) => void;
  openTriageForSingle: (exId: string) => void;
  onBack: () => void;
  onNavigateTab?: (tabId: string) => void;
}) {
  const openEx = group.exceptions.filter(e => e.status === 'OPEN').length;
  const caseCands = group.exceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const approvedCount = group.outputs.filter(o => outputReview.approvedOutputIds.includes(o.id)).length;
  const highCritical = group.exceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary transition-colors cursor-pointer">
        <ArrowLeft size={14} />Back to Output Review
      </button>

      {/* Workflow header */}
      <div className="rounded-xl border border-border-light bg-white p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Workflow size={20} /></div>
          <div>
            <h3 className="text-[16px] font-semibold text-text">{group.workflowName}</h3>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold">COMPLETED</span>
              {group.lastRunDate && <span>Last run: {group.lastRunDate}</span>}
            </div>
          </div>
        </div>

        {/* Workflow stats */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Outputs', value: group.outputs.length },
            { label: 'Approved', value: approvedCount, cls: 'text-emerald-600' },
            { label: 'Exceptions', value: group.exceptions.length, cls: group.exceptions.length > 0 ? 'text-amber-600' : '' },
            { label: 'High/Critical', value: highCritical, cls: highCritical > 0 ? 'text-red-600' : '' },
            { label: 'Case Cand.', value: caseCands, cls: caseCands > 0 ? 'text-purple-600' : '' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
              <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Outputs */}
      <div className="rounded-xl border border-border-light bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border-light bg-surface-2/20">
          <h4 className="text-[12px] font-bold text-text flex items-center gap-1.5"><FileText size={13} className="text-primary" />Outputs ({group.outputs.length})</h4>
          <p className="text-[10px] text-gray-400 mt-0.5">Approve outputs to include in the report. Excluded or unreviewed outputs will not appear in the final report.</p>
        </div>
        {group.outputs.length === 0 ? (
          <div className="px-5 py-4 text-[11px] text-gray-400 italic">No outputs generated by this workflow.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-4 py-2 text-left">Output</th><th className="px-4 py-2 text-center">Type</th><th className="px-4 py-2 text-center">Records</th><th className="px-4 py-2 text-center">Status</th><th className="px-4 py-2 text-center">Review</th><th className="px-4 py-2 text-center">Action</th>
            </tr></thead>
            <tbody>{group.outputs.map(o => {
              const rs = getOutputReviewState(o.id);
              return (
                <tr key={o.id} className="border-b border-border-light/50 hover:bg-surface-2/20">
                  <td className="px-4 py-2.5"><div className="font-medium text-text">{o.name}</div><div className="text-[10px] text-gray-400">{o.description}</div></td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-500">{o.recordCount || '—'}</td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${o.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${outputReviewCls(rs)}`}>{rs}</span></td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {rs === 'Not Reviewed' && <button onClick={() => markOutput(o.id, 'reviewed')} className="px-2 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>}
                      {rs !== 'Approved' && <button onClick={() => markOutput(o.id, 'approved')} className="px-2 py-1 rounded text-[9px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">Approve</button>}
                      {rs !== 'Excluded' && <button onClick={() => markOutput(o.id, 'rejected')} className="px-2 py-1 rounded text-[9px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors">Exclude</button>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {/* Exceptions */}
      <div className="rounded-xl border border-border-light bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border-light bg-surface-2/20">
          <h4 className="text-[12px] font-bold text-text flex items-center gap-1.5"><AlertTriangle size={13} className="text-amber-500" />Exceptions ({group.exceptions.length})</h4>
        </div>
        {group.exceptions.length === 0 ? (
          <div className="px-5 py-4 text-[11px] text-gray-400 italic flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-500" />No exceptions — clean run.</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-4 py-2 text-left">Exception</th>
              <th className="px-4 py-2 text-center">Severity</th>
              <th className="px-4 py-2 text-center">Category</th>
              <th className="px-4 py-2 text-left">Deficiency</th>
              <th className="px-4 py-2 text-center">Status</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr></thead>
            <tbody>{group.exceptions.map(ex => {
              const parentRun = (completedRuns as any[]).find((r: any) => r.exceptions.some((e: any) => e.id === ex.id));
              return (
                <tr key={ex.id} className="border-b border-border-light/50 hover:bg-surface-2/20">
                  <td className="px-4 py-2.5"><div className="font-medium text-text">{ex.title}</div><div className="text-[10px] text-gray-400">{ex.description}</div></td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></td>
                  <td className="px-4 py-2.5 text-center text-[10px] text-gray-500">{EX_CAT_LABELS[ex.category]}</td>
                  <td className="px-4 py-2.5 text-[10px]">{ex.deficiencyType ? <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${DEFICIENCY_CLS[ex.deficiencyType as DeficiencyType] || 'bg-gray-100 text-gray-600'}`}>{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-2.5 text-center">
                    {ex.status === 'OPEN' && parentRun && (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'REVIEWED')} className="px-2 py-1 rounded text-[9px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                        <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'DISMISSED')} className="px-2 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                        <button onClick={() => openTriageForSingle(ex.id)} className="px-2 py-1 rounded text-[9px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 cursor-pointer transition-colors">→ Case</button>
                      </div>
                    )}
                    {ex.status !== 'OPEN' && <span className="text-[10px] text-gray-400">{ex.status.replace(/_/g, ' ')}</span>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {/* CTA */}
      <div className="flex items-center gap-2">
        {onNavigateTab && (
          <button onClick={() => onNavigateTab?.('cases')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer transition-colors">
            Go to Cases <ChevronRight size={11} />
          </button>
        )}
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Back to Overview</button>
      </div>
    </div>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────

function PreviewModal({ item, onClose }: {
  item: { type: 'output'; item: AutomationRunOutput } | { type: 'exception'; item: AutomationRunException };
  onClose: () => void;
}) {
  const isOutput = item.type === 'output';
  const data = item.item;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-xl shadow-2xl border border-border-light w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 border-b border-border-light flex items-center justify-between ${isOutput ? 'bg-primary/5' : 'bg-amber-50/50'}`}>
          <div className="flex items-center gap-2.5">
            {isOutput ? <FileText size={16} className="text-primary" /> : <AlertTriangle size={16} className="text-amber-500" />}
            <div>
              <h3 className="text-[14px] font-semibold text-text">{isOutput ? (data as AutomationRunOutput).name : (data as AutomationRunException).title}</h3>
              <span className="text-[10px] text-text-muted">{isOutput ? 'Output Preview' : 'Exception Preview'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {isOutput ? (() => {
            const o = data as AutomationRunOutput;
            return (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</label>
                    <p className="text-[12px] text-text mt-0.5">{o.description || 'No description available.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Type</label>
                      <p className="text-[12px] text-text mt-0.5">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Records</label>
                      <p className="text-[12px] text-text mt-0.5 tabular-nums">{o.recordCount ?? '—'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</label>
                      <p className="mt-0.5"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${o.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{o.status.replace(/_/g, ' ')}</span></p>
                    </div>
                    {o.sourceWorkflowName && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Workflow</label>
                        <p className="text-[12px] text-text mt-0.5">{o.sourceWorkflowName}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })() : (() => {
            const ex = data as AutomationRunException;
            return (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</label>
                    <p className="text-[12px] text-text mt-0.5">{ex.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Severity</label>
                      <p className="mt-0.5"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</label>
                      <p className="text-[12px] text-text mt-0.5">{EX_CAT_LABELS[ex.category]}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</label>
                      <p className="mt-0.5"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></p>
                    </div>
                    {ex.deficiencyType && (
                      <div>
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Deficiency</label>
                        <p className="mt-0.5"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${DEFICIENCY_CLS[ex.deficiencyType as DeficiencyType] || 'bg-gray-100 text-gray-600'}`}>{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span></p>
                      </div>
                    )}
                  </div>
                  {(ex.sourceRecord || ex.sourceFile) && (
                    <div className="rounded-lg border border-border-light bg-surface-2/20 p-3 space-y-2">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Source Details</label>
                      {ex.sourceRecord && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">Record:</span> {ex.sourceRecord}</div>}
                      {ex.sourceFile && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">File:</span> {ex.sourceFile}</div>}
                    </div>
                  )}
                  {ex.sourceWorkflowName && (
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Workflow</label>
                      <p className="text-[12px] text-text mt-0.5">{ex.sourceWorkflowName}</p>
                    </div>
                  )}
                  {(ex.assignedOwner || ex.triageNotes) && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                      <label className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Triage Info</label>
                      {ex.assignedOwner && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">Owner:</span> {ex.assignedOwner}</div>}
                      {ex.reviewer && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">Reviewer:</span> {ex.reviewer}</div>}
                      {ex.dueDate && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">Due:</span> {ex.dueDate}</div>}
                      {ex.triageNotes && <div className="text-[11px] text-text"><span className="text-gray-400 font-medium">Notes:</span> {ex.triageNotes}</div>}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-light bg-surface-2/20 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-white cursor-pointer transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Triage Form ─────────────────────────────────────────────────────────

function TriageForm({ selectedExceptions, defaultOwner, onSave, onCancel }: {
  selectedExceptions: AutomationRunException[]; defaultOwner: string;
  onSave: (triage: { owner: string; reviewer: string; dueDate: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState(defaultOwner);
  const [reviewer, setReviewer] = useState('');
  const [dueDate, setDueDate] = useState(futureDate(14));
  const [notes, setNotes] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  const handleSave = () => {
    if (!owner.trim()) { setValidationMsg('Owner is required.'); return; }
    if (!dueDate) { setValidationMsg('Due date is required.'); return; }
    onSave({ owner: owner.trim(), reviewer: reviewer.trim(), dueDate, notes: notes.trim() });
  };

  return (
    <div className="rounded-xl border-2 border-purple-200 bg-white p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-text">Mark as Case Candidate</h4>
        <button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button>
      </div>

      <div className="text-[10px] text-gray-500">{selectedExceptions.length} exception{selectedExceptions.length !== 1 ? 's' : ''} selected:</div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {selectedExceptions.map(ex => (
          <div key={ex.id} className="flex items-center gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
            <span className="text-text font-medium">{ex.title}</span>
            {ex.sourceWorkflowName && <span className="text-gray-400">· {ex.sourceWorkflowName}</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Assign Owner <span className="text-red-400">*</span></label>
          <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Reviewer</label>
          <input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Optional reviewer" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Due Date <span className="text-red-400">*</span></label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes for Owner</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Instructions, context, or details for the risk/process owner..." className={inputCls + ' resize-none'} />
        </div>
      </div>

      {validationMsg && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-600">
          <AlertCircle size={10} /><span>{validationMsg}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer transition-colors">
          Mark {selectedExceptions.length} as Case Candidate{selectedExceptions.length !== 1 ? 's' : ''}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
      </div>
    </div>
  );
}
