import React from 'react';
import { CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import type { ConfigurableEngagement } from '../configurableEngagementTypes';
import { EngagementPatternType } from '../configurableEngagementTypes';
import { getEngagementPatternDefinition } from '../engagementPatterns';

interface Props {
  engagement: ConfigurableEngagement;
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

export default function WorkspaceOverview({ engagement }: Props) {
  const pattern = getEngagementPatternDefinition(engagement.patternType);
  const checks = getReadinessChecks(engagement);
  const configSummary = getConfigSummary(engagement);
  const readyCount = checks.filter(c => c.status === 'ready').length;
  const missingCount = checks.filter(c => c.status === 'missing').length;

  return (
    <div className="space-y-4">
      {/* Objective */}
      <div className="rounded-lg border border-border-light p-4">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Objective</h5>
        <p className="text-[12px] text-text leading-relaxed">{engagement.description}</p>
      </div>

      {/* Config summary + Readiness side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Configuration */}
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

        {/* Readiness */}
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

      {/* Workspace flow + Required outputs */}
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
