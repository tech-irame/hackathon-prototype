// ─── Automation Project — Output Review Tab ──────────────────────────────
// Review run outputs and exceptions before cases/reports.

import React, { useState } from 'react';
import {
  CheckCircle2, AlertCircle, XCircle, ChevronRight, Lock, Info, Eye,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState, ExceptionStatus } from './automationRunsData';
import { RUN_STATUS_CLS, EX_SEVERITY_CLS, EX_STATUS_CLS, EX_CAT_LABELS } from './automationRunsData';
import {
  deriveOutputReviewStatus, deriveOutputReviewSummary, REVIEW_STATUS_CLS,
  type AutomationOutputReviewState,
} from './automationOutputReviewData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  outputReview: AutomationOutputReviewState;
  onUpdateOutputReview: (state: AutomationOutputReviewState) => void;
  onUpdateRunException: (runId: string, exId: string, status: ExceptionStatus) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationOutputReviewTab({ engagement, runsState, outputReview, onUpdateOutputReview, onUpdateRunException, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const [selectedRunId, setSelectedRunId] = useState(completedRuns[completedRuns.length - 1]?.id || '');
  const [commentTarget, setCommentTarget] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

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

  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const hasReport = cfg.outputTypes.includes('REPORT');
  const canContinueCases = hasCaseMgmt && summary.caseCandidates > 0;
  const canContinueReports = hasReport && summary.approved > 0;

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

      {/* Exceptions table */}
      <div className="rounded-lg border border-border-light overflow-hidden">
        <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Exceptions ({exceptions.length})</h4></div>
        {exceptions.length === 0 ? (
          <div className="px-4 py-4 text-[11px] text-gray-400 italic flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" />No exceptions to review.</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Exception</th><th className="px-3 py-1.5 text-center">Severity</th><th className="px-3 py-1.5 text-left">Workflow</th><th className="px-3 py-1.5 text-center">Category</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{exceptions.map(ex => {
              const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === ex.id));
              return (
                <tr key={ex.id} className="border-b border-border-light/50">
                  <td className="px-3 py-2"><div className="font-medium text-text">{ex.title}</div><div className="text-[9px] text-gray-400">{ex.description.slice(0, 60)}...</div></td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span></td>
                  <td className="px-3 py-2 text-[9px] text-gray-500">{ex.sourceWorkflowName || '—'}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{EX_CAT_LABELS[ex.category]}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_STATUS_CLS[ex.status]}`}>{ex.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-3 py-2 text-center">
                    {ex.status === 'OPEN' && parentRun && (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'REVIEWED')} className="px-2 py-1 rounded text-[8px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">Review</button>
                        <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'DISMISSED')} className="px-2 py-1 rounded text-[8px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">Dismiss</button>
                        <button onClick={() => onUpdateRunException(parentRun.id, ex.id, 'CASE_CANDIDATE')} className="px-2 py-1 rounded text-[8px] font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 cursor-pointer transition-colors">→ Case</button>
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
