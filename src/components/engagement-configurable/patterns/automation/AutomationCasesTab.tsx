// ─── Automation Project — Cases Tab ───────────────────────────────────────
// Assign case candidates to risk/process owners and track responses.

import React, { useState } from 'react';
import {
  Plus, CheckCircle2, AlertCircle, ChevronRight, X, Lock, Info, Send,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from '../../configurableEngagementTypes';
import type { AutomationRunsState } from './automationRunsData';
import { EX_SEVERITY_CLS, EX_CAT_LABELS } from './automationRunsData';
import {
  deriveCasesSummary, CASE_STATUS_CLS, CASE_STATUS_LABELS, CASE_PRIORITY_CLS, CASE_CAT_LABELS,
  DEFICIENCY_LABELS, DEFICIENCY_CLS, DEFICIENCY_TYPES, REMEDIATION_STATUS_CLS,
  type AutomationCasesState, type AutomationCase, type CaseStatus, type CasePriority, type CaseCategory, type DeficiencyType, type RemediationStatus,
} from './automationCasesData';

const inputCls = 'w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[11px] font-semibold text-text-muted block mb-1';
const PRIORITIES: CasePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function now(): string { return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function futureDate(days: number): string { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

interface Props {
  engagement: ConfigurableEngagement;
  runsState: AutomationRunsState;
  casesState: AutomationCasesState;
  onUpdateCases: (state: AutomationCasesState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function AutomationCasesTab({ engagement, runsState, casesState, onUpdateCases, onNavigateTab }: Props) {
  const cfg = engagement.config as AutomationProjectConfig;
  const hasCaseMgmt = cfg.outputTypes.includes('CASE_MANAGEMENT');
  const completedRuns = runsState.runs.filter(r => r.status === 'COMPLETED');
  const allExceptions = completedRuns.flatMap(r => r.exceptions);
  const caseCandidates = allExceptions.filter(e => e.status === 'CASE_CANDIDATE' && !casesState.linkedExceptionIds.includes(e.id));
  const summary = deriveCasesSummary(casesState);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  // Locked / empty states
  if (!hasCaseMgmt && casesState.cases.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Cases</h3><p className="text-[12px] text-text-muted">Assign and track follow-up cases from automation exceptions.</p></div>
        <div className="rounded-lg border border-border-light p-6 text-center space-y-2">
          <Info size={24} className="text-gray-300 mx-auto" />
          <p className="text-[12px] text-text-muted">Case Management was not selected as an output for this project.</p>
          <p className="text-[10px] text-gray-400">You can still create a manual follow-up case if needed.</p>
          <button onClick={() => setShowManualForm(true)} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors"><Plus size={11} /> Create Manual Follow-up Case</button>
        </div>
      </div>
    );
  }

  if (completedRuns.length === 0) {
    return (
      <div className="space-y-4">
        <div><h3 className="text-[15px] font-bold text-text mb-0.5">Cases</h3><p className="text-[12px] text-text-muted">Assign follow-up cases to risk/process owners.</p></div>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50/30 p-6 text-center space-y-3">
          <Lock size={28} className="text-gray-300 mx-auto" />
          <h4 className="text-[14px] font-semibold text-text">No Completed Runs</h4>
          <p className="text-[12px] text-text-muted">Complete an automation run before assigning cases.</p>
          <button onClick={() => onNavigateTab?.('runs')} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1">Go to Runs <ChevronRight size={12} /></button>
        </div>
      </div>
    );
  }

  const handleAssignCases = (assignment: { owner: string; reviewer: string; dueDate: string; deficiencyType: DeficiencyType; priority: CasePriority; message: string }) => {
    const newCases: AutomationCase[] = [];
    const newLinked: string[] = [];
    selectedCandidateIds.forEach(exId => {
      if (casesState.linkedExceptionIds.includes(exId)) return;
      const ex = allExceptions.find(e => e.id === exId);
      if (!ex) return;
      const parentRun = completedRuns.find(r => r.exceptions.some(e => e.id === exId));
      newCases.push({
        id: `case-${Date.now()}-${exId.slice(-4)}`, title: ex.title, description: ex.description,
        sourceRunId: parentRun?.id || '', sourceExceptionId: exId,
        severity: assignment.priority, category: ex.category as CaseCategory,
        owner: assignment.owner, dueDate: assignment.dueDate, status: 'OPEN', priority: assignment.priority,
        deficiencyType: assignment.deficiencyType,
        reviewer: assignment.reviewer, sourceWorkflowName: ex.sourceWorkflowName,
        remediationStatus: 'NOT_STARTED', auditorNotes: assignment.message,
        evidenceRefs: [], comments: ex.triageNotes || '',
        createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
        history: [{ id: `ch-${Date.now()}-${exId.slice(-4)}`, action: 'ASSIGNED_TO_OWNER', actor: engagement.owner, timestamp: now(), comments: `Assigned to ${assignment.owner}` }],
      });
      newLinked.push(exId);
    });
    if (newCases.length > 0) {
      onUpdateCases({ ...casesState, cases: [...casesState.cases, ...newCases], linkedExceptionIds: [...casesState.linkedExceptionIds, ...newLinked] });
    }
    setSelectedCandidateIds(new Set());
    setShowAssignPanel(false);
  };

  const assignSingleCandidate = (exId: string) => {
    setSelectedCandidateIds(new Set([exId]));
    setShowAssignPanel(true);
  };

  const addManualCase = (c: AutomationCase) => {
    onUpdateCases({ ...casesState, cases: [...casesState.cases, c] });
    setShowManualForm(false);
  };

  const updateCase = (id: string, updates: Partial<AutomationCase>) => {
    onUpdateCases({ ...casesState, cases: casesState.cases.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString().slice(0, 10) } : c) });
  };

  const transitionStatus = (id: string, status: CaseStatus, historyAction: string) => {
    const c = casesState.cases.find(x => x.id === id);
    if (!c) return;
    updateCase(id, { status, history: [...c.history, { id: `ch-${Date.now()}`, action: historyAction, actor: engagement.owner, timestamp: now(), comments: '' }] });
  };

  const addEvidence = (id: string, ref: string) => {
    const c = casesState.cases.find(x => x.id === id);
    if (!c) return;
    updateCase(id, { evidenceRefs: [...c.evidenceRefs, ref] });
  };

  const toggleCandidate = (id: string) => setSelectedCandidateIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const hasCases = casesState.cases.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold text-text mb-0.5">Cases</h3>
          <p className="text-[12px] text-text-muted">Assign case candidates to risk/process owners and track their response.</p>
        </div>
        <button onClick={() => setShowManualForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors shrink-0"><Plus size={12} />Manual Follow-up</button>
      </div>

      {/* Integration note */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 text-[10px] text-blue-600">
        <Info size={11} className="shrink-0 mt-0.5" /><span>Future integration will sync these records with Case Management.</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Candidates', value: caseCandidates.length + casesState.linkedExceptionIds.length },
          { label: 'Assigned', value: summary.total },
          { label: 'With Owner', value: summary.sentToOwner + summary.withOwner, cls: (summary.sentToOwner + summary.withOwner) > 0 ? 'text-blue-600' : '' },
          { label: 'For Review', value: summary.submittedForReview, cls: summary.submittedForReview > 0 ? 'text-purple-600' : '' },
          { label: 'Closed', value: summary.acceptedClosed + summary.closedNotRequired, cls: 'text-emerald-600' },
          { label: 'Critical/High', value: summary.criticalHigh, cls: summary.criticalHigh > 0 ? 'text-red-600' : '' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border-light p-2.5 text-center">
            <div className={`text-[16px] font-bold tabular-nums ${s.cls || 'text-text'}`}>{s.value}</div>
            <div className="text-[9px] text-gray-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Case candidates */}
      {caseCandidates.length > 0 && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-amber-700">Case Candidates ({caseCandidates.length})</h4>
            <div className="flex items-center gap-2">
              {caseCandidates.length > 1 && <button onClick={() => setSelectedCandidateIds(new Set(caseCandidates.map(e => e.id)))} className="text-[9px] font-semibold text-primary hover:underline cursor-pointer">Select All</button>}
              {selectedCandidateIds.size > 0 && <button onClick={() => setShowAssignPanel(true)} className="px-2.5 py-1 rounded text-[9px] font-semibold text-white bg-primary hover:bg-primary/90 cursor-pointer transition-colors flex items-center gap-1"><Send size={9} />Assign {selectedCandidateIds.size} Case{selectedCandidateIds.size !== 1 ? 's' : ''}</button>}
            </div>
          </div>
          <div className="space-y-1.5">{caseCandidates.map(ex => (
            <div key={ex.id} className={`flex items-center justify-between rounded-lg border bg-white px-3 py-2 ${selectedCandidateIds.has(ex.id) ? 'border-primary' : 'border-border-light'}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input type="checkbox" checked={selectedCandidateIds.has(ex.id)} onChange={() => toggleCandidate(ex.id)} className="w-3 h-3 rounded border-border accent-[#6a12cd] cursor-pointer shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${EX_SEVERITY_CLS[ex.severity]}`}>{ex.severity}</span>
                    <span className="text-[11px] font-medium text-text">{ex.title}</span>
                    {ex.deficiencyType && <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DEFICIENCY_CLS[ex.deficiencyType as DeficiencyType] || 'bg-gray-100 text-gray-600'}`}>{DEFICIENCY_LABELS[ex.deficiencyType as DeficiencyType] || ex.deficiencyType}</span>}
                    {ex.sourceWorkflowName && <span className="text-[9px] text-gray-400">· {ex.sourceWorkflowName}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[9px] text-gray-400">
                    <span>{EX_CAT_LABELS[ex.category]}</span>
                    {ex.assignedOwner && <span>Owner: {ex.assignedOwner}</span>}
                    {ex.dueDate && <span>Due: {ex.dueDate}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => assignSingleCandidate(ex.id)} className="px-2.5 py-1 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors shrink-0 ml-2 flex items-center gap-1"><Send size={8} />Assign Case</button>
            </div>
          ))}</div>
        </div>
      )}
      {caseCandidates.length === 0 && !hasCases && (
        <div className="rounded-lg border border-border-light p-4 text-center text-[11px] text-gray-400">
          <p>No case candidates yet. Mark exceptions as Case Candidate in Output Review.</p>
          <button onClick={() => onNavigateTab?.('output-review')} className="text-primary font-semibold hover:underline cursor-pointer mt-1">Go to Output Review</button>
        </div>
      )}

      {/* Assignment panel */}
      {showAssignPanel && (
        <AssignmentPanel
          candidateCount={selectedCandidateIds.size}
          selectedExceptions={allExceptions.filter(e => selectedCandidateIds.has(e.id))}
          defaultOwner={engagement.owner}
          onAssign={handleAssignCases}
          onCancel={() => setShowAssignPanel(false)}
        />
      )}

      {/* Manual form */}
      {showManualForm && <ManualCaseForm engagement={engagement} onSave={addManualCase} onCancel={() => setShowManualForm(false)} />}

      {/* Cases table */}
      {hasCases && (
        <div className="rounded-lg border border-border-light overflow-hidden">
          <div className="px-4 py-2 bg-surface-2/20 border-b border-border-light"><h4 className="text-[11px] font-bold text-text">Assigned Cases ({casesState.cases.length})</h4></div>
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border-light bg-surface-2/30 text-[9px] font-semibold text-gray-400 uppercase">
              <th className="px-3 py-1.5 text-left">Case</th><th className="px-3 py-1.5 text-center">Deficiency</th><th className="px-3 py-1.5 text-left">Risk / Process Owner</th><th className="px-3 py-1.5 text-left">Reviewer</th><th className="px-3 py-1.5 text-center">Due</th><th className="px-3 py-1.5 text-center">Status</th><th className="px-3 py-1.5 text-center">Action</th>
            </tr></thead>
            <tbody>{casesState.cases.map(c => (
              <tr key={c.id} className="border-b border-border-light/50">
                <td className="px-3 py-2"><div className="font-medium text-text">{c.title}</div><div className="text-[9px] text-gray-400">{c.sourceWorkflowName ? `${c.sourceWorkflowName} · ` : ''}{c.sourceExceptionId ? CASE_CAT_LABELS[c.category] : 'Manual'}</div></td>
                <td className="px-3 py-2 text-center">{c.deficiencyType ? <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DEFICIENCY_CLS[c.deficiencyType]}`}>{DEFICIENCY_LABELS[c.deficiencyType]}</span> : <span className="text-[9px] text-gray-400">—</span>}</td>
                <td className="px-3 py-2 text-gray-500">{c.owner || '—'}</td>
                <td className="px-3 py-2 text-[10px] text-gray-500">{c.reviewer || '—'}</td>
                <td className="px-3 py-2 text-center text-[10px] font-mono text-gray-500">{c.dueDate || '—'}</td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${CASE_STATUS_CLS[c.status]}`}>{CASE_STATUS_LABELS[c.status]}</span></td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setEditingId(c.id)} className="px-2 py-1 rounded text-[8px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">Open</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {editingId && (() => {
        const c = casesState.cases.find(x => x.id === editingId);
        return c ? <CaseDetailPanel key={editingId} caseItem={c} engagement={engagement} onUpdate={(u) => updateCase(c.id, u)} onTransition={(s, a) => transitionStatus(c.id, s, a)} onAddEvidence={(ref) => addEvidence(c.id, ref)} onClose={() => setEditingId(null)} /> : null;
      })()}

      {/* Notes */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Case Notes</h4>
        <textarea value={casesState.caseNotes} onChange={e => onUpdateCases({ ...casesState, caseNotes: e.target.value })} rows={2} placeholder="Overall case management notes..." className={inputCls + ' resize-none'} />
      </div>

      {/* Readiness */}
      <div className="rounded-lg border border-border-light p-4 space-y-2">
        <h4 className="text-[11px] font-bold text-text">Case Readiness</h4>
        <div className="space-y-1">
          {[
            { label: 'Case candidates assigned', ok: caseCandidates.length === 0 },
            { label: 'Cases assigned to owners', ok: hasCases },
            { label: 'Owners and due dates assigned', ok: casesState.cases.every(c => c.owner.trim().length > 0 && c.dueDate.length > 0) || casesState.cases.length === 0 },
            { label: 'Owner responses submitted', ok: casesState.cases.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length > 0 || casesState.cases.length === 0 },
            { label: 'Auditor closure completed', ok: casesState.cases.filter(c => ['CLOSED', 'CANCELLED'].includes(c.status)).length === casesState.cases.length && casesState.cases.length > 0 },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 text-[10px]">
              {c.ok ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-amber-400" />}
              <span className={c.ok ? 'text-gray-500' : 'text-text'}>{c.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onNavigateTab?.('reports')} disabled={!hasCases && caseCandidates.length > 0}
          className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Continue to Reports <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Assignment Panel ────────────────────────────────────────────────────

function AssignmentPanel({ candidateCount, selectedExceptions, defaultOwner, onAssign, onCancel }: {
  candidateCount: number;
  selectedExceptions: { id: string; title: string; severity: string; sourceWorkflowName?: string }[];
  defaultOwner: string;
  onAssign: (a: { owner: string; reviewer: string; dueDate: string; deficiencyType: DeficiencyType; priority: CasePriority; message: string }) => void;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState('');
  const [reviewer, setReviewer] = useState(defaultOwner);
  const [dueDate, setDueDate] = useState(futureDate(14));
  const [deficiencyType, setDeficiencyType] = useState<DeficiencyType>('OTHER');
  const [priority, setPriority] = useState<CasePriority>('MEDIUM');
  const [message, setMessage] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  const handleSubmit = () => {
    if (!owner.trim()) { setValidationMsg('Risk / process owner is required.'); return; }
    if (!dueDate) { setValidationMsg('Due date is required.'); return; }
    onAssign({ owner: owner.trim(), reviewer: reviewer.trim(), dueDate, deficiencyType, priority, message: message.trim() });
  };

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-white p-5 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-bold text-text">Assign Cases to Owner</h4>
          <p className="text-[10px] text-gray-500">{candidateCount} case candidate{candidateCount !== 1 ? 's' : ''} will be assigned to the risk/process owner for response.</p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded text-gray-400 hover:text-text cursor-pointer"><X size={16} /></button>
      </div>

      {/* Selected exceptions preview */}
      <div className="space-y-1 max-h-20 overflow-y-auto">
        {selectedExceptions.map(ex => (
          <div key={ex.id} className="flex items-center gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${EX_SEVERITY_CLS[ex.severity as keyof typeof EX_SEVERITY_CLS]}`}>{ex.severity}</span>
            <span className="text-text font-medium">{ex.title}</span>
            {ex.sourceWorkflowName && <span className="text-gray-400">· {ex.sourceWorkflowName}</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Risk / Process Owner <span className="text-red-400">*</span></label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. P2P Process Owner" className={inputCls} /></div>
        <div><label className={labelCls}>Reviewer / Auditor</label><input value={reviewer} onChange={e => setReviewer(e.target.value)} placeholder="Auditor name" className={inputCls} /></div>
        <div><label className={labelCls}>Due Date <span className="text-red-400">*</span></label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Deficiency Type <span className="text-red-400">*</span></label><select value={deficiencyType} onChange={e => setDeficiencyType(e.target.value as DeficiencyType)} className={selectCls}>{DEFICIENCY_TYPES.map(d => <option key={d} value={d}>{DEFICIENCY_LABELS[d]}</option>)}</select></div>
        <div><label className={labelCls}>Priority <span className="text-red-400">*</span></label><select value={priority} onChange={e => setPriority(e.target.value as CasePriority)} className={selectCls}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className={labelCls}>Assignment Message</label><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Instructions to owner..." className={inputCls} /></div>
      </div>

      {validationMsg && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-600">
          <AlertCircle size={10} /><span>{validationMsg}</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-border-light">
        <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
          <Send size={12} />Assign {candidateCount} Case{candidateCount !== 1 ? 's' : ''}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Manual Case Form ────────────────────────────────────────────────────

function ManualCaseForm({ engagement, onSave, onCancel }: { engagement: ConfigurableEngagement; onSave: (c: AutomationCase) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<CaseCategory>('OTHER');
  const [priority, setPriority] = useState<CasePriority>('MEDIUM');
  const [defType, setDefType] = useState<DeficiencyType>('OTHER');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState(futureDate(14));
  const CATEGORIES: CaseCategory[] = ['RECONCILIATION_MISMATCH', 'DUPLICATE', 'MISSING_DOCUMENT', 'POLICY_VIOLATION', 'DATA_QUALITY', 'OTHER'];

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between"><h4 className="text-[13px] font-bold text-text">Create Manual Follow-up Case</h4><button onClick={onCancel} className="p-1 rounded text-gray-400 hover:text-text cursor-pointer"><X size={14} /></button></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Title <span className="text-red-400">*</span></label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Case title" className={inputCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Case description" className={inputCls + ' resize-none'} /></div>
        <div><label className={labelCls}>Category</label><select value={category} onChange={e => setCategory(e.target.value as CaseCategory)} className={selectCls}>{CATEGORIES.map(c => <option key={c} value={c}>{CASE_CAT_LABELS[c]}</option>)}</select></div>
        <div><label className={labelCls}>Deficiency Type</label><select value={defType} onChange={e => setDefType(e.target.value as DeficiencyType)} className={selectCls}>{DEFICIENCY_TYPES.map(d => <option key={d} value={d}>{DEFICIENCY_LABELS[d]}</option>)}</select></div>
        <div><label className={labelCls}>Priority</label><select value={priority} onChange={e => setPriority(e.target.value as CasePriority)} className={selectCls}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div><label className={labelCls}>Risk / Process Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner name" className={inputCls} /></div>
        <div><label className={labelCls}>Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Cancel</button>
        <button onClick={() => { if (!title.trim()) return; onSave({ id: `case-${Date.now()}`, title: title.trim(), description: desc.trim(), sourceRunId: '', sourceExceptionId: '', severity: priority, category, owner, dueDate, status: 'OPEN', priority, deficiencyType: defType, remediationStatus: 'NOT_STARTED', reviewer: engagement.owner, evidenceRefs: [], comments: '', createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10), history: [{ id: `ch-${Date.now()}`, action: 'ASSIGNED_TO_OWNER', actor: engagement.owner, timestamp: now(), comments: 'Manual follow-up case.' }] }); }}
          disabled={!title.trim()} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Assign Case</button>
      </div>
    </div>
  );
}

// ─── Case Detail Panel — 3 Sections ──────────────────────────────────────

function CaseDetailPanel({ caseItem, engagement, onUpdate, onTransition, onAddEvidence, onClose }: {
  caseItem: AutomationCase; engagement: ConfigurableEngagement; onUpdate: (u: Partial<AutomationCase>) => void; onTransition: (s: CaseStatus, action: string) => void; onAddEvidence: (ref: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...caseItem });
  const [newEvRef, setNewEvRef] = useState('');
  const [submitValidation, setSubmitValidation] = useState('');
  const upd = <K extends keyof AutomationCase>(f: K, v: AutomationCase[K]) => setDraft(prev => ({ ...prev, [f]: v }));

  const saveDraft = () => {
    onUpdate({
      title: draft.title, description: draft.description, owner: draft.owner, priority: draft.priority, dueDate: draft.dueDate,
      deficiencyType: draft.deficiencyType, reviewer: draft.reviewer, auditorNotes: draft.auditorNotes,
      rootCause: draft.rootCause, remediationPlan: draft.remediationPlan, preventiveAction: draft.preventiveAction,
      remediationOwner: draft.remediationOwner, remediationDueDate: draft.remediationDueDate, closureNotes: draft.closureNotes, comments: draft.comments,
    });
  };

  const submitOwnerResponse = () => {
    if (!draft.rootCause?.trim()) { setSubmitValidation('Root cause is required.'); return; }
    if (!draft.remediationPlan?.trim()) { setSubmitValidation('Remediation plan is required.'); return; }
    if (!draft.remediationOwner?.trim()) { setSubmitValidation('Remediation owner is required.'); return; }
    if (!draft.remediationDueDate) { setSubmitValidation('Remediation due date is required.'); return; }
    setSubmitValidation('');
    onUpdate({
      rootCause: draft.rootCause, remediationPlan: draft.remediationPlan, preventiveAction: draft.preventiveAction,
      remediationOwner: draft.remediationOwner, remediationDueDate: draft.remediationDueDate, comments: draft.comments,
      remediationStatus: 'SUBMITTED', status: 'RESOLVED' as CaseStatus,
      history: [...caseItem.history, { id: `ch-${Date.now()}`, action: 'OWNER_RESPONSE_SUBMITTED', actor: engagement.owner, timestamp: now(), comments: '' }],
    });
  };

  const isSentToOwner = caseItem.status === 'OPEN';
  const isWithOwner = caseItem.status === 'IN_PROGRESS' || caseItem.status === 'OPEN';
  const isSubmittedForReview = caseItem.status === 'RESOLVED';
  const isClosed = caseItem.status === 'CLOSED' || caseItem.status === 'CANCELLED';

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-white p-5 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-bold text-text">{caseItem.title}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${CASE_STATUS_CLS[caseItem.status]}`}>{CASE_STATUS_LABELS[caseItem.status]}</span>
            {caseItem.deficiencyType && <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${DEFICIENCY_CLS[caseItem.deficiencyType]}`}>{DEFICIENCY_LABELS[caseItem.deficiencyType]}</span>}
            {caseItem.priority && <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${CASE_PRIORITY_CLS[caseItem.priority]}`}>{caseItem.priority}</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded text-gray-400 hover:text-text cursor-pointer"><X size={16} /></button>
      </div>

      {/* ── SECTION 1: Exception & Auditor Assignment ── */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h5 className="text-[11px] font-bold text-text uppercase tracking-wider text-gray-500">Exception & Auditor Assignment</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Title</label><input value={draft.title} onChange={e => upd('title', e.target.value)} className={inputCls} disabled={isClosed} /></div>
          <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={draft.description} onChange={e => upd('description', e.target.value)} rows={2} className={inputCls + ' resize-none'} disabled={isClosed} /></div>
          <div><label className={labelCls}>Risk / Process Owner</label><input value={draft.owner} onChange={e => upd('owner', e.target.value)} className={inputCls} disabled={isClosed} /></div>
          <div><label className={labelCls}>Reviewer / Auditor</label><input value={draft.reviewer || ''} onChange={e => upd('reviewer', e.target.value)} className={inputCls} disabled={isClosed} /></div>
          <div><label className={labelCls}>Deficiency Type</label><select value={draft.deficiencyType || 'OTHER'} onChange={e => upd('deficiencyType', e.target.value as DeficiencyType)} className={selectCls} disabled={isClosed}>{DEFICIENCY_TYPES.map(d => <option key={d} value={d}>{DEFICIENCY_LABELS[d]}</option>)}</select></div>
          <div><label className={labelCls}>Priority</label><select value={draft.priority} onChange={e => upd('priority', e.target.value as CasePriority)} className={selectCls} disabled={isClosed}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className={labelCls}>Due Date</label><input type="date" value={draft.dueDate} onChange={e => upd('dueDate', e.target.value)} className={inputCls} disabled={isClosed} /></div>
          <div><label className={labelCls}>Auditor Notes</label><input value={draft.auditorNotes || ''} onChange={e => upd('auditorNotes', e.target.value)} placeholder="Instructions to owner..." className={inputCls} disabled={isClosed} /></div>
        </div>
        {caseItem.sourceExceptionId && <div className="text-[9px] text-gray-400">Source: Exception {caseItem.sourceExceptionId.slice(-8)}{caseItem.sourceWorkflowName ? ` · ${caseItem.sourceWorkflowName}` : ''}</div>}
        {!isClosed && <button onClick={() => { saveDraft(); }} className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-semibold cursor-pointer transition-colors">Save Case</button>}
      </div>

      {/* ── SECTION 2: Owner Response / Action Plan ── */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h5 className="text-[11px] font-bold text-text uppercase tracking-wider text-gray-500">Owner Response / Action Plan</h5>
        <p className="text-[9px] text-gray-400">To be filled by the risk/process owner.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Root Cause <span className="text-red-400">*</span></label><textarea value={draft.rootCause || ''} onChange={e => upd('rootCause', e.target.value)} rows={2} placeholder="What caused this issue?" className={inputCls + ' resize-none'} disabled={isClosed} /></div>
          <div className="col-span-2"><label className={labelCls}>Remediation Plan / Corrective Action <span className="text-red-400">*</span></label><textarea value={draft.remediationPlan || ''} onChange={e => upd('remediationPlan', e.target.value)} rows={2} placeholder="Planned corrective action..." className={inputCls + ' resize-none'} disabled={isClosed} /></div>
          <div className="col-span-2"><label className={labelCls}>Preventive Action</label><textarea value={draft.preventiveAction || ''} onChange={e => upd('preventiveAction', e.target.value)} rows={2} placeholder="Steps to prevent recurrence..." className={inputCls + ' resize-none'} disabled={isClosed} /></div>
          <div><label className={labelCls}>Remediation Owner <span className="text-red-400">*</span></label><input value={draft.remediationOwner || ''} onChange={e => upd('remediationOwner', e.target.value)} placeholder="Owner" className={inputCls} disabled={isClosed} /></div>
          <div><label className={labelCls}>Remediation Due Date <span className="text-red-400">*</span></label><input type="date" value={draft.remediationDueDate || ''} onChange={e => upd('remediationDueDate', e.target.value)} className={inputCls} disabled={isClosed} /></div>
        </div>

        {/* Evidence */}
        <div>
          <label className={labelCls}>Evidence ({caseItem.evidenceRefs.length})</label>
          {caseItem.evidenceRefs.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{caseItem.evidenceRefs.map((r, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] text-emerald-700">{r}</span>)}</div>}
          {!isClosed && (
            <div className="flex items-center gap-2">
              <input value={newEvRef} onChange={e => setNewEvRef(e.target.value)} placeholder="Evidence file ref..." className="flex-1 px-3 py-1.5 border border-border rounded-lg text-[11px] text-text bg-white outline-none focus:border-primary/40" />
              <button onClick={() => { if (newEvRef.trim()) { onAddEvidence(newEvRef.trim()); setNewEvRef(''); } }} disabled={!newEvRef.trim()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
            </div>
          )}
        </div>

        <div><label className={labelCls}>Owner Comments</label><input value={draft.comments} onChange={e => upd('comments', e.target.value)} placeholder="Notes..." className={inputCls} disabled={isClosed} /></div>

        {submitValidation && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-600">
            <AlertCircle size={10} /><span>{submitValidation}</span>
          </div>
        )}

        {!isClosed && !isSubmittedForReview && (
          <div className="flex items-center gap-2">
            <button onClick={() => { saveDraft(); }} className="px-3 py-1.5 rounded-lg border border-border-light text-[10px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Save Owner Response</button>
            <button onClick={submitOwnerResponse} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1"><Send size={10} />Submit Response to Auditor</button>
          </div>
        )}
        {isSubmittedForReview && <div className="flex items-center gap-2 text-[10px] text-purple-600"><CheckCircle2 size={11} /><span>Owner response submitted for auditor review.</span></div>}
      </div>

      {/* ── SECTION 3: Auditor Review & Closure ── */}
      <div className="rounded-lg border border-border-light p-4 space-y-3">
        <h5 className="text-[11px] font-bold text-text uppercase tracking-wider text-gray-500">Auditor Review & Closure</h5>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Closure Notes</label><input value={draft.closureNotes || ''} onChange={e => upd('closureNotes', e.target.value)} placeholder="Auditor review notes on closure..." className={inputCls} disabled={isClosed} /></div>
        </div>
        {!isClosed && (
          <div className="flex items-center gap-2">
            {isSubmittedForReview && (
              <>
                <button onClick={() => { onUpdate({ closureNotes: draft.closureNotes, status: 'CLOSED' as CaseStatus, history: [...caseItem.history, { id: `ch-${Date.now()}`, action: 'ACCEPTED_AND_CLOSED', actor: engagement.owner, timestamp: now(), comments: '' }] }); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1"><CheckCircle2 size={10} />Accept & Close</button>
                <button onClick={() => { onUpdate({ closureNotes: draft.closureNotes, status: 'IN_PROGRESS' as CaseStatus, remediationStatus: 'REJECTED' as RemediationStatus, history: [...caseItem.history, { id: `ch-${Date.now()}`, action: 'REJECTED_SENT_BACK', actor: engagement.owner, timestamp: now(), comments: '' }] }); }} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-semibold cursor-pointer transition-colors">Reject / Send Back</button>
              </>
            )}
            <button onClick={() => { onUpdate({ closureNotes: draft.closureNotes, status: 'CANCELLED' as CaseStatus, history: [...caseItem.history, { id: `ch-${Date.now()}`, action: 'CLOSED_NOT_REQUIRED', actor: engagement.owner, timestamp: now(), comments: '' }] }); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-[10px] font-medium text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">Close as Not Required</button>
          </div>
        )}
        {caseItem.status === 'CLOSED' && <div className="flex items-center gap-2 text-[10px] text-emerald-600"><CheckCircle2 size={11} /><span>Accepted and closed by auditor.{caseItem.closureNotes ? ` — ${caseItem.closureNotes}` : ''}</span></div>}
        {caseItem.status === 'CANCELLED' && <div className="text-[10px] text-gray-500">Closed as not required.{caseItem.closureNotes ? ` — ${caseItem.closureNotes}` : ''}</div>}
      </div>

      {/* History */}
      {caseItem.history.length > 0 && (
        <div><h6 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">History</h6>
          <div className="space-y-1">{caseItem.history.map(h => <div key={h.id} className="text-[9px] text-gray-500"><span className="font-semibold text-text">{h.action.replace(/_/g, ' ')}</span> by {h.actor} · {h.timestamp}{h.comments ? ` — ${h.comments}` : ''}</div>)}</div>
        </div>
      )}

      {/* Close button */}
      <div className="flex justify-end"><button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border-light text-[11px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors">Close Panel</button></div>
    </div>
  );
}
