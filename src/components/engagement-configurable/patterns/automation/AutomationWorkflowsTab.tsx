// ─── Automation Project — Workflows Tab ───────────────────────────────────
// Select/build workflows and run them via Workflow Library BulkExecuteModal.
// Combines the old Automation Setup + Runs into one streamlined page.

import React, { useState, useMemo } from 'react';
import {
  Workflow, Plus, Play, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, MessageSquare, Info,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationInputDataState } from './automationInputData';
import type { AutomationSetupState, SetupMode } from './automationSetupData';
import { SETUP_MODE_LABELS, MOCK_WORKFLOWS } from './automationSetupData';
import type { AutomationRunsState, AutomationRun, AutoRunType, ExceptionStatus } from './automationRunsData';
import { simulateRun, deriveRunsSummary, RUN_STATUS_CLS, EX_SEVERITY_CLS, EX_STATUS_CLS, EX_CAT_LABELS } from './automationRunsData';
import { BulkExecuteModal } from '../../../workflow/BulkExecuteModal';
import type { LibraryWorkflow } from '../../../workflow/WorkflowLibraryView';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  setup: AutomationSetupState;
  runsState: AutomationRunsState;
  onUpdateSetup: (state: AutomationSetupState) => void;
  onUpdateRuns: (state: AutomationRunsState) => void;
  onUpdateInputData?: (state: AutomationInputDataState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationWorkflowsTab({ engagement, inputData, setup, runsState, onUpdateSetup, onUpdateRuns, onUpdateInputData, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const summary = deriveRunsSummary(runsState);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [runName, setRunName] = useState('');

  // Workflow IDs/names from setup
  const wfNames = setup.selectedWorkflowNames?.length ? setup.selectedWorkflowNames : (setup.selectedWorkflowName ? [setup.selectedWorkflowName] : []);
  const wfIds = setup.selectedWorkflowIds?.length ? setup.selectedWorkflowIds : (setup.selectedWorkflowId ? [setup.selectedWorkflowId] : []);
  const isBulk = wfNames.length > 1;
  const hasWorkflows = wfIds.length > 0;
  const isWorkflowMode = setup.setupMode === 'SELECT_EXISTING_WORKFLOW' || setup.setupMode === 'CREATE_NEW_WORKFLOW';
  const createdWorkflows = setup.createdWorkflows || [];

  // All available workflows: mock library + project-created
  const allWorkflows = useMemo(() => [
    ...MOCK_WORKFLOWS.map(wf => ({ id: wf.id, name: wf.name, description: wf.description, isCreated: false, status: wf.status })),
    ...createdWorkflows.filter(w => w.status === 'SAVED').map(w => ({ id: w.id, name: w.name, description: w.description || w.objective, isCreated: true, status: 'Active' })),
  ], [createdWorkflows]);

  // Toggle workflow selection
  const toggleWorkflow = (id: string) => {
    const isSelected = wfIds.includes(id);
    const newIds = isSelected ? wfIds.filter(x => x !== id) : [...wfIds, id];
    const newNames = newIds.map(wid => allWorkflows.find(w => w.id === wid)?.name || '').filter(Boolean);
    onUpdateSetup({
      ...setup,
      setupMode: 'SELECT_EXISTING_WORKFLOW' as SetupMode,
      selectedWorkflowIds: newIds,
      selectedWorkflowNames: newNames,
      selectedWorkflowId: newIds[0] || '',
      selectedWorkflowName: newNames[0] || '',
      history: [...setup.history, { id: `sh-${Date.now()}`, action: 'WORKFLOW_TOGGLED', actor: engagement.owner, timestamp: now(), comments: `${newIds.length} selected` }],
    });
  };

  // Map for BulkExecuteModal
  const libraryWorkflows = useMemo((): LibraryWorkflow[] => {
    return wfIds.map((id, i) => {
      const mockWf = MOCK_WORKFLOWS.find(w => w.id === id);
      const createdWf = createdWorkflows.find(w => w.id === id);
      const name = wfNames[i] || mockWf?.name || createdWf?.name || 'Workflow';
      return {
        id, name,
        description: mockWf?.description || createdWf?.description || createdWf?.objective || name,
        tags: mockWf ? mockWf.compatibleTypes : ['Automation'],
        businessProcess: engagement.businessProcess || 'P2P',
        controlId: mockWf?.id ? `CTRL-${mockWf.id.replace('mwf-', '')}` : `PRJ-${id.slice(-3)}`,
        live: !!mockWf,
      };
    });
  }, [wfIds, wfNames, createdWorkflows, engagement.businessProcess]);

  const wfLabel = wfNames.length > 1 ? `${wfNames.length} Workflows` : (wfNames[0] || 'Automation');
  const defaultRunName = `${wfLabel} Run — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Run creation
  const handleBulkModalComplete = () => {
    const runType: AutoRunType = setup.setupMode === 'SELECT_EXISTING_WORKFLOW' ? 'WORKFLOW' : setup.setupMode === 'CREATE_NEW_WORKFLOW' ? 'DRAFT_WORKFLOW' : 'QA_ADHOC';
    const run: AutomationRun = {
      id: `run-${Date.now()}`, runName: runName.trim() || defaultRunName, runType, sourceSetupMode: setup.setupMode,
      workflowName: wfNames[0] || '', inputSourceIds: inputData.selectedSourceIds,
      workflowIds: wfIds, workflowNames: wfNames, bulkRun: isBulk,
      status: 'READY', startedAt: null, completedAt: null, runBy: '', summary: '', processedRecords: 0,
      exceptionCount: 0, outputCount: 0, outputs: [], exceptions: [], logs: [],
    };
    const completed = simulateRun(run, setup, inputData, engagement.owner);
    onUpdateRuns({ runs: [...runsState.runs, completed] });
    setRunName('');
    setShowBulkModal(false);
  };

  const hasCompleted = runsState.runs.some(r => r.status === 'COMPLETED');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-[15px] font-bold text-text mb-0.5">Workflows</h3>
        <p className="text-[12px] text-text-muted">Select or build workflows for this automation project, then run them using the Workflow Library bulk execution flow.</p>
      </div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Selected Workflows</span><span className="text-text font-medium">{hasWorkflows ? `${wfIds.length} selected` : 'None selected'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Created Workflows</span><span className="text-text font-medium">{createdWorkflows.filter(w => w.status === 'SAVED').length}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Total Runs</span><span className="text-text font-medium">{summary.total}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Run Type</span><span className="text-text font-medium">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
        </div>
      </div>

      {/* Workflow selection */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">Available Workflows <span className="font-normal text-gray-400 ml-1">({allWorkflows.length})</span></h4>
          <div className="flex items-center gap-2">
            {hasWorkflows && <span className="text-[10px] font-semibold text-primary">{wfIds.length} selected</span>}
          </div>
        </div>
        <div className="space-y-1.5">
          {allWorkflows.map(wf => {
            const isSelected = wfIds.includes(wf.id);
            return (
              <button key={wf.id} onClick={() => toggleWorkflow(wf.id)}
                className={`w-full text-left rounded-lg border-2 p-3 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <input type="checkbox" checked={isSelected} readOnly className="w-3.5 h-3.5 rounded border-border accent-[#6a12cd] cursor-pointer shrink-0" />
                  <Workflow size={12} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                  <span className="text-[12px] font-semibold text-text">{wf.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${wf.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{wf.status}</span>
                  {wf.isCreated && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-50 text-purple-700">Created in this Project</span>}
                </div>
                <p className="text-[10px] text-gray-500 ml-7">{wf.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Run CTA */}
      <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold text-text">Execute Workflows</h4>
          {isBulk && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[9px] font-bold">{wfNames.length} workflows selected</span>}
        </div>
        <p className="text-[10px] text-gray-500">Data source configuration happens inside the bulk execution flow before running.</p>
        {isBulk && (
          <div className="flex flex-wrap gap-1">
            {wfNames.map((n, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-600">{n}</span>)}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input value={runName} onChange={e => setRunName(e.target.value)} placeholder={defaultRunName} className="flex-1 px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40" />
          <button onClick={() => setShowBulkModal(true)} disabled={!hasWorkflows}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
            <Play size={12} />{isBulk ? 'Run Selected Workflows' : hasWorkflows ? 'Run Workflow' : 'Select Workflows First'}
          </button>
        </div>
      </div>

      {/* Run summary */}
      {summary.total > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Total Runs', value: summary.total },
            { label: 'Completed', value: summary.completed, cls: 'text-emerald-600' },
            { label: 'Open Exc.', value: summary.openExceptions, cls: summary.openExceptions > 0 ? 'text-amber-600' : '' },
            { label: 'Outputs', value: summary.outputs },
            { label: 'Last Status', value: summary.total > 0 ? summary.lastStatus : '—', cls: summary.lastStatus === 'COMPLETED' ? 'text-emerald-600' : '' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
              <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
              <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Run history */}
      {runsState.runs.length > 0 && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Run History ({runsState.runs.length})</h4></div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left w-5"></th><th className="px-3 py-1.5 text-left">Run</th><th className="px-3 py-1.5 text-center">Type</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Exceptions</th><th className="px-3 py-1.5 text-center">Outputs</th>
            </tr></thead>
            <tbody>{runsState.runs.map(run => {
              const isExp = expandedRunId === run.id;
              return (
                <React.Fragment key={run.id}>
                  <tr className={`border-b border-border-light/50 cursor-pointer hover:bg-surface-2/20 ${isExp ? 'bg-surface-2/20' : ''}`} onClick={() => setExpandedRunId(isExp ? null : run.id)}>
                    <td className="px-3 py-2 text-gray-400">{isExp ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</td>
                    <td className="px-3 py-2"><div className="font-medium text-text">{run.runName}</div><div className="text-[9px] text-gray-400">{run.completedAt || 'Pending'}</div></td>
                    <td className="px-3 py-2 text-center text-[10px] text-gray-500">{run.bulkRun ? `Bulk (${run.workflowNames?.length || 0})` : 'Workflow'}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${RUN_STATUS_CLS[run.status]}`}>{run.status}</span></td>
                    <td className="px-3 py-2 text-center"><span className={`tabular-nums ${run.exceptionCount > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>{run.exceptionCount}</span></td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-500">{run.outputCount}</td>
                  </tr>
                  {isExp && run.status === 'COMPLETED' && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="bg-surface-2/15 border-b border-border-light px-6 py-3 text-[10px] text-text">{run.summary}</div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* Continue to Output Review */}
      {hasCompleted && (
        <div className="rounded-lg border border-border-light p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-text">Next Step</h4>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">Run Completed</span>
          </div>
          <p className="text-[10px] text-gray-500">Review generated outputs and exceptions before managing cases.</p>
          <button onClick={() => onNavigateTab?.('output-review')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors">
            Continue to Output Review <ChevronRight size={11} />
          </button>
        </div>
      )}

      {/* BulkExecuteModal */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkExecuteModal
            selectedWorkflows={libraryWorkflows}
            onClose={() => setShowBulkModal(false)}
            onContinue={() => handleBulkModalComplete()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
