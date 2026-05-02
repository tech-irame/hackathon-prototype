import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Search, Shield, AlertTriangle, CheckCircle2,
  Plus, X, Star, Link2, Trash2, Workflow, ChevronRight, ChevronDown,
  Clock, User, FileText, Eye, Paperclip, FileCheck, XCircle,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import CreateControlDrawer, { type NewControlData } from '../governance/CreateControlDrawer';
import { WORKFLOWS } from '../../data/mockData';
import { computeRacmStateFromRisks, RACM_STATUS_STYLES, RACM_READINESS_STYLES, type ComputedRacmState, type RiskDetailInput } from './racmStateEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RiskControlMapping {
  id: string;
  riskId: string;
  controlId: string;
  isKeyControl: boolean;
  createdBy: string;
  createdAt: string;
}

interface ControlAttribute {
  id: string;
  name: string;
  description: string;
  evidenceType: string;
  expectedResult: string;
  passLogic: string;
}

interface ControlWorkflow {
  id: string;
  name: string;
  version: string;
  status: 'Draft' | 'Ready' | 'Active';
  lastRun: string;
  dataRequired: boolean;
  attributes: ControlAttribute[];
}

interface MappedControl {
  id: string;
  name: string;
  description: string;
  isKey: boolean;
  automation: 'Manual' | 'Automated' | 'IT-dependent';
  nature: 'Preventive' | 'Detective' | 'Corrective';
  workflowLinked: boolean;
  workflowName: string;
  attributeCount: number;
  lastExecution: string;
  status: 'Effective' | 'Ineffective' | 'Not Tested' | 'Pending';
  owner?: string;
  labels?: string[];
  workflows?: ControlWorkflow[];
}

type ControlReadiness = 'Setup Incomplete' | 'Needs Attributes' | 'Ready';

function getControlReadiness(ctrl: MappedControl): ControlReadiness {
  if (!ctrl.workflowLinked || !ctrl.workflows || ctrl.workflows.length === 0) return 'Setup Incomplete';
  if (ctrl.workflows.every(w => w.attributes.length === 0)) return 'Needs Attributes';
  return 'Ready';
}

const READINESS_CLS: Record<ControlReadiness, string> = {
  'Setup Incomplete': 'bg-red-50/60 text-red-600',
  'Needs Attributes': 'bg-amber-50/60 text-amber-600',
  'Ready': 'bg-emerald-50/60 text-emerald-600',
};
const WF_STATUS_CLS: Record<string, string> = {
  Draft: 'bg-draft-50 text-draft-700',
  Ready: 'bg-evidence-50 text-evidence-700',
  Active: 'bg-compliant-50 text-compliant-700',
};

interface RiskItem {
  id: string;
  name: string;
  description: string;
  process: string;
  sourceRef: string;
  controls: MappedControl[];
  validationStatus: 'Unvalidated' | 'Stable' | 'At Risk';
  freshness: 'Up to Date' | 'Needs Re-execution';
  // SOP traceability
  sourceSopName?: string;
  sourceSopVersion?: string;
  sourceSection?: string;
  sourceText?: string;
}

type RiskFilter = 'all' | 'unmapped' | 'partial' | 'mapped' | 'at-risk' | 'unvalidated';

interface Props {
  onBack: () => void;
  onGoToExecution?: () => void;
  racmId?: string;
  racmName?: string;
  racmProcess?: string;
  isEmpty?: boolean;
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

const CONTROL_LIBRARY: MappedControl[] = [
  { id: 'ctl-001', name: 'Three-Way PO/GRN/Invoice Matching', description: 'System-enforced three-way matching before payment release', isKey: true, automation: 'Automated', nature: 'Preventive', workflowLinked: true, workflowName: 'PO Validation Workflow v2.0', attributeCount: 5, lastExecution: 'Apr 12, 2026', status: 'Effective', owner: 'Rajiv Sharma', labels: ['SOX', 'P2P'],
    workflows: [
      { id: 'wf-pv', name: 'PO Validation Workflow', version: 'v2.0', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
        { id: 'a1', name: 'PO Existence', description: 'Verify approved PO exists for invoice', evidenceType: 'PO document', expectedResult: 'Approved PO present', passLogic: 'PO status = Approved AND amount matches' },
        { id: 'a2', name: 'Payment Approval', description: 'Confirm authorization per delegation matrix', evidenceType: 'Approval log', expectedResult: 'Dual approval documented', passLogic: 'Two approvals before release' },
      ]},
      { id: 'wf-grn', name: 'GRN Matching Workflow', version: 'v1.6', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
        { id: 'a3', name: 'GRN Match', description: 'Confirm GRN quantity matches PO', evidenceType: 'GRN document', expectedResult: 'Quantity within 5% tolerance', passLogic: 'GRN qty / PO qty variance ≤ 5%' },
      ]},
      { id: 'wf-inv', name: 'Invoice Match Workflow', version: 'v2.3', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
        { id: 'a4', name: 'Invoice Amount Match', description: 'Validate invoice matches PO and GRN', evidenceType: 'Invoice document', expectedResult: 'Amount within tolerance', passLogic: 'Invoice total within $500 or 2% of PO' },
        { id: 'a5', name: 'Tolerance Verification', description: 'Verify variance documented', evidenceType: 'Exception report', expectedResult: 'Variance approved', passLogic: 'Exception form signed if variance > threshold' },
      ]},
    ],
  },
  { id: 'ctl-002', name: 'Vendor Master Change Approval', description: 'Multi-level approval for vendor master data changes', isKey: true, automation: 'Manual', nature: 'Preventive', workflowLinked: true, workflowName: 'Vendor Change Monitor v1.1', attributeCount: 3, lastExecution: 'Apr 10, 2026', status: 'Effective', owner: 'Deepak Bansal', labels: ['SOX', 'P2P'],
    workflows: [{ id: 'wf-vcm', name: 'Vendor Change Monitor', version: 'v1.1', status: 'Active', lastRun: 'Apr 10, 2026', dataRequired: true, attributes: [
      { id: 'a6', name: 'Registration Complete', description: 'All required fields populated', evidenceType: 'Registration form', expectedResult: 'No blank mandatory fields', passLogic: 'All required fields have values' },
      { id: 'a7', name: 'Tax ID Verified', description: 'Tax ID validated against government DB', evidenceType: 'System log', expectedResult: 'ID validated', passLogic: 'Tax ID check returns valid' },
      { id: 'a8', name: 'Change Notification', description: 'Finance head notified of change', evidenceType: 'Email log', expectedResult: 'Notification sent within 24h', passLogic: 'Email timestamp < change timestamp + 24h' },
    ]}],
  },
  { id: 'ctl-003', name: 'Duplicate Invoice Detection', description: 'Automated scan of invoices against historical data', isKey: true, automation: 'Automated', nature: 'Detective', workflowLinked: true, workflowName: 'Duplicate Detector v1.4', attributeCount: 4, lastExecution: 'Apr 18, 2026', status: 'Pending', owner: 'Rajiv Sharma', labels: ['SOX', 'P2P'],
    workflows: [{ id: 'wf-dd', name: 'Duplicate Detector', version: 'v1.4', status: 'Active', lastRun: 'Apr 18, 2026', dataRequired: true, attributes: [
      { id: 'a9', name: 'Scan Executed', description: 'Duplicate scan ran before processing', evidenceType: 'System log', expectedResult: 'Scan log present', passLogic: 'Scan timestamp < payment timestamp' },
      { id: 'a10', name: 'Flag Resolved', description: 'Flagged duplicates reviewed', evidenceType: 'Approval log', expectedResult: 'Resolution documented', passLogic: 'Approver sign-off on flagged items' },
    ]}],
  },
  { id: 'ctl-004', name: 'High-Value Payment Review', description: 'Flagging and additional approval for payments exceeding threshold', isKey: true, automation: 'IT-dependent', nature: 'Preventive', workflowLinked: true, workflowName: 'Payment Flagging v2.0', attributeCount: 2, lastExecution: 'Apr 14, 2026', status: 'Effective', owner: 'Karan Mehta', labels: ['SOX'],
    workflows: [{ id: 'wf-pf', name: 'Payment Flagging', version: 'v2.0', status: 'Active', lastRun: 'Apr 14, 2026', dataRequired: true, attributes: [
      { id: 'a11', name: 'Threshold Applied', description: 'Payment correctly flagged per config', evidenceType: 'System log', expectedResult: 'Flagged if above threshold', passLogic: 'Amount > threshold → flag present' },
      { id: 'a12', name: 'Senior Approval', description: 'Additional approval obtained', evidenceType: 'Approval log', expectedResult: 'Senior approval before release', passLogic: 'Approval level ≥ required level' },
    ]}],
  },
  { id: 'ctl-005', name: 'SOD Violation Detection', description: 'Real-time segregation of duties conflict detection', isKey: true, automation: 'Automated', nature: 'Detective', workflowLinked: true, workflowName: 'SOD Detector v1.1', attributeCount: 4, lastExecution: '—', status: 'Not Tested', owner: 'IT Security', labels: ['ITGC'],
    workflows: [{ id: 'wf-sod', name: 'SOD Detector', version: 'v1.1', status: 'Ready', lastRun: '—', dataRequired: true, attributes: [
      { id: 'a13', name: 'Role Matrix Current', description: 'SOD rule matrix is current', evidenceType: 'Matrix export', expectedResult: 'Current version loaded', passLogic: 'Matrix version date within 90 days' },
      { id: 'a14', name: 'Conflicts Detected', description: 'Conflicts found and reported', evidenceType: 'Violation report', expectedResult: 'Report generated', passLogic: 'All known conflicts listed' },
    ]}],
  },
  { id: 'ctl-006', name: 'Revenue Recognition Compliance Check', description: 'ASC 606 validation on revenue transactions', isKey: true, automation: 'Automated', nature: 'Detective', workflowLinked: true, workflowName: 'Revenue Checker v2.3', attributeCount: 2, lastExecution: 'Apr 10, 2026', status: 'Effective', owner: 'Neha Joshi', labels: ['SOX', 'O2C'],
    workflows: [{ id: 'wf-rc', name: 'Revenue Checker', version: 'v2.3', status: 'Active', lastRun: 'Apr 10, 2026', dataRequired: true, attributes: [
      { id: 'a15', name: 'ASC 606 Mapped', description: 'All 5 steps evaluated', evidenceType: 'Compliance doc', expectedResult: 'Full evaluation documented', passLogic: 'All 5 ASC 606 steps have entries' },
      { id: 'a16', name: 'Timing Validated', description: 'Recognition matches obligation', evidenceType: 'Invoice', expectedResult: 'Date aligned', passLogic: 'Recognition date ≤ obligation completion' },
    ]}],
  },
  { id: 'ctl-007', name: 'Journal Entry Anomaly Review', description: 'AI-powered anomaly detection on journal entries', isKey: true, automation: 'Automated', nature: 'Detective', workflowLinked: true, workflowName: 'JE Analyzer v3.0', attributeCount: 2, lastExecution: 'Apr 16, 2026', status: 'Effective', owner: 'Rohan Patel', labels: ['SOX', 'R2R'],
    workflows: [{ id: 'wf-je', name: 'JE Analyzer', version: 'v3.0', status: 'Active', lastRun: 'Apr 16, 2026', dataRequired: true, attributes: [
      { id: 'a17', name: 'Model Executed', description: 'AI anomaly model ran on batch', evidenceType: 'System log', expectedResult: 'Execution log with scores', passLogic: 'Model output exists with timestamp' },
      { id: 'a18', name: 'Flagged Reviewed', description: 'High-score entries reviewed', evidenceType: 'Approval log', expectedResult: 'Review documented', passLogic: 'All scores > threshold have review notes' },
    ]}],
  },
  { id: 'ctl-008', name: 'Period-End Close Reconciliation', description: 'Monthly reconciliation of GL accounts', isKey: false, automation: 'Manual', nature: 'Detective', workflowLinked: false, workflowName: '', attributeCount: 0, lastExecution: '—', status: 'Not Tested', owner: 'Karan Mehta', labels: ['R2R'], workflows: [] },
  { id: 'ctl-009', name: 'Purchase Order Dual Sign-Off', description: 'Dual authorization for POs above threshold', isKey: false, automation: 'Manual', nature: 'Preventive', workflowLinked: false, workflowName: '', attributeCount: 0, lastExecution: '—', status: 'Not Tested', owner: 'Meera Patel', labels: ['P2P'], workflows: [] },
  { id: 'ctl-010', name: 'Credit Limit Override Approval', description: 'Review process for credit limit changes', isKey: false, automation: 'Manual', nature: 'Preventive', workflowLinked: false, workflowName: '', attributeCount: 0, lastExecution: '—', status: 'Not Tested', owner: 'Sneha Desai', labels: ['O2C'], workflows: [] },
];

