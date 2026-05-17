import React from 'react';
import {
  CheckCircle2, AlertCircle, MinusCircle, Activity, BarChart3,
  AlertTriangle, Shield, Workflow, Calendar, ChevronRight, Clock, Play,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../configurableEngagementTypes';
import { EngagementPatternType } from '../configurableEngagementTypes';
import { getEngagementPatternDefinition } from '../engagementPatterns';
import type { AutomationProjectWorkspaceState } from '../patterns/automation/automationInputData';
import type { AutomationScheduleState } from '../patterns/automation/automationScheduleData';
import { calculateNextRun } from '../patterns/automation/automationScheduleData';

interface Props {
  engagement: ConfigurableEngagement;
  automationState?: AutomationProjectWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}

interface CheckItem {
  label: string;
  status: 'ready' | 'missing' | 'optional';
}

function getReadinessChecks(eng: ConfigurableEngagement): CheckItem[] {
  const cfg = eng.config;
  const checks: CheckItem[] = [];

  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    checks.push({ label: 'Framework selected', status: cfg.framework ? 'ready' : 'missing' });
    checks.push({ label: 'Control scope source selected', status: cfg.controlScopeSource ? 'ready' : 'missing' });
    checks.push({ label: 'RACM linked', status: cfg.racmVersionId ? 'ready' : cfg.controlScopeSource === 'RACM_VERSION' ? 'missing' : 'optional' });
    checks.push({ label: 'Testing input method selected', status: cfg.defaultTestingInputMethod ? 'ready' : 'missing' });
    checks.push({ label: 'Reviewer assigned', status: eng.reviewer ? 'ready' : 'missing' });
    checks.push({ label: 'Audit period configured', status: cfg.auditPeriodStart && cfg.auditPeriodEnd ? 'ready' : 'missing' });
    checks.push({ label: 'Working paper required', status: 'ready' });
  }

  if (cfg.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    checks.push({ label: 'Scope level selected', status: cfg.scopeLevel ? 'ready' : 'missing' });
    checks.push({ label: 'Process owner assigned', status: cfg.processOwner ? 'ready' : 'missing' });
    checks.push({ label: 'Announcement configured', status: cfg.announcementRequired ? 'ready' : 'optional' });
    checks.push({ label: 'IDR enabled', status: cfg.idrEnabled ? 'ready' : 'optional' });
    checks.push({ label: 'Audit period configured', status: cfg.auditPeriodStart && cfg.auditPeriodEnd ? 'ready' : 'missing' });
    checks.push({ label: 'Final report required', status: cfg.finalReportRequired ? 'ready' : 'missing' });
    checks.push({ label: 'Action tracking enabled', status: cfg.actionTrackingEnabled ? 'ready' : 'optional' });
  }

  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    checks.push({ label: 'Input type selected', status: cfg.inputType ? 'ready' : 'missing' });
    checks.push({ label: 'Automation setup mode selected', status: cfg.automationSetupMode ? 'ready' : 'missing' });
    checks.push({ label: 'Output report required', status: cfg.reportRequired ? 'ready' : 'missing' });
    checks.push({ label: 'Case creation enabled', status: cfg.caseCreationEnabled ? 'ready' : 'optional' });
    checks.push({ label: 'Review required', status: cfg.reviewRequired ? 'ready' : 'optional' });
    if (cfg.runType === 'RECURRING') {
      checks.push({ label: 'Schedule configured', status: cfg.frequency ? 'ready' : 'missing' });
    }
  }

  return checks;
}

function getConfigSummary(eng: ConfigurableEngagement): { label: string; value: string }[] {
  const cfg = eng.config;
  const entries: { label: string; value: string }[] = [];

  if (cfg.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    entries.push(
      { label: 'Framework', value: cfg.framework.replace(/_/g, ' ') },
      { label: 'Audit Type', value: cfg.auditType },
      { label: 'Control Scope', value: cfg.controlScopeSource.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Testing Method', value: cfg.defaultTestingInputMethod.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
    );
  }
  if (cfg.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    entries.push(
      { label: 'Scope Level', value: cfg.scopeLevel.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Process Owner', value: cfg.processOwner },
      { label: 'IDR', value: cfg.idrEnabled ? 'Enabled' : 'Disabled' },
      { label: 'Announcement', value: cfg.announcementRequired ? 'Required' : 'Not required' },
    );
  }
  if (cfg.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT) {
    entries.push(
      { label: 'Input Type', value: cfg.inputType.replace(/_/g, ' ') },
      { label: 'Setup Mode', value: cfg.automationSetupMode.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) },
      { label: 'Run Type', value: cfg.runType.replace(/_/g, ' ') },
    );
    if (cfg.frequency) entries.push({ label: 'Frequency', value: cfg.frequency });
  }

  return entries;
}

const STATUS_ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  ready: { icon: CheckCircle2, cls: 'text-emerald-500' },
  missing: { icon: AlertCircle, cls: 'text-red-400' },
  optional: { icon: MinusCircle, cls: 'text-gray-300' },
};

