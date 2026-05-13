// ─── Automation Project — Automation Setup Tab ───────────────────────────
// Configure workflow/Q&A/ad-hoc approach for automation runs.

import React, { useState } from 'react';
import {
  Workflow, MessageSquare, Database, Clock, Plus, CheckCircle2, AlertCircle, ChevronRight, X, Info,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationInputDataState } from './automationInputData';
import {
  deriveSetupReadiness, SETUP_MODE_LABELS, SETUP_STATUS_CLS, MOCK_WORKFLOWS,
  SUGGESTED_STEPS, SUGGESTED_QUESTIONS, EXPECTED_OUTPUTS, STEP_TYPES, STEP_TYPE_LABELS,
  type AutomationSetupState, type SetupMode, type DraftWorkflow, type DraftWorkflowStep, type QASetup, type StepType,
} from './automationSetupData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

interface Props {
  engagement: ConfigurableEngagement;
  inputData: AutomationInputDataState;
  setupState: AutomationSetupState;
  onUpdateSetup: (state: AutomationSetupState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationSetupTab({ engagement, inputData, setupState, onUpdateSetup, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const { status, checks } = deriveSetupReadiness(inputData, setupState, cfg);
  const hasInput = inputData.dataSources.some(d => inputData.selectedSourceIds.includes(d.id)) || inputData.proceedWithoutData;
  const isRecurring = cfg.runType === 'RECURRING';

  const setMode = (mode: SetupMode) => {
    onUpdateSetup({ ...setupState, setupMode: mode, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'MODE_SELECTED', actor: engagement.owner, timestamp: now(), comments: SETUP_MODE_LABELS[mode] }] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Automation Setup</h3>
          <p className="text-[12px] text-text-muted">Configure whether this project uses an existing workflow, a new workflow, or Q&A/ad-hoc analysis.</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${SETUP_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Context */}
      <div className="rounded-lg border border-border-light p-3">
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-gray-400 block text-[10px]">Setup Mode</span><span className="text-text font-medium">{SETUP_MODE_LABELS[setupState.setupMode]}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Input Sources</span><span className={`font-medium ${hasInput ? 'text-emerald-600' : 'text-amber-600'}`}>{hasInput ? `${inputData.selectedSourceIds.length} selected` : 'None'}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Run Type</span><span className="text-text font-medium">{cfg.runType.replace(/_/g, ' ')}{cfg.frequency ? ` (${cfg.frequency})` : ''}</span></div>
          <div><span className="text-gray-400 block text-[10px]">Outputs</span><span className="text-text font-medium">{cfg.outputTypes.map(o => o.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(', ')}</span></div>
        </div>
      </div>

      {!hasInput && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>No input data selected. Configure input data or proceed with Q&A/ad-hoc setup.</span>
        </div>
      )}

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { mode: 'SELECT_EXISTING_WORKFLOW' as SetupMode, icon: Workflow, title: 'Select Existing Workflow', desc: 'Use a saved workflow from the workflow library.' },
          { mode: 'CREATE_NEW_WORKFLOW' as SetupMode, icon: Plus, title: 'Create New Workflow', desc: 'Define a new repeatable workflow for this project.' },
          { mode: 'QA_ADHOC_ANALYSIS' as SetupMode, icon: MessageSquare, title: 'Q&A / Ad-hoc Analysis', desc: 'Ask questions or define analysis instructions.' },
          { mode: 'UPLOAD_DATA_FIRST_DECIDE_LATER' as SetupMode, icon: Clock, title: 'Decide Later', desc: 'Keep setup open until requirements are clearer.' },
        ]).map(m => {
          const Icon = m.icon;
          const isSelected = setupState.setupMode === m.mode;
          return (
            <button key={m.mode} onClick={() => setMode(m.mode)}
              className={`text-left rounded-xl border-2 p-3 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                <span className={`text-[12px] font-semibold ${isSelected ? 'text-primary' : 'text-text'}`}>{m.title}</span>
                {isSelected && <CheckCircle2 size={12} className="text-primary ml-auto" />}
              </div>
              <p className="text-[10px] text-gray-500">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mode content */}
      {setupState.setupMode === 'SELECT_EXISTING_WORKFLOW' && (
        <ExistingWorkflowPanel inputType={cfg.inputType} setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} />
      )}
      {setupState.setupMode === 'CREATE_NEW_WORKFLOW' && (
        <CreateWorkflowPanel setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} inputSourceIds={inputData.selectedSourceIds} />
      )}
      {setupState.setupMode === 'QA_ADHOC_ANALYSIS' && (
        <QASetupPanel setupState={setupState} onUpdateSetup={onUpdateSetup} engagement={engagement} inputSourceIds={inputData.selectedSourceIds} isRecurring={isRecurring} />
      )}
      {setupState.setupMode === 'UPLOAD_DATA_FIRST_DECIDE_LATER' && (
        <div className="rounded-lg border border-border-light p-4 text-center space-y-2">
          <Clock size={24} className="text-gray-300 mx-auto" />
          <h4 className="text-[13px] font-semibold text-text">Automation setup is not configured yet</h4>
          <p className="text-[11px] text-gray-500">Review input data, then choose a setup mode above.</p>
        </div>
      )}

      {/* Setup notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Setup Notes</h4>
        <textarea value={setupState.setupNotes} onChange={e => onUpdateSetup({ ...setupState, setupNotes: e.target.value })}
          rows={2} placeholder="Assumptions, workflow design notes, unresolved questions..." className={inputCls + ' resize-none'} />
      </div>

      {/* History */}
      {setupState.history.length > 0 && (
        <div className="rounded-lg border border-border-light p-4">
          <h4 className="text-[11px] font-bold text-text mb-1">History</h4>
          <div className="space-y-1">{setupState.history.slice(-5).map(h => (
            <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action.replace(/_/g, ' ')}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>
          ))}</div>
        </div>
      )}

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold text-text">Automation Setup Readiness</h4>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${SETUP_STATUS_CLS[status]}`}>{status.replace(/_/g, ' ')}</span>
        </div>
        <div className="space-y-1">{checks.map(c => (
          <div key={c.label} className="flex items-center gap-2 text-[10px]">
            {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
            <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
          </div>
        ))}</div>
        {isRecurring && setupState.setupMode === 'QA_ADHOC_ANALYSIS' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
            <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Recurring automation should use a saved workflow. Q&A setup is valid for ad-hoc runs only.</span>
          </div>
        )}
        <button onClick={() => onNavigateTab?.('runs')} disabled={status !== 'READY_FOR_RUN'}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Runs <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Existing Workflow Panel ──────────────────────────────────────────────

function ExistingWorkflowPanel({ inputType, setupState, onUpdateSetup, engagement }: { inputType: string; setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement }) {
  return (
    <div className="rounded-lg border border-border-light p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-text">Select Workflow</h4>
      <div className="space-y-2">
        {MOCK_WORKFLOWS.map(wf => {
          const isSelected = setupState.selectedWorkflowId === wf.id;
          const compatible = wf.compatibleTypes.includes(inputType) || inputType === 'HYBRID';
          return (
            <button key={wf.id} onClick={() => onUpdateSetup({ ...setupState, selectedWorkflowId: wf.id, selectedWorkflowName: wf.name, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'WORKFLOW_SELECTED', actor: engagement.owner, timestamp: now(), comments: wf.name }] })}
              className={`w-full text-left rounded-lg border-2 p-3 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/30'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[12px] font-semibold text-text">{wf.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${wf.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{wf.status}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${compatible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{compatible ? 'Compatible' : 'Needs Review'}</span>
                {isSelected && <CheckCircle2 size={12} className="text-primary ml-auto" />}
              </div>
              <p className="text-[10px] text-gray-500 mb-1">{wf.description}</p>
              <div className="flex flex-wrap gap-1">{wf.steps.map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px]">{i + 1}. {s}</span>)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Workflow Panel ────────────────────────────────────────────────

function CreateWorkflowPanel({ setupState, onUpdateSetup, engagement, inputSourceIds }: { setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement; inputSourceIds: string[] }) {
  const draft = setupState.draftWorkflow || { id: `dwf-${Date.now()}`, name: '', description: '', triggerType: 'MANUAL' as const, steps: [], status: 'DRAFT' as const };
  const [wfName, setWfName] = useState(draft.name);
  const [wfDesc, setWfDesc] = useState(draft.description);

  const saveDraft = (updates: Partial<DraftWorkflow>) => {
    const updated = { ...draft, ...updates };
    onUpdateSetup({ ...setupState, draftWorkflow: updated, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'DRAFT_WORKFLOW_CREATED', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const addSuggestedSteps = () => {
    const steps: DraftWorkflowStep[] = SUGGESTED_STEPS.map((s, i) => ({ ...s, id: `step-${Date.now()}-${i}`, inputSourceIds }));
    saveDraft({ name: wfName || 'Vendor Reconciliation Workflow', description: wfDesc || 'Auto-generated workflow steps.', steps, status: 'DRAFT' });
  };

  const addCustomStep = () => {
    const newStep: DraftWorkflowStep = { id: `step-${Date.now()}`, order: draft.steps.length + 1, stepType: 'OTHER', name: '', description: '', inputSourceIds: [], outputName: '' };
    saveDraft({ steps: [...draft.steps, newStep] });
  };

  const markReady = () => {
    if (!draft.name || draft.steps.length === 0) return;
    saveDraft({ name: wfName || draft.name, description: wfDesc || draft.description, status: 'READY' });
  };

  return (
    <div className="rounded-lg border border-border-light p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-text">Create New Workflow</h4>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Workflow Name</label><input value={wfName} onChange={e => setWfName(e.target.value)} placeholder="e.g. Vendor Reconciliation Workflow" className={inputCls} /></div>
        <div><label className={labelCls}>Description</label><input value={wfDesc} onChange={e => setWfDesc(e.target.value)} placeholder="What does this workflow do?" className={inputCls} /></div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Steps ({draft.steps.length})</label>
          <div className="flex items-center gap-1">
            <button onClick={addSuggestedSteps} className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Add Suggested Steps</button>
            <button onClick={addCustomStep} className="px-2 py-1 rounded text-[9px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors">+ Custom Step</button>
          </div>
        </div>
        {draft.steps.length === 0 ? (
          <div className="text-[10px] text-gray-400 italic py-2">No steps defined yet. Add suggested steps or create custom ones.</div>
        ) : (
          <div className="space-y-1">{draft.steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light text-[10px]">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold inline-flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-text font-medium flex-1">{s.name || 'Untitled step'}</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px]">{STEP_TYPE_LABELS[s.stepType]}</span>
            </div>
          ))}</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={markReady} disabled={!wfName.trim() || draft.steps.length === 0}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
          <CheckCircle2 size={11} />Mark Workflow Ready
        </button>
        {draft.status === 'READY' && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={10} />Ready</span>}
        <span className="text-[9px] text-gray-400 ml-auto">Workflow will be saved to Workflow Library later.</span>
      </div>
    </div>
  );
}

// ─── Q&A Setup Panel ──────────────────────────────────────────────────────

function QASetupPanel({ setupState, onUpdateSetup, engagement, inputSourceIds, isRecurring }: { setupState: AutomationSetupState; onUpdateSetup: (s: AutomationSetupState) => void; engagement: ConfigurableEngagement; inputSourceIds: string[]; isRecurring: boolean }) {
  const qa = setupState.qaSetup || { id: `qa-${Date.now()}`, objective: '', questions: [], selectedSourceIds: inputSourceIds, expectedOutputs: [], status: 'DRAFT' as const };
  const [objective, setObjective] = useState(qa.objective);
  const [newQ, setNewQ] = useState('');
  const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(new Set(qa.expectedOutputs));

  const saveQA = (updates: Partial<QASetup>) => {
    onUpdateSetup({ ...setupState, qaSetup: { ...qa, ...updates }, history: [...setupState.history, { id: `sh-${Date.now()}`, action: 'QA_CONFIGURED', actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const addQuestion = () => { if (newQ.trim()) { saveQA({ questions: [...qa.questions, newQ.trim()] }); setNewQ(''); } };
  const addSuggested = () => { saveQA({ questions: [...qa.questions, ...SUGGESTED_QUESTIONS.filter(q => !qa.questions.includes(q))] }); };
  const toggleOutput = (o: string) => { const n = new Set(selectedOutputs); n.has(o) ? n.delete(o) : n.add(o); setSelectedOutputs(n); saveQA({ expectedOutputs: Array.from(n) }); };

  const markReady = () => {
    if (!objective.trim() || qa.questions.length === 0) return;
    saveQA({ objective, status: 'READY' });
  };

  return (
    <div className="rounded-lg border border-border-light p-4 space-y-3">
      <h4 className="text-[11px] font-bold text-text">Q&A / Ad-hoc Analysis Setup</h4>

      <div><label className={labelCls}>Analysis Objective</label><textarea value={objective} onChange={e => setObjective(e.target.value)} rows={2} placeholder="What should this analysis accomplish?" className={inputCls + ' resize-none'} /></div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Questions / Instructions ({qa.questions.length})</label>
          <button onClick={addSuggested} className="px-2 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Use Suggested</button>
        </div>
        {qa.questions.length > 0 && (
          <div className="space-y-1 mb-2">{qa.questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light text-[10px]">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold inline-flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-text flex-1">{q}</span>
            </div>
          ))}</div>
        )}
        <div className="flex items-center gap-2">
          <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Add custom question..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" onKeyDown={e => { if (e.key === 'Enter') addQuestion(); }} />
          <button onClick={addQuestion} disabled={!newQ.trim()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
        </div>
      </div>

      <div>
        <label className={labelCls}>Expected Outputs</label>
        <div className="flex flex-wrap gap-2">{EXPECTED_OUTPUTS.map(o => (
          <label key={o} className="flex items-center gap-1.5 text-[10px] text-text cursor-pointer">
            <input type="checkbox" checked={selectedOutputs.has(o)} onChange={() => toggleOutput(o)} className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer" />{o}
          </label>
        ))}</div>
      </div>

      {isRecurring && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
          <AlertCircle size={11} className="shrink-0 mt-0.5" /><span>Recurring automation should be converted into a saved workflow. Q&A is valid for ad-hoc/one-time runs.</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={markReady} disabled={!objective.trim() || qa.questions.length === 0}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
          <CheckCircle2 size={11} />Mark Q&A Ready
        </button>
        {qa.status === 'READY' && <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={10} />Ready</span>}
      </div>
    </div>
  );
}
