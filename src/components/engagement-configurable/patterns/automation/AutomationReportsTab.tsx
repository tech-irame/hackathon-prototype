// ─── Automation Project — Reports Tab ─────────────────────────────────────
// Platform-style report matching existing Report module UX/theme.

import React, { useState, useMemo } from 'react';
import {
  Download, CheckCircle2, AlertCircle, ChevronRight, Lock, Share2,
  FileText, AlertTriangle, Workflow, BarChart3, Shield, Layout,
  Sparkles, TrendingUp,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationProjectWorkspaceState } from './automationInputData';
import type { AutomationRunOutput, AutomationRunException, AutomationRun } from './automationRunsData';
import { EX_SEVERITY_CLS, EX_CAT_LABELS } from './automationRunsData';
import {
  generateDraftReport, deriveReportReadiness, REPORT_STATUS_CLS,
  type AutomationReportsState, type AutomationReport, type ReportStatus,
} from './automationReportsData';
import { DEFICIENCY_LABELS, type DeficiencyType } from './automationCasesData';
import FloatingLines from '../../../shared/FloatingLines';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  automationState: AutomationProjectWorkspaceState;
  reportsState: AutomationReportsState;
  onUpdateReports: (state: AutomationReportsState) => void;
  onNavigateTab?: (tabId: string) => void;
}

// Group outputs/exceptions by workflow
interface WorkflowReportSection {
  workflowName: string;
  outputs: AutomationRunOutput[];
  exceptions: AutomationRunException[];
  findings: string[];
  caseCount: number;
}

function buildWorkflowSections(state: AutomationProjectWorkspaceState): WorkflowReportSection[] {
  const completedRuns = state.runs.runs.filter(r => r.status === 'COMPLETED');
  const map = new Map<string, WorkflowReportSection>();

  for (const run of completedRuns) {
    for (const out of run.outputs) {
      const name = out.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, outputs: [], exceptions: [], findings: [], caseCount: 0 });
      map.get(name)!.outputs.push(out);
    }
    for (const ex of run.exceptions) {
      const name = ex.sourceWorkflowName || 'Unassigned';
      if (!map.has(name)) map.set(name, { workflowName: name, outputs: [], exceptions: [], findings: [], caseCount: 0 });
      map.get(name)!.exceptions.push(ex);
    }
  }

  // Generate findings from exceptions
  for (const [, section] of map) {
    const high = section.exceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL');
    const medium = section.exceptions.filter(e => e.severity === 'MEDIUM');
    const caseCands = section.exceptions.filter(e => e.status === 'CASE_CANDIDATE');

    if (high.length > 0) section.findings.push(`${high.length} high/critical exception${high.length !== 1 ? 's' : ''} identified requiring immediate review`);
    if (medium.length > 0) section.findings.push(`${medium.length} medium-severity finding${medium.length !== 1 ? 's' : ''} detected`);

    const categories = new Set(section.exceptions.map(e => EX_CAT_LABELS[e.category]));
    if (categories.size > 0) section.findings.push(`Exception categories: ${Array.from(categories).join(', ')}`);

    if (caseCands.length > 0) section.findings.push(`${caseCands.length} exception${caseCands.length !== 1 ? 's' : ''} marked as case candidate${caseCands.length !== 1 ? 's' : ''} for follow-up`);

    if (section.exceptions.length === 0) section.findings.push('No exceptions identified — clean execution');

    // Count cases linked to this workflow's exceptions
    section.caseCount = state.cases.cases.filter(c => section.exceptions.some(e => e.id === c.sourceExceptionId)).length;
  }

  return Array.from(map.values());
}

