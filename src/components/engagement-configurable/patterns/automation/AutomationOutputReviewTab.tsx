// ─── Automation Project — Output Review Tab ──────────────────────────────
// Review run outputs and exceptions before cases/reports.

import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, XCircle, ChevronRight, Lock, Info, Eye, X,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState, AutomationRunException, ExceptionStatus } from './automationRunsData';
import { EX_SEVERITY_CLS, EX_STATUS_CLS, EX_CAT_LABELS } from './automationRunsData';
import {
  deriveOutputReviewStatus, deriveOutputReviewSummary, REVIEW_STATUS_CLS,
  type AutomationOutputReviewState,
} from './automationOutputReviewData';
import { DEFICIENCY_LABELS, DEFICIENCY_CLS, DEFICIENCY_TYPES, type DeficiencyType } from './automationCasesData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
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

export default function AutomationOutputReviewTab({ engagement, runsState, outputReview, onUpdateOutputReview, onUpdateRunException, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const [selectedRunId, setSelectedRunId] = useState(completedRuns[completedRuns.length - 1]?.id || '');
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedExIds, setSelectedExIds] = useState<Set<string>>(new Set());
  const [showTriageForm, setShowTriageForm] = useState(false);

  // Locked
  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Output Review</h3><p className="text-[12px] text-text-muted">Review generated outputs and exceptions.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Output Review Locked</h4>
          <p className="text-[12px] text-text-muted">Complete at least one automation run before reviewing outputs.</p>
          <button onClick={() => onNavigateTab?.('runs')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Runs <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  const status = deriveOutputReviewStatus(runsState, outputReview, cfg);
  const summary = deriveOutputReviewSummary(runsState, outputReview, cfg);
  const selectedRun = completedRuns.find(r => r.id === selectedRunId) || completedRuns[completedRuns.length - 1];
  const outputs = selectedRunId ? (selectedRun?.outputs || []) : completedRuns.flatMap(r => r.outputs);
  const exceptions = selectedRunId ? (selectedRun?.exceptions || []) : completedRuns.flatMap(r => r.exceptions);

  const getOutputReviewState = (outputId: string) => {
    if (outputReview.approvedOutputIds.includes(outputId)) return 'Approved';
    if (outputReview.rejectedOutputIds.includes(outputId)) return 'Rejected';
    if (outputReview.reviewedOutputIds.includes(outputId)) return 'Reviewed';
    return 'Not Reviewed';
  };
  const outputReviewCls = (s: string) => s === 'Approved' ? 'bg-emerald-50 text-emerald-700' : s === 'Rejected' ? 'bg-red-50 text-red-700' : s === 'Reviewed' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500';

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

  // ── Exception bulk selection ──
  const toggleExSelect = (id: string) => setSelectedExIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllEx = () => { const openIds = exceptions.filter(e => e.status === 'OPEN').map(e => e.id); setSelectedExIds(new Set(openIds)); };
  const clearExSelection = () => setSelectedExIds(new Set());

  const bulkUpdateStatus = (newStatus: ExceptionStatus) => {
    selectedExIds.forEach(exId => {
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      if (parentRun) onUpdateRunException(parentRun.id, exId, newStatus);
    });
    clearExSelection();
  };

  const handleTriageSave = (triage: { deficiencyType: DeficiencyType; owner: string; reviewer: string; dueDate: string; notes: string }) => {
    const ts = now();
    selectedExIds.forEach(exId => {
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      if (parentRun) {
        onUpdateRunException(parentRun.id, exId, 'CASE_CANDIDATE', {
          deficiencyType: triage.deficiencyType, assignedOwner: triage.owner, reviewer: triage.reviewer,
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

  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const hasReport = cfg.outputTypes.includes('REPORT');
  const canContinueCases = hasCaseMgmt && summary.caseCandidates > 0;
  const canContinueReports = hasReport && summary.approved > 0;
  const selectedCount = selectedExIds.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Output Review</h3>
          <p className="text-[12px] text-text-muted">Review generated outputs and exceptions before creating cases or reports.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${REVIEW_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Runs', value: summary.completedRuns },
          { label: 'Outputs', value: summary.totalOutputs },
          { label: 'Reviewed', value: summary.reviewed },
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

      {/* Run selector */}
      <div className="flex items-center gap-1">
        <button onClick={() => setSelectedRunId('')}
          className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${!selectedRunId ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          All Runs
        </button>
        {completedRuns.map(r => (
          <button key={r.id} onClick={() => setSelectedRunId(r.id)}
            className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${selectedRunId === r.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {r.runName.length > 25 ? r.runName.slice(0, 24) + '…' : r.runName}
          </button>
        ))}
      </div>

      {/* Outputs table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Outputs ({outputs.length})</h4></div>
        {outputs.length === 0 ? (
          <div className="px-4 py-4 text-[11px] text-gray-400 italic">No outputs to review.</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Output</th><th className="px-3 py-1.5 text-center">Type</th><th className="px-3 py-1.5 text-left">Workflow</th><th className="px-3 py-1.5 text-center">Records</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Review</th><th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{outputs.map(o => {
              const rs = getOutputReviewState(o.id);
              return (
                <tr key={o.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2"><div className="font-medium text-text">{o.name}</div><div className="text-[9px] text-gray-400">{o.description}</div></td>
                  <td className="px-3 py-2 text-center text-gray-500">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td className="px-3 py-2 text-[9px] text-gray-500">{o.sourceWorkflowName || '—'}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-500">{o.recordCount || '—'}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${o.status === 'GENERATED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{o.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${outputReviewCls(rs)}`}>{rs}</span></td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {rs === 'Not Reviewed' && <button onClick={() => markOutput(o.id, 'reviewed')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>}
                      {rs !== 'Approved' && <button onClick={() => markOutput(o.id, 'approved')} className="px-2 py-1 rounded text-[8px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer transition-colors">Approve</button>}
                      {rs !== 'Rejected' && <button onClick={() => markOutput(o.id, 'rejected')} className="px-2 py-1 rounded text-[8px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors">Reject</button>}
                      <button onClick={() => { setCommentTarget(o.id); setCommentText(outputReview.outputComments[o.id] || ''); }} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"><Eye size={8} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {/* Comment panel */}
      {commentTarget && (
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-bold text-text">Output Comment</h5>
            <button onClick={() => setCommentTarget(null)} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><XCircle size={12} /></button>
          </div>
          <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={2} placeholder="Add review comment..." className={inputCls + ' resize-none'} />
          <button onClick={() => saveComment(commentTarget)} className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors">Save Comment</button>
        </div>
      )}

      {/* Exceptions — bulk action bar */}
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
          selectedExceptions={exceptions.filter(e => selectedExIds.has(e.id))}
          defaultOwner={engagement.owner}
          onSave={handleTriageSave}
          onCancel={() => { setShowTriageForm(false); }}
        />
      )}

      {/* Exceptions table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-text">Exceptions ({exceptions.length})</h4>
            {exceptions.filter(e => e.status === 'OPEN').length > 0 && (
              <button onClick={selectAllEx} className="text-[9px] font-semibold text-primary hover:underline cursor-pointer">Select All Open</button>
            )}
          </div>
          <p className="text-[9px] text-gray-400">Exceptions are system findings. Review them, dismiss false positives, or mark valid issues as case candidates with deficiency type and owner.</p>
        </div>
        {exceptions.length === 0 ? (
          <div className="px-4 py-4 text-[11px] text-gray-400 italic flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" />No exceptions to review.</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
              <th className="px-2 py-1.5 w-6"></th>
              <th className="px-2 py-1.5 text-left">Exception</th>
              <th className="px-2 py-1.5 text-center">Severity</th>
              <th className="px-2 py-1.5 text-left">Workflow</th>
              <th className="px-2 py-1.5 text-center">Category</th>
              <th className="px-2 py-1.5 text-left">Deficiency</th>
              <th className="px-2 py-1.5 text-left">Owner</th>
              <th className="px-2 py-1.5 text-center">Due</th>
              <th className="px-2 py-1.5 text-center">Status</th>
              <th className="px-2 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{exceptions.map(ex => {
              const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === ex.id));
              const isChecked = selectedExIds.has(ex.id);
              return (
                <tr key={ex.id} className={`border-b border-border-light/50 ${isChecked ? 'bg-purple-50/30' : ''}`}>
                  <td className="px-2 py-2 text-center">
                    {ex.status === 'OPEN' && <input type="checkbox" checked={isChecked} onChange={() => toggleExSelect(ex.id)} className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />}
                  </td>
                  <td className="px-2 py-2"><div className="font-medium text-text">{ex.title}</div><div className="text-[9px] text-gray-400">{ex.description.slice(0, 50)}...</div></td>
                  <td className="px-2 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></td>
                  <td className="px-2 py-2 text-[9px] text-gray-500">{ex.sourceWorkflowName || '—'}</td>
                  <td className="px-2 py-2 text-center text-[9px] text-gray-500">{EX_CAT_LABELS[ex.category]}</td>
                  <td className="px-2 py-2 text-[9px]">{ex.deficiencyType ? <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DEFICIENCY_CLS[ex.deficiencyType as DeficiencyType] || 'bg-gray-100 text-gray-600'}`}>{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-2 py-2 text-[9px] text-gray-500">{ex.assignedOwner || '—'}</td>
                  <td className="px-2 py-2 text-center text-[9px] font-mono text-gray-500">{ex.dueDate || '—'}</td>
                  <td className="px-2 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-2 py-2 text-center">
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
            })}</tbody>
          </table>
        )}
      </div>

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

// ─── Triage Form ─────────────────────────────────────────────────────────

function TriageForm({ selectedExceptions, defaultOwner, onSave, onCancel }: {
  selectedExceptions: AutomationRunException[]; defaultOwner: string;
  onSave: (triage: { deficiencyType: DeficiencyType; owner: string; reviewer: string; dueDate: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [deficiencyType, setDeficiencyType] = useState<DeficiencyType>('OTHER');
  const [owner, setOwner] = useState(defaultOwner);
  const [reviewer, setReviewer] = useState('');
  const [dueDate, setDueDate] = useState(futureDate(14));
  const [notes, setNotes] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  const handleSave = () => {
    if (!owner.trim()) { setValidationMsg('Owner is required.'); return; }
    if (!dueDate) { setValidationMsg('Due date is required.'); return; }
    onSave({ deficiencyType, owner: owner.trim(), reviewer: reviewer.trim(), dueDate, notes: notes.trim() });
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
          <label className={labelCls}>Deficiency Type <span className="text-red-400">*</span></label>
          <select value={deficiencyType} onChange={e => setDeficiencyType(e.target.value as DeficiencyType)} className={selectCls}>
            {DEFICIENCY_TYPES.map(d => <option key={d} value={d}>{DEFICIENCY_LABELS[d]}</option>)}
          </select>
        </div>
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
          <label className={labelCls}>Triage Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Classification rationale, context..." className={inputCls + ' resize-none'} />
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
