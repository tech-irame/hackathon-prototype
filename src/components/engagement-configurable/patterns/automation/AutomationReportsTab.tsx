// ─── Automation Project — Reports Tab ─────────────────────────────────────
// Generate output reports from runs, outputs, exceptions, and cases.

import React, { useState } from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronRight, Lock, Info,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationProjectWorkspaceState } from './automationInputData';
import {
  generateDraftReport, deriveReportReadiness, REPORT_STATUS_CLS,
  type AutomationReportsState, type AutomationReport, type ReportStatus,
} from './automationReportsData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  automationState: AutomationProjectWorkspaceState;
  reportsState: AutomationReportsState;
  onUpdateReports: (state: AutomationReportsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationReportsTab({ engagement, automationState, reportsState, onUpdateReports, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasReportOutput = cfg.outputTypes.includes('REPORT');
  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const { ready, checks } = deriveReportReadiness(automationState, cfg);
  const [selectedReportId, setSelectedReportId] = useState(reportsState.reports[0]?.id || '');
  const selectedReport = reportsState.reports.find(r => r.id === selectedReportId);

  // Locked
  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Reports</h3><p className="text-[12px] text-text-muted">Generate automation output reports.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Reports Locked</h4>
          <p className="text-[12px] text-text-muted">Complete at least one automation run before generating a report.</p>
          <button onClick={() => onNavigateTab?.('runs')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Runs <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  // Warning for no approved outputs
  const noApproved = automationState.outputReview.approvedOutputIds.length === 0;

  const handleGenerate = () => {
    const draft = generateDraftReport(engagement, automationState);
    const report: AutomationReport = { id: `rpt-${Date.now()}`, ...draft } as AutomationReport;
    onUpdateReports({ ...reportsState, reports: [...reportsState.reports, report] });
    setSelectedReportId(report.id);
  };

  const updateReport = (id: string, updates: Partial<AutomationReport>) => {
    onUpdateReports({ ...reportsState, reports: reportsState.reports.map(r => r.id === id ? { ...r, ...updates } : r) });
  };

  const markReady = (id: string) => {
    updateReport(id, { status: 'READY', history: [...(selectedReport?.history || []), { id: `rrh-${Date.now()}`, action: 'MARKED_READY', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const finalize = (id: string) => {
    updateReport(id, { status: 'FINAL', finalizedAt: now(), finalizedBy: engagement.owner, history: [...(selectedReport?.history || []), { id: `rrh-${Date.now()}`, action: 'FINALIZED', actor: engagement.owner, timestamp: now(), comments: 'Report finalized.' }] });
  };

  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const isFinal = selectedReport?.status === 'FINAL';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Reports</h3>
          <p className="text-[12px] text-text-muted">Generate automation output reports from runs, outputs, exceptions, and cases.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!hasReportOutput && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">Report not in outputs</span>}
          <button onClick={() => alert('Report export will be connected later.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors">
            <Download size={12} />Export
          </button>
        </div>
      </div>

      {noApproved && hasReportOutput && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>No approved outputs yet. Review and approve outputs before finalizing the report.</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Runs', value: completedRuns.length },
          { label: 'Outputs', value: allOutputs.length },
          { label: 'Approved', value: automationState.outputReview.approvedOutputIds.length, cls: 'text-emerald-600' },
          { label: 'Exceptions', value: allExceptions.length },
          { label: 'Cases', value: automationState.cases.cases.length },
          { label: 'Draft', value: reportsState.reports.filter(r => r.status === 'DRAFT' || r.status === 'READY').length },
          { label: 'Final', value: reportsState.reports.filter(r => r.status === 'FINAL').length, cls: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
            <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Generate */}
      {reportsState.reports.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h4 className="text-[13px] font-semibold text-text">Generate Draft Report</h4>
          <p className="text-[11px] text-text-muted">Create a report from completed runs, approved outputs, exceptions, and cases.</p>
          <button onClick={handleGenerate} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors">Generate Draft Report</button>
        </div>
      )}

      {/* Report selector */}
      {reportsState.reports.length > 0 && (
        <div className="flex items-center gap-2">
          {reportsState.reports.map(r => (
            <button key={r.id} onClick={() => setSelectedReportId(r.id)}
              className={`px-2.5 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-colors ${selectedReportId === r.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {r.title.length > 30 ? r.title.slice(0, 29) + '…' : r.title} <span className={`ml-1 px-1 py-0.5 rounded text-[7px] font-bold ${REPORT_STATUS_CLS[r.status]}`}>{r.status}</span>
            </button>
          ))}
          <button onClick={handleGenerate} className="px-2.5 py-1 rounded-full text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">+ New Report</button>
        </div>
      )}

      {/* Report editor */}
      {selectedReport && (
        <div className="rounded-xl border border-border-light bg-white p-5 space-y-3">
          {[
            { label: 'Report Title', field: 'title' as const, rows: 0 },
            { label: 'Executive Summary', field: 'executiveSummary' as const, rows: 3 },
            { label: 'Project Objective', field: 'projectObjective' as const, rows: 2 },
            { label: 'Input Summary', field: 'inputSummary' as const, rows: 3 },
            { label: 'Automation Summary', field: 'automationSummary' as const, rows: 2 },
            { label: 'Run Summary', field: 'runSummary' as const, rows: 3 },
            { label: 'Exception Summary', field: 'exceptionSummary' as const, rows: 2 },
            { label: 'Case Summary', field: 'caseSummary' as const, rows: 3 },
            { label: 'Key Metrics', field: 'keyMetrics' as const, rows: 3 },
            { label: 'Recommendations', field: 'recommendations' as const, rows: 3 },
            { label: 'Distribution List', field: 'distributionList' as const, rows: 0 },
          ].map(s => (
            <div key={s.field}>
              <label className={labelCls}>{s.label}</label>
              {s.rows > 0 ? (
                <textarea value={selectedReport[s.field]} onChange={e => updateReport(selectedReport.id, { [s.field]: e.target.value })} rows={s.rows} className={inputCls + ' resize-none font-mono text-[11px]'} disabled={isFinal} />
              ) : (
                <input value={selectedReport[s.field]} onChange={e => updateReport(selectedReport.id, { [s.field]: e.target.value })} className={inputCls} disabled={isFinal} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {selectedReport && selectedReport.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-1">Report History</h4>
          <div className="space-y-1">{selectedReport.history.map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Actions */}
      {selectedReport && (
        <div className="flex items-center gap-3">
          {selectedReport.status === 'DRAFT' && <button onClick={() => markReady(selectedReport.id)} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer transition-colors">Mark Ready</button>}
          {(selectedReport.status === 'DRAFT' || selectedReport.status === 'READY') && (
            <button onClick={() => finalize(selectedReport.id)} disabled={!ready}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
              <CheckCircle2 size={13} />Finalize Report
            </button>
          )}
          {isFinal && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700 flex-1">
              <CheckCircle2 size={13} className="shrink-0 mt-0.5" /><span>Report finalized on {selectedReport.finalizedAt} by {selectedReport.finalizedBy}.</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Report Notes</h4>
        <textarea value={reportsState.reportNotes} onChange={e => onUpdateReports({ ...reportsState, reportNotes: e.target.value })} rows={2} placeholder="Report assumptions, notes..." className={inputCls + ' resize-none'} />
      </div>

      {/* Readiness + CTA */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Report Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ready ? 'Ready' : 'Pending'}</span>
        </div>
        <div className="space-y-1">{checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-[10px]">
            {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
            <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
          </div>
        ))}</div>
        <button onClick={() => onNavigateTab?.('schedule')} disabled={!reportsState.reports.some(r => r.status === 'FINAL') && hasReportOutput}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Schedule <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