export default function AutomationReportsTab({ engagement, automationState, reportsState, onUpdateReports, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasReportOutput = cfg.outputTypes.includes('REPORT');
  const completedRuns = automationState.runs.runs.filter(r => r.status === 'COMPLETED');
  const { ready, checks } = deriveReportReadiness(automationState, cfg);
  const [selectedReportId, setSelectedReportId] = useState(reportsState.reports[0]?.id || '');
  const selectedReport = reportsState.reports.find(r => r.id === selectedReportId);
  const workflowSections = useMemo(() => buildWorkflowSections(automationState), [automationState]);

  // Derived stats
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const highCritical = allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
  const caseCandidates = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const totalRecords = completedRuns.reduce((s, r) => s + r.processedRecords, 0);
  const approvedCount = automationState.outputReview.approvedOutputIds.length;
  const excludedCount = automationState.outputReview.rejectedOutputIds.length;
  const pendingCount = allOutputs.length - approvedCount - excludedCount;
  const caseCount = automationState.cases.cases.length;
  const closedCases = automationState.cases.cases.filter(c => c.status === 'CLOSED').length;

  // Locked
  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Reports</h3><p className="text-[12px] text-text-muted">Generate automation output reports.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">Reports Locked</h4>
          <p className="text-[12px] text-text-muted">Complete at least one automation run before generating a report.</p>
          <button onClick={() => onNavigateTab?.('workflows')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Workflows <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

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

  const isFinal = selectedReport?.status === 'FINAL';

  // No report generated yet
  if (reportsState.reports.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-bold text-text mb-0.5">Reports</h3>
            <p className="text-[12px] text-text-muted">Generate automation output reports from runs, outputs, exceptions, and cases.</p>
          </div>
        </div>

        {noApproved && hasReportOutput && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
            <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>No approved outputs yet. Review and approve outputs before finalizing the report.</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'Runs', value: completedRuns.length },
            { label: 'Workflows', value: workflowSections.length },
            { label: 'Outputs', value: allOutputs.length },
            { label: 'Exceptions', value: allExceptions.length },
            { label: 'Cases', value: caseCount },
            { label: 'Approved', value: approvedCount, cls: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2 text-center">
              <div className={`text-[15px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[8px] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <h4 className="text-[13px] font-semibold text-text">Generate Draft Report</h4>
          <p className="text-[11px] text-text-muted">Create a comprehensive report from completed runs, approved outputs, exceptions, and cases — grouped by workflow.</p>
          <button onClick={handleGenerate} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary-medium text-white text-[12px] font-semibold hover:from-primary-hover hover:to-primary cursor-pointer transition-all">Generate Draft Report</button>
        </div>

        {/* Readiness */}
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
        </div>
      </div>
    );
  }

  // ── Report view (platform-style) ──
  return (
    <div className="space-y-5">
      {/* Report selector + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {reportsState.reports.map(r => (
            <button key={r.id} onClick={() => setSelectedReportId(r.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${selectedReportId === r.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {r.title.length > 30 ? r.title.slice(0, 29) + '...' : r.title} <span className={`ml-1 px-1 py-0.5 rounded text-[7px] font-bold ${REPORT_STATUS_CLS[r.status]}`}>{r.status}</span>
            </button>
          ))}
          <button onClick={handleGenerate} className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">+ New Report</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => alert('Apply Template — placeholder')} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Layout size={13} /> Apply Template
          </button>
          <button onClick={() => alert('Share — placeholder')} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Share2 size={13} /> Share
          </button>
          <button onClick={() => alert('Download — placeholder')} className="flex items-center gap-1.5 px-3 py-2 border border-border text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/30 transition-colors cursor-pointer bg-white rounded-lg">
            <Download size={13} /> Download
          </button>
        </div>
      </div>

      {selectedReport && (
        <>
          {/* ── Purple report header/banner — matches platform style ── */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#3b0b72] to-[#6a12cd]" style={{ boxShadow: '0 4px 24px rgba(106,18,205,0.35)' }}>
            <div className="absolute inset-0 z-0" style={{ maskImage: 'linear-gradient(to right, transparent 35%, white 70%)', WebkitMaskImage: 'linear-gradient(to right, transparent 35%, white 70%)' }}>
              <FloatingLines
                enabledWaves={['top', 'middle']}
                lineCount={6}
                lineDistance={6}
                bendRadius={4}
                bendStrength={-0.3}
                interactive={true}
                parallax={false}
                color="#e879f9"
                opacity={0.3}
              />
            </div>
            <div className="relative z-10 px-8 py-7">
              <p className="text-white/50 text-[11px] font-semibold uppercase tracking-wider mb-1">Automation Project Report</p>
              <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{selectedReport.title}</h1>
              <p className="text-white/60 text-[13px] mb-3">{engagement.description || 'Comprehensive automation project report with workflow-wise results.'}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-semibold text-white">{engagement.owner}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{selectedReport.generatedAt}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{workflowSections.length} workflow{workflowSections.length !== 1 ? 's' : ''}</span>
                  <span className="text-white/30 mx-0.5">|</span>
                  <span className="text-white/70">{completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-[10px] text-[11px] font-bold ${isFinal ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                    {selectedReport.status}
                  </span>
                  {!isFinal && (
                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold text-primary bg-white rounded-[10px] hover:bg-white/90 transition-colors cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    >
                      <Sparkles size={13} />
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Report metadata ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-[12px]">
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Project Name</span><span className="text-text font-semibold">{engagement.name}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Business Process</span><span className="text-text font-semibold">{engagement.businessProcess || 'P2P'}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Entity</span><span className="text-text font-semibold">{engagement.entityOrLocation || '—'}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Reporting Period</span><span className="text-text font-semibold">{engagement.plannedStartDate || '—'} to {engagement.plannedEndDate || '—'}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Run Type</span><span className="text-text font-semibold">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
              <div><span className="text-text-muted block text-[10px] font-medium mb-0.5">Report Generated</span><span className="text-text font-semibold">{selectedReport.generatedAt}</span></div>
            </div>
          </div>

          {/* ── Executive Summary ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><FileText size={14} className="text-primary" /> Executive Summary</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { icon: BarChart3, label: 'Records Processed', value: totalRecords.toLocaleString(), color: 'text-primary bg-primary/10' },
                { icon: AlertTriangle, label: 'Exceptions', value: allExceptions.length, color: 'text-high-700 bg-high-50' },
                { icon: Shield, label: 'Cases Assigned', value: caseCount, color: 'text-brand-700 bg-brand-50' },
                { icon: TrendingUp, label: 'Completion', value: caseCount > 0 ? `${Math.round(closedCases / caseCount * 100)}%` : allExceptions.length === 0 ? '100%' : '—', color: 'text-compliant-700 bg-compliant-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-border-light p-4 flex items-center gap-3 hover:shadow-md hover:shadow-primary/5 transition-all">
                  <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={16} /></div>
                  <div>
                    <div className="text-xl font-bold text-text">{stat.value}</div>
                    <div className="text-[10px] text-text-muted tracking-wide">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-text-secondary leading-relaxed">{selectedReport.executiveSummary}</p>
            {/* Output approval breakdown */}
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              <span className="text-text-muted">Outputs:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{approvedCount} approved for report</span>
              {excludedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{excludedCount} excluded</span>}
              {pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{pendingCount} pending review</span>}
            </div>
            {approvedCount === 0 && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>No outputs have been approved for this report yet. Approve outputs in Output Review to include them.</span>
              </div>
            )}
          </div>

          {/* ── Workflow sections ── */}
          {workflowSections.map((section, sectionIdx) => {
            const approvedOuts = section.outputs.filter(o => automationState.outputReview.approvedOutputIds.includes(o.id));
            const openExc = section.exceptions.filter(e => e.status === 'OPEN').length;
            const reviewedExc = section.exceptions.filter(e => e.status === 'REVIEWED').length;
            const dismissedExc = section.exceptions.filter(e => e.status === 'DISMISSED').length;
            const caseCandExc = section.exceptions.filter(e => e.status === 'CASE_CANDIDATE').length;

            return (
              <div key={section.workflowName} className="bg-white rounded-xl border border-border-light overflow-hidden">
                {/* Workflow section header */}
                <div className="px-5 py-4 border-b border-border-light">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Workflow size={16} /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-primary/50">WORKFLOW {sectionIdx + 1}</span>
                      </div>
                      <h4 className="text-[14px] font-semibold text-text">{section.workflowName}</h4>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">{approvedOuts.length}/{section.outputs.length} approved</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold ${section.exceptions.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{section.exceptions.length} exceptions</span>
                      {section.caseCount > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold">{section.caseCount} case{section.caseCount !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Outputs */}
                  <div>
                    <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Outputs</h5>
                    {section.outputs.length === 0 ? (
                      <p className="text-[12px] text-text-muted italic">No outputs generated.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {section.outputs.map(o => {
                          const isApproved = automationState.outputReview.approvedOutputIds.includes(o.id);
                          const isExcluded = automationState.outputReview.rejectedOutputIds.includes(o.id);
                          const isPending = !isApproved && !isExcluded;
                          return (
                            <div key={o.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light/50 ${isExcluded ? 'bg-gray-50 opacity-60' : isPending ? 'bg-amber-50/20' : 'bg-surface-2/30'}`}>
                              <FileText size={13} className={isApproved ? 'text-primary shrink-0' : 'text-gray-400 shrink-0'} />
                              <span className={`text-[12px] font-medium flex-1 ${isExcluded ? 'text-gray-400 line-through' : 'text-text'}`}>{o.name}</span>
                              <span className="text-[10px] text-text-muted">{o.outputType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                              {o.recordCount && <span className="text-[10px] text-text-muted tabular-nums">{o.recordCount} records</span>}
                              {isApproved && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold">Included in Report</span>}
                              {isExcluded && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-bold">Excluded</span>}
                              {isPending && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold">Pending Review</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Findings */}
                  <div>
                    <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Findings</h5>
                    {section.findings.length === 0 ? (
                      <p className="text-[12px] text-text-muted italic">No findings to report.</p>
                    ) : (
                      <ul className="space-y-1">
                        {section.findings.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-text-secondary leading-relaxed">
                            <span className="text-primary mt-1 shrink-0">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Exception summary for this workflow */}
                  {section.exceptions.length > 0 && (
                    <div>
                      <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Exception Breakdown</h5>
                      <div className="flex items-center gap-3 text-[11px]">
                        {openExc > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{openExc} Open</span>}
                        {reviewedExc > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{reviewedExc} Reviewed</span>}
                        {dismissedExc > 0 && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{dismissedExc} Dismissed</span>}
                        {caseCandExc > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">{caseCandExc} Case Candidate{caseCandExc !== 1 ? 's' : ''}</span>}
                      </div>
                      {/* Exception detail rows */}
                      <div className="mt-2 space-y-1">
                        {section.exceptions.map(ex => (
                          <div key={ex.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2/20 text-[11px]">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                            <span className="font-medium text-text flex-1">{ex.title}</span>
                            <span className="text-text-muted">{EX_CAT_LABELS[ex.category]}</span>
                            {ex.deficiencyType && <span className="text-text-muted">{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Case/classification for this workflow */}
                  {section.caseCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100 text-[11px]">
                      <Shield size={12} className="text-purple-600" />
                      <span className="text-purple-700 font-medium">{section.caseCount} case{section.caseCount !== 1 ? 's' : ''} assigned from this workflow's exceptions</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Cases / Exception Classification Summary ── */}
          {caseCount > 0 && (
            <div className="bg-white rounded-xl border border-border-light p-5">
              <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><Shield size={14} className="text-primary" /> Cases & Classification Summary</h3>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: 'Total Cases', value: caseCount },
                  { label: 'Sent to Owner', value: automationState.cases.cases.filter(c => c.status === 'OPEN').length },
                  { label: 'Submitted', value: automationState.cases.cases.filter(c => c.status === 'RESOLVED').length },
                  { label: 'Closed', value: closedCases, cls: 'text-emerald-600' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
                    <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Deficiency breakdown */}
              {(() => {
                const defBreakdown = automationState.cases.cases.reduce<Record<string, number>>((acc, c) => {
                  const t = c.deficiencyType || 'Unclassified';
                  acc[t] = (acc[t] || 0) + 1;
                  return acc;
                }, {});
                const entries = Object.entries(defBreakdown);
                if (entries.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Deficiency Classification</h5>
                    <div className="flex flex-wrap gap-2">
                      {entries.map(([type, count]) => (
                        <span key={type} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border-light text-[11px] text-text font-medium">
                          {DEFICIENCY_LABELS[type as DeficiencyType] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}: <span className="font-bold">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Key Metrics ── */}
          <div className="bg-white rounded-xl border border-border-light p-5">
            <h3 className="text-[13px] font-bold text-text mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-primary" /> Key Metrics</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
              {[
                { label: 'Records Processed', value: totalRecords.toLocaleString() },
                { label: 'Outputs Generated', value: allOutputs.length },
                { label: 'Outputs Approved for Report', value: approvedCount },
                { label: 'Outputs Excluded', value: excludedCount },
                { label: 'Outputs Pending Review', value: pendingCount },
                { label: 'Exceptions Identified', value: allExceptions.length },
                { label: 'High/Critical Exceptions', value: highCritical },
                { label: 'Case Candidates', value: caseCandidates },
                { label: 'Cases Assigned', value: caseCount },
                { label: 'Cases Closed', value: closedCases },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border-light/40">
                  <span className="text-text-muted">{m.label}</span>
                  <span className="text-text font-semibold tabular-nums">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recommendations ── */}
          {selectedReport.recommendations && (
            <div className="bg-white rounded-xl border border-border-light p-5">
              <h3 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Recommendations</h3>
              <ul className="space-y-1">
                {selectedReport.recommendations.split('\n').filter(Boolean).map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-text-secondary leading-relaxed">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Actions ── */}
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

          {/* ── History ── */}
          {selectedReport.history.length > 0 && (
            <div className="rounded-lg border border-border-light p-4">
              <h4 className="text-[11px] font-bold text-text mb-1">Report History</h4>
              <div className="space-y-1">{selectedReport.history.map(h => (
                <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
              ))}</div>
            </div>
          )}

          {/* ── Report Notes ── */}
          <div className="rounded-lg border border-border-light p-4 space-y-2">
            <h4 className="text-[11px] font-bold text-text">Report Notes</h4>
            <textarea value={reportsState.reportNotes} onChange={e => onUpdateReports({ ...reportsState, reportNotes: e.target.value })} rows={2} placeholder="Report assumptions, notes..." className="w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none" />
          </div>

          {/* ── Readiness + CTA ── */}
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
        </>
      )}
    </div>
  );
}