// ─── Standard Overview (Compliance, IA, or non-dashboard Automation) ──────

function StandardOverview({ engagement }: { engagement: ConfigurableEngagement }) {
  const pattern = getEngagementPatternDefinition(engagement.patternType);
  const checks = getReadinessChecks(engagement);
  const configSummary = getConfigSummary(engagement);
  const readyCount = checks.filter(c => c.status === 'ready').length;
  const missingCount = checks.filter(c => c.status === 'missing').length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-light p-4">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Objective</h5>
        <p className="text-[12px] text-text leading-relaxed">{engagement.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Configuration</h5>
          <div className="space-y-1.5">
            {configSummary.map((e, i) => (
              <div key={i} className="flex items-baseline gap-2 text-[11px]">
                <span className="text-gray-400 w-28 shrink-0">{e.label}</span>
                <span className="text-text font-medium">{e.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-light p-4">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Readiness</h5>
            <span className={`text-[10px] font-semibold ${missingCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {readyCount}/{checks.length} ready
            </span>
          </div>
          <div className="space-y-1">
            {checks.map((c, i) => {
              const { icon: Icon, cls } = STATUS_ICON[c.status];
              return (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <Icon size={11} className={cls} />
                  <span className={c.status === 'missing' ? 'text-text' : 'text-gray-500'}>{c.label}</span>
                  {c.status === 'optional' && <span className="text-[8px] text-gray-300 ml-auto">Optional</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Workspace Flow</h5>
          <div className="flex flex-wrap gap-1.5">
            {pattern.workspaceTabs.map((tab, i) => (
              <span key={tab.id} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-semibold">
                <span className="text-[8px] text-primary/50">{i + 1}</span>
                {tab.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-light p-4">
          <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Required Outputs</h5>
          <div className="space-y-1">
            {pattern.requiredOutputs.map(o => (
              <div key={o} className="flex items-center gap-2 text-[10px] text-text">
                <CheckCircle2 size={10} className="text-gray-300" />
                {o}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Continuous Monitoring Dashboard ──────────────────────────────────────

function ContinuousMonitoringDashboard({ engagement, state, onNavigateTab }: {
  engagement: ConfigurableEngagement;
  state: AutomationProjectWorkspaceState;
  onNavigateTab?: (tabId: string) => void;
}) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { runs, schedule, cases, outputReview } = state;
  const completedRuns = runs.runs.filter(r => r.status === 'COMPLETED');
  const failedRuns = runs.runs.filter(r => r.status === 'FAILED');
  const allOutputs = completedRuns.flatMap(r => r.outputs);
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const highCritical = allExceptions.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL').length;
  const openEx = allExceptions.filter(e => e.status === 'OPEN').length;
  const caseCands = allExceptions.filter(e => e.status === 'CASE_CANDIDATE').length;
  const lastRun = runs.runs.length > 0 ? runs.runs[runs.runs.length - 1] : null;
  const wfNames = state.setup.selectedWorkflowNames?.length ? state.setup.selectedWorkflowNames : (state.setup.selectedWorkflowName ? [state.setup.selectedWorkflowName] : []);
  const hasWorkflows = wfNames.length > 0;
  const hasRuns = completedRuns.length > 0;
  const scheduleActive = schedule.status === 'ACTIVE';
  const nextRun = schedule.status === 'ACTIVE' && schedule.startDate ? calculateNextRun(schedule.startDate, schedule.frequency, schedule.runTime) : null;

  // ── Setup prompts ──
  if (!hasWorkflows) {
    return (
      <div className="space-y-4">
        <DashboardHeader engagement={engagement} />
        <SetupPrompt
          icon={Workflow}
          title="Select workflows to start monitoring"
          description="Choose or build workflows that will be monitored on a recurring schedule."
          cta="Go to Workflows"
          onAction={() => onNavigateTab?.('workflows')}
        />
      </div>
    );
  }

  if (!hasRuns) {
    return (
      <div className="space-y-4">
        <DashboardHeader engagement={engagement} />
        <MonitoringStatus schedule={schedule} lastRun={null} nextRun={null} wfCount={wfNames.length} />
        <SetupPrompt
          icon={Play}
          title="Run workflows to initialize monitoring baseline"
          description={`${wfNames.length} workflow${wfNames.length !== 1 ? 's' : ''} selected. Run them once to establish the baseline for continuous monitoring.`}
          cta="Go to Workflows"
          onAction={() => onNavigateTab?.('workflows')}
        />
      </div>
    );
  }

  if (!scheduleActive && hasRuns) {
    // Show dashboard with runs data but prompt to activate schedule
    return (
      <div className="space-y-4">
        <DashboardHeader engagement={engagement} />
        <MonitoringStatus schedule={schedule} lastRun={lastRun} nextRun={null} wfCount={wfNames.length} />
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Schedule not active.</span> Monitoring dashboard is based on completed runs. Activate schedule for continuous monitoring.
            <button onClick={() => onNavigateTab?.('schedule')} className="ml-2 text-primary font-semibold hover:underline cursor-pointer">Configure Schedule</button>
          </div>
        </div>
        <HealthCards completedRuns={completedRuns.length} failedRuns={failedRuns.length} totalOutputs={allOutputs.length} totalExceptions={allExceptions.length} openExceptions={openEx} highCritical={highCritical} caseCandidates={caseCands} caseCount={cases.cases.length} closedCases={cases.cases.filter(c => c.status === 'CLOSED').length} approvedOutputs={outputReview.approvedOutputIds.length} />
        <WorkflowHealthTable state={state} completedRuns={completedRuns} schedule={schedule} onNavigateTab={onNavigateTab} />
        <NextActions onNavigateTab={onNavigateTab} />
      </div>
    );
  }

  // ── Full dashboard ──
  return (
    <div className="space-y-4">
      <DashboardHeader engagement={engagement} />
      <MonitoringStatus schedule={schedule} lastRun={lastRun} nextRun={nextRun} wfCount={wfNames.length} />
      <HealthCards completedRuns={completedRuns.length} failedRuns={failedRuns.length} totalOutputs={allOutputs.length} totalExceptions={allExceptions.length} openExceptions={openEx} highCritical={highCritical} caseCandidates={caseCands} caseCount={cases.cases.length} closedCases={cases.cases.filter(c => c.status === 'CLOSED').length} approvedOutputs={outputReview.approvedOutputIds.length} />
      <WorkflowHealthTable state={state} completedRuns={completedRuns} schedule={schedule} onNavigateTab={onNavigateTab} />
      <NextActions onNavigateTab={onNavigateTab} />
    </div>
  );
}

// ─── Dashboard sub-components ────────────────────────────────────────────

function DashboardHeader({ engagement }: { engagement: ConfigurableEngagement }) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={16} className="text-primary" />
        <h3 className="text-[15px] font-bold text-text">Continuous Monitoring Dashboard</h3>
      </div>
      <p className="text-[12px] text-text-muted">Monitor recurring workflow runs, exceptions, cases, and report readiness for this automation project.</p>
      <p className="text-[10px] text-gray-400 mt-1">Dashboard appears because Dashboard output is selected and this project is configured for recurring monitoring.</p>
    </div>
  );
}

function MonitoringStatus({ schedule, lastRun, nextRun, wfCount }: {
  schedule: AutomationScheduleState; lastRun: any; nextRun: string | null; wfCount: number;
}) {
  const statusLabel = schedule.status === 'ACTIVE' ? 'Active' : schedule.status === 'PAUSED' ? 'Paused' : schedule.status === 'DRAFT' ? 'Draft' : 'Not Scheduled';
  const statusCls = schedule.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : schedule.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500';

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Monitoring Status</h4>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>{statusLabel}</span>
      </div>
      <div className="grid grid-cols-4 gap-4 text-[11px]">
        <div>
          <span className="text-gray-400 block text-[10px]">Last Run</span>
          <span className="text-text font-medium">{lastRun?.completedAt || '—'}</span>
          {lastRun && <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${lastRun.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{lastRun.status}</span>}
        </div>
        <div>
          <span className="text-gray-400 block text-[10px]">Next Run</span>
          <span className="text-text font-medium">{nextRun || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 block text-[10px]">Frequency</span>
          <span className="text-text font-medium">{schedule.frequency || '—'}</span>
        </div>
        <div>
          <span className="text-gray-400 block text-[10px]">Workflows Monitored</span>
          <span className="text-text font-medium">{wfCount}</span>
        </div>
      </div>
      {schedule.autoCreateCases && (
        <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" />Auto-create cases enabled</div>
      )}
      {schedule.autoGenerateReport && (
        <div className="text-[10px] text-gray-400 flex items-center gap-1"><CheckCircle2 size={10} className="text-emerald-500" />Auto-generate report enabled</div>
      )}
    </div>
  );
}

function HealthCards({ completedRuns, failedRuns, totalOutputs, totalExceptions, openExceptions, highCritical, caseCandidates, caseCount, closedCases, approvedOutputs }: {
  completedRuns: number; failedRuns: number; totalOutputs: number; totalExceptions: number;
  openExceptions: number; highCritical: number; caseCandidates: number;
  caseCount: number; closedCases: number; approvedOutputs: number;
}) {
  const sections = [
    {
      title: 'Run Health',
      icon: BarChart3,
      items: [
        { label: 'Completed', value: completedRuns, cls: 'text-emerald-600' },
        { label: 'Failed', value: failedRuns, cls: failedRuns > 0 ? 'text-red-600' : '' },
        { label: 'Outputs', value: totalOutputs },
        { label: 'Approved', value: approvedOutputs, cls: 'text-emerald-600' },
      ],
    },
    {
      title: 'Exception Health',
      icon: AlertTriangle,
      items: [
        { label: 'Total', value: totalExceptions },
        { label: 'Open', value: openExceptions, cls: openExceptions > 0 ? 'text-amber-600' : '' },
        { label: 'High/Critical', value: highCritical, cls: highCritical > 0 ? 'text-red-600' : '' },
        { label: 'Case Cand.', value: caseCandidates, cls: caseCandidates > 0 ? 'text-purple-600' : '' },
      ],
    },
    {
      title: 'Case Health',
      icon: Shield,
      items: [
        { label: 'Assigned', value: caseCount },
        { label: 'Closed', value: closedCases, cls: 'text-emerald-600' },
        { label: 'Open', value: caseCount - closedCases, cls: caseCount - closedCases > 0 ? 'text-amber-600' : '' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {sections.map(section => (
        <div key={section.title} className="rounded-xl border border-border-light bg-white p-4">
          <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <section.icon size={12} className="text-primary" />{section.title}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {section.items.map(item => (
              <div key={item.label}>
                <div className={`text-[18px] font-bold tabular-nums ${item.cls || 'text-text'}`}>{item.value}</div>
                <div className="text-[9px] text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkflowHealthTable({ state, completedRuns, schedule, onNavigateTab }: {
  state: AutomationProjectWorkspaceState;
  completedRuns: any[];
  schedule: AutomationScheduleState;
  onNavigateTab?: (tabId: string) => void;
}) {
  // Build workflow rows from completed runs
  const wfMap = new Map<string, { name: string; lastStatus: string; outputs: number; exceptions: number; caseCands: number; lastRun: string | null }>();
  for (const run of completedRuns) {
    const wfNames = run.workflowNames?.length ? run.workflowNames : (run.workflowName ? [run.workflowName] : []);
    for (const name of wfNames) {
      const existing = wfMap.get(name);
      const wfOutputs = run.outputs.filter((o: any) => o.sourceWorkflowName === name).length;
      const wfExceptions = run.exceptions.filter((e: any) => e.sourceWorkflowName === name).length;
      const wfCaseCands = run.exceptions.filter((e: any) => e.sourceWorkflowName === name && e.status === 'CASE_CANDIDATE').length;
      if (!existing) {
        wfMap.set(name, { name, lastStatus: run.status, outputs: wfOutputs, exceptions: wfExceptions, caseCands: wfCaseCands, lastRun: run.completedAt });
      } else {
        existing.outputs += wfOutputs;
        existing.exceptions += wfExceptions;
        existing.caseCands += wfCaseCands;
        if (run.completedAt && (!existing.lastRun || run.completedAt > existing.lastRun)) {
          existing.lastRun = run.completedAt;
          existing.lastStatus = run.status;
        }
      }
    }
  }
  const workflows = Array.from(wfMap.values());

  if (workflows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-light bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-border-light flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <Workflow size={12} className="text-primary" />Workflow Health
        </h4>
        <button onClick={() => onNavigateTab?.('workflows')} className="text-[10px] font-semibold text-primary hover:underline cursor-pointer">View All</button>
      </div>
      <table className="w-full text-[11px]">
        <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
          <th className="px-4 py-2 text-left">Workflow</th>
          <th className="px-4 py-2 text-center">Last Status</th>
          <th className="px-4 py-2 text-center">Outputs</th>
          <th className="px-4 py-2 text-center">Exceptions</th>
          <th className="px-4 py-2 text-center">Case Cand.</th>
          <th className="px-4 py-2 text-left">Last Run</th>
        </tr></thead>
        <tbody>{workflows.map(wf => (
          <tr key={wf.name} className="border-b border-border-light/50 hover:bg-surface-2/20">
            <td className="px-4 py-2.5 font-medium text-text">{wf.name}</td>
            <td className="px-4 py-2.5 text-center">
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${wf.lastStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{wf.lastStatus}</span>
            </td>
            <td className="px-4 py-2.5 text-center tabular-nums text-text-muted">{wf.outputs}</td>
            <td className="px-4 py-2.5 text-center"><span className={wf.exceptions > 0 ? 'text-amber-600 font-medium' : 'text-text-muted'}>{wf.exceptions}</span></td>
            <td className="px-4 py-2.5 text-center"><span className={wf.caseCands > 0 ? 'text-purple-600 font-medium' : 'text-text-muted'}>{wf.caseCands}</span></td>
            <td className="px-4 py-2.5 text-text-muted">{wf.lastRun || '—'}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function NextActions({ onNavigateTab }: { onNavigateTab?: (tabId: string) => void }) {
  const actions = [
    { label: 'Workflows', tabId: 'workflows', icon: Workflow },
    { label: 'Output Review', tabId: 'output-review', icon: CheckCircle2 },
    { label: 'Cases', tabId: 'cases', icon: Shield },
    { label: 'Reports', tabId: 'reports', icon: BarChart3 },
    { label: 'Schedule', tabId: 'schedule', icon: Calendar },
  ];

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">Quick Actions</h5>
      <div className="flex flex-wrap gap-2">
        {actions.map(a => (
          <button key={a.tabId} onClick={() => onNavigateTab?.(a.tabId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-primary/5 hover:text-primary hover:border-primary/20 cursor-pointer transition-colors">
            <a.icon size={12} />{a.label}<ChevronRight size={10} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupPrompt({ icon: Icon, title, description, cta, onAction }: {
  icon: React.ElementType; title: string; description: string; cta: string; onAction: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-3">
      <Icon size={28} className="text-primary/40 mx-auto" />
      <h4 className="text-[13px] font-semibold text-text">{title}</h4>
      <p className="text-[11px] text-text-muted">{description}</p>
      <button onClick={onAction} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">
        {cta} <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────

export default function WorkspaceOverview({ engagement, automationState, onNavigateTab }: Props) {
  // Detect continuous monitoring mode for Automation Projects
  if (
    engagement.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT &&
    automationState
  ) {
    const cfg = engagement.config as AutomationProjectConfig;
    const hasDashboardOutput = cfg.outputTypes.includes('DASHBOARD');
    const isRecurring = cfg.runType === 'RECURRING';

    if (hasDashboardOutput && isRecurring) {
      return <ContinuousMonitoringDashboard engagement={engagement} state={automationState} onNavigateTab={onNavigateTab} />;
    }

    // Dashboard selected but not recurring
    if (hasDashboardOutput && !isRecurring) {
      return (
        <div className="space-y-4">
          <StandardOverview engagement={engagement} />
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[11px] text-blue-600">
            <Activity size={12} className="shrink-0 mt-0.5" />
            <span>Dashboard output is selected. Set run type to <strong>Recurring</strong> and configure a schedule to enable continuous monitoring.</span>
          </div>
        </div>
      );
    }

    // Recurring but no dashboard output
    if (isRecurring && !hasDashboardOutput) {
      return (
        <div className="space-y-4">
          <StandardOverview engagement={engagement} />
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[11px] text-blue-600">
            <Activity size={12} className="shrink-0 mt-0.5" />
            <span>This project is configured for recurring runs. Add <strong>Dashboard</strong> as an output type to enable continuous monitoring view.</span>
          </div>
        </div>
      );
    }
  }

  return <StandardOverview engagement={engagement} />;
}
