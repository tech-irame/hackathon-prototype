import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Upload, Sparkles,
  ChevronRight, ChevronDown,
  ArrowLeft, ArrowRight,
  Building2, Briefcase, Calendar, Users,
  FileText, CheckCircle2, AlertTriangle, X, Eye, Loader2,
} from 'lucide-react';
import { BUSINESS_PROCESSES, SOPS, RACMS, RISKS, CONTROLS, WORKFLOWS, ENGAGEMENTS } from '../../data/mockData';
import { CardContainer, CardBody, CardItem } from '../shared/3DCard';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import RacmListTable from './RacmListTable';
import RiskRegister from './RiskRegister';
import ControlLibraryView from '../governance/ControlLibraryView';
import WorkflowLibraryView from '../workflow/WorkflowLibraryView';

interface Props {
  selectedBPId: string | null;
  onSelectBP: (id: string | null) => void;
  onOpenEngagement?: (engagementId: string) => void;
}

type HubTabId = 'engagements' | 'business-processes';

const HUB_TABS: { id: HubTabId; label: string; icon: React.ElementType }[] = [
  { id: 'engagements',        label: 'Engagements',       icon: Briefcase },
  { id: 'business-processes', label: 'Business processes', icon: Building2 },
];


// ─── SOP Types & Extraction Mock Data ─────────────────────────────────────

type SOPStatus = 'Uploaded' | 'Processing' | 'Ready for Review' | 'Partial' | 'Processed' | 'Failed' | 'Archived';

// ─── SOP Status Display ───────────────────────────────────────────────────

const SOP_STATUS_STYLES: Record<SOPStatus, string> = {
  'Uploaded': 'bg-gray-100 text-gray-500',
  'Processing': 'bg-gray-100 text-gray-600',
  'Ready for Review': 'bg-amber-50/80 text-amber-600',
  'Partial': 'bg-amber-50/60 text-amber-500',
  'Processed': 'bg-emerald-50/80 text-emerald-600',
  'Failed': 'bg-red-50/60 text-red-500',
  'Archived': 'bg-gray-50 text-gray-400',
};

interface SOPAction {
  label: string;
  cls: string;
}