const INITIAL_RISKS: RiskItem[] = [
  { id: 'rsk-001', name: 'Unauthorized vendor payments', description: 'Payments processed without proper PO or approval', process: 'P2P', sourceRef: 'Row 2', controls: [CONTROL_LIBRARY[0], CONTROL_LIBRARY[3]], validationStatus: 'Stable', freshness: 'Up to Date', sourceSopName: 'Vendor Payment SOP', sourceSopVersion: 'v2.1', sourceSection: '§3.2 Payment Authorization', sourceText: 'All payments must be matched against an approved PO before release.' },
  { id: 'rsk-002', name: 'Duplicate invoices processed', description: 'Same invoice paid twice due to weak detection', process: 'P2P', sourceRef: 'Row 3', controls: [CONTROL_LIBRARY[2]], validationStatus: 'At Risk', freshness: 'Needs Re-execution', sourceSopName: 'Vendor Payment SOP', sourceSopVersion: 'v2.1', sourceSection: '§4.1 Invoice Processing', sourceText: 'Invoices shall be scanned against historical records to prevent duplicates.' },
  { id: 'rsk-003', name: 'Fictitious vendor registration', description: 'Vendor created without verification', process: 'P2P', sourceRef: 'Row 4', controls: [CONTROL_LIBRARY[1]], validationStatus: 'Stable', freshness: 'Up to Date', sourceSopName: 'Vendor Payment SOP', sourceSopVersion: 'v2.1', sourceSection: '§2.3 Vendor Management', sourceText: 'New vendor registration requires tax ID verification and multi-level approval.' },
  { id: 'rsk-004', name: 'Unauthorized PO creation', description: 'POs above threshold without dual sign-off', process: 'P2P', sourceRef: 'Row 5', controls: [], validationStatus: 'Unvalidated', freshness: 'Needs Re-execution', sourceSopName: 'Purchase Order SOP', sourceSopVersion: 'v1.3', sourceSection: '§3.4 Approval Matrix', sourceText: 'Purchase orders exceeding threshold require dual authorization.' },
  { id: 'rsk-005', name: 'SOD violation in AP', description: 'Same user creates and approves payment', process: 'P2P', sourceRef: 'Row 6', controls: [], validationStatus: 'Unvalidated', freshness: 'Needs Re-execution', sourceSopName: 'Vendor Payment SOP', sourceSopVersion: 'v2.1', sourceSection: '§5.1 Access Controls', sourceText: 'Segregation of duties must be enforced between payment creation and approval.' },
  { id: 'rsk-006', name: 'Revenue recognition timing', description: 'Revenue recognized before obligation completion', process: 'O2C', sourceRef: 'Row 7', controls: [CONTROL_LIBRARY[5]], validationStatus: 'Stable', freshness: 'Up to Date', sourceSopName: 'Invoice Management SOP', sourceSopVersion: 'v1.0', sourceSection: '§6.2 Revenue Policy', sourceText: 'Revenue must be recognized per ASC 606 only after performance obligations are met.' },
  { id: 'rsk-007', name: 'Incorrect journal entries', description: 'Manual JE posted without review', process: 'R2R', sourceRef: 'Row 8', controls: [CONTROL_LIBRARY[6]], validationStatus: 'Stable', freshness: 'Up to Date', sourceSopName: 'Financial Close SOP', sourceSopVersion: 'v3.0', sourceSection: '§3.1 Journal Entries', sourceText: 'All manual journal entries require manager review before posting.' },
  { id: 'rsk-008', name: 'GL balance discrepancy', description: 'Subsidiary balances do not reconcile', process: 'R2R', sourceRef: 'Row 9', controls: [], validationStatus: 'Unvalidated', freshness: 'Needs Re-execution', sourceSopName: 'GL Reconciliation SOP', sourceSopVersion: 'v1.2', sourceSection: '§2.4 Reconciliation', sourceText: 'Monthly reconciliation of subsidiary balances to consolidated GL is required.' },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const VAL_CLS: Record<string, string> = {
  Stable: 'bg-emerald-100 text-emerald-800',
  'At Risk': 'bg-red-100 text-red-800',
  Unvalidated: 'bg-gray-100 text-gray-600',
};
const EXEC_CLS: Record<string, string> = {
  Effective: 'bg-compliant-50 text-compliant-700',
  Ineffective: 'bg-risk-50 text-risk-700',
  Pending: 'bg-mitigated-50 text-mitigated-700',
  'Not Tested': 'bg-draft-50 text-draft-700',
};
const AUTO_CLS: Record<string, string> = {
  Automated: 'bg-evidence-50 text-evidence-700',
  Manual: 'bg-gray-100 text-gray-700',
  'IT-dependent': 'bg-purple-100 text-purple-800',
};
const NATURE_CLS: Record<string, string> = {
  Preventive: 'bg-compliant-50 text-compliant-700',
  Detective: 'bg-evidence-50 text-evidence-700',
  Corrective: 'bg-mitigated-50 text-mitigated-700',
};

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

const BP_DOTS: Record<string, string> = { P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', S2C: '#059669', ITGC: '#16a34a' };

// ─── Component ──────────────────────────────────────────────────────────────

export default function RacmMappingWorkspace({ onBack, onGoToExecution, racmId, racmName, racmProcess, isEmpty: isEmptyRacm }: Props) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [selectedRiskId, setSelectedRiskId] = useState<string>('');
  const [showLinkDrawer, setShowLinkDrawer] = useState(false);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [linkWorkflowControlId, setLinkWorkflowControlId] = useState<string | null>(null);
  const [createWorkflowControlId, setCreateWorkflowControlId] = useState<string | null>(null);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [racmValidated, setRacmValidated] = useState(false);
  const [showNewRiskDrawer, setShowNewRiskDrawer] = useState(false);
  const [duplicateRiskWarning, setDuplicateRiskWarning] = useState<{ name: string; existingRisk: RiskItem; pendingRisk: Omit<RiskItem, 'id'> } | null>(null);

  // Simulate loading RACM data based on racmId
  useEffect(() => {
    console.log('[RACM] Loading mapping workspace — racmId:', racmId, 'racmName:', racmName);
    setIsLoading(true);
    const timer = setTimeout(() => {
      if (isEmptyRacm) {
        console.log('[RACM] Empty RACM — no risks to load');
        setRisks([]);
      } else {
        // Load risks for this RACM (in prototype, all RACMs share seed data filtered by process)
        const filtered = racmProcess
          ? INITIAL_RISKS.filter(r => r.process === racmProcess || racmProcess === 'Cross')
          : INITIAL_RISKS;
        const loaded = filtered.length > 0 ? filtered : INITIAL_RISKS;
        console.log('[RACM] Loaded', loaded.length, 'risks for racmId:', racmId);
        setRisks(loaded);
        setSelectedRiskId(loaded[0]?.id || '');
      }
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [racmId, racmProcess, isEmptyRacm, racmName]);

  const selectedRisk = risks.find(r => r.id === selectedRiskId) || risks[0];

  // Resolve the control being linked/created for a workflow
  const linkWorkflowControl = linkWorkflowControlId
    ? selectedRisk.controls.find(c => c.id === linkWorkflowControlId) || null
    : null;
  const createWorkflowControl = createWorkflowControlId
    ? risks.flatMap(r => r.controls).find(c => c.id === createWorkflowControlId) || null
    : null;

  // Summary
  const totalRisks = risks.length;
  const unmappedCount = risks.filter(r => r.controls.length === 0).length;
  const mappedCount = risks.filter(r => r.controls.length > 0).length;

  // Handlers
  const handleLinkControl = (controlId: string) => {
    const ctrl = CONTROL_LIBRARY.find(c => c.id === controlId);
    if (!ctrl || !selectedRisk) return;
    if (selectedRisk.controls.some(c => c.id === controlId)) {
      addToast({ message: 'Control already mapped to this risk', type: 'warning' });
      return;
    }
    setRisks(prev => prev.map(r => r.id === selectedRisk.id ? {
      ...r, controls: [...r.controls, ctrl],
      validationStatus: r.validationStatus === 'Unvalidated' && ctrl.status === 'Effective' ? 'Stable' : r.validationStatus,
    } : r));
    setShowLinkDrawer(false);
    if (racmValidated) setRacmValidated(false);
    addToast({ message: `"${ctrl.name}" mapped to "${selectedRisk.name}"`, type: 'success' });
  };

  const handleRemoveControl = (controlId: string) => {
    setRisks(prev => prev.map(r => r.id === selectedRisk.id ? {
      ...r, controls: r.controls.filter(c => c.id !== controlId),
    } : r));
    if (racmValidated) setRacmValidated(false);
    addToast({ message: 'Control removed from risk mapping', type: 'info' });
  };

  const handleLinkWorkflowToControl = (controlId: string, wf: ControlWorkflow) => {
    setRisks(prev => prev.map(r => ({
      ...r,
      controls: r.controls.map(c => {
        if (c.id !== controlId) return c;
        const existing = c.workflows || [];
        if (existing.some(w => w.id === wf.id)) return c;
        const updated = [...existing, wf];
        return {
          ...c,
          workflows: updated,
          workflowLinked: true,
          workflowName: updated[0].name + ' ' + updated[0].version,
          attributeCount: updated.reduce((s, w) => s + w.attributes.length, 0),
        };
      }),
    })));
    setLinkWorkflowControlId(null);
    addToast({ message: `Workflow "${wf.name}" linked to control (Control Library updated)`, type: 'success' });
  };

  const handleCreateWorkflowForControl = (controlId: string, wf: ControlWorkflow) => {
    setRisks(prev => prev.map(r => ({
      ...r,
      controls: r.controls.map(c => {
        if (c.id !== controlId) return c;
        const existing = c.workflows || [];
        const updated = [...existing, wf];
        return {
          ...c,
          workflows: updated,
          workflowLinked: true,
          workflowName: updated[0].name + ' ' + updated[0].version,
          attributeCount: updated.reduce((s, w) => s + w.attributes.length, 0),
        };
      }),
    })));
    setCreateWorkflowControlId(null);
    addToast({ message: `Workflow "${wf.name}" created in Control Library and linked`, type: 'success' });
  };

  const handleToggleKey = (controlId: string) => {
    setRisks(prev => prev.map(r => r.id === selectedRisk.id ? {
      ...r, controls: r.controls.map(c => c.id === controlId ? { ...c, isKey: !c.isKey } : c),
    } : r));
  };

  const handleCreateControl = (data: NewControlData) => {
    // Convert NewControlData → MappedControl (same shape as Control Library objects)
    const linkedWfs: ControlWorkflow[] = [];
    if (data.workflowChoice === 'link' && data.linkedWorkflowId) {
      const wf = WORKFLOWS.find(w => w.id === data.linkedWorkflowId);
      if (wf) linkedWfs.push({ id: wf.id, name: wf.name, version: 'v1.0', status: 'Active', lastRun: '—', dataRequired: true, attributes: [] });
    }

    const ctrl: MappedControl = {
      id: `ctl-new-${Date.now()}`,
      name: data.name,
      description: data.description,
      isKey: data.classification === 'Key',
      automation: data.automation,
      nature: data.nature,
      workflowLinked: linkedWfs.length > 0,
      workflowName: linkedWfs.length > 0 ? linkedWfs[0].name : '',
      attributeCount: 0,
      lastExecution: '—',
      status: 'Not Tested',
      owner: data.owner,
      labels: [data.businessProcess],
      workflows: linkedWfs,
    };

    // Map to the selected risk (and any risks from mappedRisks)
    const targetRiskIds = new Set([selectedRisk.id, ...data.mappedRisks.map(rid => {
      // Find risk by RSK id pattern — map to our local risk IDs if possible
      const match = risks.find(r => r.id === rid || r.name.toLowerCase().includes(rid.toLowerCase()));
      return match?.id;
    }).filter(Boolean) as string[]]);

    setRisks(prev => prev.map(r => targetRiskIds.has(r.id) ? {
      ...r, controls: [...r.controls, ctrl],
    } : r));
    setShowCreateDrawer(false);
    addToast({ message: `"${ctrl.name}" created in Control Library and mapped`, type: 'success' });
  };

  // Derived state from engine (single source of truth)
  const racmComputed = useMemo<ComputedRacmState>(() =>
    computeRacmStateFromRisks(
      risks as RiskDetailInput[],
      racmValidated,
      false, // not locked at mapping stage
    ),
    [risks, racmValidated],
  );

  const valChecks = [
    { label: 'All risks added', done: racmComputed.checks.hasRisks },
    { label: 'All risks mapped to controls', done: racmComputed.checks.allRisksMapped },
    { label: 'Key controls identified', done: racmComputed.checks.hasKeyControls },
    { label: 'All controls have workflows', done: racmComputed.checks.allControlsHaveWorkflows },
    { label: 'All workflows have attributes', done: racmComputed.checks.allWorkflowsHaveAttributes },
  ];
  const allValPassed = racmComputed.readiness === 'Ready to Validate' || racmComputed.readiness === 'Ready';

  const handleValidate = () => {
    if (!allValPassed) return;
    setRacmValidated(true);
    setShowValidateModal(false);
    addToast({ message: 'RACM validated — status Active, ready for execution', type: 'success' });
  };

  // Create new risk and add to RACM
  const handleCreateRisk = (data: { name: string; description: string; process: string; subProcess: string; category: string; owner: string; priority: string }) => {
    // Duplicate check
    const similar = risks.find(r => r.name.toLowerCase() === data.name.trim().toLowerCase());
    const newRiskData: Omit<RiskItem, 'id'> = {
      name: data.name.trim(), description: data.description.trim(), process: data.process || racmProcess || 'P2P',
      sourceRef: 'Manual', controls: [], validationStatus: 'Unvalidated', freshness: 'Needs Re-execution',
    };

    if (similar) {
      setDuplicateRiskWarning({ name: data.name.trim(), existingRisk: similar, pendingRisk: newRiskData });
      return;
    }

    addRiskToRacm(newRiskData);
  };

  const addRiskToRacm = (data: Omit<RiskItem, 'id'>) => {
    const newId = `rsk-new-${Date.now()}`;
    const newRisk: RiskItem = { id: newId, ...data };
    setRisks(prev => [...prev, newRisk]);
    setSelectedRiskId(newId);
    setShowNewRiskDrawer(false);
    setDuplicateRiskWarning(null);
    if (racmValidated) setRacmValidated(false);
    addToast({ message: `Risk created and added to this RACM.`, type: 'success' });
  };

  const addExistingRiskToRacm = (risk: RiskItem) => {
    if (risks.some(r => r.id === risk.id)) {
      addToast({ message: 'This risk is already in the RACM.', type: 'warning' });
      return;
    }
    setRisks(prev => [...prev, risk]);
    setSelectedRiskId(risk.id);
    setShowNewRiskDrawer(false);
    setDuplicateRiskWarning(null);
    if (racmValidated) setRacmValidated(false);
    addToast({ message: `Existing risk added to this RACM.`, type: 'success' });
  };

  // Fallback guard — no RACM context
  if (!racmId && !isLoading && risks.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back to RACM
        </button>
        <div className="glass-card rounded-xl p-12 text-center space-y-3">
          <AlertTriangle size={32} className="mx-auto text-amber-400" />
          <h3 className="text-[15px] font-semibold text-text">Unable to load RACM</h3>
          <p className="text-[12px] text-text-muted max-w-sm mx-auto">No RACM context was provided. Please go back and retry by selecting a RACM from the list.</p>
          <button onClick={onBack} className="mt-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-2">
            <ArrowLeft size={14} />Back to RACM
          </button>
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-64 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
        <div className="glass-card rounded-xl p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="flex items-center gap-4">
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-50 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-2">
            <ArrowLeft size={14} />Back to RACM
          </button>
          <h3 className="text-[16px] font-bold text-text">
            Risk-Control Mapping
            {racmName && <span className="text-[13px] font-medium text-text-muted ml-2">— {racmName}</span>}
          </h3>
          <p className="text-[12px] text-text-muted mt-0.5">Map risks to controls and prepare for execution.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {racmComputed.status === 'Active' ? (
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-semibold"><CheckCircle2 size={14} />Validated</span>
          ) : racmComputed.readiness === 'Ready to Validate' ? (
            <button onClick={() => setShowValidateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
              <FileCheck size={13} />Validate RACM
            </button>
          ) : (
            <button disabled
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-[12px] font-semibold cursor-not-allowed">
              <FileCheck size={13} />Validate RACM
            </button>
          )}
        </div>
      </div>

      {/* Empty RACM state */}
      {risks.length === 0 && !isLoading && (
        <div className="glass-card rounded-xl p-10 text-center space-y-3">
          <Shield size={28} className="mx-auto text-gray-300" />
          <h4 className="text-[14px] font-semibold text-text">No risks added yet</h4>
          <p className="text-[12px] text-text-muted max-w-sm mx-auto">This RACM has no risks. Import from a file or go back to the setup workspace to add risks.</p>
          <button onClick={onBack} className="mt-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
            Back to Setup
          </button>
        </div>
      )}

      {/* ══ GRID — primary workspace ══ */}
      {risks.length > 0 && (
        <RacmGridView
          risks={risks}
          onSelectRisk={(id) => { setSelectedRiskId(id); }}
          onUpdateRisks={setRisks}
          onLinkControl={(riskId) => { setSelectedRiskId(riskId); setShowLinkDrawer(true); }}
          onCreateControl={(riskId) => { setSelectedRiskId(riskId); setShowCreateDrawer(true); }}
          onLinkWorkflow={(ctrlId) => { setLinkWorkflowControlId(ctrlId); }}
          onCreateWorkflow={(ctrlId) => { setCreateWorkflowControlId(ctrlId); }}
          onAddRisk={() => setShowNewRiskDrawer(true)}
        />
      )}

      {/* Readiness + Validation (below grid) */}
      {!racmValidated && risks.length > 0 && <RacmReadinessCard risks={risks} onGoToExecution={onGoToExecution} />}
      {racmValidated && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-compliant/20 bg-gradient-to-br from-compliant-50/30 to-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-compliant"><CheckCircle2 size={18} className="text-white" /></div>
            <div>
              <h3 className="text-[15px] font-bold text-compliant-700">RACM is ready</h3>
              <p className="text-[12px] text-compliant-700/70 mt-0.5">All risks are mapped and validated. You can proceed to execution.</p>
            </div>
          </div>
          {onGoToExecution && (
            <button onClick={onGoToExecution}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-compliant hover:bg-compliant-700 text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
              <ChevronRight size={13} />Go to Execution
            </button>
          )}
        </motion.div>
      )}

      {/* Helper */}
      <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2 flex items-start gap-2">
        <Shield size={11} className="text-ink-400 mt-0.5 shrink-0" />
        <span className="text-[10px] text-ink-400">Controls are reusable objects from the Control Library. Workflows and attributes define execution readiness. Mapping creates a risk → control relationship only.</span>
      </div>


      {/* ── Link Existing Control Drawer ── */}
      <AnimatePresence>
        {showLinkDrawer && (
          <LinkControlDrawer
            alreadyLinkedIds={selectedRisk.controls.map(c => c.id)}
            onClose={() => setShowLinkDrawer(false)}
            onLink={handleLinkControl}
          />
        )}
      </AnimatePresence>

      {/* ── Create New Control Drawer ── */}
      <AnimatePresence>
        {showCreateDrawer && (
          <CreateControlDrawer
            onClose={() => setShowCreateDrawer(false)}
            onSave={handleCreateControl}
            defaultProcess={selectedRisk.process}
            defaultRiskIds={[selectedRisk.id]}
          />
        )}
      </AnimatePresence>

      {/* ── Link Workflow to Control Drawer ── */}
      <AnimatePresence>
        {linkWorkflowControl && (
          <LinkWorkflowToControlDrawer
            control={linkWorkflowControl}
            onClose={() => setLinkWorkflowControlId(null)}
            onLink={(wf) => handleLinkWorkflowToControl(linkWorkflowControl.id, wf)}
          />
        )}
      </AnimatePresence>

      {/* ── Create Workflow Builder Drawer ── */}
      <AnimatePresence>
        {createWorkflowControl && (
          <CreateWorkflowBuilderDrawer
            control={createWorkflowControl}
            onClose={() => setCreateWorkflowControlId(null)}
            onCreate={(wf) => handleCreateWorkflowForControl(createWorkflowControl.id, wf)}
          />
        )}
      </AnimatePresence>

      {/* ── Validate RACM Modal ── */}
      <AnimatePresence>
        {showValidateModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setShowValidateModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[440px] p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-brand-50"><FileCheck size={20} className="text-brand-600" /></div>
                  <h2 className="text-[16px] font-bold text-text">Validate RACM</h2>
                </div>

                {/* Checklist */}
                <div className="space-y-2 mb-4">
                  {valChecks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1">
                      {c.done
                        ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        : <XCircle size={15} className="text-red-500 shrink-0" />}
                      <span className={`text-[13px] ${c.done ? 'text-text-secondary' : 'text-text font-semibold'}`}>{c.label}</span>
                    </div>
                  ))}
                </div>

                {/* Blocking errors */}
                {!allValPassed && (
                  <div className="rounded-lg border border-red-200/50 bg-red-50/30 px-3 py-2.5 mb-4">
                    <p className="text-[12px] font-semibold text-red-700 mb-1">Validation blocked — {racmComputed.readiness}</p>
                    <ul className="space-y-0.5">
                      {valChecks.filter(c => !c.done).map((c, i) => (
                        <li key={i} className="text-[11px] text-red-600/80 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-red-500/50 shrink-0" />{c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {allValPassed && (
                  <div className="rounded-lg bg-surface-2/50 border border-border px-3 py-2.5 mb-4">
                    <p className="text-[12px] text-text leading-relaxed">All checks passed. Validating will set RACM status to <strong>Active</strong> and readiness to <strong>Ready</strong>.</p>
                  </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="glass-card rounded-lg p-2"><div className="text-lg font-bold text-text">{totalRisks}</div><div className="text-[10px] text-text-muted">Risks</div></div>
                  <div className="glass-card rounded-lg p-2"><div className="text-lg font-bold text-text">{mappedCount}</div><div className="text-[10px] text-text-muted">Mapped</div></div>
                  <div className="glass-card rounded-lg p-2"><div className="text-lg font-bold text-text">{risks.flatMap(r => r.controls).filter(c => c.isKey).length}</div><div className="text-[10px] text-text-muted">Key Controls</div></div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleValidate} disabled={!allValPassed}
                    className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    {allValPassed ? 'Confirm & Validate' : 'Cannot Validate'}
                  </button>
                  <button onClick={() => setShowValidateModal(false)}
                    className="px-4 py-2.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── New Risk Drawer ── */}
      <AnimatePresence>
        {showNewRiskDrawer && (
          <NewRiskDrawer
            defaultProcess={racmProcess || ''}
            onClose={() => setShowNewRiskDrawer(false)}
            onSave={handleCreateRisk}
          />
        )}
      </AnimatePresence>

      {/* ── Duplicate Risk Warning ── */}
      <AnimatePresence>
        {duplicateRiskWarning && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setDuplicateRiskWarning(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[420px] p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h2 className="text-[16px] font-bold text-text">Similar risk exists</h2>
                </div>
                <p className="text-[12px] text-text-muted mb-3">A risk with a similar name already exists in this RACM:</p>
                <div className="rounded-lg border border-border bg-gray-50 px-4 py-3 mb-4">
                  <div className="text-[12px] font-medium text-text">{duplicateRiskWarning.existingRisk.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{duplicateRiskWarning.existingRisk.id} · {duplicateRiskWarning.existingRisk.process}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => addExistingRiskToRacm(duplicateRiskWarning.existingRisk)}
                    className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer">
                    Use Existing Risk
                  </button>
                  <button onClick={() => addRiskToRacm(duplicateRiskWarning.pendingRisk)}
                    className="px-4 py-2.5 border border-border rounded-lg text-[13px] text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
                    Create Anyway
                  </button>
                  <button onClick={() => setDuplicateRiskWarning(null)}
                    className="px-3 py-2.5 text-[13px] text-gray-400 hover:text-gray-600 cursor-pointer">
                    Cancel
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

// ─── RACM Grid View (Excel-style) ───────────────────────────────────────────

const MAPPING_STATUS_CLS: Record<string, string> = {
  Unmapped: 'bg-red-50 text-red-700',
  'Partially Mapped': 'bg-amber-50 text-amber-700',
  Mapped: 'bg-emerald-50 text-emerald-700',
};

const WF_READINESS_CLS: Record<string, string> = {
  'Setup Incomplete': 'bg-red-50/60 text-red-600',
  'Needs Attributes': 'bg-amber-50/60 text-amber-600',
  Ready: 'bg-emerald-50/60 text-emerald-600',
  '—': 'bg-gray-50 text-gray-400',
};

function getRowMappingStatus(r: RiskItem): string {
  if (r.controls.length === 0) return 'Unmapped';
  if (r.controls.some(c => !c.workflowLinked)) return 'Partially Mapped';
  return 'Mapped';
}

function getRowWorkflowStatus(r: RiskItem): string {
  if (r.controls.length === 0) return '—';
  const readinesses = r.controls.map(c => getControlReadiness(c));
  if (readinesses.some(s => s === 'Setup Incomplete')) return 'Setup Incomplete';
  if (readinesses.some(s => s === 'Needs Attributes')) return 'Needs Attributes';
  return 'Ready';
}

function RacmGridView({ risks, onSelectRisk, onUpdateRisks, onLinkControl, onCreateControl, onLinkWorkflow, onCreateWorkflow, onAddRisk }: {
  risks: RiskItem[];
  onSelectRisk: (id: string) => void;
  onUpdateRisks: (updater: (prev: RiskItem[]) => RiskItem[]) => void;
  onLinkControl: (riskId: string) => void;
  onCreateControl: (riskId: string) => void;
  onLinkWorkflow?: (controlId: string) => void;
  onCreateWorkflow?: (controlId: string) => void;
  onAddRisk?: () => void;
}) {
  const { addToast } = useToast();
  const [gridSearch, setGridSearch] = useState('');
  const [gridFilter, setGridFilter] = useState<'All' | 'Unmapped' | 'Partially Mapped' | 'Mapped' | 'At Risk' | 'Unvalidated'>('All');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [controlPickerRiskId, setControlPickerRiskId] = useState<string | null>(null);
  const [controlSearch, setControlSearch] = useState('');
  const [wfDrawerRiskId, setWfDrawerRiskId] = useState<string | null>(null);
  const wfDrawerRisk = wfDrawerRiskId ? risks.find(r => r.id === wfDrawerRiskId) : null;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filtering
  const q = gridSearch.toLowerCase();
  const filteredRisks = risks.filter(r => {
    if (q && !r.name.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.process.toLowerCase().includes(q)) return false;
    if (gridFilter === 'Unmapped' && r.controls.length > 0) return false;
    if (gridFilter === 'Mapped' && (r.controls.length === 0 || r.controls.some(c => !c.workflowLinked))) return false;
    if (gridFilter === 'Partially Mapped' && !(r.controls.length > 0 && r.controls.some(c => !c.workflowLinked))) return false;
    if (gridFilter === 'At Risk' && r.validationStatus !== 'At Risk') return false;
    if (gridFilter === 'Unvalidated' && r.validationStatus !== 'Unvalidated') return false;
    return true;
  });

  // Summary
  const mappedRiskCount = risks.filter(r => r.controls.length > 0).length;
  const unmappedRiskCount = risks.filter(r => r.controls.length === 0).length;
  const mappedPct = risks.length > 0 ? Math.round((mappedRiskCount / risks.length) * 100) : 0;

  // Selection helpers
  const allSelected = filteredRisks.length > 0 && filteredRisks.every(r => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0;
  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRisks.map(r => r.id)));
  };

  // Inline name edit
  const startEditName = (risk: RiskItem) => {
    setEditingNameId(risk.id);
    setEditNameValue(risk.name);
  };
  const saveName = (riskId: string) => {
    if (editNameValue.trim()) {
      onUpdateRisks(prev => prev.map(r => r.id === riskId ? { ...r, name: editNameValue.trim() } : r));
      addToast({ message: 'Risk name updated', type: 'success' });
    }
    setEditingNameId(null);
  };

  // Toggle key control
  const toggleKeyInGrid = (riskId: string, controlId: string) => {
    onUpdateRisks(prev => prev.map(r => r.id === riskId ? {
      ...r, controls: r.controls.map(c => c.id === controlId ? { ...c, isKey: !c.isKey } : c),
    } : r));
  };

  // Remove control
  const removeControlInGrid = (riskId: string, controlId: string) => {
    onUpdateRisks(prev => prev.map(r => r.id === riskId ? {
      ...r, controls: r.controls.filter(c => c.id !== controlId),
    } : r));
    addToast({ message: 'Control removed from mapping', type: 'info' });
  };

  // Link control from grid picker
  const linkControlFromGrid = (riskId: string, controlId: string) => {
    const ctrl = CONTROL_LIBRARY.find(c => c.id === controlId);
    if (!ctrl) return;
    onUpdateRisks(prev => prev.map(r => r.id === riskId ? {
      ...r, controls: [...r.controls, ctrl],
    } : r));
    addToast({ message: `"${ctrl.name}" mapped`, type: 'success' });
  };

  // Inline control picker — available controls not yet linked to this risk
  const pickerRisk = controlPickerRiskId ? risks.find(r => r.id === controlPickerRiskId) : null;
  const pickerLinkedIds = new Set(pickerRisk?.controls.map(c => c.id) || []);
  const pickerAvailable = CONTROL_LIBRARY.filter(c => !pickerLinkedIds.has(c.id));
  const pickerFiltered = controlSearch
    ? pickerAvailable.filter(c => c.name.toLowerCase().includes(controlSearch.toLowerCase()))
    : pickerAvailable;

  // Bulk actions
  const handleBulkRemoveMapping = () => {
    onUpdateRisks(prev => prev.map(r => selectedIds.has(r.id) ? { ...r, controls: [] } : r));
    addToast({ message: `Mapping removed from ${selectedIds.size} risk${selectedIds.size !== 1 ? 's' : ''}`, type: 'info' });
    setSelectedIds(new Set());
  };

  const handleBulkMarkKey = () => {
    onUpdateRisks(prev => prev.map(r => selectedIds.has(r.id) ? {
      ...r, controls: r.controls.map(c => ({ ...c, isKey: true })),
    } : r));
    addToast({ message: `All controls marked as Key for ${selectedIds.size} risk${selectedIds.size !== 1 ? 's' : ''}`, type: 'success' });
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-3" onClick={() => { if (controlPickerRiskId) setControlPickerRiskId(null); }}>
      {/* Summary bar */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-semibold text-text">{mappedRiskCount} of {risks.length} risks mapped</span>
          <span className="text-[11px] text-text-muted tabular-nums">{mappedPct}%</span>
        </div>
        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-medium transition-all" style={{ width: `${mappedPct}%` }} />
        </div>
      </div>

      {/* Warning banner */}
      {unmappedRiskCount > 0 && (
        <div className="rounded-lg border border-risk/20 bg-risk-50/30 px-4 py-2.5 flex items-center gap-2.5">
          <AlertTriangle size={13} className="text-risk-700 shrink-0" />
          <span className="text-[11px] text-risk-700">{unmappedRiskCount} risk{unmappedRiskCount !== 1 ? 's' : ''} not mapped to controls. Complete mapping before validation.</span>
        </div>
      )}

      {/* Toolbar: search + filters + bulk actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" value={gridSearch} onChange={e => setGridSearch(e.target.value)} placeholder="Search risks..."
              className="pl-8 pr-3 py-1.5 text-[11px] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 transition-colors w-44" />
          </div>
          <div className="flex gap-1">
            {(['All', 'Unmapped', 'Partially Mapped', 'Mapped', 'At Risk', 'Unvalidated'] as const).map(f => (
              <button key={f} onClick={() => setGridFilter(f)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                  gridFilter === f ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              <span className="text-[10px] text-text-muted">{selectedIds.size} selected</span>
              <button onClick={handleBulkMarkKey} className="px-2 py-1 rounded text-[10px] font-semibold text-mitigated-700 bg-mitigated-50 hover:bg-mitigated-50/80 cursor-pointer transition-colors">
                <Star size={9} className="inline mr-0.5 -mt-0.5" />Mark Key
              </button>
              <button onClick={handleBulkRemoveMapping} className="px-2 py-1 rounded text-[10px] font-semibold text-risk-700 bg-risk-50 hover:bg-risk-50/80 cursor-pointer transition-colors">
                <Trash2 size={9} className="inline mr-0.5 -mt-0.5" />Remove
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-1.5 py-1 rounded text-[10px] text-ink-400 hover:text-ink-700 cursor-pointer"><X size={10} /></button>
            </div>
          )}
          {onAddRisk && (
            <button onClick={onAddRisk}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 cursor-pointer transition-colors inline-flex items-center gap-1">
              <Plus size={9} />New Risk
            </button>
          )}
          <span className="text-[10px] text-text-muted">{filteredRisks.length} risk{filteredRisks.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Grid table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 560 }}>
          <table className="w-full text-[11px] table-fixed" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-2/80 backdrop-blur-sm">
                <th className="px-2 py-3 w-[40px]">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-primary accent-primary cursor-pointer" />
                </th>
                {[
                  { label: 'Risk ID', w: 'w-[100px]' },
                  { label: 'Risk Name', w: 'w-[180px]' },
                  { label: 'Process', w: 'w-[100px]' },
                  { label: 'Risk Status', w: 'w-[90px]' },
                  { label: 'Control(s)', w: 'w-[240px]' },
                  { label: 'Key Control', w: 'w-[80px]' },
                  { label: 'Workflow Status', w: 'w-[110px]' },
                  { label: 'Mapping', w: 'w-[80px]' },
                  { label: '', w: 'w-[50px]' },
                ].map(h => (
                  <th key={h.label || 'actions'} className={`px-3 py-3 text-left text-[9px] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap ${h.w}`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRisks.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[12px] text-text-muted">No risks match search or filters</td></tr>
              ) : filteredRisks.map((risk, i) => {
                const keyCount = risk.controls.filter(c => c.isKey).length;
                const mappingStatus = getRowMappingStatus(risk);
                const wfStatus = getRowWorkflowStatus(risk);

                return (<React.Fragment key={risk.id}>
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                    onClick={() => setExpandedRowId(expandedRowId === risk.id ? null : risk.id)}
                    className={`border-b border-border/30 transition-colors cursor-pointer group ${
                      mappingStatus === 'Unmapped' ? 'bg-risk-50/5 hover:bg-risk-50/15' : 'hover:bg-brand-50/15'
                    }`}>
                    {/* Checkbox */}
                    <td className="px-2 py-2.5 w-[40px] align-middle" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(risk.id)} onChange={() => toggleSelect(risk.id)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary accent-primary cursor-pointer" />
                    </td>
                    {/* Risk ID + expand chevron */}
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight size={11} className={`text-ink-400 transition-transform shrink-0 ${expandedRowId === risk.id ? 'rotate-90' : ''}`} />
                        <span className="font-mono text-[10px] text-ink-500 bg-canvas px-1.5 py-0.5 rounded">{risk.id.toUpperCase()}</span>
                      </div>
                    </td>

                    {/* Risk Name — editable */}
                    <td className="px-3 py-2.5 align-middle" onClick={e => e.stopPropagation()}>
                      {editingNameId === risk.id ? (
                        <input value={editNameValue} onChange={e => setEditNameValue(e.target.value)}
                          onBlur={() => saveName(risk.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveName(risk.id); if (e.key === 'Escape') setEditingNameId(null); }}
                          className="w-full px-2 py-1 rounded border border-primary/40 text-[11px] text-text bg-white outline-none ring-2 ring-primary/10"
                          autoFocus />
                      ) : (
                        <div className="group/name cursor-text" onClick={() => startEditName(risk)} title={risk.description}>
                          <div className="text-[11px] font-medium text-text truncate group-hover/name:text-primary transition-colors">{risk.name}</div>
                        </div>
                      )}
                    </td>

                    {/* Process */}
                    <td className="px-3 py-2.5 align-middle">
                      <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60 whitespace-nowrap">
                        {risk.process}
                      </span>
                    </td>

                    {/* Risk Status */}
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center whitespace-nowrap ${VAL_CLS[risk.validationStatus]}`}>{risk.validationStatus}</span>
                    </td>

                    {/* Controls — interactive pills */}
                    <td className="px-3 py-2.5 align-middle relative" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1 max-h-[44px] overflow-hidden">
                        {risk.controls.slice(0, 3).map(c => (
                          <span key={c.id} className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded bg-gray-50 text-[9px] font-medium text-gray-700 border border-gray-200/70 group/pill cursor-default" title={c.name}>
                            <button onClick={() => toggleKeyInGrid(risk.id, c.id)} className="cursor-pointer shrink-0" title={c.isKey ? 'Unmark key' : 'Mark as key'}>
                              <Star size={8} className={c.isKey ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-400 transition-colors'} />
                            </button>
                            <span className="truncate max-w-[80px]">{c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name}</span>
                            <button onClick={() => removeControlInGrid(risk.id, c.id)} className="cursor-pointer shrink-0 opacity-0 group-hover/pill:opacity-100 transition-opacity" title="Remove">
                              <X size={8} className="text-gray-400 hover:text-red-600" />
                            </button>
                          </span>
                        ))}
                        {risk.controls.length > 3 && (
                          <span className="inline-flex items-center px-1.5 h-5 rounded bg-gray-50 text-[9px] font-semibold text-gray-500 border border-gray-200/70">+{risk.controls.length - 3} more</span>
                        )}
                        {/* Add control button */}
                        <button onClick={() => { setControlPickerRiskId(controlPickerRiskId === risk.id ? null : risk.id); setControlSearch(''); }}
                          className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded text-[9px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 cursor-pointer transition-colors border border-primary/20">
                          <Plus size={8} />{risk.controls.length === 0 ? 'Add Control' : '+'}
                        </button>
                      </div>

                      {/* Inline control picker dropdown */}
                      <AnimatePresence>
                        {controlPickerRiskId === risk.id && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }}
                            className="absolute left-2 top-full mt-1 z-30 w-[260px] bg-white rounded-xl border border-border shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-border/50">
                              <div className="relative">
                                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
                                <input value={controlSearch} onChange={e => setControlSearch(e.target.value)} placeholder="Search controls..."
                                  className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-border bg-white text-[11px] placeholder:text-ink-400 outline-none focus:border-primary/40" autoFocus />
                              </div>
                            </div>
                            <div className="max-h-[180px] overflow-y-auto">
                              {pickerFiltered.length === 0 ? (
                                <div className="px-3 py-4 text-center text-[10px] text-ink-400">No controls available</div>
                              ) : pickerFiltered.slice(0, 6).map(ctrl => (
                                <button key={ctrl.id} onClick={() => { linkControlFromGrid(risk.id, ctrl.id); }}
                                  className="w-full text-left px-3 py-2 hover:bg-brand-50/30 transition-colors cursor-pointer border-b border-border/20 last:border-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium text-text truncate">{ctrl.name}</span>
                                    {ctrl.isKey && <Star size={7} className="fill-amber-400 text-amber-400 shrink-0" />}
                                  </div>
                                  <div className="text-[9px] text-ink-400 mt-0.5">{ctrl.automation} · {ctrl.nature}</div>
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-border/50 p-1.5 flex gap-1">
                              <button onClick={() => { setControlPickerRiskId(null); onLinkControl(risk.id); }}
                                className="flex-1 text-center px-2 py-1.5 rounded-lg text-[9px] font-semibold text-primary hover:bg-primary/10 cursor-pointer transition-colors">Browse Library</button>
                              <button onClick={() => { setControlPickerRiskId(null); onCreateControl(risk.id); }}
                                className="flex-1 text-center px-2 py-1.5 rounded-lg text-[9px] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">+ Create New</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>

                    {/* Key Control Count */}
                    <td className="px-3 py-2.5 align-middle text-center">
                      {keyCount > 0
                        ? <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-medium text-gray-600"><Star size={9} className="fill-amber-400 text-amber-400" />{keyCount}</span>
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>

                    {/* Workflow Status — clickable */}
                    <td className="px-3 py-2.5 align-middle" onClick={e => { e.stopPropagation(); if (risk.controls.length > 0) setWfDrawerRiskId(risk.id); }}>
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ${WF_READINESS_CLS[wfStatus]}`}>{wfStatus}</span>
                    </td>

                    {/* Mapping Status */}
                    <td className="px-3 py-2.5 align-middle">
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center whitespace-nowrap ${MAPPING_STATUS_CLS[mappingStatus]}`}>{mappingStatus}</span>
                    </td>

                    {/* Manage Workflow — single row action */}
                    <td className="px-2 py-2.5 align-middle" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        {risk.controls.length > 0 ? (
                          <button onClick={() => setWfDrawerRiskId(risk.id)}
                            title="Manage Workflow" className="p-1.5 rounded-md text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer">
                            <Workflow size={13} />
                          </button>
                        ) : (
                          <span className="p-1.5 text-ink-200"><Workflow size={13} /></span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                  {/* Expanded detail row */}
                  <AnimatePresence>
                    {expandedRowId === risk.id && (
                      <motion.tr key={`exp-${risk.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                        <td colSpan={10} className="p-0">
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.15 }}
                            className="overflow-hidden">
                            <div className="px-6 py-4 bg-surface-2/20 border-b border-border/30 space-y-4">
                              {/* Risk details */}
                              <div className="grid grid-cols-4 gap-4">
                                <div><span className="text-[9px] text-ink-400 uppercase block">Description</span><p className="text-[11px] text-text mt-0.5">{risk.description || '—'}</p></div>
                                <div><span className="text-[9px] text-ink-400 uppercase block">Source Ref</span><p className="text-[11px] text-text mt-0.5 font-mono">{risk.sourceRef}</p></div>
                                <div><span className="text-[9px] text-ink-400 uppercase block">Freshness</span><p className={`text-[11px] font-medium mt-0.5 ${risk.freshness === 'Up to Date' ? 'text-compliant-700' : 'text-high-700'}`}>{risk.freshness}</p></div>
                                <div><span className="text-[9px] text-ink-400 uppercase block">Validation</span><span className={`mt-0.5 px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${VAL_CLS[risk.validationStatus]}`}>{risk.validationStatus}</span></div>
                              </div>

                              {/* SOP Traceability */}
                              {risk.sourceSopName && (
                                <div className="rounded-lg border border-border/40 bg-white px-4 py-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <FileText size={10} className="text-gray-400" />
                                    <span className="text-[9px] font-bold text-ink-400 uppercase tracking-wider">SOP Source</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <span className="text-[9px] text-gray-400 block">SOP</span>
                                      <span className="text-[11px] text-text font-medium">{risk.sourceSopName}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-gray-400 block">Section</span>
                                      <span className="text-[10px] font-mono text-gray-500">{risk.sourceSection}</span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-gray-400 block">Original Text</span>
                                      <span className="text-[10px] text-gray-500 italic line-clamp-2">"{risk.sourceText}"</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Controls detail */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Mapped Controls ({risk.controls.length})</h4>
                                  <div className="flex items-center gap-2">
                                    <button onClick={e => { e.stopPropagation(); onLinkControl(risk.id); }}
                                      className="text-[10px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"><Link2 size={9} />Link Control</button>
                                    <button onClick={e => { e.stopPropagation(); onCreateControl(risk.id); }}
                                      className="text-[10px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"><Plus size={9} />Create Control</button>
                                  </div>
                                </div>
                                {risk.controls.length === 0 ? (
                                  <p className="text-[11px] text-ink-400">No controls mapped. Use the actions above to start.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {risk.controls.map(ctrl => {
                                      const rd = getControlReadiness(ctrl);
                                      const wfs = ctrl.workflows || [];
                                      return (
                                        <div key={ctrl.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/50 bg-white">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[11px] font-medium text-text">{ctrl.name}</span>
                                              {ctrl.isKey && <Star size={8} className="fill-amber-400 text-amber-400 shrink-0" />}
                                              <span className={`px-1.5 h-3.5 rounded text-[8px] font-bold inline-flex items-center ${AUTO_CLS[ctrl.automation]}`}>{ctrl.automation}</span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-[9px] text-ink-400">
                                              <span>{wfs.length} workflow{wfs.length !== 1 ? 's' : ''}</span>
                                              <span>{wfs.reduce((s, w) => s + w.attributes.length, 0)} attrs</span>
                                              {ctrl.owner && <span>{ctrl.owner}</span>}
                                            </div>
                                          </div>
                                          <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center shrink-0 ${READINESS_CLS[rd]}`}>{rd}</span>
                                          {wfs.length === 0 && onLinkWorkflow && (
                                            <button onClick={e => { e.stopPropagation(); onLinkWorkflow(ctrl.id); }}
                                              className="text-[9px] font-semibold text-brand-600 hover:underline cursor-pointer shrink-0">Link Workflow</button>
                                          )}
                                          {wfs.length > 0 && (
                                            <button onClick={e => { e.stopPropagation(); setWfDrawerRiskId(risk.id); }}
                                              className="text-[9px] font-semibold text-brand-600 hover:underline cursor-pointer shrink-0">Manage</button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>);
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border bg-surface-2/30 flex items-center justify-between">
          <span className="text-[10px] text-text-muted">{filteredRisks.length} risk{filteredRisks.length !== 1 ? 's' : ''} · Use inline controls to map, hover for quick actions, click workflow status for details</span>
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-compliant-50 border border-compliant/30" /><span className="text-text-muted">Mapped</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-mitigated-50 border border-mitigated/30" /><span className="text-text-muted">Partial</span></span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-risk-50 border border-risk/30" /><span className="text-text-muted">Unmapped</span></span>
          </div>
        </div>
      </div>

      {/* Workflow Readiness Drawer */}
      <AnimatePresence>
        {wfDrawerRisk && (
          <WorkflowReadinessDrawer
            risk={wfDrawerRisk}
            onClose={() => setWfDrawerRiskId(null)}
            onLinkWorkflow={(ctrlId) => { setWfDrawerRiskId(null); if (onLinkWorkflow) onLinkWorkflow(ctrlId); }}
            onCreateWorkflow={(ctrlId) => { setWfDrawerRiskId(null); if (onCreateWorkflow) onCreateWorkflow(ctrlId); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Workflow Readiness Drawer ──────────────────────────────────────────────

function WorkflowReadinessDrawer({ risk, onClose, onLinkWorkflow, onCreateWorkflow }: {
  risk: RiskItem;
  onClose: () => void;
  onLinkWorkflow: (controlId: string) => void;
  onCreateWorkflow: (controlId: string) => void;
}) {
  const { addToast } = useToast();

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[460px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Workflow Readiness">

        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Workflow size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Workflow Readiness</h2></div>
              <p className="text-[12px] text-ink-500 mt-0.5">{risk.name}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {risk.controls.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={28} className="mx-auto text-ink-300 mb-2" />
              <p className="text-[13px] font-semibold text-ink-600 mb-1">No controls mapped</p>
              <p className="text-[11px] text-ink-400">Map controls first, then link workflows.</p>
            </div>
          ) : (
            risk.controls.map(ctrl => {
              const readiness = getControlReadiness(ctrl);
              const wfs = ctrl.workflows || [];
              const totalAttrs = wfs.reduce((s, w) => s + w.attributes.length, 0);

              return (
                <div key={ctrl.id} className="glass-card rounded-xl p-4">
                  {/* Control header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield size={13} className="text-brand-600 shrink-0" />
                      <span className="text-[12px] font-semibold text-text">{ctrl.name}</span>
                      {ctrl.isKey && <Star size={9} className="fill-mitigated text-mitigated" />}
                    </div>
                    <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${READINESS_CLS[readiness]}`}>{readiness}</span>
                  </div>

                  {/* Workflows under this control */}
                  {wfs.length === 0 ? (
                    <div className="rounded-lg border border-risk/20 bg-risk-50/15 px-3 py-2.5 text-center mb-2">
                      <p className="text-[10px] text-risk-700 font-medium">No workflow linked</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {wfs.map(wf => (
                        <div key={wf.id} className="rounded-lg border border-border px-3 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Workflow size={11} className="text-brand-600 shrink-0" />
                            <span className="text-[11px] font-medium text-text">{wf.name}</span>
                            <span className="text-[9px] font-mono text-ink-400">{wf.version}</span>
                            <span className={`px-1.5 h-4 rounded text-[8px] font-bold inline-flex items-center ${WF_STATUS_CLS[wf.status]}`}>{wf.status}</span>
                          </div>
                          <div className="text-[9px] text-ink-400">{wf.attributes.length} attribute{wf.attributes.length !== 1 ? 's' : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => { onLinkWorkflow(ctrl.id); addToast({ message: 'Opening workflow linker in Split View', type: 'info' }); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 cursor-pointer transition-colors">
                      <Link2 size={10} />Link Workflow
                    </button>
                    <button onClick={() => { onCreateWorkflow(ctrl.id); addToast({ message: 'Opening workflow builder in Split View', type: 'info' }); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-50/80 cursor-pointer transition-colors">
                      <Plus size={10} />Create Workflow
                    </button>
                  </div>

                  {/* Summary line */}
                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[9px] text-ink-400">
                    <span>{wfs.length} workflow{wfs.length !== 1 ? 's' : ''}</span>
                    <span>{totalAttrs} attribute{totalAttrs !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              );
            })
          )}

          {/* Notice */}
          <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2 flex items-start gap-2">
            <Shield size={11} className="text-ink-400 mt-0.5 shrink-0" />
            <span className="text-[9.5px] text-ink-400">Workflow readiness only — no execution or testing data shown here. Link or create workflows to move controls toward Ready status.</span>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Close</button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── New Risk Drawer (for creating risk from RACM) ──────────────────────────

const RISK_CATEGORIES = ['Financial', 'Operational', 'Compliance', 'IT', 'Fraud', 'Reporting', 'Other'];
const RISK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const RISK_PROCESSES = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];

function NewRiskDrawer({ defaultProcess, onClose, onSave }: {
  defaultProcess: string;
  onClose: () => void;
  onSave: (data: { name: string; description: string; process: string; subProcess: string; category: string; owner: string; priority: string }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [process, setProcess] = useState(defaultProcess);
  const [subProcess, setSubProcess] = useState('');
  const [category, setCategory] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('');

  const isValid = name.trim() && description.trim();

  const fCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
  const lCls = 'text-[12px] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 w-full max-w-[480px] h-full bg-white border-l border-canvas-border shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between shrink-0">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink-900">New Risk</h2>
            <p className="text-[12px] text-ink-500 mt-0.5">Create a risk and add it to this RACM.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className={lCls}>Risk Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Unauthorized vendor payments" className={fCls} autoFocus />
          </div>
          <div>
            <label className={lCls}>Description <span className="text-red-400">*</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the risk scenario and potential impact..." className={fCls + ' resize-none'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lCls}>Business Process</label>
              <div className="px-3 py-2.5 border border-border rounded-lg text-[13px] text-text bg-gray-50 cursor-not-allowed">{process || '—'}</div>
            </div>
            <div>
              <label className={lCls}>Sub-process</label>
              <input value={subProcess} onChange={e => setSubProcess(e.target.value)} placeholder="e.g. Accounts Payable" className={fCls} />
            </div>
          </div>
          <div>
            <label className={lCls}>Risk Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={fCls + ' cursor-pointer appearance-none'}>
              <option value="">Select...</option>
              {RISK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lCls}>Risk Owner</label>
              <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Name" className={fCls} />
            </div>
            <div>
              <label className={lCls}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={fCls + ' cursor-pointer appearance-none'}>
                <option value="">Select...</option>
                {RISK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => { if (isValid) onSave({ name, description, process, subProcess, category, owner, priority }); }} disabled={!isValid}
            className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Create & Add to RACM
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── RACM Readiness Card ────────────────────────────────────────────────────

function RacmReadinessCard({ risks, onGoToExecution }: { risks: RiskItem[]; onGoToExecution?: () => void }) {
  const computed = computeRacmStateFromRisks(risks as RiskDetailInput[], false, false);
  const { checks } = computed;

  const checkList = [
    { label: 'Risks added', done: checks.hasRisks },
    { label: 'All risks mapped to controls', done: checks.allRisksMapped },
    { label: 'Key controls identified', done: checks.hasKeyControls },
    { label: 'All controls have workflows', done: checks.allControlsHaveWorkflows },
    { label: 'All workflows have attributes', done: checks.allWorkflowsHaveAttributes },
  ];

  const checksDone = checkList.filter(c => c.done).length;
  const isReady = computed.readiness === 'Ready to Validate' || computed.readiness === 'Ready';

  return (
    <div className={`rounded-xl border p-5 ${isReady ? 'border-emerald-200/50 bg-emerald-50/10' : 'border-border bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className={isReady ? 'text-emerald-700' : 'text-text-muted'} />
          <h4 className="text-[13px] font-bold text-text">RACM Readiness</h4>
          <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${RACM_READINESS_STYLES[computed.readiness]}`}>{computed.readiness}</span>
        </div>
        <span className="text-[11px] text-text-muted">{checksDone}/{checkList.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
        {checkList.map((c, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            {c.done
              ? <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
              : <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
            <span className={`text-[11px] ${c.done ? 'text-text-secondary' : 'text-text font-medium'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => { if (isReady && onGoToExecution) onGoToExecution(); }}
          disabled={!isReady}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
            isReady
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}>
          <ChevronRight size={13} />Go to Execution
        </button>
        {!isReady && <span className="text-[10px] text-text-muted">Resolve remaining checks to proceed</span>}
      </div>

      <div className="mt-3 pt-3 border-t border-border/40">
        <p className="text-[10px] text-ink-400">RACM defines what should be executed. Execution will happen in the Execution tab using linked workflows and selected datasets.</p>
      </div>
    </div>
  );
}

// ─── Link Existing Control Drawer ───────────────────────────────────────────

function LinkControlDrawer({ alreadyLinkedIds, onClose, onLink }: {
  alreadyLinkedIds: string[]; onClose: () => void; onLink: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [processFilter, setProcessFilter] = useState('all');
  const [keyFilter, setKeyFilter] = useState('all');

  const available = CONTROL_LIBRARY.filter(c => !alreadyLinkedIds.includes(c.id));
  const filtered = available.filter(c => {
    if (processFilter !== 'all') return false; // simplified — all controls shown
    if (keyFilter === 'key' && !c.isKey) return false;
    if (keyFilter === 'non-key' && c.isKey) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Link Control">
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Link2 size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Link Existing Control</h2></div>
              <p className="text-[12px] text-ink-500 mt-0.5">Search the Control Library to map a control to this risk.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="px-6 py-3 border-b border-canvas-border space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search controls..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-canvas-border bg-white text-[13px] placeholder:text-ink-400 outline-none focus:border-brand-500/60 transition-all" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-500">Key:</span>
            {['all', 'key', 'non-key'].map(k => (
              <button key={k} onClick={() => setKeyFilter(k)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-all ${keyFilter === k ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-500 hover:bg-brand-50'}`}>
                {k === 'all' ? 'All' : k === 'key' ? 'Key' : 'Non-Key'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-[12px] text-ink-400">No controls available</div>
          ) : filtered.map(ctrl => (
            <button key={ctrl.id} onClick={() => onLink(ctrl.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-canvas-border bg-white hover:bg-canvas hover:border-primary/20 transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-text">{ctrl.name}</span>
                {ctrl.isKey && <Star size={10} className="fill-mitigated text-mitigated" />}
              </div>
              <p className="text-[10px] text-text-muted mb-1.5">{ctrl.description}</p>
              <div className="flex items-center gap-3 text-[9px] text-ink-400">
                <span className={`px-1.5 h-4 rounded font-bold inline-flex items-center ${AUTO_CLS[ctrl.automation]}`}>{ctrl.automation}</span>
                <span>{ctrl.workflowLinked ? ctrl.workflowName : 'No workflow'}</span>
                <span>{ctrl.attributeCount} attrs</span>
              </div>
            </button>
          ))}
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Create New Control Mini Drawer ─────────────────────────────────────────

function CreateControlMiniDrawer({ onClose, onCreate, defaultProcess }: {
  onClose: () => void; onCreate: (ctrl: MappedControl) => void; defaultProcess: string;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [isKey, setIsKey] = useState(false);
  const [automation, setAutomation] = useState<'Manual' | 'Automated' | 'IT-dependent'>('Manual');
  const [nature, setNature] = useState<'Preventive' | 'Detective' | 'Corrective'>('Preventive');

  const isValid = name.trim().length > 0;

  const handleCreate = () => {
    if (!isValid) return;
    onCreate({
      id: `ctl-new-${Date.now()}`, name, description, isKey, automation, nature,
      workflowLinked: false, workflowName: '', attributeCount: 0, lastExecution: '—', status: 'Not Tested',
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Create Control">
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Shield size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Create New Control</h2></div>
              <p className="text-[12px] text-ink-500 mt-0.5">Create and map to selected risk ({defaultProcess}).</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          <div className="mb-3"><label className={labelCls}>Control Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PO Dual Sign-Off" className={inputCls} /></div>
          <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe the control..." className={inputCls + ' resize-none'} /></div>
          <div className="mb-3"><label className={labelCls}>Control Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. Rajiv Sharma" className={inputCls} /></div>

          <div className="mb-4">
            <label className={labelCls}>Key Control</label>
            <div className="flex gap-2">
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setIsKey(v)}
                  className={`px-4 py-2 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${isKey === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>
                  {v ? '★ Key' : 'Non-Key'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className={labelCls}>Automation Type</label>
            <div className="flex gap-2">
              {(['Manual', 'Automated', 'IT-dependent'] as const).map(v => (
                <button key={v} onClick={() => setAutomation(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${automation === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{v}</button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className={labelCls}>Nature</label>
            <div className="flex gap-2">
              {(['Preventive', 'Detective', 'Corrective'] as const).map(v => (
                <button key={v} onClick={() => setNature(v)}
                  className={`px-3 py-2 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${nature === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={handleCreate} disabled={!isValid}
            className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            Create & Map
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Link Workflow to Control Drawer ────────────────────────────────────────

const AVAILABLE_WORKFLOWS: ControlWorkflow[] = [
  { id: 'awf-001', name: 'PO Validation Workflow', version: 'v2.0', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
    { id: 'wa1', name: 'PO Existence', description: 'Verify approved PO', evidenceType: 'PO document', expectedResult: 'Approved PO present', passLogic: 'PO status = Approved' },
    { id: 'wa2', name: 'Payment Approval', description: 'Authorization check', evidenceType: 'Approval log', expectedResult: 'Dual approval', passLogic: 'Two approvals before release' },
  ]},
  { id: 'awf-002', name: 'GRN Matching Workflow', version: 'v1.6', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
    { id: 'wa3', name: 'GRN Match', description: 'Quantity matches PO', evidenceType: 'GRN document', expectedResult: 'Within 5% tolerance', passLogic: 'Variance ≤ 5%' },
  ]},
  { id: 'awf-003', name: 'Invoice Match Workflow', version: 'v2.3', status: 'Active', lastRun: 'Apr 12, 2026', dataRequired: true, attributes: [
    { id: 'wa4', name: 'Invoice Amount Match', description: 'Amount matches PO/GRN', evidenceType: 'Invoice document', expectedResult: 'Within tolerance', passLogic: 'Invoice ≤ PO ± $500/2%' },
    { id: 'wa5', name: 'Tolerance Verification', description: 'Variance documented', evidenceType: 'Exception report', expectedResult: 'Approved', passLogic: 'Exception form signed' },
  ]},
  { id: 'awf-004', name: 'Vendor Change Monitor', version: 'v1.1', status: 'Active', lastRun: 'Apr 10, 2026', dataRequired: true, attributes: [
    { id: 'wa6', name: 'Registration Complete', description: 'Required fields populated', evidenceType: 'Registration form', expectedResult: 'No blanks', passLogic: 'All required fields filled' },
    { id: 'wa7', name: 'Tax ID Verified', description: 'Government DB check', evidenceType: 'System log', expectedResult: 'Valid', passLogic: 'Tax ID returns valid' },
  ]},
  { id: 'awf-005', name: 'Duplicate Detector', version: 'v1.4', status: 'Active', lastRun: 'Apr 18, 2026', dataRequired: true, attributes: [
    { id: 'wa9', name: 'Scan Executed', description: 'Scan before processing', evidenceType: 'System log', expectedResult: 'Log present', passLogic: 'Scan < payment timestamp' },
  ]},
  { id: 'awf-006', name: 'SOD Detector', version: 'v1.1', status: 'Ready', lastRun: '—', dataRequired: true, attributes: [
    { id: 'wa11', name: 'Role Matrix Current', description: 'SOD rules current', evidenceType: 'Matrix export', expectedResult: 'Current version', passLogic: 'Date within 90 days' },
  ]},
  { id: 'awf-007', name: 'GL Reconciliation Workflow', version: 'v1.0', status: 'Draft', lastRun: '—', dataRequired: true, attributes: [] },
  { id: 'awf-008', name: 'Period Close Validator', version: 'v0.9', status: 'Draft', lastRun: '—', dataRequired: true, attributes: [
    { id: 'wa13', name: 'Balance Reconciled', description: 'GL balances match sub-ledger', evidenceType: 'Recon report', expectedResult: 'No variance', passLogic: 'GL = sub-ledger ± $100' },
  ]},
];

function LinkWorkflowToControlDrawer({ control, onClose, onLink }: {
  control: MappedControl;
  onClose: () => void;
  onLink: (wf: ControlWorkflow) => void;
}) {
  const [search, setSearch] = useState('');
  const alreadyLinkedIds = new Set((control.workflows || []).map(w => w.id));
  const available = AVAILABLE_WORKFLOWS.filter(w => !alreadyLinkedIds.has(w.id));
  const filtered = search ? available.filter(w => w.name.toLowerCase().includes(search.toLowerCase())) : available;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[500px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Link Workflow to Control">

        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Link2 size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Link Workflow to Control</h2></div>
              <p className="text-[12px] text-ink-500 mt-1">Workflows are owned by the Control Library. Linking here updates the control object.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
          <div className="mt-3 rounded-lg border border-canvas-border bg-canvas px-3 py-2.5">
            <div className="flex items-center gap-2 mb-0.5">
              <Shield size={12} className="text-brand-600 shrink-0" />
              <span className="text-[12px] font-semibold text-text">{control.name}</span>
              {control.isKey && <Star size={9} className="fill-mitigated text-mitigated" />}
            </div>
            <p className="text-[10px] text-ink-400">{control.description}</p>
          </div>
        </header>

        <div className="px-6 py-3 border-b border-canvas-border">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-canvas-border bg-white text-[13px] placeholder:text-ink-400 outline-none focus:border-brand-500/60 transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Workflow size={28} className="mx-auto text-ink-300 mb-2" />
              <p className="text-[13px] font-semibold text-ink-600 mb-1">No workflows found</p>
              <p className="text-[11px] text-ink-400 mb-3">No matching workflows available in the Control Library.</p>
              <button onClick={() => { onClose(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer">
                <Plus size={11} />Create Workflow
              </button>
            </div>
          ) : filtered.map(wf => (
            <div key={wf.id} className="rounded-xl border border-canvas-border bg-white hover:border-primary/20 hover:bg-primary-xlight/20 transition-all">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Workflow size={13} className="text-brand-600 shrink-0" />
                    <span className="text-[13px] font-semibold text-text">{wf.name}</span>
                    <span className="text-[10px] font-mono text-ink-400">{wf.version}</span>
                    <span className={`px-1.5 h-4 rounded text-[9px] font-bold inline-flex items-center ${WF_STATUS_CLS[wf.status]}`}>{wf.status}</span>
                  </div>
                  <button onClick={() => onLink(wf)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0">
                    <Link2 size={10} />Link
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-ink-400 mb-2">
                  <span>{wf.attributes.length} attribute{wf.attributes.length !== 1 ? 's' : ''}</span>
                  <span>Last run: {wf.lastRun}</span>
                  <span>Data: {wf.dataRequired ? 'Required' : 'No'}</span>
                </div>
                {wf.attributes.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {wf.attributes.map(a => <span key={a.id} className="px-1.5 h-4 rounded text-[9px] font-medium bg-brand-50 text-brand-700 inline-flex items-center">{a.name}</span>)}
                  </div>
                ) : (
                  <span className="text-[10px] text-mitigated-700 font-medium">No attributes configured yet</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas">
          <div className="rounded-lg border border-canvas-border bg-surface-2/50 px-3 py-2 flex items-start gap-2 mb-3">
            <Shield size={11} className="text-ink-400 mt-0.5 shrink-0" />
            <span className="text-[9.5px] text-ink-400 leading-relaxed">Workflows belong to the Control Library. Linking here updates the control object, not the RACM mapping directly.</span>
          </div>
          <button onClick={onClose} className="w-full px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Create Workflow Builder Drawer ─────────────────────────────────────────

function CreateWorkflowBuilderDrawer({ control, onClose, onCreate }: {
  control: MappedControl;
  onClose: () => void;
  onCreate: (wf: ControlWorkflow) => void;
}) {
  const { addToast } = useToast();
  const [mode, setMode] = useState<'choose' | 'builder' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('v1.0');
  const [dataRequired, setDataRequired] = useState(true);
  const [executionType, setExecutionType] = useState('Automated');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Ready'>('Draft');

  // Attributes
  const [attrs, setAttrs] = useState<ControlAttribute[]>([]);
  const [showAttrForm, setShowAttrForm] = useState(false);
  const [editAttrIdx, setEditAttrIdx] = useState<number | null>(null);
  const [attrName, setAttrName] = useState('');
  const [attrDesc, setAttrDesc] = useState('');
  const [attrEvidence, setAttrEvidence] = useState('');
  const [attrExpected, setAttrExpected] = useState('');
  const [attrPassLogic, setAttrPassLogic] = useState('');
  const [attrRequired, setAttrRequired] = useState(true);

  const isValid = name.trim().length > 0;

  const resetAttrForm = () => { setAttrName(''); setAttrDesc(''); setAttrEvidence(''); setAttrExpected(''); setAttrPassLogic(''); setAttrRequired(true); setEditAttrIdx(null); setShowAttrForm(false); };

  const handleAddAttr = () => {
    if (!attrName.trim()) return;
    const attr: ControlAttribute = { id: `attr-new-${Date.now()}`, name: attrName, description: attrDesc, evidenceType: attrEvidence, expectedResult: attrExpected, passLogic: attrPassLogic };
    if (editAttrIdx !== null) {
      setAttrs(prev => prev.map((a, i) => i === editAttrIdx ? attr : a));
    } else {
      setAttrs(prev => [...prev, attr]);
    }
    resetAttrForm();
  };

  const handleEditAttr = (idx: number) => {
    const a = attrs[idx];
    setAttrName(a.name); setAttrDesc(a.description); setAttrEvidence(a.evidenceType); setAttrExpected(a.expectedResult); setAttrPassLogic(a.passLogic); setAttrRequired(true);
    setEditAttrIdx(idx); setShowAttrForm(true);
  };

  const handleDeleteAttr = (idx: number) => { setAttrs(prev => prev.filter((_, i) => i !== idx)); };

  const handleSave = () => {
    if (!isValid) return;
    onCreate({ id: `wf-new-${Date.now()}`, name, version, status: attrs.length > 0 ? 'Ready' : status, lastRun: '—', dataRequired, attributes: attrs });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Create Workflow">

        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Workflow size={18} className="text-brand-600" /><h2 className="font-display text-[18px] font-semibold text-ink-900">Create Workflow</h2></div>
              <p className="text-[12px] text-ink-500 mt-1">Created under <strong className="text-ink-700">{control.name}</strong> in the Control Library.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {/* Mode selection */}
            {!mode && (
              <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-[13px] text-text-secondary">Choose how to build:</p>
                <div className="space-y-3">
                  <button onClick={() => setMode('builder')} className="w-full text-left px-4 py-4 rounded-xl border border-canvas-border bg-white hover:border-primary/20 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-brand-50"><Workflow size={18} className="text-brand-600" /></div><div><div className="text-[13px] font-semibold text-text">Workflow Builder</div><div className="text-[11px] text-text-muted mt-0.5">Define settings and attributes inline.</div></div><ChevronRight size={16} className="text-ink-300 ml-auto shrink-0" /></div>
                  </button>
                  <button onClick={() => { setMode('builder'); addToast({ message: 'Q&A flow — same builder with guided questions', type: 'info' }); }} className="w-full text-left px-4 py-4 rounded-xl border border-canvas-border bg-white hover:border-primary/20 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-evidence-50"><FileText size={18} className="text-evidence-700" /></div><div><div className="text-[13px] font-semibold text-text">Q&A Flow</div><div className="text-[11px] text-text-muted mt-0.5">Answer guided questions step by step.</div></div><ChevronRight size={16} className="text-ink-300 ml-auto shrink-0" /></div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Builder form */}
            {mode === 'builder' && (
              <motion.div key="builder" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-0">
                <button onClick={() => setMode(null)} className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary font-medium mb-3 cursor-pointer"><ArrowLeft size={12} />Back</button>
                <div className="mb-3"><label className={labelCls}>Workflow Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder={`e.g. ${control.name} Test Workflow`} className={inputCls} /></div>
                <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What does this workflow test?" className={inputCls + ' resize-none'} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="mb-3"><label className={labelCls}>Version</label><input value={version} onChange={e => setVersion(e.target.value)} className={inputCls + ' font-mono'} /></div>
                  <div className="mb-3"><label className={labelCls}>Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="e.g. Tushar Goel" className={inputCls} /></div>
                </div>
                <div className="mb-3">
                  <label className={labelCls}>Data Required</label>
                  <div className="flex gap-2">{[true, false].map(v => (<button key={String(v)} onClick={() => setDataRequired(v)} className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${dataRequired === v ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{v ? 'Yes' : 'No'}</button>))}</div>
                </div>
                <div className="mb-3">
                  <label className={labelCls}>Execution Type</label>
                  <div className="flex gap-2">{['Automated', 'Manual', 'Hybrid'].map(t => (<button key={t} onClick={() => setExecutionType(t)} className={`px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${executionType === t ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{t}</button>))}</div>
                </div>

                {/* ── Attributes Section ── */}
                <div className="mt-5 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className={labelCls + ' mb-0'}>Test Attributes ({attrs.length})</label>
                      {attrs.length === 0 && <span className="px-1.5 h-4 rounded text-[9px] font-bold bg-mitigated-50 text-mitigated-700 inline-flex items-center">Needs Attributes</span>}
                      {attrs.length > 0 && <span className="px-1.5 h-4 rounded text-[9px] font-bold bg-compliant-50 text-compliant-700 inline-flex items-center">Ready</span>}
                    </div>
                    {!showAttrForm && <button onClick={() => { resetAttrForm(); setShowAttrForm(true); }} className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer flex items-center gap-1"><Plus size={11} />Add Attribute</button>}
                  </div>

                  {/* Existing attributes */}
                  {attrs.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {attrs.map((a, i) => (
                        <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-canvas-border bg-white">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-text">{a.name}</div>
                            {a.description && <div className="text-[9.5px] text-ink-400 truncate">{a.description}</div>}
                            <div className="flex items-center gap-3 mt-1 text-[9px] text-ink-400">
                              {a.evidenceType && <span className="flex items-center gap-0.5"><Paperclip size={8} />{a.evidenceType}</span>}
                              {a.expectedResult && <span>Expected: {a.expectedResult}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => handleEditAttr(i)} className="p-1 rounded hover:bg-gray-100 text-ink-400 hover:text-ink-700 cursor-pointer"><Eye size={10} /></button>
                            <button onClick={() => handleDeleteAttr(i)} className="p-1 rounded hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add/Edit attribute form */}
                  {showAttrForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-xl border border-brand-200 bg-brand-50/20 p-3 space-y-2 mb-3 overflow-hidden">
                      <div className="text-[11px] font-bold text-brand-700 mb-1">{editAttrIdx !== null ? 'Edit Attribute' : 'New Attribute'}</div>
                      <input value={attrName} onChange={e => setAttrName(e.target.value)} placeholder="Attribute name *" className="w-full px-2.5 py-1.5 rounded-lg border border-border text-[12px] text-text bg-white outline-none focus:border-brand-500/60" />
                      <input value={attrDesc} onChange={e => setAttrDesc(e.target.value)} placeholder="Description" className="w-full px-2.5 py-1.5 rounded-lg border border-border text-[12px] text-text bg-white outline-none focus:border-brand-500/60" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={attrEvidence} onChange={e => setAttrEvidence(e.target.value)} placeholder="Evidence type (e.g. PO doc)" className="px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-text bg-white outline-none focus:border-brand-500/60" />
                        <input value={attrExpected} onChange={e => setAttrExpected(e.target.value)} placeholder="Expected result" className="px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-text bg-white outline-none focus:border-brand-500/60" />
                      </div>
                      <input value={attrPassLogic} onChange={e => setAttrPassLogic(e.target.value)} placeholder="Pass/fail rule (e.g. Amount ≤ threshold)" className="w-full px-2.5 py-1.5 rounded-lg border border-border text-[11px] text-text bg-white outline-none focus:border-brand-500/60 font-mono" />
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1.5">{[true, false].map(v => (<button key={String(v)} onClick={() => setAttrRequired(v)} className={`px-2.5 py-1 rounded text-[10px] font-medium cursor-pointer ${attrRequired === v ? 'bg-brand-600 text-white' : 'bg-white border border-border text-ink-600'}`}>{v ? 'Required' : 'Optional'}</button>))}</div>
                        <div className="flex gap-1.5">
                          <button onClick={resetAttrForm} className="px-2.5 py-1 rounded text-[10px] font-medium text-ink-500 hover:bg-gray-100 cursor-pointer">Cancel</button>
                          <button onClick={handleAddAttr} disabled={!attrName.trim()} className="px-3 py-1 rounded bg-brand-600 text-white text-[10px] font-semibold cursor-pointer disabled:opacity-40">{editAttrIdx !== null ? 'Update' : 'Add'}</button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {attrs.length === 0 && !showAttrForm && (
                    <div className="rounded-lg border border-mitigated/20 bg-mitigated-50/20 px-3 py-2 text-[10px] text-mitigated-700">
                      No attributes yet. Add at least one test attribute for the workflow to be marked Ready.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between">
          <div className="text-[10px] text-ink-400">{attrs.length > 0 ? `${attrs.length} attribute${attrs.length !== 1 ? 's' : ''} → Ready` : 'No attributes → Needs Attributes'}</div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[13px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
            {mode === 'builder' && (
              <button onClick={handleSave} disabled={!isValid}
                className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                Create & Link Workflow
              </button>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}
