// ─── Internal Audit — Final Report Tab ────────────────────────────────────
// Formal audit report from working paper, observations, and discussion.

import React from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronRight, FileText, Lock, RefreshCw,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from '../../configurableEngagementTypes';
import type { InternalAuditWorkspaceState } from './internalAuditScopeData';
import { SEVERITY_CLS as OBS_SEV_CLS } from './internalAuditObservationsData';
import {
  generateReportDraft, deriveFinalReportReadiness, RATING_LABELS, RATING_CLS, REPORT_STATUS_CLS,
  type InternalAuditFinalReportState, type OverallRating, type ReportStatus,
} from './internalAuditFinalReportData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  iaState: InternalAuditWorkspaceState;
  finalReport: InternalAuditFinalReportState;
  onUpdateFinalReport: (state: InternalAuditFinalReportState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function InternalAuditFinalReportTab({ engagement, iaState, finalReport, onUpdateFinalReport, onNavigateTab }: Props) {
  const { ready, checks } = deriveFinalReportReadiness(iaState, engagement);
  const activeObs = iaState.observations.observations.filter(o => o.status !== 'DROPPED');
  const agreedActions = iaState.discussion.items.filter(i => (i.status === 'AGREED' || i.status === 'READY_FOR_REPORT') && i.agreedAction.trim());
  const isIssued = finalReport.status === 'ISSUED';
  const isDraft = finalReport.status === 'DRAFT';
  const isReadyForReview = finalReport.status === 'READY_FOR_REVIEW';
  const hasDraft = finalReport.initialized;

  const handleGenerate = () => {
    const draft = generateReportDraft(engagement, iaState);
    onUpdateFinalReport({ ...finalReport, ...draft, status: 'DRAFT' });
  };

  const handleRefresh = () => {
    const draft = generateReportDraft(engagement, iaState);
    onUpdateFinalReport({
      ...finalReport,
      scopeAndObjective: draft.scopeAndObjective || finalReport.scopeAndObjective,
      proceduresPerformed: draft.proceduresPerformed || finalReport.proceduresPerformed,
      dataReviewed: draft.dataReviewed || finalReport.dataReviewed,
      overallRating: draft.overallRating || finalReport.overallRating,
      history: [...finalReport.history, { id: `rh-${Date.now()}`, action: 'UPDATED', actor: engagement.owner, timestamp: now(), comments: 'Refreshed from working paper.' }],
    });
  };

  const update = <K extends keyof InternalAuditFinalReportState>(f: K, v: InternalAuditFinalReportState[K]) =>
    onUpdateFinalReport({ ...finalReport, [f]: v });

  const handleMarkReady = () => {
    if (!ready) return;
    onUpdateFinalReport({ ...finalReport, status: 'READY_FOR_REVIEW', history: [...finalReport.history, { id: `rh-${Date.now()}`, action: 'MARKED_READY_FOR_REVIEW', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const handleIssue = () => {
    onUpdateFinalReport({ ...finalReport, status: 'ISSUED', issuedAt: now(), issuedBy: engagement.reviewer || engagement.owner, history: [...finalReport.history, { id: `rh-${Date.now()}`, action: 'ISSUED', actor: engagement.reviewer || engagement.owner, timestamp: now(), comments: 'Final report issued.' }] });
  };

  // Not started
  if (!hasDraft) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Final Report</h3><p className="text-[12px] text-text-muted">Prepare the formal internal audit report for management and closure.</p></div>
        <div className="rounded-xl border-2 border-dashed border-border-light p-8 text-center space-y-3">
          <FileText size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Generate Draft Report</h4>
          <p className="text-[12px] text-text-muted max-w-md mx-auto">Generate a draft report from the working paper, observations, and management discussion.</p>
          {!ready && <div className="flex items-start justify-center gap-2 text-[10px] text-amber-600"><AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Working paper is not fully ready. Report will contain pending sections.</span></div>}
          <button onClick={handleGenerate} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">Generate Draft Report</button>
        </div>
        {/* Readiness */}
        <div className="rounded-lg border border-border-light p-4 space-y-1">
          <h4 className="text-[11px] font-bold text-text mb-1">Report Readiness</h4>
          {checks.map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Final Report</h3>
          <p className="text-[12px] text-text-muted">Formal internal audit report for management and closure.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${REPORT_STATUS_CLS[finalReport.status]}`}>{finalReport.status.replace(/_/g, ' ')}</span>
          <button onClick={() => alert('Final report export will be connected later.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
            <Download size={12} />Export
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Status', value: finalReport.status === 'READY_FOR_REVIEW' ? 'Review' : finalReport.status.replace(/_/g, ' ') },
          { label: 'Rating', value: RATING_LABELS[finalReport.overallRating], cls: finalReport.overallRating === 'SATISFACTORY' ? 'text-emerald-600' : finalReport.overallRating === 'UNSATISFACTORY' ? 'text-red-600' : finalReport.overallRating === 'NEEDS_IMPROVEMENT' ? 'text-amber-600' : '' },
          { label: 'Observations', value: activeObs.length },
          { label: 'Critical/High', value: activeObs.filter(o => o.severity === 'CRITICAL' || o.severity === 'HIGH').length, cls: activeObs.some(o => o.severity === 'CRITICAL' || o.severity === 'HIGH') ? 'text-red-600' : '' },
          { label: 'Responses', value: iaState.discussion.items.filter(i => i.managementResponse.trim()).length },
          { label: 'Actions', value: agreedActions.length },
          { label: 'Readiness', value: ready ? 'Ready' : 'Pending', cls: ready ? 'text-emerald-600' : 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[14px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overall Rating */}
      <div className={`rounded-lg border-2 p-4 flex items-center justify-between ${RATING_CLS[finalReport.overallRating]}`}>
        <div>
          <h4 className="text-[14px] font-bold">Overall Audit Rating: {RATING_LABELS[finalReport.overallRating]}</h4>
          <p className="text-[11px] mt-0.5 opacity-80">{finalReport.executiveSummary.slice(0, 120)}{finalReport.executiveSummary.length > 120 ? '...' : ''}</p>
        </div>
        {!isIssued && (
          <select value={finalReport.overallRating} onChange={e => update('overallRating', e.target.value as OverallRating)} className="px-2 py-1 rounded border border-white/30 bg-white/50 text-[10px] font-semibold cursor-pointer outline-none">
            {(['SATISFACTORY', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY', 'NOT_APPLICABLE'] as OverallRating[]).map(r => <option key={r} value={r}>{RATING_LABELS[r]}</option>)}
          </select>
        )}
      </div>

      {/* Report sections */}
      <div className="rounded-xl border border-border-light bg-white p-5 space-y-4">
        {([
          { label: 'Report Title', field: 'reportTitle' as const, rows: 0 },
          { label: 'Executive Summary', field: 'executiveSummary' as const, rows: 4 },
          { label: 'Scope and Objective', field: 'scopeAndObjective' as const, rows: 3 },
          { label: 'Procedures Performed', field: 'proceduresPerformed' as const, rows: 2 },
          { label: 'Data / Documents Reviewed', field: 'dataReviewed' as const, rows: 2 },
          { label: 'Conclusion / Closing Remarks', field: 'conclusionRemarks' as const, rows: 3 },
          { label: 'Distribution List', field: 'distributionList' as const, rows: 0 },
        ]).map(s => (
          <div key={s.field}>
            <label className={labelCls}>{s.label}</label>
            {s.rows > 0 ? (
              <textarea value={finalReport[s.field]} onChange={e => update(s.field, e.target.value)} rows={s.rows} className={inputCls + ' resize-none'} disabled={isIssued} />
            ) : (
              <input value={finalReport[s.field]} onChange={e => update(s.field, e.target.value)} className={inputCls} disabled={isIssued} />
            )}
          </div>
        ))}

        {/* Observations in report */}
        <div>
          <label className={labelCls}>Detailed Observations ({activeObs.length})</label>
          {iaState.observations.noObservationsConfirmed ? (
            <div className="text-[11px] text-emerald-600 flex items-center gap-2 py-2"><CheckCircle2 size={12} />No audit observations were noted during this assignment.</div>
          ) : activeObs.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic py-2">Observations pending.</div>
          ) : (
            <div className="rounded-lg border border-border-light overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                  <th className="px-2 py-1.5 text-left">Observation</th><th className="px-2 py-1.5 text-center">Severity</th><th className="px-2 py-1.5 text-left">Root Cause</th><th className="px-2 py-1.5 text-left">Recommendation</th><th className="px-2 py-1.5 text-left">Mgmt Response</th><th className="px-2 py-1.5 text-left">Action</th><th className="px-2 py-1.5 text-left">Owner</th><th className="px-2 py-1.5 text-center">Target</th>
                </tr></thead>
                <tbody>{activeObs.map(o => {
                  const disc = iaState.discussion.items.find(d => d.observationId === o.id);
                  return (
                    <tr key={o.id} className="border-b border-border-light/50">
                      <td className="px-2 py-1.5 text-text font-medium">{o.title}</td>
                      <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${OBS_SEV_CLS[o.severity]}`}>{o.severity}</span></td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[100px]">{o.rootCause || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[100px]">{o.recommendation || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[100px]">{disc?.managementResponse || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[100px]">{disc?.agreedAction || '—'}</td>
                      <td className="px-2 py-1.5 text-gray-500">{disc?.actionOwner || o.processOwner || '—'}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-gray-500">{disc?.targetDate || o.targetRemediationDate || '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Agreed actions preview */}
      {agreedActions.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-2">Agreed Actions for Action Plan ({agreedActions.length})</h4>
          <div className="rounded-lg border border-border-light overflow-hidden">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b border-border-light bg-surface-2/30 text-[8px] font-semibold text-gray-400 uppercase">
                <th className="px-2 py-1.5 text-left">Observation</th><th className="px-2 py-1.5 text-left">Action</th><th className="px-2 py-1.5 text-left">Owner</th><th className="px-2 py-1.5 text-center">Target</th><th className="px-2 py-1.5 text-center">Status</th>
              </tr></thead>
              <tbody>{agreedActions.map(a => (
                <tr key={a.id} className="border-b border-border-light/50">
                  <td className="px-2 py-1.5 text-text">{a.observationTitle}</td>
                  <td className="px-2 py-1.5 text-gray-500">{a.agreedAction}</td>
                  <td className="px-2 py-1.5 text-gray-500">{a.actionOwner || '—'}</td>
                  <td className="px-2 py-1.5 text-center font-mono text-gray-500">{a.targetDate || '—'}</td>
                  <td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-amber-50 text-amber-700">Pending Action Plan</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* History */}
      {finalReport.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-2">Report History</h4>
          <div className="space-y-1">{finalReport.history.map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action.replace(/_/g, ' ')}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {!isIssued && (
          <button onClick={handleRefresh} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">
            <RefreshCw size={11} />Refresh from Working Paper
          </button>
        )}
        {isDraft && (
          <button onClick={handleMarkReady} disabled={!ready}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Mark Ready for Review</button>
        )}
        {isReadyForReview && (
          <button onClick={handleIssue}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <CheckCircle2 size={13} />Issue Final Report
          </button>
        )}
        {isIssued && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 flex-1">
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
            <span>Final report issued on {finalReport.issuedAt} by {finalReport.issuedBy}.</span>
          </div>
        )}
      </div>

      {/* Readiness + CTA */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ready ? 'Ready' : 'Pending'}</span>
        </div>
        <div className="space-y-1">{checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-[10px]">
            {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
            <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
          </div>
        ))}</div>
        <button onClick={() => onNavigateTab?.('action-plan')} disabled={!isIssued}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Action Plan <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
