// ─── Automation Project — Cases Tab ───────────────────────────────────────
// Embeds existing ManageExceptionsView for exception/case management,
// fed with V3 automation run exceptions.

import React, { useState, useMemo, useCallback } from 'react';
import { Lock, ChevronRight, Info } from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState, AutomationRunException, ExceptionStatus } from './automationRunsData';
import type { AutomationCasesState } from './automationCasesData';
import type { ExceptionRole } from '../../../../hooks/useAppState';
import ManageExceptionsView from '../../../exceptions/ManageExceptionsView';
import type { GrcException } from '../../../../data/mockData';
import { mapV3ExceptionsToGrc, syncGrcToV3Exception } from './exceptionAdapter';

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  casesState: AutomationCasesState;
  onUpdateCases: (state: AutomationCasesState) => void;
  onUpdateRunException?: (runId: string, exId: string, status: ExceptionStatus, triageData?: Record<string, unknown>) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationCasesTab({ engagement, runsState, casesState, onUpdateCases, onUpdateRunException, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const [role, setRole] = useState<ExceptionRole>('auditor');

  // Locked states
  if (!hasCaseMgmt) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[12px] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-lg border border-border-light p-6 text-center space-y-2">
          <Info size={24} className="text-gray-300 mx-auto" />
          <p className="text-[12px] text-text-muted">Case Management was not selected as an output for this project.</p>
        </div>
      </div>
    );
  }

  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[12px] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">No Completed Runs</h4>
          <p className="text-[12px] text-text-muted">Complete an automation run before managing exceptions.</p>
          <button onClick={() => onNavigateTab?.('runs')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Runs <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  if (allExceptions.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Exceptions & Cases</h3><p className="text-[12px] text-text-muted">Review workflow exceptions and manage follow-up cases.</p></div>
        <div className="rounded-lg border border-border-light p-6 text-center space-y-2">
          <Info size={24} className="text-gray-300 mx-auto" />
          <p className="text-[12px] text-text-muted">No exceptions were generated from completed runs. All clear.</p>
          <button onClick={() => onNavigateTab?.('reports')} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Continue to Reports <ChevronRight size={11} /></button>
        </div>
      </div>
    );
  }

  // Map V3 exceptions to GRC format
  const grcExceptions = useMemo(() =>
    mapV3ExceptionsToGrc(completedRuns.map(r => ({ id: r.id, exceptions: r.exceptions }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedRuns.map(r => `${r.id}:${r.exceptions.map(e => `${e.id}:${e.status}:${e.deficiencyType}`).join(',')}`).join('|')]
  );

  // Sync changes from ManageExceptionsView back to V3 runs state
  const handleExceptionsChange = useCallback((updatedGrcExceptions: GrcException[]) => {
    if (!onUpdateRunException) return;
    for (const grcEx of updatedGrcExceptions) {
      // Find original V3 exception
      for (const run of completedRuns) {
        const original = run.exceptions.find(e => e.id === grcEx.id);
        if (original) {
          const updates = syncGrcToV3Exception(grcEx, original);
          if (Object.keys(updates).length > 0) {
            onUpdateRunException(run.id, grcEx.id, updates.status || original.status, updates);
          }
          break;
        }
      }
    }
  }, [completedRuns, onUpdateRunException]);

  return (
    <div className="space-y-0">
      {/* Thin context banner */}
      <div className="flex items-start gap-2 px-4 py-2 rounded-t-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600 mb-0">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>Review workflow exceptions, classify deficiencies, assign owners, and manage remediation using the existing case management flow.</span>
      </div>

      {/* Embedded ManageExceptionsView */}
      <div className="rounded-b-lg border border-t-0 border-border-light overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
        <ManageExceptionsView
          role={role}
          setRole={setRole}
          onBack={() => onNavigateTab?.('output-review')}
          embedded={true}
          exceptions={grcExceptions}
          onExceptionsChange={handleExceptionsChange}
          contextLabel={engagement.name}
        />
      </div>
    </div>
  );
}