function getSOPAction(status: SOPStatus, hasRacm: boolean): SOPAction {
  switch (status) {
    case 'Uploaded':         return { label: 'Start Processing',  cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Processing':       return { label: 'View Progress',     cls: 'bg-gray-100 text-gray-500 hover:bg-gray-200/70' };
    case 'Ready for Review': return { label: 'Create RACM',       cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Partial':          return { label: 'Create RACM',       cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Processed':        return { label: 'Create RACM',       cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
    case 'Failed':           return { label: 'Retry',             cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200/70' };
    case 'Archived':         return { label: 'View SOP',          cls: 'bg-gray-50 text-gray-400 hover:bg-gray-100' };
  }
}

interface ExtractedRisk {
  id: string;
  name: string;
  description: string;
  section: string;
  confidence: 'high' | 'medium' | 'low';
  accepted: boolean;
}

interface ExtractedControl {
  id: string;
  name: string;
  description: string;
  linkedRiskId: string;
  type: 'Preventive' | 'Detective' | 'Corrective';
  section: string;
  confidence: 'high' | 'medium' | 'low';
  accepted: boolean;
}

interface LocalSOP {
  id: string;
  name: string;
  fileName: string;
  version: string;
  description: string;
  businessProcess: string;
  uploadedBy: string;
  uploadedAt: string;
  status: SOPStatus;
  progress: number;
  processingStep: number; // 0-6 index into PROCESSING_STEPS
  risks: number;
  controls: number;
  racmId: string | null;
  racmName: string | null;
  failureReason: string | null;
  extractedRisks: ExtractedRisk[];
  extractedControls: ExtractedControl[];
}

const FAILURE_REASONS = [
  'Unsupported file format — only PDF, DOCX, and XLSX are supported.',
  'File is unreadable — the document may be corrupted or password-protected.',
  'Processing timeout — the document is too large or complex. Try splitting into smaller sections.',
  'No process content detected — the document does not appear to contain standard operating procedures.',
] as const;

// Determine if extraction is partial (incomplete)
function isPartialExtraction(sop: LocalSOP): boolean {
  const risks = sop.extractedRisks || [];
  const ctrls = sop.extractedControls || [];
  const hasRisks = risks.length > 0;
  const hasControls = ctrls.length > 0;
  const lowConfidence = [...risks, ...ctrls].filter(x => x.confidence === 'low').length;
  const total = risks.length + ctrls.length;
  // Partial if: risks but no controls, controls but no risks, or >40% low confidence
  if (hasRisks && !hasControls) return true;
  if (!hasRisks && hasControls) return true;
  if (total > 0 && lowConfidence / total > 0.4) return true;
  return false;
}

function getPartialWarnings(sop: LocalSOP): string[] {
  const risks = sop.extractedRisks || [];
  const ctrls = sop.extractedControls || [];
  const warnings: string[] = [];
  if (risks.length === 0) warnings.push('No risks were extracted from the document.');
  if (ctrls.length === 0) warnings.push('No control references were extracted.');
  const lowRisks = risks.filter(r => r.confidence === 'low').length;
  const lowCtrls = ctrls.filter(c => c.confidence === 'low').length;
  if (lowRisks > 0) warnings.push(`${lowRisks} risk${lowRisks > 1 ? 's have' : ' has'} low extraction confidence.`);
  if (lowCtrls > 0) warnings.push(`${lowCtrls} control reference${lowCtrls > 1 ? 's have' : ' has'} low extraction confidence.`);
  const unclearSections = [...risks, ...ctrls].filter(x => x.section === 'Unclear' || x.section === '').length;
  if (unclearSections > 0) warnings.push(`${unclearSections} item${unclearSections > 1 ? 's have' : ' has'} unclear source sections.`);
  return warnings;
}

// ─── Processing Steps ─────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { label: 'File uploaded', description: 'Document received and queued' },
  { label: 'Reading document', description: 'Reading SOP structure' },
  { label: 'Identifying activities', description: 'Identifying activities and control points' },
  { label: 'Extracting risks', description: 'Drafting risks from SOP' },
  { label: 'Extracting controls', description: 'Drafting control references' },
  { label: 'Building RACM structure', description: 'Preparing RACM draft' },
  { label: 'Ready for review', description: 'Ready for user review' },
] as const;

type StepState = 'pending' | 'in-progress' | 'completed' | 'failed';

function getStepState(stepIndex: number, currentStep: number, failed: boolean): StepState {
  if (failed && stepIndex === currentStep) return 'failed';
  if (stepIndex < currentStep) return 'completed';
  if (stepIndex === currentStep) return 'in-progress';
  return 'pending';
}

const STEP_STATE_STYLES: Record<StepState, { dot: string; text: string; line: string }> = {
  'completed':   { dot: 'bg-gray-400 text-white', text: 'text-gray-500', line: 'bg-gray-300' },
  'in-progress': { dot: 'bg-gray-600 text-white ring-2 ring-gray-200', text: 'text-gray-700 font-semibold', line: 'bg-gray-200' },
  'pending':     { dot: 'bg-gray-200 text-gray-400', text: 'text-gray-400', line: 'bg-gray-200' },
  'failed':      { dot: 'bg-red-400 text-white', text: 'text-red-500', line: 'bg-gray-200' },
};

function ProcessingStepperPanel({ sop }: { sop: LocalSOP }) {
  const isFailed = sop.status === 'Failed';
  const progressPct = Math.round((sop.processingStep / (PROCESSING_STEPS.length - 1)) * 100);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }} className="overflow-hidden">
      <div className="px-4 py-4 bg-surface-2/30 border-t border-border/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-text-muted">Processing: {sop.name}</span>
          <span className="text-[11px] font-bold text-text tabular-nums">{progressPct}%</span>
        </div>
        <div className="space-y-0">
          {PROCESSING_STEPS.map((step, idx) => {
            const state = getStepState(idx, sop.processingStep, isFailed);
            const styles = STEP_STATE_STYLES[state];
            const isLast = idx === PROCESSING_STEPS.length - 1;
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${styles.dot}`}>
                    {state === 'completed' && <CheckCircle2 size={10} />}
                    {state === 'in-progress' && <Loader2 size={10} className="animate-spin" />}
                    {state === 'failed' && <X size={10} />}
                    {state === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                  </div>
                  {!isLast && <div className={`w-0.5 h-5 ${styles.line}`} />}
                </div>
                <div className={`pt-0.5 pb-3 ${styles.text}`}>
                  <div className="text-[11px] leading-tight">{step.label}</div>
                  {state === 'in-progress' && <div className="text-[10px] text-gray-400 mt-0.5">{step.description}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function buildMockExtractions(): { risks: ExtractedRisk[]; controls: ExtractedControl[] } {
  const risks: ExtractedRisk[] = [
    { id: 'ext-r1', name: 'Unauthorized vendor payments without PO', description: 'Payments may be processed without a valid purchase order, leading to financial loss.', section: '§3.2 Payment Authorization', confidence: 'high', accepted: true },
    { id: 'ext-r2', name: 'Duplicate invoice submission', description: 'Same invoice could be submitted and paid twice due to weak detection.', section: '§4.1 Invoice Processing', confidence: 'high', accepted: true },
    { id: 'ext-r3', name: 'Vendor master data manipulation', description: 'Unauthorized changes to vendor bank details could enable fraudulent payments.', section: '§2.3 Vendor Management', confidence: 'medium', accepted: true },
    { id: 'ext-r4', name: 'Threshold bypass for approvals', description: 'High-value transactions processed without required dual authorization.', section: '§3.4 Approval Matrix', confidence: 'medium', accepted: false },
    { id: 'ext-r5', name: 'Segregation of duties violation', description: 'Same user creates and approves payment transactions.', section: '§5.1 Access Controls', confidence: 'high', accepted: true },
  ];
  const controls: ExtractedControl[] = [
    { id: 'ext-c1', name: 'Three-way PO/GRN/Invoice match', description: 'System enforces matching before payment release.', linkedRiskId: 'ext-r1', type: 'Preventive', section: '§3.2 Payment Authorization', confidence: 'high', accepted: true },
    { id: 'ext-c2', name: 'Duplicate invoice detection scan', description: 'Automated scan against historical invoices before processing.', linkedRiskId: 'ext-r2', type: 'Detective', section: '§4.1 Invoice Processing', confidence: 'high', accepted: true },
    { id: 'ext-c3', name: 'Vendor change multi-level approval', description: 'Multi-level approval for vendor master data changes.', linkedRiskId: 'ext-r3', type: 'Preventive', section: '§2.3 Vendor Management', confidence: 'medium', accepted: true },
    { id: 'ext-c4', name: 'High-value payment flagging', description: 'Automatic flagging for payments above threshold.', linkedRiskId: 'ext-r1', type: 'Preventive', section: '§3.4 Approval Matrix', confidence: 'medium', accepted: false },
    { id: 'ext-c5', name: 'SOD conflict detection', description: 'Real-time detection of segregation of duties violations.', linkedRiskId: 'ext-r5', type: 'Detective', section: '§5.1 Access Controls', confidence: 'high', accepted: true },
  ];
  return { risks, controls };
}

function buildPartialExtractions(): { risks: ExtractedRisk[]; controls: ExtractedControl[] } {
  const risks: ExtractedRisk[] = [
    { id: 'ext-p-r1', name: 'Potential unauthorized access', description: 'Document references access controls but details are unclear.', section: 'Unclear', confidence: 'low', accepted: true },
    { id: 'ext-p-r2', name: 'Data integrity risk', description: 'Manual data entry processes may lead to errors.', section: '§2.1 Data Entry', confidence: 'medium', accepted: true },
    { id: 'ext-p-r3', name: 'Process gap identified', description: 'The document mentions a review step but no details on frequency or ownership.', section: '§4.3 Review', confidence: 'low', accepted: false },
  ];
  // No controls extracted — partial
  return { risks, controls: [] };
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-gray-100 text-gray-500',
};

// ─── SOP Extraction Review Workspace (inline, replaces SOP table) ─────────

function ExtractionReviewWorkspace({ sop, onBack, onAccept, onUpdateRisks, onUpdateControls }: {
  sop: LocalSOP;
  onBack: () => void;
  onAccept: (racmName: string) => void;
  onUpdateRisks: (risks: ExtractedRisk[]) => void;
  onUpdateControls: (controls: ExtractedControl[]) => void;
}) {
  const { addToast } = useToast();
  const isPartial = sop.status === 'Partial' || isPartialExtraction(sop);
  const partialWarnings = isPartial ? getPartialWarnings(sop) : [];
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const defaultRacmName = `FY26 ${sop.businessProcess} — ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;
  const [racmName, setRacmName] = useState(defaultRacmName);

  const [summary, setSummary] = useState(
    `This SOP describes the ${sop.businessProcess} process for ${sop.name.replace(' SOP', '')}. ` +
    `AI extraction identified ${(sop.extractedRisks || []).length} potential risks and ${(sop.extractedControls || []).length} control references ` +
    `across ${new Set((sop.extractedRisks || []).map(r => r.section)).size} document sections.`
  );
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [editingCtrlId, setEditingCtrlId] = useState<string | null>(null);
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [showAddCtrl, setShowAddCtrl] = useState(false);

  // Inline add risk form state
  const [newRiskName, setNewRiskName] = useState('');
  const [newRiskDesc, setNewRiskDesc] = useState('');
  const [newRiskSection, setNewRiskSection] = useState('');

  // Inline add control ref form state
  const [newCtrlName, setNewCtrlName] = useState('');
  const [newCtrlDesc, setNewCtrlDesc] = useState('');
  const [newCtrlRiskId, setNewCtrlRiskId] = useState('');
  const [newCtrlType, setNewCtrlType] = useState<'Preventive' | 'Detective' | 'Corrective'>('Preventive');
  const [newCtrlSection, setNewCtrlSection] = useState('');

  const risks = sop.extractedRisks || [];
  const controls = sop.extractedControls || [];
  const activeRisks = risks.filter(r => r.accepted);

  const handleRemoveRisk = (id: string) => {
    onUpdateRisks(risks.filter(r => r.id !== id));
    addToast({ message: 'Risk removed', type: 'info' });
  };

  const handleRemoveControl = (id: string) => {
    onUpdateControls(controls.filter(c => c.id !== id));
    addToast({ message: 'Control reference removed', type: 'info' });
  };

  const handleEditRisk = (id: string, field: keyof ExtractedRisk, value: string) => {
    onUpdateRisks(risks.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleEditControl = (id: string, field: keyof ExtractedControl, value: string) => {
    onUpdateControls(controls.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddRisk = () => {
    if (!newRiskName.trim()) return;
    const newRisk: ExtractedRisk = {
      id: `ext-r-new-${Date.now()}`, name: newRiskName.trim(), description: newRiskDesc.trim(),
      section: newRiskSection.trim() || 'Manual entry', confidence: 'medium', accepted: true,
    };
    onUpdateRisks([...risks, newRisk]);
    setNewRiskName(''); setNewRiskDesc(''); setNewRiskSection(''); setShowAddRisk(false);
    addToast({ message: `Risk "${newRisk.name}" added`, type: 'success' });
  };

  const handleAddControl = () => {
    if (!newCtrlName.trim()) return;
    const newCtrl: ExtractedControl = {
      id: `ext-c-new-${Date.now()}`, name: newCtrlName.trim(), description: newCtrlDesc.trim(),
      linkedRiskId: newCtrlRiskId, type: newCtrlType, section: newCtrlSection.trim() || 'Manual entry',
      confidence: 'medium', accepted: true,
    };
    onUpdateControls([...controls, newCtrl]);
    setNewCtrlName(''); setNewCtrlDesc(''); setNewCtrlRiskId(''); setNewCtrlSection(''); setShowAddCtrl(false);
    addToast({ message: `Control reference "${newCtrl.name}" added`, type: 'success' });
  };

  const fieldCls = 'w-full px-2 py-1.5 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to SOP List
        </button>
        <div className="bg-white rounded-xl border border-border-light p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-text">{sop.name}</h2>
                <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">{sop.version}</span>
                <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[11px] text-gray-500">
                <span>Uploaded by {sop.uploadedBy} · {sop.uploadedAt}</span>
                <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{sop.businessProcess}</span>
              </div>
            </div>
            <button onClick={() => setShowConfirmModal(true)} disabled={activeRisks.length === 0 || (isPartial && !partialConfirmed)}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
              <FileText size={13} />Create Draft RACM
            </button>
          </div>

          {/* Partial extraction warning */}
          {isPartial && partialWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 mt-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-amber-800">Incomplete extraction — review required</div>
                  <p className="text-[11px] text-amber-700/80 mt-0.5">Some information could not be extracted confidently. Review and complete missing items before creating RACM.</p>
                  <ul className="mt-2 space-y-0.5">
                    {partialWarnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-amber-700/70 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" checked={partialConfirmed} onChange={e => setPartialConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-amber-300 text-amber-600 accent-amber-600 cursor-pointer" />
                    <span className="text-[11px] font-medium text-amber-800">I have reviewed the gaps and want to proceed</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-surface-2/50 border border-border/50">
              <div className="text-lg font-bold text-text">{activeRisks.length}</div>
              <div className="text-[10px] text-text-muted">Accepted Risks</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-2/50 border border-border/50">
              <div className="text-lg font-bold text-text">{controls.filter(c => c.accepted).length}</div>
              <div className="text-[10px] text-text-muted">Control References</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface-2/50 border border-border/50">
              <div className="text-lg font-bold text-gray-400">{risks.length - activeRisks.length + controls.length - controls.filter(c => c.accepted).length}</div>
              <div className="text-[10px] text-text-muted">Removed</div>
            </div>
          </div>

          {/* Linked RACM traceability (SOP → RACM) */}
          {sop.racmId && (
            <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/20 px-4 py-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileText size={12} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-text">{sop.racmName || sop.racmId}</span>
                      <span className="px-1.5 h-4 rounded text-[8px] font-bold bg-gray-100 text-gray-600">Draft</span>
                      <span className="px-1.5 h-4 rounded text-[8px] font-bold bg-amber-50 text-amber-600">Needs Mapping</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {sop.risks} risks · {sop.controls} control references · Created from this SOP
                    </div>
                  </div>
                </div>
                <button onClick={onBack}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200/70 cursor-pointer transition-colors inline-flex items-center gap-1">
                  View RACM<ChevronRight size={8} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary — editable */}
      <div className="bg-white rounded-xl border border-border-light p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary/60" />SOP Summary
          </h3>
          <button onClick={() => setEditingSummary(!editingSummary)} className="text-[10px] font-medium text-primary hover:underline cursor-pointer">
            {editingSummary ? 'Done' : 'Edit'}
          </button>
        </div>
        {editingSummary ? (
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-[12px] text-text bg-white outline-none focus:border-primary/40 resize-none" />
        ) : (
          <p className="text-[12px] text-text-secondary leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Extracted Risks Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-text">Extracted Risks ({risks.length})</h3>
          <button onClick={() => setShowAddRisk(true)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />Add Missing Risk
          </button>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  {['Risk Name', 'Description', 'Process', 'Source Section', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id} className={`border-b border-border/50 transition-colors ${risk.accepted ? 'hover:bg-gray-50/60' : 'bg-gray-50/30 opacity-50'}`}>
                    <td className="px-3 py-2.5">
                      {editingRiskId === risk.id ? (
                        <input value={risk.name} onChange={e => handleEditRisk(risk.id, 'name', e.target.value)} className={fieldCls} autoFocus />
                      ) : (
                        <span className="text-[12px] font-medium text-text">{risk.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      {editingRiskId === risk.id ? (
                        <input value={risk.description} onChange={e => handleEditRisk(risk.id, 'description', e.target.value)} className={fieldCls} />
                      ) : (
                        <span className="text-[11px] text-gray-500 line-clamp-2">{risk.description}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{sop.businessProcess}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] text-gray-400 font-mono">{risk.section}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center ${CONFIDENCE_STYLES[risk.confidence]}`}>{risk.confidence}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingRiskId(editingRiskId === risk.id ? null : risk.id)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary cursor-pointer" title="Edit">
                          <Eye size={11} />
                        </button>
                        <button onClick={() => handleRemoveRisk(risk.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer" title="Remove">
                          <X size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Add risk inline form */}
                {showAddRisk && (
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="px-3 py-2"><input value={newRiskName} onChange={e => setNewRiskName(e.target.value)} placeholder="Risk name" className={fieldCls} autoFocus /></td>
                    <td className="px-3 py-2"><input value={newRiskDesc} onChange={e => setNewRiskDesc(e.target.value)} placeholder="Description" className={fieldCls} /></td>
                    <td className="px-3 py-2"><span className="text-[10px] text-gray-400">{sop.businessProcess}</span></td>
                    <td className="px-3 py-2"><input value={newRiskSection} onChange={e => setNewRiskSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-3 py-2"><span className="text-[9px] text-gray-400">Manual</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={handleAddRisk} disabled={!newRiskName.trim()} className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button onClick={() => { setShowAddRisk(false); setNewRiskName(''); setNewRiskDesc(''); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 cursor-pointer"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Extracted Control References Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-[13px] font-semibold text-text">Extracted Control References ({controls.length})</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">References only — actual controls will be created in the Control Library after RACM review.</p>
          </div>
          <button onClick={() => setShowAddCtrl(true)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1">
            <Plus size={11} />Add Missing Reference
          </button>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  {['Control Reference', 'Related Risk', 'Process', 'Source Section', 'Type', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controls.map(ctrl => {
                  const linkedRisk = risks.find(r => r.id === ctrl.linkedRiskId);
                  return (
                    <tr key={ctrl.id} className={`border-b border-border/50 transition-colors ${ctrl.accepted ? 'hover:bg-gray-50/60' : 'bg-gray-50/30 opacity-50'}`}>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        {editingCtrlId === ctrl.id ? (
                          <input value={ctrl.name} onChange={e => handleEditControl(ctrl.id, 'name', e.target.value)} className={fieldCls} autoFocus />
                        ) : (
                          <span className="text-[12px] font-medium text-text">{ctrl.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] text-gray-500">{linkedRisk?.name || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{sop.businessProcess}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] text-gray-400 font-mono">{ctrl.section || '—'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 h-4 rounded text-[8px] font-bold bg-gray-100 text-gray-500 inline-flex items-center">{ctrl.type}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center ${CONFIDENCE_STYLES[ctrl.confidence]}`}>{ctrl.confidence}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditingCtrlId(editingCtrlId === ctrl.id ? null : ctrl.id)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary cursor-pointer" title="Edit">
                            <Eye size={11} />
                          </button>
                          <button onClick={() => handleRemoveControl(ctrl.id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer" title="Remove">
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Add control ref inline form */}
                {showAddCtrl && (
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="px-3 py-2"><input value={newCtrlName} onChange={e => setNewCtrlName(e.target.value)} placeholder="Control reference" className={fieldCls} autoFocus /></td>
                    <td className="px-3 py-2">
                      <select value={newCtrlRiskId} onChange={e => setNewCtrlRiskId(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                        <option value="">Select risk...</option>
                        {activeRisks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2"><span className="text-[10px] text-gray-400">{sop.businessProcess}</span></td>
                    <td className="px-3 py-2"><input value={newCtrlSection} onChange={e => setNewCtrlSection(e.target.value)} placeholder="Section" className={fieldCls} /></td>
                    <td className="px-3 py-2">
                      <select value={newCtrlType} onChange={e => setNewCtrlType(e.target.value as any)} className={fieldCls + ' cursor-pointer appearance-none'}>
                        <option value="Preventive">Preventive</option>
                        <option value="Detective">Detective</option>
                        <option value="Corrective">Corrective</option>
                      </select>
                    </td>
                    <td className="px-3 py-2"><span className="text-[9px] text-gray-400">Manual</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={handleAddControl} disabled={!newCtrlName.trim()} className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer disabled:opacity-40"><CheckCircle2 size={11} /></button>
                        <button onClick={() => { setShowAddCtrl(false); setNewCtrlName(''); setNewCtrlDesc(''); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 cursor-pointer"><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Draft RACM Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[480px]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-text">Create Draft RACM from SOP</h2>
                    <p className="text-[12px] text-text-muted mt-0.5">Review the summary below before creating the draft RACM.</p>
                  </div>
                  <button onClick={() => setShowConfirmModal(false)} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
                </div>

                {/* Summary */}
                <div className="px-6 py-5 space-y-4">
                  {/* Source SOP */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Source SOP</span>
                      <span className="text-[13px] text-text font-medium mt-0.5 block">{sop.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Business Process</span>
                      <span className="text-[13px] text-text mt-0.5 block">{sop.businessProcess}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Risks to create</span>
                      <span className="text-[13px] text-text font-semibold mt-0.5 block">{activeRisks.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Control references</span>
                      <span className="text-[13px] text-text font-semibold mt-0.5 block">{controls.filter(c => c.accepted).length}</span>
                    </div>
                  </div>

                  {/* RACM Name */}
                  <div>
                    <label className="text-[12px] font-semibold text-text-muted block mb-1.5">RACM Name</label>
                    <input value={racmName} onChange={e => setRacmName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
                  </div>

                  {/* What will happen */}
                  <div className="rounded-lg bg-surface-2/50 border border-border/50 px-4 py-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-text-muted">What will happen:</div>
                    <ul className="space-y-1">
                      {[
                        'RACM created in Draft status (not Active)',
                        `${activeRisks.length} extracted risks linked to RACM`,
                        `${controls.filter(c => c.accepted).length} control references preserved (not mapped to Control Library)`,
                        'Source SOP sections preserved for traceability',
                        'RACM readiness set to "Needs Mapping"',
                        'SOP linked to the created RACM',
                      ].map((item, i) => (
                        <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                          <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* What will NOT happen */}
                  <div className="rounded-lg bg-gray-50 border border-border/30 px-4 py-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-gray-500">What will NOT happen:</div>
                    <ul className="space-y-1">
                      {[
                        'Controls will not be created in Control Library',
                        'Workflows will not be linked',
                        'RACM will not be validated or activated',
                      ].map((item, i) => (
                        <li key={i} className="text-[11px] text-gray-400 flex items-start gap-1.5">
                          <X size={10} className="text-gray-300 shrink-0 mt-0.5" />{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
                  <button onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
                  <button onClick={() => { setShowConfirmModal(false); onAccept(racmName); }} disabled={!racmName.trim()}
                    className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
                    <FileText size={13} />Create Draft RACM
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Upload SOP Drawer ────────────────────────────────────────────────────

interface UploadSOPData {
  name: string;
  version: string;
  description: string;
  fileName: string;
}

function UploadSOPDrawer({ bpAbbr, onClose, onUploadAndProcess, onSaveAsDraft }: {
  bpAbbr: string;
  onClose: () => void;
  onUploadAndProcess: (data: UploadSOPData) => void;
  onSaveAsDraft: (data: UploadSOPData) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const now = new Date();
  const uploadDate = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleFile = (file: File) => {
    setFileName(file.name);
    if (!name) {
      setName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
    }
  };

  const isValid = name.trim() && fileName;

  const buildData = (): UploadSOPData => ({ name: name.trim(), version: 'v1.0', description: description.trim(), fileName });

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
  const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">

        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">Upload SOP</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">Upload a process document and define metadata.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* File Upload */}
          <div>
            <label className={labelCls}>Document <span className="text-red-400">*</span></label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.docx,.xlsx,.doc,.xls,.csv';
                input.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
                input.click();
              }}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary bg-primary/5' : fileName ? 'border-emerald-300 bg-emerald-50/30' : 'border-border hover:border-gray-300'
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-emerald-600" />
                  <span className="text-[12px] font-medium text-emerald-700">{fileName}</span>
                  <button onClick={e => { e.stopPropagation(); setFileName(''); }} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <Upload size={18} className={`mx-auto mb-1.5 ${dragOver ? 'text-primary' : 'text-gray-300'}`} />
                  <div className="text-[12px] text-text-muted">Drag & drop or click to browse</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">PDF, DOCX, XLSX, CSV</div>
                </>
              )}
            </div>
          </div>

          {/* SOP Name */}
          <div>
            <label className={labelCls}>SOP Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Auto-filled from file name" className={fieldCls} />
          </div>

          {/* Business Process (read-only) */}
          <div>
            <label className={labelCls}>Business Process</label>
            <div className="px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-gray-50 cursor-not-allowed">{bpAbbr}</div>
          </div>



          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Brief description of the SOP scope..." className={fieldCls + ' resize-none'} />
          </div>

        </div>

        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => { if (isValid) onUploadAndProcess(buildData()); }} disabled={!isValid}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Upload & Process
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── SOP Preview Drawer ──────────────────────────────────────────────────

function SOPPreviewDrawer({ sop, onClose, onGoToRacm }: { sop: LocalSOP; onClose: () => void; onGoToRacm?: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[17px] font-semibold text-ink-900">{sop.name}</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">SOP Preview</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><span className="text-[10px] text-gray-400 uppercase block">Uploaded By</span><span className="text-[13px] text-text mt-0.5 block">{sop.uploadedBy}</span></div>
            <div><span className="text-[10px] text-gray-400 uppercase block">Upload Date</span><span className="text-[13px] text-text mt-0.5 block">{sop.uploadedAt}</span></div>
            <div><span className="text-[10px] text-gray-400 uppercase block">Business Process</span><span className="text-[13px] text-text mt-0.5 block">{sop.businessProcess}</span></div>
            <div><span className="text-[10px] text-gray-400 uppercase block">Version</span><span className="text-[13px] text-text mt-0.5 font-mono block">{sop.version}</span></div>
            <div><span className="text-[10px] text-gray-400 uppercase block">Status</span><span className={`mt-0.5 px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>{sop.status}</span></div>
            <div><span className="text-[10px] text-gray-400 uppercase block">File</span><span className="text-[13px] text-text mt-0.5 block">{sop.fileName}</span></div>
          </div>
          {/* Description */}
          {sop.description && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase block mb-1">Description</span>
              <p className="text-[13px] text-text-secondary leading-relaxed">{sop.description}</p>
            </div>
          )}
          {/* Source file placeholder */}
          <div>
            <span className="text-[10px] text-gray-400 uppercase block mb-2">Document Preview</span>
            <div className="rounded-lg border border-border bg-gray-50 p-8 text-center">
              <FileText size={24} className="mx-auto text-gray-300 mb-2" />
              <div className="text-[12px] text-gray-400">Document preview not available in prototype</div>
              <div className="text-[10px] text-gray-300 mt-1">{sop.fileName}</div>
            </div>
          </div>
          {/* Extraction summary */}
          {(sop.risks > 0 || sop.controls > 0) && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase block mb-2">Extraction Summary</span>
              <div className="flex gap-4">
                <div className="text-center p-3 rounded-lg bg-surface-2/50 border border-border/50 flex-1">
                  <div className="text-lg font-bold text-text">{sop.risks}</div>
                  <div className="text-[10px] text-text-muted">Risks Extracted</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-2/50 border border-border/50 flex-1">
                  <div className="text-lg font-bold text-text">{sop.controls}</div>
                  <div className="text-[10px] text-text-muted">Control References</div>
                </div>
              </div>
            </div>
          )}
          {/* Linked RACM */}
          {sop.racmId && (
            <div>
              <span className="text-[10px] text-gray-400 uppercase block mb-2">Linked RACM</span>
              <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-text">{sop.racmName || sop.racmId}</span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">{sop.risks} risks · {sop.controls} control references</span>
                </div>
                {onGoToRacm && (
                  <button onClick={() => { onClose(); onGoToRacm(); }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">
                    View RACM
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border">
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Create RACM from SOP Modal ──────────────────────────────────────────

const RACM_AUDIT_TYPES = ['IFC', 'Internal Audit', 'Operational Audit', 'Concurrent Audit', 'ITGC'];
const RACM_FY_OPTIONS = ['FY25', 'FY26', 'FY27'];
const RACM_FRAMEWORKS = ['SOX ICFR', 'ISO 27001', 'Internal Policy', 'Custom'];

function CreateRacmFromSOPModal({ sopName, bpAbbr, onClose, onCreate }: {
  sopName: string;
  bpAbbr: string;
  onClose: () => void;
  onCreate: (racmName: string, framework: string) => void;
}) {
  const defaultName = `FY26 ${bpAbbr} — ${sopName.replace(/\s*SOP\s*/i, '').trim()}`;
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [auditType, setAuditType] = useState('');
  const [financialYear, setFinancialYear] = useState('FY26');
  const [framework, setFramework] = useState('');
  const [owner, setOwner] = useState('Current User');

  const isValid = name.trim().length > 0 && auditType !== '' && financialYear !== '' && owner.trim().length > 0;
  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
  const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[480px] flex flex-col" onClick={e => e.stopPropagation()}>

          <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
            <div>
              <h2 className="font-display text-[18px] font-semibold text-ink-900">Create RACM</h2>
              <p className="text-[12px] text-ink-500 mt-0.5">Create a Risk & Control Matrix from "{sopName}".</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ maxHeight: 480 }}>
            {/* Section 1: Basic Info */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Basic Info</h3>
              <div>
                <label className={labelCls}>RACM Name <span className="text-red-400">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY26 P2P — Vendor Payment" className={fieldCls} autoFocus />
              </div>
              <div>
                <label className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief description of scope..." className={fieldCls + ' resize-none'} />
              </div>
            </div>

            {/* Section 2: Audit Context */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Audit Context</h3>
              <div>
                <label className={labelCls}>Business Process</label>
                <div className="px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-gray-50 cursor-not-allowed">{bpAbbr}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Audit Type <span className="text-red-400">*</span></label>
                  <select value={auditType} onChange={e => setAuditType(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                    <option value="">Select audit type...</option>
                    {RACM_AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Financial Year <span className="text-red-400">*</span></label>
                  <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                    {RACM_FY_OPTIONS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Framework <span className="font-normal text-ink-400">(optional)</span></label>
                <select value={framework} onChange={e => setFramework(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                  <option value="">Select framework...</option>
                  {RACM_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Section 3: Ownership */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ownership</h3>
              <div>
                <label className={labelCls}>RACM Owner <span className="text-red-400">*</span></label>
                <input value={owner} onChange={e => setOwner(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
            <button onClick={() => { if (isValid) onCreate(name.trim(), framework || auditType); }} disabled={!isValid}
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              Create RACM
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ─── SOP Tab Content Component ────────────────────────────────────────────

function SOPTabContent({ bpId, bpAbbr, existingSops, existingRacms, onGoToRacm, onRacmCreated }: {
  bpId: string;
  bpAbbr: string;
  existingSops: typeof SOPS;
  existingRacms: typeof RACMS;
  onGoToRacm: () => void;
  onRacmCreated?: (racmId: string, racmName: string, process: string, framework: string) => void;
}) {
  const { addToast } = useToast();

  // Local SOP state (seed from mock + allow new uploads)
  const [localSops, setLocalSops] = useState<LocalSOP[]>(() =>
    existingSops.map((s, idx) => ({
      id: s.id, name: s.name, fileName: `${s.name.replace(/\s+/g, '_')}.pdf`, version: s.version,
      description: '', businessProcess: bpAbbr,
      uploadedBy: s.by, uploadedAt: s.at,
      status: (s.racmId ? 'Processed' : idx % 3 === 0 ? 'Processed' : 'Uploaded') as SOPStatus,
      progress: s.racmId ? 100 : 0, processingStep: s.racmId ? 6 : 0,
      risks: s.risks, controls: s.controls, racmId: s.racmId, racmName: s.racmId ? `FY26 ${bpAbbr} — ${s.name.replace(/\s*SOP\s*/i, '').trim()}` : null, failureReason: null,
      extractedRisks: s.racmId ? [] : buildMockExtractions().risks,
      extractedControls: s.racmId ? [] : buildMockExtractions().controls,
    }))
  );

  const [reviewingSopId, setReviewingSopId] = useState<string | null>(null);
  const [previewingSopId, setPreviewingSopId] = useState<string | null>(null);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [showCreateRacmForSopId, setShowCreateRacmForSopId] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState<{ data: UploadSOPData; startProcessing: boolean; existing: LocalSOP } | null>(null);

  const reviewingSop = reviewingSopId ? localSops.find(s => s.id === reviewingSopId) : null;

  // Check for duplicate before creating
  const handleUploadIntent = useCallback((data: UploadSOPData, startProcessing: boolean) => {
    const nameLower = data.name.trim().toLowerCase();
    const existing = localSops.find(s => s.name.toLowerCase() === nameLower && s.status !== 'Archived');
    if (existing) {
      setVersionConflict({ data, startProcessing, existing });
      return;
    }
    handleCreateSOP(data, startProcessing);
  }, [localSops]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVersionConflictResolve = (action: 'new-version' | 'replace' | 'cancel') => {
    if (!versionConflict) return;
    const { data, startProcessing, existing } = versionConflict;

    if (action === 'cancel') {
      setVersionConflict(null);
      return;
    }

    if (action === 'replace') {
      // Replace: remove old, create new with same version
      setLocalSops(prev => prev.filter(s => s.id !== existing.id));
      handleCreateSOP(data, startProcessing);
      setVersionConflict(null);
      return;
    }

    if (action === 'new-version') {
      // Bump version: parse existing, increment
      const match = existing.version.match(/v(\d+)\.(\d+)/);
      const major = match ? parseInt(match[1]) : 1;
      const minor = match ? parseInt(match[2]) + 1 : 1;
      const newVersion = `v${major}.${minor}`;
      handleCreateSOP({ ...data, version: newVersion }, startProcessing);
      setVersionConflict(null);
      return;
    }
  };

  // Create SOP record and optionally start AI processing
  const handleCreateSOP = useCallback((data: UploadSOPData, startProcessing: boolean) => {
    const newId = `sop-new-${Date.now()}`;
    const { risks, controls } = buildMockExtractions();
    const uploadDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const newSop: LocalSOP = {
      id: newId, name: data.name, fileName: data.fileName, version: data.version,
      description: data.description, businessProcess: bpAbbr,
      uploadedBy: 'Current User', uploadedAt: uploadDate,
      status: startProcessing ? 'Processing' : 'Uploaded',
      progress: 0, processingStep: startProcessing ? 0 : 0,
      risks: 0, controls: 0, racmId: null, racmName: null, failureReason: null,
      extractedRisks: risks, extractedControls: controls,
    };

    setLocalSops(prev => [newSop, ...prev]);
    setShowUploadDrawer(false);

    if (!startProcessing) {
      addToast({ message: `"${data.name}" saved as draft. Start processing when ready.`, type: 'success' });
      return;
    }

    addToast({ message: `Processing "${data.name}"...`, type: 'info' });

    // Simulate step-by-step: advance processingStep 0→6, then Ready for Review
    const stepDelays = [500, 1000, 1800, 2500, 3200, 3800, 4200];
    stepDelays.forEach((delay, stepIdx) => {
      setTimeout(() => {
        setLocalSops(prev => prev.map(s => s.id === newId ? {
          ...s,
          processingStep: stepIdx,
          progress: Math.round((stepIdx / 6) * 100),
        } : s));
      }, delay);
    });
    // Final: determine if result is Ready for Review or Partial
    setTimeout(() => {
      setLocalSops(prev => prev.map(s => {
        if (s.id !== newId) return s;
        const updated = {
          ...s, progress: 100, processingStep: 6,
          risks: risks.filter(r => r.accepted).length,
          controls: controls.filter(c => c.accepted).length,
        };
        const partial = isPartialExtraction(updated);
        return { ...updated, status: 'Processed' as SOPStatus };
      }));
      addToast({ message: `"${data.name}" processed — ${risks.length} risks and ${controls.length} controls extracted. Review to create draft RACM.`, type: 'success' });
    }, 4500);
  }, [addToast, bpAbbr]);

  // Start processing for a draft SOP
  const handleStartProcessing = useCallback((sopId: string) => {
    const sop = localSops.find(s => s.id === sopId);
    if (!sop || (sop.status !== 'Uploaded' && sop.status !== 'Failed')) return;

    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, status: 'Processing' as SOPStatus, progress: 0, processingStep: 0, failureReason: null } : s));
    addToast({ message: `Processing "${sop.name}"...`, type: 'info' });

    const { risks, controls } = buildMockExtractions();

    const stepDelays = [500, 1000, 1800, 2500, 3200, 3800, 4200];
    stepDelays.forEach((delay, stepIdx) => {
      setTimeout(() => {
        setLocalSops(prev => prev.map(s => s.id === sopId ? {
          ...s, processingStep: stepIdx, progress: Math.round((stepIdx / 6) * 100),
          ...(stepIdx === 0 ? { extractedRisks: risks, extractedControls: controls } : {}),
        } : s));
      }, delay);
    });
    setTimeout(() => {
      setLocalSops(prev => prev.map(s => {
        if (s.id !== sopId) return s;
        const updated = {
          ...s, progress: 100, processingStep: 6,
          risks: risks.filter(r => r.accepted).length,
          controls: controls.filter(c => c.accepted).length,
        };
        const partial = isPartialExtraction(updated);
        return { ...updated, status: 'Processed' as SOPStatus };
      }));
      addToast({ message: `"${sop.name}" processed — ${risks.length} risks and ${controls.length} controls extracted.`, type: 'success' });
    }, 4500);
  }, [addToast, localSops]);

  const handleUpdateRisks = (sopId: string, risks: ExtractedRisk[]) => {
    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, extractedRisks: risks, risks: risks.filter(r => r.accepted).length } : s));
  };

  const handleUpdateControls = (sopId: string, controls: ExtractedControl[]) => {
    setLocalSops(prev => prev.map(s => s.id === sopId ? { ...s, extractedControls: controls, controls: controls.filter(c => c.accepted).length } : s));
  };

  const handleCreateDraftRacm = (sopId: string, racmName?: string) => {
    const sop = localSops.find(s => s.id === sopId);
    if (!sop) return;
    const racmId = `RACM-DRAFT-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const acceptedRisks = (sop.extractedRisks || []).filter(r => r.accepted).length;
    const acceptedControls = (sop.extractedControls || []).filter(c => c.accepted).length;
    const name = racmName || `FY26 ${sop.businessProcess} — ${sop.name.replace(/\s*SOP\s*/i, '').trim()}`;

    setLocalSops(prev => prev.map(s => s.id === sopId ? {
      ...s, status: 'Processed' as SOPStatus, racmId, racmName: name, risks: acceptedRisks, controls: acceptedControls,
    } : s));
    setReviewingSopId(null);
    addToast({ message: `Draft RACM "${name}" created with ${acceptedRisks} risks and ${acceptedControls} control references. Status: Draft · Readiness: Needs Mapping. Open the RACM tab to continue.`, type: 'success' });
  };

  // Action click handlers — derived from status via getSOPAction
  const handleSOPActionClick = (sop: LocalSOP) => {
    const action = getSOPAction(sop.status, !!sop.racmId);
    switch (action.label) {
      case 'Start Processing':  handleStartProcessing(sop.id); break;
      case 'View Progress':     addToast({ message: `"${sop.name}" is currently being processed...`, type: 'info' }); break;
      case 'Create RACM':       setShowCreateRacmForSopId(sop.id); break;
      case 'Retry':             handleStartProcessing(sop.id); break;
      case 'View SOP':          setPreviewingSopId(sop.id); break;
    }
  };

  // If reviewing an SOP, render the extraction workspace inline
  if (reviewingSop) {
    return (
      <div>
        <ExtractionReviewWorkspace
          sop={reviewingSop}
          onBack={() => setReviewingSopId(null)}
          onAccept={(racmName) => handleCreateDraftRacm(reviewingSop.id, racmName)}
          onUpdateRisks={(risks) => handleUpdateRisks(reviewingSop.id, risks)}
          onUpdateControls={(controls) => handleUpdateControls(reviewingSop.id, controls)}
        />

        {/* Upload SOP Drawer (keep available even in review) */}
        <AnimatePresence>
          {showUploadDrawer && (
            <UploadSOPDrawer bpAbbr={bpAbbr} onClose={() => setShowUploadDrawer(false)}
              onUploadAndProcess={(data) => handleUploadIntent(data, true)} onSaveAsDraft={(data) => handleUploadIntent(data, false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Sort: latest version first (higher version number = first), then newest upload date
  const sortedSops = useMemo(() => {
    return [...localSops].sort((a, b) => {
      // Parse version numbers for comparison
      const parseVer = (v: string) => {
        const m = v.match(/v(\d+)\.(\d+)/);
        return m ? parseInt(m[1]) * 1000 + parseInt(m[2]) : 0;
      };
      const vDiff = parseVer(b.version) - parseVer(a.version);
      if (vDiff !== 0) return vDiff;
      // Newer uploads first (by id — newer IDs are larger timestamps)
      return b.id.localeCompare(a.id);
    });
  }, [localSops]);

  return (
    <div>
      {/* Empty state */}
      {sortedSops.length === 0 ? (
        <div className="bg-white rounded-xl border border-border-light p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-200 mb-3" />
          <div className="text-[14px] font-semibold text-text mb-1">No SOPs uploaded yet</div>
          <p className="text-[12px] text-gray-400 max-w-sm mx-auto mb-4">Upload a Standard Operating Procedure to extract risks and control references.</p>
          <button onClick={() => setShowUploadDrawer(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer">
            <Upload size={14} />Upload SOP
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] text-gray-500">{sortedSops.length} SOP{sortedSops.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setShowUploadDrawer(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
              <Upload size={13} />Upload SOP
            </button>
          </div>

          {/* SOP Table */}
          <div className="bg-white rounded-xl border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    {['SOP Name', 'Status', 'Uploaded', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSops.map((sop, i) => {
                    const isProcessing = sop.status === 'Processing';
                    const action = getSOPAction(sop.status, !!sop.racmId);
                    const showCounts = sop.status !== 'Uploaded' && sop.status !== 'Processing';
                    return (<React.Fragment key={sop.id}>
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                        className={`border-b border-border/40 transition-colors ${sop.status === 'Archived' ? 'opacity-50' : 'hover:bg-gray-50/50'}`}>
                        <td className="px-3 py-3">
                          <span className="text-[12px] font-medium text-text">{sop.name}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{sop.uploadedBy} · {sop.uploadedAt}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${SOP_STATUS_STYLES[sop.status]}`}>
                            {isProcessing && <Loader2 size={9} className="animate-spin mr-1" />}
                            {sop.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[11px] text-gray-400">{sop.uploadedAt}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleSOPActionClick(sop)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${action.cls}`}>
                              {action.label}
                            </button>
                            {(sop.status === 'Processed' || sop.status === 'Ready for Review' || sop.status === 'Partial') && (
                              <button onClick={() => setPreviewingSopId(sop.id)}
                                className="px-2 py-1 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors">
                                View SOP
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                      {/* Processing stepper */}
                      <AnimatePresence>
                        {isProcessing && (
                          <tr><td colSpan={4} className="p-0"><ProcessingStepperPanel sop={sop} /></td></tr>
                        )}
                      </AnimatePresence>
                      {/* Failed state */}
                      {sop.status === 'Failed' && (
                        <tr>
                          <td colSpan={4} className="p-0">
                            <div className="px-4 py-3 bg-gray-50/50 border-t border-border/30">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-red-500/80 flex-1">{sop.failureReason || 'An unexpected error occurred.'}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => handleStartProcessing(sop.id)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors">Retry</button>
                                  <button onClick={() => setShowUploadDrawer(true)} className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">Re-upload</button>
                                  <button onClick={() => { setLocalSops(prev => prev.map(s => s.id === sop.id ? { ...s, status: 'Archived' as SOPStatus } : s)); addToast({ message: `"${sop.name}" archived`, type: 'info' }); }}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">Archive</button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SOP Preview Drawer */}
      <AnimatePresence>
        {previewingSopId && (() => {
          const pSop = localSops.find(s => s.id === previewingSopId);
          return pSop ? <SOPPreviewDrawer sop={pSop} onClose={() => setPreviewingSopId(null)} onGoToRacm={pSop.racmId ? onGoToRacm : undefined} /> : null;
        })()}
      </AnimatePresence>

      {/* Upload SOP Drawer */}
      <AnimatePresence>
        {showUploadDrawer && (
          <UploadSOPDrawer
            bpAbbr={bpAbbr}
            onClose={() => setShowUploadDrawer(false)}
            onUploadAndProcess={(data) => handleUploadIntent(data, true)}
            onSaveAsDraft={(data) => handleUploadIntent(data, false)}
          />
        )}
      </AnimatePresence>

      {/* Create RACM Modal */}
      <AnimatePresence>
        {showCreateRacmForSopId && (() => {
          const targetSop = localSops.find(s => s.id === showCreateRacmForSopId);
          if (!targetSop) return null;
          return <CreateRacmFromSOPModal
            sopName={targetSop.name}
            bpAbbr={bpAbbr}
            onClose={() => setShowCreateRacmForSopId(null)}
            onCreate={(racmName, framework) => {
              const racmId = `racm-${Date.now()}`;
              setLocalSops(prev => prev.map(s => s.id === showCreateRacmForSopId ? {
                ...s, racmId, racmName,
              } : s));
              setShowCreateRacmForSopId(null);
              onRacmCreated?.(racmId, racmName, bpAbbr, framework);
              addToast({ message: `RACM "${racmName}" created. Open the RACM tab to start mapping.`, type: 'success' });
            }}
          />;
        })()}
      </AnimatePresence>

      {/* Version Conflict Modal */}
      <AnimatePresence>
        {versionConflict && (() => {
          const { existing } = versionConflict;
          const canReplace = existing.status === 'Uploaded' || existing.status === 'Failed';
          const isLinked = existing.status === 'Processed' && !!existing.racmId;
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setVersionConflict(null)}>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[440px]" onClick={e => e.stopPropagation()}>

                  <div className="px-6 pt-5 pb-4 border-b border-canvas-border">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <h2 className="text-[16px] font-bold text-text">SOP already exists</h2>
                    </div>
                    <p className="text-[12px] text-text-muted">An SOP with this name already exists for this process.</p>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* Existing SOP info */}
                    <div className="rounded-lg border border-border bg-surface-2/30 px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-semibold text-text">{existing.name}</span>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-50 px-1 py-0.5 rounded">{existing.version}</span>
                        <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center ${SOP_STATUS_STYLES[existing.status]}`}>{existing.status}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {existing.uploadedBy} · {existing.uploadedAt}
                        {isLinked && <span className="ml-2 text-primary">Linked to {existing.racmId}</span>}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                      <button onClick={() => handleVersionConflictResolve('new-version')}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                        <div className="text-[12px] font-semibold text-text">Upload as new version</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">Creates {existing.version.replace(/\d+$/, m => String(Number(m) + 1))} — keeps existing SOP and linked RACM intact.</div>
                      </button>

                      {canReplace ? (
                        <button onClick={() => handleVersionConflictResolve('replace')}
                          className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-amber-300 hover:bg-amber-50/30 transition-all cursor-pointer">
                          <div className="text-[12px] font-semibold text-text">Replace existing draft</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">Removes the {existing.status.toLowerCase()} SOP and uploads the new file in its place.</div>
                        </button>
                      ) : (
                        <div className="px-4 py-3 rounded-lg border border-border/50 bg-gray-50/50 opacity-60">
                          <div className="text-[12px] font-medium text-gray-400">Replace existing</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">Cannot replace — SOP is {existing.status.toLowerCase()}{isLinked ? ' and linked to a RACM' : ''}.</div>
                        </div>
                      )}

                      <button onClick={() => handleVersionConflictResolve('cancel')}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-gray-50 transition-all cursor-pointer">
                        <div className="text-[12px] font-medium text-gray-500">Cancel</div>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ─── BP Detail View ─── */
function BPDetailView({ bp, onBack }: {
  bp: typeof BUSINESS_PROCESSES[0]; onBack: () => void;
}) {
  const [tab, setTab] = useState<'sop' | 'racm' | 'risks' | 'controls' | 'workflows'>('sop');
  const [createdRacms, setCreatedRacms] = useState<import('./RacmListTable').RacmEntry[]>([]);

  // ─── Data: single query per entity, filtered by business_process_id ───
  const bpRacms = RACMS.filter(r => r.bpId === bp.id);
  const bpSops = SOPS.filter(s => s.bpId === bp.id);
  const bpWfs = WORKFLOWS.filter(w => w.bpId === bp.id);
  const bpRisks = RISKS.filter(r => r.bpId === bp.id);
  const bpRiskIds = new Set(bpRisks.map(r => r.id));
  const bpControls = CONTROLS.filter(c => bpRiskIds.has(c.riskId));
  const bpEngagements = useMemo(() => ENGAGEMENTS.filter(e => e.bps.includes(bp.id)), [bp.id]);

  // No separate status logic — RACM uses racmStateEngine, risks use RiskRegister lifecycle,
  // controls use ControlLibraryView status, workflows use WorkflowLibraryView status.

  const tabs = [
    { id: 'sop' as const,       label: 'SOP',             count: bpSops.length },
    { id: 'racm' as const,      label: 'RACM',            count: bpRacms.length },
    { id: 'risks' as const,     label: 'Risk Register',   count: bpRisks.length },
    { id: 'controls' as const,  label: 'Control Library', count: bpControls.length },
    { id: 'workflows' as const, label: 'Workflows',       count: bpWfs.length },
  ];

  return (
    <div className="h-full overflow-y-auto bg-surface-2">
      <div className="px-10 py-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary mb-4 transition-colors">
          <ArrowLeft size={14} />
          Business Processes
        </button>

        {/* BP Header — metadata always visible above tabs */}
        <div className="bg-white rounded-2xl border border-border-light p-6 mb-6 ai-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: bp.color + '1a' }}>
              <span className="text-sm font-bold" style={{ color: bp.color }}>{bp.abbr}</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-text">{bp.name}</h1>
              <p className="text-[12px] text-text-muted">Business Process · FY 2025--26</p>
            </div>
          </div>

          {/* Process Metadata — always visible */}
          <div className="flex items-center gap-6 mb-4 pb-4 border-b border-border-light">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-text-muted">Owner:</span>
              <span className="text-[12px] font-medium text-text">Tushar Goel</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-text-muted">Status:</span>
              <span className="inline-flex items-center gap-1.5 bg-success-bg text-compliant-700 px-2.5 py-0.5 rounded-full text-[12px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Active
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[12px] font-bold text-text-muted shrink-0">Description:</span>
              <span className="text-[12px] text-text-secondary truncate">End-to-end {bp.name.toLowerCase()} process covering all related risks, controls, and compliance workflows.</span>
            </div>
          </div>


        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className="flex items-center gap-2">
                {t.label}
                {t.count != null && (
                  <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.id ? 'bg-primary/10 text-primary' : 'bg-paper-50 text-ink-500'
                  }`}>{t.count}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* SOP Tab — full journey: Upload → Process → Review → Draft RACM */}
        {tab === 'sop' && (
          <SOPTabContent
            bpId={bp.id}
            bpAbbr={bp.abbr}
            existingSops={bpSops}
            existingRacms={bpRacms}
            onGoToRacm={() => setTab('racm')}
            onRacmCreated={(racmId, racmName, process, framework) => {
              setCreatedRacms(prev => [...prev, {
                id: racmId, name: racmName, version: 'v1.0', process, framework,
                risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
                workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
              }]);
            }}
          />
        )}

        {/* RACM Tab — filtered RACM list table */}
        {tab === 'racm' && (
          <RacmListTable processFilter={bp.abbr} extraRacms={createdRacms} />
        )}

        {/* Risk Register Tab — embedded RiskRegister filtered by process */}
        {tab === 'risks' && (
          <div className="-mx-10 -mb-6">
            <RiskRegister processFilter={bp.abbr} />
          </div>
        )}

        {/* Control Library Tab — embedded ControlLibraryView filtered by process */}
        {tab === 'controls' && (
          <div className="-mx-10 -mb-6">
            <ControlLibraryView processFilter={bp.abbr} />
          </div>
        )}

        {/* Workflows Tab — embedded WorkflowLibraryView filtered by process */}
        {tab === 'workflows' && (
          <div className="-mx-10 -mb-6">
            <WorkflowLibraryView processFilter={bp.abbr} />
          </div>
        )}

      </div>
    </div>
  );
}

/* ─── Business Processes List ─── */
export default function BusinessProcesses({ selectedBPId, onSelectBP, onOpenEngagement }: Props) {
  const [tab, setTab] = useState<HubTabId>('engagements');
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

  if (selectedBPId) {
    const bp = BUSINESS_PROCESSES.find(b => b.id === selectedBPId);
    if (bp) return <BPDetailView bp={bp} onBack={() => onSelectBP(null)} />;
  }

  const activeTabLabel = HUB_TABS.find(t => t.id === tab)!.label;

  // Filtered counts + lists per tab
  const lcSearch = search.trim().toLowerCase();
  const filteredEngagements = ENGAGEMENTS.filter(e => {
    if (!lcSearch) return true;
    return e.name.toLowerCase().includes(lcSearch) || e.owner.toLowerCase().includes(lcSearch) || e.type.toLowerCase().includes(lcSearch);
  });
  const filteredBPs = BUSINESS_PROCESSES.filter(b => {
    if (!lcSearch) return true;
    return b.name.toLowerCase().includes(lcSearch) || b.abbr.toLowerCase().includes(lcSearch);
  });

  const newButtonLabel = tab === 'engagements' ? 'New engagement' : 'Add process';
  const onNewClick = () => addToast({
    type: 'info',
    message: tab === 'engagements'
      ? 'New engagement wizard — coming soon.'
      : 'Add process wizard — coming soon.',
  });

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />

      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium text-white">
                <Building2 size={16} />
              </div>
              <h1 className="text-xl font-bold text-text">Process Hub</h1>
            </div>
            <p className="text-sm text-text-secondary mt-1 ml-9">
              {tab === 'engagements'
                ? 'Active and historical audit engagements across your business.'
                : 'End-to-end business processes with linked SOPs, RACMs, controls and workflows.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNewClick}
              className="flex items-center gap-1.5 px-3 py-2 border border-primary/30 bg-primary/5 rounded-lg text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              {newButtonLabel}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-4">
          {HUB_TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const count = t.id === 'engagements' ? ENGAGEMENTS.length : BUSINESS_PROCESSES.length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon size={14} />
                {t.label}
                <span className={`tabular-nums text-[11px] ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder={`Search ${activeTabLabel.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-9 rounded-md border border-border-light bg-white text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Tab content */}
        <div>
        <AnimatePresence mode="wait">
          {tab === 'engagements' ? (
            <motion.div
              key="engagements"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-2 gap-5"
            >
              {filteredEngagements.map((e, i) => (
                <EngagementCard
                  key={e.id}
                  eng={e}
                  index={i}
                  onOpen={() => onOpenEngagement?.(e.id)}
                />
              ))}
              {filteredEngagements.length === 0 && (
                <div className="col-span-2 text-center py-16 text-[13px] text-text-muted">
                  No engagements match "{search}".
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="bps"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {/* AI Insight Banner */}
              <div className="bg-gradient-to-r from-primary-xlight via-white to-primary-xlight rounded-2xl border border-primary/10 p-5 mb-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-text">AI Coverage Analysis</div>
                  <div className="text-[12px] text-text-secondary mt-0.5">
                    2 processes are below 60% control coverage. <span className="text-primary font-semibold cursor-pointer hover:underline">View recommendations</span>
                  </div>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold font-mono text-text">{BUSINESS_PROCESSES.length}</div>
                    <div className="text-[12px] text-text-muted">Processes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold font-mono text-primary">{Math.round(BUSINESS_PROCESSES.reduce((s, b) => s + b.coverage, 0) / BUSINESS_PROCESSES.length)}%</div>
                    <div className="text-[12px] text-text-muted">Avg Coverage</div>
                  </div>
                </div>
              </div>

              {/* BP Cards — 3D Hover */}
              <div className="grid grid-cols-2 gap-5">
                {filteredBPs.map((bp, i) => (
                  <motion.div
                    key={bp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <CardContainer containerClassName="w-full">
                      <CardBody
                        className="bg-white rounded-2xl border border-border-light p-6 cursor-pointer hover:shadow-primary/5 hover:border-primary/20 active:scale-[0.998] transition-all duration-300 group relative overflow-hidden"
                      >
                        {/* Accent gradient orb */}
                        <div
                          className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.07] blur-2xl pointer-events-none"
                          style={{ background: bp.color }}
                        />
                        <div
                          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: `linear-gradient(90deg, ${bp.color}, ${bp.color}80, transparent)` }}
                        />

                        <div onClick={() => onSelectBP(bp.id)} className="relative">
                          <CardItem translateZ={40}>
                            <div className="flex items-center gap-3 mb-5">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300" style={{ background: bp.color + '1a' }}>
                                <span className="text-sm font-bold" style={{ color: bp.color }}>{bp.abbr}</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-[15px] font-semibold text-text group-hover:text-primary transition-colors">{bp.name}</div>
                                <div className="text-[12px] text-text-muted">FY 2025–26</div>
                              </div>
                              <ChevronRight size={15} className="text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </CardItem>

                          <CardItem translateZ={25}>
                            <div className="grid grid-cols-4 gap-3 mb-5">
                              {[
                                { l: 'Risks', v: bp.risks, c: '#dc2626' },
                                { l: 'Controls', v: bp.controls, c: '#0284c7' },
                                { l: 'SOPs', v: bp.sops, c: '#16a34a' },
                                { l: 'Workflows', v: bp.workflows, c: '#d97706' },
                              ].map(s => (
                                <div key={s.l} className="text-center p-2 rounded-lg bg-surface-2/80 border border-border-light/50">
                                  <div className="text-lg font-bold text-text leading-none mb-0.5">{s.v}</div>
                                  <div className="text-[12px] text-text-muted font-medium">{s.l}</div>
                                </div>
                              ))}
                            </div>
                          </CardItem>

                          <CardItem translateZ={15}>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2.5 bg-border-light rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${bp.coverage}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                                  className="h-full rounded-full"
                                  style={{ background: `linear-gradient(90deg, ${bp.color}, ${bp.color}cc)` }}
                                />
                              </div>
                              <span className="text-[13px] font-bold font-mono" style={{ color: bp.color }}>{bp.coverage}%</span>
                            </div>
                          </CardItem>
                        </div>
                      </CardBody>
                    </CardContainer>
                  </motion.div>
                ))}
                {filteredBPs.length === 0 && (
                  <div className="col-span-2 text-center py-16 text-[13px] text-text-muted">
                    No business processes match "{search}".
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Engagement Card (used by Engagements tab) ─── */
function EngagementCard({ eng, index, onOpen }: { eng: typeof ENGAGEMENTS[0]; index: number; onOpen: () => void }) {
  const statusTone =
    eng.status === 'active'   ? { bg: 'bg-evidence-50', text: 'text-evidence-700', label: 'In fieldwork' } :
    eng.status === 'complete' ? { bg: 'bg-compliant-50', text: 'text-compliant-700', label: 'Closed' } :
    eng.status === 'draft'    ? { bg: 'bg-paper-100',   text: 'text-ink-600',      label: 'Planned' } :
                                { bg: 'bg-paper-100',   text: 'text-ink-600',      label: eng.status };

  const progressPct = eng.controls > 0 ? Math.round((eng.tested / eng.controls) * 100) : 0;
  const effectivePct = eng.tested > 0 ? Math.round((eng.effective / eng.tested) * 100) : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={onOpen}
      className="text-left group relative bg-white rounded-2xl border border-border-light p-6 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary-xlight flex items-center justify-center shrink-0">
            <Briefcase size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-text group-hover:text-primary transition-colors truncate">{eng.name}</div>
            <div className="text-[12px] text-text-muted mt-0.5 flex items-center gap-2">
              <span className="font-mono">{eng.id.toUpperCase()}</span>
              <span className="text-text-muted/50">·</span>
              <span>{eng.type}</span>
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 h-6 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusTone.bg} ${statusTone.text}`}>
          {statusTone.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
          <div className="text-[18px] font-semibold text-text tabular-nums leading-none mb-1">{eng.controls}</div>
          <div className="text-[11px] text-text-muted">Controls</div>
        </div>
        <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
          <div className="text-[18px] font-semibold text-text tabular-nums leading-none mb-1">{eng.tested}</div>
          <div className="text-[11px] text-text-muted">Tested</div>
        </div>
        <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
          <div className={`text-[18px] font-semibold tabular-nums leading-none mb-1 ${eng.deficiencies > 0 ? 'text-risk-700' : 'text-text'}`}>{eng.deficiencies}</div>
          <div className="text-[11px] text-text-muted">Deficiencies</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, delay: 0.15 + index * 0.05 }}
            className="h-full rounded-full bg-primary"
          />
        </div>
        <span className="text-[12px] font-semibold text-text-secondary tabular-nums">{progressPct}%</span>
      </div>

      <div className="flex items-center justify-between text-[12px] text-text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><Users size={11} />{eng.owner}</span>
          <span className="text-text-muted/50">·</span>
          <span className="flex items-center gap-1.5"><Calendar size={11} />{eng.start} – {eng.end}</span>
        </div>
        {eng.tested > 0 && (
          <span className="font-mono text-[11px]">{effectivePct}% effective</span>
        )}
      </div>
    </motion.button>
  );
}
