import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Paperclip, Sparkles, History, X, FileText,
  Workflow, BarChart3, ChevronDown, ChevronRight,
  MessageSquare, ArrowRight, Plus, Lightbulb,
  Save, CheckCircle, Maximize2, Lock,
  ExternalLink, Download, MoreHorizontal, Pencil, CornerDownLeft, ArrowUpRight,
} from 'lucide-react';
import { CHAT_HISTORY, CHAT_CONVERSATIONS, CLARIFICATION_STEPS, BUSINESS_PROCESSES, SOPS } from '../../data/mockData';
import { useToast } from '../shared/Toast';
import type { WorkflowTypeId } from '../../data/mockData';
import type { ArtifactTab } from '../../hooks/useAppState';
import { TextShimmer } from '../shared/TextShimmer';
import { AuditifyHelloEffect } from '../shared/HelloEffect';
import BorderGlow from '../shared/BorderGlow';
import FloatingLines from '../shared/FloatingLines';
// Persona removed — Rive WebGL crashes in some browsers
import ClarificationCard from './ClarificationCard';
import DataPickerModal, { type AttachmentSelection } from './DataPickerModal';
import { AddToDashboardModal } from './AddToDashboardModal';
import { AddToReportModal } from './AddToReportModal';
import { ConfigurableChart } from '../dashboard/add-widget/ConfigurableChart';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thinking?: string[];
  hasArtifact?: boolean;
  artifactType?: 'workflow' | 'query' | 'report';
  followUps?: string[];
  timestamp: Date;
  // Rich inline components
  richType?: 'summary-kpi' | 'audit-result' | 'audit-loading' | 'clarification' | 'save-workflow-prompt' | 'workflow-checkpoint';
  richData?: Record<string, unknown>;
  // Tracks which dashboards/reports this result was added to
  addedTo?: {
    dashboards?: { id: string; name: string }[];
    reports?: { id: string; name: string }[];
  };
}

// Clarification interaction shape (one per IRA message of richType 'clarification')
interface ClarificationData {
  intro: string;
  questions: { question: string; options: string[] }[];
  answers: Record<number, string>;
  status: 'open' | 'submitted'; // 'submitted' freezes the UI into a recap
}

// ─── Audit-query result fixture ──────────────────────────────────────────────
const AUDIT_RESULT = {
  kpis: [
    { label: 'Records scanned', value: '1.2M', color: 'text-ink-800' },
    { label: 'Duplicates found', value: '8', color: 'text-risk-700' },
    { label: 'Total amount', value: '₹6.16L', color: 'text-mitigated-700' },
    { label: 'Highest match', value: '96%', color: 'text-evidence-700' },
  ],
  charts: [
    {
      id: 'confidence',
      label: 'By confidence',
      // Match-score histogram — 4 vertical bars
      data: [
        { bucket: '90–100%', count: 5, tone: 'bg-risk' },
        { bucket: '80–89%', count: 2, tone: 'bg-high' },
        { bucket: '70–79%', count: 1, tone: 'bg-mitigated' },
        { bucket: '60–69%', count: 0, tone: 'bg-compliant' },
      ],
    },
    {
      id: 'vendor',
      label: 'By vendor',
      // Top vendors — horizontal bars
      data: [
        { bucket: 'Acme Corp', count: 4, tone: 'bg-risk' },
        { bucket: 'Global Supplies', count: 2, tone: 'bg-high' },
        { bucket: 'TechParts Ltd', count: 1, tone: 'bg-mitigated' },
        { bucket: 'FastShip Logistics', count: 1, tone: 'bg-mitigated' },
      ],
    },
  ],
  table: {
    columns: ['Invoice A', 'Invoice B', 'Vendor', 'Amount', 'Match %'],
    rows: [
      ['INV-2024-8821', 'INV-2024-8847', 'Acme Corp', '₹1,42,500', '96%'],
      ['INV-2024-8910', 'INV-2024-9001', 'Acme Corp', '₹89,200', '94%'],
      ['INV-2024-9112', 'INV-2024-9183', 'Global Supplies', '₹2,18,400', '92%'],
      ['INV-2024-9245', 'INV-2024-9301', 'Acme Corp', '₹54,000', '91%'],
      ['INV-2024-9377', 'INV-2024-9420', 'Global Supplies', '₹76,800', '90%'],
    ],
    totalRows: 8,
  },
};

const AUDIT_FOLLOWUPS = [
  'Show match-method breakdown for the top 3 flags',
  'Drill into Acme Corp’s flagged invoices',
  'Build a recurring duplicate-invoice monitoring workflow',
];

interface ChatViewProps {
  showChatHistory: boolean;
  toggleChatHistory: () => void;
  setShowArtifacts: (v: boolean) => void;
  setActiveArtifactTab: (t: ArtifactTab) => void;
  setArtifactMode: (m: 'query' | 'workflow') => void;
  setWorkflowCanvasStage?: (stage: number) => void;
  setWorkflowType?: (type: WorkflowTypeId | null) => void;
  setQueryAssumptions?: (assumptions: string[]) => void;
  initialQuery?: string;
  onInitialQueryProcessed?: () => void;
  /** When set, ChatView loads CHAT_CONVERSATIONS[selectedChatId] on mount/change. */
  selectedChatId?: string | null;
  /** Called once the selected chat has been loaded so the parent can clear the id. */
  onChatLoaded?: () => void;
  /** Optional view router so the slide-out can deep-link to /recents. */
  setView?: (v: import('../../hooks/useAppState').View) => void;
  /** Pending dashboard waiting for chat data */
  pendingDashboard?: { name: string; description: string } | null;
  /** Create dashboard with fields from chat */
  onAddToDashboard?: (fields: string[]) => void;
  /** Dismiss the pending dashboard banner */
  onDismissPendingDashboard?: () => void;
  /**
   * Hand the typed prompt to the AI Concierge workflow builder. Invoked from
   * the empty-state Submit when the "Build a workflow" toggle is on — the
   * builder opens directly on the clarification screen.
   */
  onLaunchWorkflowBuilder?: (prompt: string) => void;
  /** Available dashboards for "Add to Dashboard" modal */
  availableDashboards?: import('./AddToDashboardModal').DashboardOption[];
  /** Available reports for "Add to Report" modal */
  availableReports?: import('./AddToReportModal').ReportOption[];
  /** Called when user adds result to a dashboard */
  onAddResultToDashboard?: (payload: {
    dashboardId: string;
    dashboardName: string;
    isNew: boolean;
    newName?: string;
    newDescription?: string;
    selection: import('./AddToDashboardModal').GranularSelection;
  }) => void;
  /** Called when user adds result to a report */
  onAddResultToReport?: (payload: {
    reportId: string;
    reportName: string;
    isNew: boolean;
    newName?: string;
    newDescription?: string;
    selection: import('./AddToDashboardModal').GranularSelection;
  }) => void;
  /** Navigate to a dashboard detail view */
  onViewDashboard?: (dashboardId: string) => void;
  /** Navigate to a report view */
  onViewReport?: (reportId: string) => void;
}

// Step labels for the subtle inline audit loader. The artifact panel renders
// the full Plan / Code / Sources detail; here we only narrate progress as a
// single shimmering line and sync the active artifact tab.
const LOADING_STEPS: { label: string; tab: ArtifactTab | null }[] = [
  { label: 'Generating execution plan…',  tab: 'plan' },
  { label: 'Writing SQL query…',          tab: 'code' },
  { label: 'Connecting data sources…',    tab: 'sources' },
  { label: 'Processing 1.2M records…',    tab: null },
];

const WORKFLOW_TYPE_NAMES: Record<WorkflowTypeId, string> = {
  reconciliation: 'Three-Way Reconciliation',
  detection: 'Duplicate Detection',
  monitoring: 'Vendor Master Monitoring',
  compliance: 'Segregation of Duties Compliance',
};

const detectWorkflowType = (msg: string): WorkflowTypeId => {
  const lower = msg.toLowerCase();
  if (lower.includes('reconciliation') || lower.includes('3-way') || lower.includes('po match')) return 'reconciliation';
  if (lower.includes('duplicate') || lower.includes('detection')) return 'detection';
  if (lower.includes('monitor') || lower.includes('vendor master') || lower.includes('change')) return 'monitoring';
  if (lower.includes('sod') || lower.includes('segregation') || lower.includes('compliance')) return 'compliance';
  return 'detection';
};

// ─── Chart rendering (reuses dashboard ConfigurableChart) ─────────────────────

function renderChart(chart: typeof AUDIT_RESULT.charts[number], variant: 'inline' | 'fullscreen') {
  const isConfidence = chart.id === 'confidence';
  return (
    <div style={variant === 'fullscreen' ? { width: '100%', height: '100%' } : { height: 240 }}>
      <ConfigurableChart
        type={isConfidence ? 'bar' : 'pie'}
        xAxis={isConfidence ? 'Quarter' : 'Department'}
        color={isConfidence ? '#7C3AED' : '#3d68ee'}
        showTarget={false}
        showLegend={!isConfidence}
      />
    </div>
  );
}

// ─── ChartGroup with chip toggle + fullscreen ────────────────────────────────

function ChartGroup({ charts }: { charts: typeof AUDIT_RESULT.charts }) {
  const [activeId, setActiveId] = useState(charts[0].id);
  const [fullscreen, setFullscreen] = useState(false);
  const active = charts.find(c => c.id === activeId) ?? charts[0];

  return (
    <>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-canvas-border bg-paper-50/60">
          {charts.length > 1 ? (
            <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-paper-100">
              {charts.map(c => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`px-2.5 h-7 rounded text-[12px] font-medium transition-colors ${
                      isActive ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[12px] font-medium text-ink-700">{active.label}</span>
          )}
          <button
            onClick={() => setFullscreen(true)}
            className="p-1.5 rounded-md text-ink-500 hover:text-ink-700 hover:bg-paper-100 transition-colors cursor-pointer"
            aria-label="Expand chart"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        <div>{renderChart(active, 'inline')}</div>
      </div>
      <AnimatePresence>
        {fullscreen && (
          <FullscreenChartModal
            charts={charts}
            activeId={activeId}
            onActiveChange={setActiveId}
            onClose={() => setFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FullscreenChartModal({
  charts, activeId, onActiveChange, onClose,
}: {
  charts: typeof AUDIT_RESULT.charts;
  activeId: string;
  onActiveChange: (id: string) => void;
  onClose: () => void;
}) {
  const active = charts.find(c => c.id === activeId) ?? charts[0];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop — same as dashboard */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog — same ratio as dashboard ExpandedWidgetModal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '96vw', height: '94vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-canvas-border shrink-0">
          {charts.length > 1 ? (
            <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-paper-100">
              {charts.map(c => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => onActiveChange(c.id)}
                    className={`px-3 h-7 rounded text-[12px] font-medium transition-colors cursor-pointer ${
                      isActive ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[13px] font-semibold text-ink-800">{active.label}</span>
          )}
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-500 hover:text-ink-700 hover:bg-paper-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Chart — fills remaining space, same as dashboard */}
        <div className="relative flex-1 overflow-hidden" style={{ minHeight: 200 }}>
          {renderChart(active, 'fullscreen')}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Results table preview ───────────────────────────────────────────────────

function ResultsTable({
  columns, rows, totalRows, onOpen, onDownload,
}: {
  columns: string[];
  rows: string[][];
  totalRows: number;
  onOpen: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-canvas-border bg-paper-50">
              {columns.map(c => (
                <th key={c} className="text-left px-3 py-2.5 font-semibold text-ink-500">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 py-2.5 text-ink-700 ${j >= 3 ? 'tabular-nums' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-canvas-border bg-paper-50/60">
        <span className="text-[12px] text-ink-500">Preview · <span className="tabular-nums">{rows.length}</span> of <span className="tabular-nums">{totalRows}</span> results</span>
        <div className="flex items-center gap-1">
          <button onClick={onOpen} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-ink-600 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer">
            <ExternalLink size={12} /> Open in new view
          </button>
          <button onClick={onDownload} className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-ink-600 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer">
            <Download size={12} /> Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible thinking trail (one per IRA message) ───────────────────────

function ThinkingTrail({ summary, steps, defaultOpen = false }: {
  summary: string;
  steps: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!steps.length) return null;
  return (
    <button
      onClick={() => setOpen(p => !p)}
      className="group inline-flex items-start gap-1.5 text-left text-[12px] text-ink-500 hover:text-ink-700 transition-colors cursor-pointer mb-2"
    >
      <ChevronRight size={12} className={`mt-0.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      <span className="flex-1">
        <span className="block">{summary}</span>
        {open && (
          <span className="mt-1.5 block pl-2 border-l border-canvas-border space-y-0.5">
            {steps.map((s, i) => (
              <span key={i} className="block text-ink-500">— {s}</span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Clarification block (interactive, lives inside an IRA message) ────────

function ClarificationBlock({
  data, onAnswer, onSubmit, onSkipAll, onSkipCurrent,
}: {
  data: ClarificationData;
  onAnswer: (qIndex: number, answer: string) => void;
  onSubmit: () => void;
  onSkipAll: () => void;
  onSkipCurrent: (qIndex: number) => void;
}) {
  const total = data.questions.length;
  const answeredCount = Object.keys(data.answers).length;
  const activeIndex = data.questions.findIndex((_, i) => data.answers[i] === undefined);

  const [highlighted, setHighlighted] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef(customInput);
  customInputRef.current = customInput;

  // Reset highlight + input when active question changes
  useEffect(() => {
    setHighlighted(0);
    setCustomInput('');
  }, [activeIndex]);

  const activeQ = activeIndex !== -1 ? data.questions[activeIndex] : null;
  const optionCount = activeQ?.options.length ?? 0;

  // Keyboard navigation — only fires while clarification is open and active
  useEffect(() => {
    if (data.status === 'submitted' || activeIndex === -1 || !activeQ) return;
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inMainTextarea =
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement && active !== inputRef.current);
      const inOurInput = active === inputRef.current;

      if (e.key === 'ArrowDown') {
        if (inMainTextarea) return;
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, optionCount - 1));
      } else if (e.key === 'ArrowUp') {
        if (inMainTextarea) return;
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === 'Enter' && !inMainTextarea && !inOurInput) {
        e.preventDefault();
        selectOption(activeQ.options[highlighted]);
      } else if (e.key === 'Escape') {
        if (inMainTextarea) return;
        e.preventDefault();
        skipCurrent();
      } else if (/^[1-9]$/.test(e.key) && !inMainTextarea && !inOurInput) {
        const num = parseInt(e.key, 10) - 1;
        if (num < optionCount) {
          e.preventDefault();
          selectOption(activeQ.options[num]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // selectOption / skipCurrent close over highlighted + activeIndex; we want fresh ones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, activeIndex, optionCount, data.status]);

  if (data.status === 'submitted') {
    return (
      <div className="text-[13px] text-ink-700 leading-relaxed">
        Got it — running with these inputs.
      </div>
    );
  }

  if (activeIndex === -1 || !activeQ) {
    return null;
  }

  function selectOption(opt: string) {
    if (activeIndex === -1) return;
    const wasLast = answeredCount === total - 1;
    onAnswer(activeIndex, opt);
    if (wasLast) setTimeout(() => onSubmit(), 80);
  }

  function skipCurrent() {
    if (activeIndex === -1) return;
    const wasLast = activeIndex === total - 1;
    onSkipCurrent(activeIndex);
    if (wasLast) setTimeout(() => onSubmit(), 80);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 border-b border-canvas-border/60 bg-canvas-elevated flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-ink-800 truncate">{activeQ.question}</span>
          <span className="text-[11px] text-ink-500 tabular-nums shrink-0">· {activeIndex + 1} of {total}</span>
        </div>

        {/* Numbered options */}
        <div role="listbox" aria-label={activeQ.question}>
          {activeQ.options.map((opt, idx) => {
            const isHighlighted = highlighted === idx;
            return (
              <button
                key={opt}
                role="option"
                aria-selected={isHighlighted}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-canvas-border/60 first:border-t-0 transition-colors cursor-pointer ${
                  isHighlighted ? 'bg-primary-xlight' : 'hover:bg-primary-xlight/50'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
                  isHighlighted ? 'bg-primary-xlight text-primary font-semibold' : 'bg-ink-300/15 text-ink-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="flex-1 text-[13px] text-ink-800">{opt}</span>
                {isHighlighted && (
                  <CornerDownLeft size={12} className="text-primary shrink-0" />
                )}
              </button>
            );
          })}

          {/* Custom input row */}
          <div className="border-t border-canvas-border/60 flex items-center gap-3 px-4 py-2">
            <Pencil size={13} className="text-ink-400 shrink-0" />
            <input
              ref={inputRef}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customInputRef.current.trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                  selectOption(customInputRef.current.trim());
                }
              }}
              placeholder="Something else"
              className="flex-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 outline-none h-8"
            />
            <button
              onClick={skipCurrent}
              className="px-3 h-7 text-[12px] font-medium text-ink-600 hover:text-ink-800 border border-canvas-border bg-canvas-elevated hover:bg-paper-50 rounded-md transition-colors cursor-pointer shrink-0"
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      {/* Footer kbd hints + answered tally */}
      <div className="flex items-center justify-between gap-4 text-[11px] text-ink-500 px-1">
        <div className="flex items-center gap-3">
          <span>↑↓ to navigate</span>
          <span className="text-ink-300">·</span>
          <span>Enter to select</span>
          <span className="text-ink-300">·</span>
          <span>Esc to skip</span>
        </div>
        <span className="tabular-nums">{answeredCount} of {total} answered</span>
      </div>
    </div>
  );
}

// ─── Subtle inline audit loader ───────────────────────────────────────────────
// Single shimmering line that cycles through LOADING_STEPS, syncs the active
// artifact tab as it advances, and fires onComplete when done. The artifact
// panel carries the heavy detail (Plan / Code / Sources); inline stays quiet.
function InlineAuditLoader({
  steps,
  onTabSwitch,
  onComplete,
  stepDurationMs = 1700,
}: {
  steps: { label: string; tab: ArtifactTab | null }[];
  onTabSwitch?: (tab: ArtifactTab) => void;
  onComplete: () => void;
  stepDurationMs?: number;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onTabSwitchRef = useRef(onTabSwitch);
  onCompleteRef.current = onComplete;
  onTabSwitchRef.current = onTabSwitch;

  useEffect(() => {
    if (completedRef.current) return;
    if (stepIdx >= steps.length) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }
    const tab = steps[stepIdx].tab;
    if (tab) onTabSwitchRef.current?.(tab);
    const t = setTimeout(() => setStepIdx(i => i + 1), stepDurationMs);
    return () => clearTimeout(t);
  }, [stepIdx, steps, stepDurationMs]);

  const active = steps[Math.min(stepIdx, steps.length - 1)];
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-600">
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
      </span>
      <TextShimmer as="span" duration={2} spread={1.5}>
        {active.label}
      </TextShimmer>
    </div>
  );
}

function SaveWorkflowButton() {
  const [saved, setSaved] = useState(false);
  if (saved) {
    return (
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 px-3 py-2 bg-compliant-50 text-compliant rounded-lg text-[12px] font-semibold">
        <CheckCircle size={12} /> Saved to Library
      </motion.div>
    );
  }
  return (
    <button onClick={() => setSaved(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer">
      <Save size={12} /> Save to Library
    </button>
  );
}

// ─── Save-as-Workflow Modal ─────────────────────────────────────────────────
// Path 3 commit moment: turning a query thread into a workflow thread is
// irreversible per PRD, so the modal captures metadata (name, BP, sub-process,
// description) and surfaces the warning copy before flipping artifactMode.

interface SaveAsWorkflowModalProps {
  open: boolean;
  defaultName: string;
  defaultDescription: string;
  onCancel: () => void;
  onConfirm: (data: { name: string; bpId: string; subProcessId: string; description: string }) => void;
}

function SaveAsWorkflowModal({ open, defaultName, defaultDescription, onCancel, onConfirm }: SaveAsWorkflowModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [bpId, setBpId] = useState<string>('');
  const [subProcessId, setSubProcessId] = useState<string>('');

  // Reset form when modal opens with fresh defaults
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription);
      setBpId('');
      setSubProcessId('');
    }
  }, [open, defaultName, defaultDescription]);

  // Sub-process options derived from SOPs filtered by selected BP
  const subProcessOptions = bpId ? SOPS.filter(s => s.bpId === bpId) : [];

  const canConfirm = name.trim() && bpId && subProcessId;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="save-as-wf-title">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[4px]"
        onClick={onCancel}
      />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl border border-border-light w-[560px] max-w-[92vw] max-h-[88vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-xlight flex items-center justify-center shrink-0">
              <Save size={16} className="text-primary" />
            </div>
            <div>
              <h2 id="save-as-wf-title" className="text-[15px] font-semibold text-text">Save as workflow</h2>
              <p className="text-[12px] text-text-muted mt-0.5">Turn this query result into a re-runnable workflow.</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 text-text-muted hover:text-text-secondary rounded-md hover:bg-paper-50 transition-colors cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div className="mx-6 mb-4 px-3 py-2.5 rounded-lg bg-mitigated-50 border border-mitigated-200 flex gap-2 items-start">
          <Lightbulb size={13} className="text-mitigated-700 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-relaxed text-mitigated-700">
            This chat will switch to <strong>workflow mode</strong>. You won't be able to switch back to query mode in this chat — start a new chat for that.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 flex-1 overflow-y-auto space-y-4">
          {/* Workflow name */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1.5">Workflow name <span className="text-risk">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              placeholder="e.g., Duplicate Invoice Detection — Q1 ±3 days"
            />
            <p className="text-[11px] text-text-muted mt-1">IRA pre-filled this from your query. Edit if needed.</p>
          </div>

          {/* Two-column row: BP + Sub-process */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1.5">Business process <span className="text-risk">*</span></label>
              <select
                value={bpId}
                onChange={e => { setBpId(e.target.value); setSubProcessId(''); }}
                className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
              >
                <option value="">Select…</option>
                {BUSINESS_PROCESSES.map(bp => (
                  <option key={bp.id} value={bp.id}>{bp.name} ({bp.abbr})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1.5">Sub-process <span className="text-risk">*</span></label>
              <select
                value={subProcessId}
                onChange={e => setSubProcessId(e.target.value)}
                disabled={!bpId}
                className="w-full h-10 px-3 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer disabled:bg-paper-50 disabled:text-text-muted disabled:cursor-not-allowed"
              >
                <option value="">{bpId ? 'Select…' : 'Pick a business process first'}</option>
                {subProcessOptions.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.name.replace(/\s*SOP$/i, '').trim()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-[13px] text-text border border-border-light rounded-lg bg-white focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none"
              placeholder="One-line summary of what this workflow does."
            />
            <p className="text-[11px] text-text-muted mt-1">Optional. IRA pre-filled this from your query.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border-light px-6 py-3 flex items-center justify-end gap-2 bg-paper-50/40">
          <button onClick={onCancel} className="px-4 py-2 text-[12px] font-semibold text-text-muted hover:text-text-secondary hover:bg-white rounded-lg transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm({ name: name.trim(), bpId, subProcessId, description: description.trim() })}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-paper-200 disabled:text-text-muted disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <Save size={12} /> Save & switch to workflow
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ChatView({ showChatHistory, toggleChatHistory, setShowArtifacts, setActiveArtifactTab, setArtifactMode, setWorkflowType, initialQuery, onInitialQueryProcessed, selectedChatId, onChatLoaded, setView, pendingDashboard, onAddToDashboard, onDismissPendingDashboard, onLaunchWorkflowBuilder, availableDashboards, availableReports, onAddResultToDashboard, onAddResultToReport, onViewDashboard, onViewReport }: ChatViewProps) {
  const { addToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const processingRef = useRef(false);

  // New flow state
  const [showClarificationCard, setShowClarificationCard] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{ question: string; options: string[] }>>([]);
  const [showProgressiveLoader, setShowProgressiveLoader] = useState(false);

  // Workflow build flow state
  const [workflowBuildPhase, setWorkflowBuildPhase] = useState(0); // 0=idle, 1=asking-files, 2=asking-logic, 3=confirming, 4=input-config, 5=freeze-confirm, 6=output-config, 7=save
  const [currentWorkflowType, setCurrentWorkflowType] = useState<WorkflowTypeId | null>(null);

  // Composer mode toggle — drives whether a Submit routes to query or workflow flow.
  // Default is query (toggle off); user opts into workflow build by toggling the pill on.
  const [buildWorkflowMode, setBuildWorkflowMode] = useState(false);

  // Save-as-workflow flow state (Path 3 — query → workflow flip)
  const [showSaveAsWfModal, setShowSaveAsWfModal] = useState(false);
  const [lockedAsWorkflow, setLockedAsWorkflow] = useState(false);

  // Data picker modal — replaces the raw file-input click on the upload buttons.
  // attachedSources are picks from existing data (files / DBs / APIs / cloud / session)
  // and live alongside the legacy `files` array (raw fresh uploads).
  const [showDataPicker, setShowDataPicker] = useState(false);
  const [attachedSources, setAttachedSources] = useState<AttachmentSelection[]>([]);

  // Add-to-dashboard / add-to-report modals
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  // Which message's result we're adding (tracks the message id)
  const [activeAddMsgId, setActiveAddMsgId] = useState<string | null>(null);
  // Dropdown on already-added buttons: "msg-id:dashboard" or "msg-id:report"
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Track whether the progressive loader is rendering an audit-query response
  const activeQueryFlowRef = useRef<'audit-query' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isUserScrolledUp = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserScrolledUp.current = distanceFromBottom > threshold;
  }, []);

  useEffect(() => {
    if (!isUserScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, thinkingSteps, showClarificationCard, showProgressiveLoader]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // Support for "Ask AI about risk" context — auto-send initialQuery when it appears
  useEffect(() => {
    if (initialQuery) {
      setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: initialQuery, timestamp: new Date() }]);
      simulateResponse(initialQuery);
      onInitialQueryProcessed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Clear all pending timers
  const clearTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  // Schedule a callback after ms — stored in ref for cleanup
  const schedule = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  // ─── Load a saved conversation by id (used by slide-out + Recents) ───
  const loadChatById = useCallback((chatId: string) => {
    const convo = CHAT_CONVERSATIONS[chatId];
    if (!convo) return false;
    const msgs: ChatMessage[] = convo.map((m, idx) => ({
      id: `history-${chatId}-${idx}`,
      role: m.role,
      text: m.text,
      timestamp: new Date(),
    }));
    setMessages(msgs);
    setShowClarificationCard(false);
    setShowProgressiveLoader(false);
    setIsTyping(false);
    setThinkingSteps([]);
    setWorkflowBuildPhase(0);
    setCurrentWorkflowType(null);
    setLockedAsWorkflow(false);
    clearTimers();
    return true;
  }, []);

  // Honor selectedChatId from app state (Recents → Chats deep-link).
  // Always clear the selection after the effect runs — even when the id has
  // no matching CHAT_CONVERSATIONS entry — so a stale id never sticks.
  useEffect(() => {
    if (!selectedChatId) return;
    loadChatById(selectedChatId);
    onChatLoaded?.();
  }, [selectedChatId, loadChatById, onChatLoaded]);

  // ─── Query Clarification Complete Handler ───
  // ─── Start the audit run as ONE IRA message that hosts the loader inline ───
  const auditRunMsgIdRef = useRef<string | null>(null);
  const startAuditQueryRun = () => {
    activeQueryFlowRef.current = 'audit-query';
    const msgId = `msg-audit-run-${Date.now()}`;
    auditRunMsgIdRef.current = msgId;

    setMessages(prev => [...prev, {
      id: msgId,
      role: 'assistant',
      text: '',
      thinking: [
        'Generating execution plan',
        'Writing SQL query',
        'Connecting to data sources',
        'Processing 1.2M records',
      ],
      timestamp: new Date(),
      richType: 'audit-loading',
    }]);

    setShowProgressiveLoader(true);
    setArtifactMode('query');
    setShowArtifacts(true);
    setActiveArtifactTab('plan');
  };

  // ─── Update an answer for the active clarification message ───
  const updateClarificationAnswer = (msgId: string, qIndex: number, answer: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      return {
        ...m,
        richData: { ...data, answers: { ...data.answers, [qIndex]: answer } } as unknown as Record<string, unknown>,
      };
    }));
  };

  // ─── Skip a single clarification question — sentinel '' marks "skipped but acknowledged" ───
  const skipClarificationQuestion = (msgId: string, qIndex: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      return {
        ...m,
        richData: { ...data, answers: { ...data.answers, [qIndex]: '' } } as unknown as Record<string, unknown>,
      };
    }));
  };

  // ─── Submit the clarification — freeze it, drop a single user msg, start the run ───
  const submitClarification = (msgId: string, fromSkip = false) => {
    let consolidated: { question: string; answer: string }[] = [];
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'clarification') return m;
      const data = m.richData as unknown as ClarificationData;
      consolidated = data.questions
        .map((q, qi) => ({ question: q.question, answer: data.answers[qi] }))
        .filter(p => !!p.answer);
      return {
        ...m,
        richData: { ...data, status: 'submitted' } as unknown as Record<string, unknown>,
      };
    }));

    schedule(() => {
      const userText = consolidated.length
        ? consolidated.map(c => `• ${c.answer}`).join('\n')
        : (fromSkip ? 'Skip — use sensible defaults.' : 'Run with the inputs above.');
      setMessages(prev => [...prev, {
        id: `msg-user-clarify-${Date.now()}`,
        role: 'user',
        text: userText,
        timestamp: new Date(),
      }]);
    }, 80);

    schedule(() => startAuditQueryRun(), 240);
  };

  // ─── Workflow Clarification Complete Handler ───
  const handleWorkflowClarificationComplete = (answers: Record<number, string>) => {
    setShowClarificationCard(false);

    if (workflowBuildPhase === 1) {
      // Phase 1 complete — summarize and move to Phase 2 (logic)
      const format = answers[0] || 'Mixed sources';
      const count = answers[1] || '3+ sources';
      setMessages(prev => [...prev, {
        id: `msg-wf-files-summary-${Date.now()}`,
        role: 'assistant',
        text: `Got it — **${format}** with **${count}**. Now let me understand the matching logic.`,
        timestamp: new Date(),
      }]);
      setWorkflowBuildPhase(2);

      // Show logic clarification card after brief delay
      schedule(() => {
        setClarificationQuestions([
          { question: 'What matching logic should I use?', options: ['Exact field matching', 'Fuzzy match with tolerance', 'AI-powered pattern detection', 'Custom rules (I\'ll define)'] },
          { question: 'What should happen with mismatches?', options: ['Flag for manual review', 'Auto-reject and notify', 'Quarantine for investigation', 'Score and prioritize'] },
        ]);
        setShowClarificationCard(true);
      }, 800);
    }
    else if (workflowBuildPhase === 2) {
      // Phase 2 complete — summarize and wait for user confirmation before opening canvas
      const logic = answers[0] || 'Fuzzy match';
      const action = answers[1] || 'Flag for review';
      setMessages(prev => [...prev, {
        id: `msg-wf-logic-summary-${Date.now()}`,
        role: 'assistant',
        text: `Perfect — **${logic}** with **${action}** for mismatches.\n\nHere's what I'll build:\n\n• **Data sources:** Mixed format (SQL + file upload)\n• **Matching:** ${logic}\n• **Mismatches:** ${action}\n\nShall I open the workflow canvas and configure the inputs? Type **"go"** or **"looks good"** to proceed.`,
        timestamp: new Date(),
        followUps: ['Looks good, build it', 'Change the matching logic', 'Add more data sources'],
      }]);
      setWorkflowBuildPhase(3);
    }
  };

  // ─── Clarification Card Complete Router (workflow flow only — audit-query is inline now) ───
  const handleClarificationCardComplete = (answers: Record<number, string>) => {
    setShowClarificationCard(false);
    if (workflowBuildPhase > 0) {
      handleWorkflowClarificationComplete(answers);
    }
  };

  // ─── Inline Query Clarification Flow ───
  // ONE IRA message holds: thinking summary + intro + 4 stacked questions + submit row.
  // User answers via clicking options or typing in the main chat box (routed to first
  // unanswered question while a clarification is open).
  const startQueryClarificationFlow = () => {
    clearTimers();
    setIsTyping(true);

    schedule(() => {
      setIsTyping(false);
      const questions = CLARIFICATION_STEPS.map(step => ({
        question: step.question,
        options: step.options,
      }));
      const data: ClarificationData = {
        intro: "One quick check before I run — pick what fits, or type your own.",
        questions,
        answers: {},
        status: 'open',
      };
      setMessages(prev => [...prev, {
        id: `msg-clarify-${Date.now()}`,
        role: 'assistant',
        text: '',
        thinking: [
          'Parsed intent: invoice duplicate detection',
          'Identified 4 underspecified parameters',
          'Selected highest-impact prompts for clarification',
        ],
        timestamp: new Date(),
        richType: 'clarification',
        richData: data as unknown as Record<string, unknown>,
      }]);
    }, 600);
  };

  // ─── Progressive Loading Complete — swap the SAME IRA msg from loading → result ───
  const handleProgressiveLoadingComplete = () => {
    setShowProgressiveLoader(false);
    activeQueryFlowRef.current = null;

    const targetId = auditRunMsgIdRef.current;
    auditRunMsgIdRef.current = null;

    setMessages(prev => prev.map(m => {
      if (m.id !== targetId) return m;
      return {
        ...m,
        text: "Done. I scanned 1.2M invoice records and surfaced 8 potential duplicates — total exposure ₹6.16L, with the highest-confidence pair at 96% match (Acme Corp). Acme accounts for half of the flags and is the first place I'd look.",
        followUps: AUDIT_FOLLOWUPS,
        richType: 'audit-result',
        richData: AUDIT_RESULT,
      };
    }));
  };

  // ─── Conversational Workflow Flow ───
  const startConversationalWorkflowFlow = (userMsg: string) => {
    clearTimers();
    const wfType = detectWorkflowType(userMsg);
    const wfName = WORKFLOW_TYPE_NAMES[wfType];
    setCurrentWorkflowType(wfType);
    setWorkflowBuildPhase(1);

    // Brief thinking animation
    setIsTyping(true);
    schedule(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-wf-intro-${Date.now()}`,
        role: 'assistant',
        text: `Great, I'll help you build a **${wfName}** workflow. Let me understand your data sources first.`,
        timestamp: new Date(),
      }]);
      // Show file type clarification card
      setClarificationQuestions([
        { question: 'What data format are your source files?', options: ['CSV / Excel upload', 'Direct SQL connection', 'User uploads in chat', 'Mixed (SQL + file upload)'] },
        { question: 'How many data sources will this workflow need?', options: ['1 source (single file)', '2 sources (input + reference)', '3+ sources (multi-way match)', 'Not sure \u2014 recommend for me'] },
      ]);
      setShowClarificationCard(true);
    }, 1200);
  };

  // ─── Open Canvas After User Confirms (workflow phase 3) ───
  const openCanvasAfterConfirmation = () => {
    setIsTyping(true);
    schedule(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `msg-wf-opening-canvas-${Date.now()}`,
        role: 'assistant',
        text: `Setting up your workflow canvas now...`,
        timestamp: new Date(),
      }]);
    }, 600);

    schedule(() => {
      setArtifactMode('workflow');
      setWorkflowType?.(currentWorkflowType);
      setShowArtifacts(true);
    }, 1200);

    schedule(() => {
      setMessages(prev => [...prev, {
        id: `msg-wf-canvas-ready-${Date.now()}`,
        role: 'assistant',
        text: `I've configured the input sources based on your selections. Review and customize the input configuration in the canvas.\n\nTake your time — click **'Confirm Inputs'** when ready.`,
        timestamp: new Date(),
      }]);
      setWorkflowBuildPhase(4);
    }, 2500);

    // Tip messages
    const freezeHintId = 'msg-wf-freeze-hint';
    schedule(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === freezeHintId)) return prev;
        return [...prev, {
          id: freezeHintId,
          role: 'assistant' as const,
          text: `**Tip:** I've frozen the **Vendor Master Data** by default (last refreshed Mar 20). Toggle freeze on any other source that doesn't change between runs.`,
          timestamp: new Date(),
        }];
      });
    }, 8000);

    schedule(() => {
      setMessages(prev => {
        if (prev.some(m => m.id === 'msg-wf-save-prompt')) return prev;
        return [...prev, {
          id: 'msg-wf-save-prompt',
          role: 'assistant' as const,
          text: '',
          richType: 'save-workflow-prompt',
          timestamp: new Date(),
        }];
      });
    }, 20000);
  };

  const handleAuditAction = (action: 'workflow' | 'report' | 'dashboard', msgId?: string) => {
    if (action === 'dashboard') {
      setActiveAddMsgId(msgId || null);
      setShowDashboardModal(true);
      return;
    }
    if (action === 'report') {
      setActiveAddMsgId(msgId || null);
      setShowReportModal(true);
      return;
    }
    // workflow — keep existing toast behaviour
    addToast({ type: 'info', message: 'Adding to workflow library…' });
    setTimeout(() => {
      addToast({ type: 'success', message: 'Saved as workflow “AQ-2026-04-24”.' });
    }, 1200);
  };

  // Callback: user confirmed “Add to Dashboard” from modal
  const handleDashboardConfirm = (payload: Parameters<NonNullable<ChatViewProps['onAddResultToDashboard']>>[0]) => {
    if (activeAddMsgId) {
      setMessages(prev => prev.map(m => {
        if (m.id !== activeAddMsgId) return m;
        const existing = m.addedTo?.dashboards || [];
        return {
          ...m,
          addedTo: {
            ...m.addedTo,
            dashboards: [...existing, { id: payload.dashboardId, name: payload.dashboardName }],
          },
        };
      }));
    }
    onAddResultToDashboard?.(payload);
    const itemCount = payload.selection.kpis.length + payload.selection.charts.length + payload.selection.columns.length;
    // No Undo on dashboard toast: removeFromDashboard would only clear the
    // chat pill, leaving the persisted widgets orphaned on the dashboard.
    // Users remove widgets from the dashboard view itself.
    addToast({
      type: 'success',
      message: `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to dashboard “${payload.dashboardName}”.`,
      action: { label: 'View Dashboard', onClick: () => onViewDashboard?.(payload.dashboardId) },
    });
    setActiveAddMsgId(null);
  };

  // Callback: user confirmed “Add to Report” from modal
  const handleReportConfirm = (payload: Parameters<NonNullable<ChatViewProps['onAddResultToReport']>>[0]) => {
    if (activeAddMsgId) {
      setMessages(prev => prev.map(m => {
        if (m.id !== activeAddMsgId) return m;
        const existing = m.addedTo?.reports || [];
        return {
          ...m,
          addedTo: {
            ...m.addedTo,
            reports: [...existing, { id: payload.reportId, name: payload.reportName }],
          },
        };
      }));
    }
    onAddResultToReport?.(payload);
    const undoMsgId = activeAddMsgId;
    const itemCount = payload.selection.kpis.length + payload.selection.charts.length + payload.selection.columns.length;
    addToast({
      type: 'success',
      message: `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to report “${payload.reportName}”.`,
      action: { label: 'View Report', onClick: () => onViewReport?.(payload.reportId) },
      secondaryAction: undoMsgId
        ? { label: 'Undo', onClick: () => removeFromReport(undoMsgId, payload.reportId) }
        : undefined,
    });
    setActiveAddMsgId(null);
  };

  // Remove a dashboard/report link from a message
  const removeFromDashboard = (msgId: string, dashId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        addedTo: {
          ...m.addedTo,
          dashboards: (m.addedTo?.dashboards || []).filter(d => d.id !== dashId),
        },
      };
    }));
    addToast({ type: 'info', message: 'Removed from dashboard.' });
  };

  const removeFromReport = (msgId: string, rptId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      return {
        ...m,
        addedTo: {
          ...m.addedTo,
          reports: (m.addedTo?.reports || []).filter(r => r.id !== rptId),
        },
      };
    }));
    addToast({ type: 'info', message: 'Removed from report.' });
  };

  // Path 3 entry — open the Save-as-Workflow modal from the audit-result action bar.
  const openSaveAsWorkflowModal = () => setShowSaveAsWfModal(true);

  // Path 3 commit — modal confirmed. Lock the thread into workflow mode,
  // swap the IRA Workspace canvas (parent App.tsx handles the Y-spin), and
  // post the inline checkpoint message asking which params to make configurable.
  const handleSaveAsWorkflowConfirm = (data: { name: string; bpId: string; subProcessId: string; description: string }) => {
    setShowSaveAsWfModal(false);

    // Lock the composer pill — visual signal that mode is irreversible per thread.
    setLockedAsWorkflow(true);

    // Toast the save intent immediately so the user sees commit feedback
    // independently of the canvas-flip animation.
    addToast({ type: 'success', message: `Workflow draft "${data.name}" created.` });

    // Flip the right pane to workflow mode. App.tsx wraps the canvas in an
    // AnimatePresence Y-spin keyed on artifactMode, so this triggers the rotation.
    setArtifactMode('workflow');
    setWorkflowType?.('detection'); // duplicate-invoice query → detection workflow
    setShowArtifacts(true);

    // Inject IRA's checkpoint message inline in the same thread. Configurable
    // params are seeded from the existing AUDIT_RESULT context (date / threshold
    // / vendor / amount). User can multi-select via chips.
    schedule(() => {
      setMessages(prev => [...prev, {
        id: `msg-wf-checkpoint-${Date.now()}`,
        role: 'assistant',
        text: '',
        richType: 'workflow-checkpoint',
        richData: {
          intro: `I'll turn this into a workflow under **${BUSINESS_PROCESSES.find(b => b.id === data.bpId)?.name ?? 'the selected process'}**. Which parameters should be configurable when someone runs this later?`,
          options: [
            { id: 'date', label: 'Date range', detail: 'currently Q1 2026 — switch to rolling window at run time' },
            { id: 'threshold', label: 'Match threshold', detail: 'currently 90% — adjustable per run' },
            { id: 'vendor', label: 'Vendor scope', detail: 'currently all — filter to specific vendors' },
            { id: 'amount', label: 'Amount threshold', detail: 'currently any — filter to >X' },
          ],
          selected: [] as string[],
          status: 'open' as 'open' | 'submitted',
        },
        timestamp: new Date(),
      }]);
    }, 800);
  };

  // Toggle a checkpoint chip selection (multi-select).
  const toggleCheckpointParam = (msgId: string, paramId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'workflow-checkpoint') return m;
      const data = m.richData as { selected: string[] };
      const isSelected = data.selected.includes(paramId);
      return {
        ...m,
        richData: {
          ...m.richData,
          selected: isSelected ? data.selected.filter(p => p !== paramId) : [...data.selected, paramId],
        },
      };
    }));
  };

  // Confirm checkpoint selections — freeze the chip group + post follow-up.
  const submitCheckpoint = (msgId: string) => {
    let pickedLabels: string[] = [];
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || m.richType !== 'workflow-checkpoint') return m;
      const data = m.richData as { selected: string[]; options: { id: string; label: string }[] };
      pickedLabels = data.options.filter(o => data.selected.includes(o.id)).map(o => o.label);
      return { ...m, richData: { ...m.richData, status: 'submitted' as const } };
    }));
    schedule(() => {
      setMessages(prev => [...prev, {
        id: `msg-wf-config-update-${Date.now()}`,
        role: 'assistant',
        text: pickedLabels.length
          ? `Got it — I've marked **${pickedLabels.join(', ')}** as configurable. Review the input + output config in the IRA Workspace, then click **'Save to Library'** when ready.`
          : `Okay — keeping all parameters fixed for this workflow. Review the input + output config in the IRA Workspace, then click **'Save to Library'** when ready.`,
        timestamp: new Date(),
      }]);
    }, 600);
  };

  const simulateResponse = (userMsg: string, explicitMode?: 'query' | 'workflow') => {
    clearTimers();

    // If workflow is awaiting user confirmation (phase 3), any positive reply opens canvas
    if (workflowBuildPhase === 3) {
      openCanvasAfterConfirmation();
      return;
    }

    if (explicitMode === 'workflow') {
      startConversationalWorkflowFlow(userMsg);
      return;
    }
    if (explicitMode === 'query') {
      startQueryClarificationFlow();
      return;
    }

    const lower = userMsg.toLowerCase();
    if (lower.includes('workflow') || lower.includes('build a') || lower.includes('build me') || lower.includes('create a') || lower.includes('design a') || lower.includes('reconciliation')) {
      startConversationalWorkflowFlow(userMsg);
      return;
    }

    // Default — audit query flow with clarification → assumptions → loader → inline rich response
    startQueryClarificationFlow();
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && files.length === 0) return;
    let text = trimmed;
    const attachmentLabels = [
      ...attachedSources.map(s => s.kind === 'source' ? s.name : ''),
      ...files.map(f => f.name),
    ].filter(Boolean);
    if (attachmentLabels.length > 0) text += `\n[Attached: ${attachmentLabels.join(', ')}]`;

    // Empty-state Submit with the "Build a workflow" toggle on hands the
    // typed prompt off to the AI Concierge workflow builder, which opens on
    // the clarification screen. The chat thread isn't started — the user
    // continues the conversation inside the journey.
    if (buildWorkflowMode && messages.length === 0 && trimmed && onLaunchWorkflowBuilder) {
      onLaunchWorkflowBuilder(trimmed);
      setInput('');
      setFiles([]);
      setAttachedSources([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    // If a clarification message is open, route the typed text to its first
    // unanswered question instead of starting a new chat turn.
    const openClarify = [...messages].reverse().find(
      m => m.richType === 'clarification' && (m.richData as unknown as ClarificationData)?.status === 'open'
    );
    if (openClarify && trimmed) {
      const data = openClarify.richData as unknown as ClarificationData;
      const firstUnanswered = data.questions.findIndex((_, i) => !data.answers[i]);
      if (firstUnanswered !== -1) {
        updateClarificationAnswer(openClarify.id, firstUnanswered, trimmed);
        setInput('');
        setFiles([]);
        setAttachedSources([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }

    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text, timestamp: new Date() }]);
    setInput('');
    setFiles([]);
    setAttachedSources([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    simulateResponse(text, buildWorkflowMode ? 'workflow' : 'query');
  };

  const handleFollowUpClick = (question: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setMessages(prev => [...prev, { id: `msg-${Date.now()}`, role: 'user', text: question, timestamp: new Date() }]);
    simulateResponse(question);
    setTimeout(() => { processingRef.current = false; }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  // Picker → composer: source picks become labelled chips; fresh uploads
  // become a stub File so the existing `files` chip rendering picks them up.
  const handleDataPickerConfirm = (selections: AttachmentSelection[]) => {
    // Exhaustive over AttachmentSelection.kind. 'connect-db' is a Knowledge Hub-
    // only variant and unreachable here (chat opens the picker without `mode`,
    // so the Connect tab isn't rendered) — narrowing it explicitly keeps the
    // type contract honest if the picker is ever embedded differently.
    const sources:  Extract<AttachmentSelection, { kind: 'source' }>[] = [];
    const uploads:  Extract<AttachmentSelection, { kind: 'upload' }>[] = [];
    for (const s of selections) {
      switch (s.kind) {
        case 'source':     sources.push(s);  break;
        case 'upload':     uploads.push(s);  break;
        case 'connect-db': /* not reachable in chat mode; intentionally ignored */ break;
      }
    }
    if (sources.length > 0) setAttachedSources(prev => [...prev, ...sources]);
    if (uploads.length > 0) {
      const stubFiles = uploads.map(u => new File([''], u.name, { type: 'application/octet-stream' }));
      setFiles(prev => [...prev, ...stubFiles]);
    }
    setShowDataPicker(false);
    addToast({ type: 'success', message: `Attached ${selections.length} ${selections.length === 1 ? 'item' : 'items'}.` });
  };

  const handleTextareaInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const isEmpty = messages.length === 0;

  // Most-recent open clarification — drives the docked picker at the bottom of the chat.
  const openClarification = [...messages].reverse().find(
    m => m.richType === 'clarification' && (m.richData as unknown as ClarificationData)?.status === 'open'
  );

  /* ────────────────────── CHAT HISTORY SIDEBAR ────────────────────── */
  const chatHistoryPanel = (
    <AnimatePresence>
      {showChatHistory && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full bg-white border-r border-border-light overflow-hidden shrink-0"
        >
          <div className="p-4 border-b border-border-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Chat History</h3>
            <button onClick={toggleChatHistory} className="text-text-muted hover:text-text-secondary p-1 rounded-md hover:bg-gray-50 cursor-pointer">
              <X size={16} />
            </button>
          </div>
          <div className="p-3">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-[12.5px] text-primary font-medium hover:bg-primary-xlight transition-colors cursor-pointer">
              <Plus size={14} />
              New Chat
            </button>
          </div>
          <div className="overflow-y-auto flex-1" style={{ height: 'calc(100% - 150px)' }}>
            {CHAT_HISTORY.map(chat => (
              <button
                key={chat.id}
                className="w-full text-left px-4 py-3 border-b border-border-light hover:bg-primary-xlight/50 transition-colors group cursor-pointer"
                onClick={() => loadChatById(chat.id)}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare size={12} className="text-primary/60" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-text truncate group-hover:text-primary transition-colors">{chat.title}</div>
                    <div className="text-[12px] text-text-muted truncate mt-0.5">{chat.preview}</div>
                    <div className="text-[12px] text-text-muted/60 mt-1">{chat.timestamp}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Slide-out is a quick switcher for the last 5; canonical browser is /recents. */}
          {setView && (
            <div className="border-t border-border-light p-3">
              <button
                onClick={() => { toggleChatHistory(); setView('recents'); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
              >
                Browse all in Recents
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ────────────────────── EMPTY STATE ────────────────────── */
  if (isEmpty) {
    return (
      <>
      <div style={{ display: 'flex', height: '100%', width: '100%' }}>
        {chatHistoryPanel}

        <div style={{
          flex: '1 1 0%',
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9fc',
        }}
          className="bg-hero-pattern bg-grid-subtle relative"
        >
          <FloatingLines
            enabledWaves={['top', 'middle', 'bottom']}
            lineCount={5}
            lineDistance={5}
            bendRadius={5}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
            color="#6a12cd"
            opacity={0.06}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px' }} className="relative z-10">
            <button onClick={toggleChatHistory} className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" aria-label="Chat History">
              <History size={18} />
            </button>
            <button className="p-2.5 text-text-muted hover:text-text-secondary hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" aria-label="New Chat">
              <Plus size={18} />
            </button>
          </div>

          {pendingDashboard && (
            <div className="shrink-0 mx-5 mb-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-xl border border-brand-200 flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <BarChart3 size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-brand-900">Creating: {pendingDashboard.name}</p>
                  <p className="text-[11px] text-brand-600">Run a query, then add results to your dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const mockFields = ['Date', 'Region', 'Category', 'Vendor Name', 'Invoice Amount (₹)', 'Status', 'Department', 'Quantity'];
                    onAddToDashboard?.(mockFields);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <BarChart3 size={12} />
                  Add to Dashboard
                </button>
                <button
                  onClick={onDismissPendingDashboard}
                  className="p-1 rounded-md text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            padding: '0 24px 60px',
          }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={{ width: 720, maxWidth: '100%', textAlign: 'center' }}
            >
              <div className="mb-4">
                <AuditifyHelloEffect
                  className="text-primary h-14 mx-auto"
                  speed={0.7}
                />
              </div>

              <h1 style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8, color: 'rgba(14,11,30,0.85)' }}>
                Audit smarter.{' '}
                <TextShimmer as="span" className="font-bold" duration={3} spread={2}>
                  Not harder.
                </TextShimmer>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5, duration: 0.6 }}
                className="text-[15px] text-text-muted mb-10"
              >
                Your AI copilot already knows what to look for. Just ask.
              </motion.p>

              {/* Attachment chips — surface picked sources / fresh uploads above the composer */}
              {(files.length > 0 || attachedSources.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2 max-w-[680px] mx-auto">
                  {attachedSources.map((s, i) => (
                    s.kind === 'source' && (
                      <div key={`src-${i}`} className="flex items-center gap-1 bg-evidence-50 text-evidence-700 text-[12px] px-2 py-1 rounded-md font-medium border border-evidence-200">
                        <span className="text-[10px] uppercase font-bold tracking-wide opacity-60">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                        <span className="truncate max-w-[160px]">{s.name}</span>
                        <button
                          onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                          className="hover:text-evidence-700 ml-0.5 cursor-pointer"
                          aria-label={`Remove ${s.name}`}
                        ><X size={10} /></button>
                      </div>
                    )
                  ))}
                  {files.map((f, i) => (
                    <div key={`file-${i}`} className="flex items-center gap-1 bg-primary-light text-primary text-[12px] px-2 py-1 rounded-md font-medium">
                      <FileText size={11} />
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-primary-hover ml-0.5 cursor-pointer"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ai-border" style={{ marginBottom: 24 }}>
                <div style={{ position: 'relative', background: 'white', borderRadius: 18 }}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={buildWorkflowMode ? 'Describe a workflow and let Auditify do the rest' : 'Ask a question or run an audit query'}
                    style={{
                      width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      resize: 'none', padding: '20px 20px 56px', fontSize: 15, minHeight: 100,
                      maxHeight: 200, borderRadius: 18, fontFamily: 'inherit', color: '#0e0b1e',
                      boxSizing: 'border-box',
                    }}
                    rows={2}
                  />
                  <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setShowDataPicker(true)}
                      className="p-2 text-text-muted/40 hover:text-primary hover:bg-primary-xlight rounded-lg transition-colors cursor-pointer"
                      aria-label="Attach data sources or files"
                    >
                      <Plus size={18} />
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={buildWorkflowMode}
                      aria-label="Build a workflow"
                      onClick={() => setBuildWorkflowMode(v => !v)}
                      className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors cursor-pointer ${
                        buildWorkflowMode
                          ? 'border-primary/40 bg-primary-xlight text-primary'
                          : 'border-border-light bg-white text-text-secondary hover:text-text hover:border-border'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${buildWorkflowMode ? 'bg-gradient-to-br from-purple-500 to-violet-600' : 'bg-paper-100'}`}>
                        <Workflow size={9} className={buildWorkflowMode ? 'text-white' : 'text-text-muted'} />
                      </span>
                      Build a workflow
                    </button>
                  </div>
                  <div style={{ position: 'absolute', right: 12, bottom: 12 }}>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() && files.length === 0 && attachedSources.length === 0}
                      className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-medium hover:from-primary-hover hover:to-primary disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-semibold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Sparkles size={14} />
                      Submit
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </div>
        {/* Modals must mount in this branch too — empty state is the most likely
            place a user opens the data picker (before sending the first message). */}
        <DataPickerModal
          open={showDataPicker}
          onClose={() => setShowDataPicker(false)}
          onConfirm={handleDataPickerConfirm}
        />
      </>
    );
  }

  /* ────────────────────── MESSAGES STATE ────────────────────── */
  return (
    <div className="flex h-full w-full" style={{ flex: '1 1 0%', minWidth: 0 }}>
      {chatHistoryPanel}
      <div className="flex flex-col h-full bg-white" style={{ flex: '1 1 0%', minWidth: 0 }}>
        {/* Top bar */}
        <div className="h-12 border-b border-canvas-border bg-canvas-elevated flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <button onClick={toggleChatHistory} className={`p-1.5 rounded-md transition-colors cursor-pointer ${showChatHistory ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-secondary hover:bg-gray-50'}`}>
              <History size={16} />
            </button>
            <span className="text-sm font-medium text-text">Chat</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMessages([]); setInput(''); setShowClarificationCard(false); setShowProgressiveLoader(false); setWorkflowBuildPhase(0); setCurrentWorkflowType(null); setLockedAsWorkflow(false); setAttachedSources([]); setFiles([]); clearTimers(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light text-[12px] font-medium text-text-secondary hover:bg-white hover:border-primary/20 transition-all cursor-pointer"
            >
              <Plus size={12} />
              New Chat
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-primary/10 to-primary-medium/10 text-primary text-[12px] font-semibold">
              <Sparkles size={11} />
              AI Copilot
            </div>
          </div>
        </div>

        {/* Pending Dashboard Banner */}
        {pendingDashboard && (
          <div className="shrink-0 px-4 py-2.5 bg-gradient-to-r from-brand-50 to-brand-100/50 border-b border-brand-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <BarChart3 size={14} className="text-white" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-brand-900">Creating: {pendingDashboard.name}</p>
                <p className="text-[11px] text-brand-600">Run a query, then add results to your dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const mockFields = ['Date', 'Region', 'Category', 'Vendor Name', 'Invoice Amount (₹)', 'Status', 'Department', 'Quantity'];
                  onAddToDashboard?.(mockFields);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <BarChart3 size={12} />
                Add to Dashboard
              </button>
              <button
                onClick={onDismissPendingDashboard}
                className="p-1 rounded-md text-brand-400 hover:text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg, msgIdx) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%]">
                    {/* Single thinking trail per IRA message */}
                    {msg.role === 'assistant' && msg.thinking && msg.thinking.length > 0 && (
                      <ThinkingTrail
                        summary={
                          msg.richType === 'clarification' ? 'Identified ambiguity, asking for inputs' :
                          msg.richType === 'audit-loading' ? 'Running query through plan → SQL → sources → results' :
                          msg.richType === 'audit-result' ? 'Completed query — running through plan → SQL → sources → results' :
                          `Thought for ${msg.thinking.length} steps`
                        }
                        steps={msg.thinking}
                      />
                    )}

                    {/* IRA byline — appears above each assistant response so the source is unambiguous */}
                    {msg.role === 'assistant' && (msg.text || msg.richType) && (
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400 mb-2">IRA</div>
                    )}

                    {/* Rich inline components */}
                    {msg.richType === 'clarification' ? (
                      <div className="max-w-[66ch]">
                        {(msg.richData as unknown as ClarificationData).status === 'submitted' ? (
                          <div className="text-[13px] text-ink-700 leading-relaxed">
                            Got it — running with these inputs.
                          </div>
                        ) : (
                          <div className="text-[15px] leading-[1.65] text-ink-800">
                            {(msg.richData as unknown as ClarificationData).intro}
                          </div>
                        )}
                      </div>
                    ) : msg.richType === 'audit-loading' ? (
                      <div className="max-w-[680px]">
                        {showProgressiveLoader && msg.id === auditRunMsgIdRef.current && (
                          <InlineAuditLoader
                            steps={LOADING_STEPS}
                            onTabSwitch={setActiveArtifactTab}
                            onComplete={handleProgressiveLoadingComplete}
                          />
                        )}
                      </div>
                    ) : msg.richType === 'audit-result' ? (
                      <div className="space-y-4 max-w-[680px]">
                        {/* Body text */}
                        {msg.text && (
                          <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">{msg.text}</div>
                        )}

                        {/* Affordance: link inline result to the auto-opened panel */}
                        <button
                          onClick={() => setShowArtifacts(true)}
                          className="inline-flex items-center gap-1.5 text-[12px] text-ink-500 hover:text-brand-700 transition-colors cursor-pointer"
                        >
                          <span>Plan, query, and sources are in the artifact panel</span>
                          <ArrowUpRight size={12} />
                        </button>

                        {/* KPI cards */}
                        <div className="grid grid-cols-4 gap-2">
                          {AUDIT_RESULT.kpis.map((kpi, ki) => (
                            <motion.div
                              key={kpi.label}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: ki * 0.05 }}
                              className="rounded-xl border border-canvas-border bg-canvas-elevated p-3"
                            >
                              <div className={`text-[18px] font-semibold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                              <div className="text-[12px] text-ink-500 mt-0.5">{kpi.label}</div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Charts */}
                        <ChartGroup charts={AUDIT_RESULT.charts} />

                        {/* Table preview */}
                        <ResultsTable
                          columns={AUDIT_RESULT.table.columns}
                          rows={AUDIT_RESULT.table.rows}
                          totalRows={AUDIT_RESULT.table.totalRows}
                          onOpen={() => addToast({ type: 'info', message: 'Opening full results in a new view…' })}
                          onDownload={() => addToast({ type: 'success', message: 'CSV download started.' })}
                        />

                        {/* Action bar — explicit row of actions per PRD action-bar spec.
                            Save as workflow opens the metadata modal; the others stub via toast. */}
                        <div className="flex items-center gap-2 pt-3 border-t border-canvas-border">
                          <button
                            onClick={() => addToast({ type: 'success', message: 'CSV download started.' })}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-canvas-elevated border border-canvas-border text-[12px] font-semibold text-ink-700 hover:border-brand-200 hover:text-ink-800 transition-colors cursor-pointer"
                          >
                            <Download size={13} /> Export
                          </button>
                          {/* Dashboard button — shows added state with dropdown if linked */}
                          {(() => {
                            const dashLinks = msg.addedTo?.dashboards || [];
                            const hasDash = dashLinks.length > 0;
                            const dropKey = `${msg.id}:dashboard`;
                            const isOpen = openDropdown === dropKey;
                            return (
                              <div className="relative">
                                <button
                                  onClick={() => hasDash ? setOpenDropdown(isOpen ? null : dropKey) : handleAuditAction('dashboard', msg.id)}
                                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${
                                    hasDash
                                      ? 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
                                      : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200 hover:text-ink-800'
                                  }`}
                                >
                                  {hasDash ? <CheckCircle size={13} /> : <BarChart3 size={13} />}
                                  {hasDash
                                    ? dashLinks.length === 1
                                      ? `In "${dashLinks[0].name}"`
                                      : `In ${dashLinks.length} dashboards`
                                    : 'Dashboard'}
                                  {hasDash && <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                                </button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white rounded-lg shadow-lg border border-canvas-border py-1">
                                      {dashLinks.map(d => (
                                        <div key={d.id} className="px-3 py-1.5 flex items-center gap-2 text-[12px] text-ink-700">
                                          <BarChart3 size={12} className="text-brand-600 shrink-0" />
                                          <span className="flex-1 truncate font-medium">{d.name}</span>
                                          <button onClick={() => { onViewDashboard?.(d.id); setOpenDropdown(null); }} className="text-brand-600 hover:text-brand-700 cursor-pointer" title="View">
                                            <ExternalLink size={12} />
                                          </button>
                                          <button onClick={() => { removeFromDashboard(msg.id, d.id); setOpenDropdown(null); }} className="text-ink-400 hover:text-red-600 cursor-pointer" title="Remove">
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="border-t border-canvas-border mt-1 pt-1">
                                        <button
                                          onClick={() => { setOpenDropdown(null); handleAuditAction('dashboard', msg.id); }}
                                          className="w-full px-3 py-1.5 flex items-center gap-2 text-[12px] font-medium text-brand-600 hover:bg-brand-50 cursor-pointer"
                                        >
                                          <Plus size={12} /> Add to another
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {/* Report button — shows added state with dropdown if linked */}
                          {(() => {
                            const rptLinks = msg.addedTo?.reports || [];
                            const hasRpt = rptLinks.length > 0;
                            const dropKey = `${msg.id}:report`;
                            const isOpen = openDropdown === dropKey;
                            return (
                              <div className="relative">
                                <button
                                  onClick={() => hasRpt ? setOpenDropdown(isOpen ? null : dropKey) : handleAuditAction('report', msg.id)}
                                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${
                                    hasRpt
                                      ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
                                      : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200 hover:text-ink-800'
                                  }`}
                                >
                                  {hasRpt ? <CheckCircle size={13} /> : <FileText size={13} />}
                                  {hasRpt
                                    ? rptLinks.length === 1
                                      ? `In "${rptLinks[0].name}"`
                                      : `In ${rptLinks.length} reports`
                                    : 'Reports'}
                                  {hasRpt && <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                                </button>
                                {isOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white rounded-lg shadow-lg border border-canvas-border py-1">
                                      {rptLinks.map(r => (
                                        <div key={r.id} className="px-3 py-1.5 flex items-center gap-2 text-[12px] text-ink-700">
                                          <FileText size={12} className="text-violet-600 shrink-0" />
                                          <span className="flex-1 truncate font-medium">{r.name}</span>
                                          <button onClick={() => { onViewReport?.(r.id); setOpenDropdown(null); }} className="text-violet-600 hover:text-violet-700 cursor-pointer" title="View">
                                            <ExternalLink size={12} />
                                          </button>
                                          <button onClick={() => { removeFromReport(msg.id, r.id); setOpenDropdown(null); }} className="text-ink-400 hover:text-red-600 cursor-pointer" title="Remove">
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="border-t border-canvas-border mt-1 pt-1">
                                        <button
                                          onClick={() => { setOpenDropdown(null); handleAuditAction('report', msg.id); }}
                                          className="w-full px-3 py-1.5 flex items-center gap-2 text-[12px] font-medium text-violet-600 hover:bg-violet-50 cursor-pointer"
                                        >
                                          <Plus size={12} /> Add to another
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <div className="ml-auto">
                            <button
                              onClick={openSaveAsWorkflowModal}
                              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer"
                            >
                              <Workflow size={13} /> Save as workflow
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : msg.richType === 'summary-kpi' ? (
                      <div className="ml-7 grid grid-cols-4 gap-2">
                        {((msg.richData?.kpis as { label: string; value: string; color: string }[] | undefined) || []).map((kpi, ki) => (
                          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ki * 0.1 }}
                            className="rounded-xl border border-canvas-border bg-canvas-elevated p-3 text-center"
                          >
                            <div className={`text-lg font-semibold tabular-nums ${kpi.color}`}>{kpi.value}</div>
                            <div className="text-[12px] text-ink-500 mt-0.5">{kpi.label}</div>
                          </motion.div>
                        ))}
                      </div>
                    ) : msg.richType === 'workflow-checkpoint' ? (
                      // Path 3 inline checkpoint: IRA asks which params to make
                      // configurable for the saved workflow. Multi-select chips,
                      // freeze on submit, then post a follow-up message.
                      (() => {
                        const data = msg.richData as {
                          intro: string;
                          options: { id: string; label: string; detail: string }[];
                          selected: string[];
                          status: 'open' | 'submitted';
                        };
                        return (
                          <div className="ml-7">
                            <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">
                              {data.intro.split('**').map((part, i) =>
                                i % 2 === 1 ? <strong key={i} className="font-semibold text-text">{part}</strong> : part
                              )}
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[66ch]">
                              {data.options.map(opt => {
                                const isSelected = data.selected.includes(opt.id);
                                const disabled = data.status === 'submitted';
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => !disabled && toggleCheckpointParam(msg.id, opt.id)}
                                    disabled={disabled}
                                    className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                                      isSelected
                                        ? 'bg-primary-xlight border-primary text-primary'
                                        : 'bg-white border-border-light text-text hover:border-primary/40 hover:bg-paper-50'
                                    } ${disabled ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                        isSelected ? 'bg-primary border-primary' : 'bg-white border-border-light'
                                      }`}>
                                        {isSelected && <CheckCircle size={10} className="text-white" />}
                                      </div>
                                      <span className="text-[12.5px] font-semibold">{opt.label}</span>
                                    </div>
                                    <p className={`text-[11.5px] mt-1 ml-6 ${isSelected ? 'text-primary/80' : 'text-text-muted'}`}>{opt.detail}</p>
                                  </button>
                                );
                              })}
                            </div>
                            {data.status === 'open' ? (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => submitCheckpoint(msg.id)}
                                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer"
                                >
                                  <CheckCircle size={13} /> Confirm parameters
                                </button>
                                <button
                                  onClick={() => submitCheckpoint(msg.id)}
                                  className="text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                                >
                                  Skip — keep all fixed
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-text-muted">
                                <CheckCircle size={11} className="text-compliant" /> Parameters confirmed
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : msg.richType === 'save-workflow-prompt' ? (
                      <div className="ml-12 mt-1">
                        <div className="glass-card rounded-xl p-4 border border-primary/10 max-w-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Save size={13} className="text-primary" />
                            <span className="text-[12px] font-semibold text-text">Save Workflow</span>
                          </div>
                          <p className="text-[12px] text-text-muted mb-3">Ready to save this workflow to your library for recurring use?</p>
                          <div className="flex gap-2">
                            <SaveWorkflowButton />
                            <button className="px-3 py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:bg-surface-2 rounded-lg transition-colors cursor-pointer">
                              Continue editing
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : msg.text ? (
                      msg.role === 'user' ? (
                        <div className="px-4 py-2.5 rounded-2xl bg-primary-xlight text-primary border border-primary/15 text-[13.5px] leading-relaxed">
                          {msg.text}
                        </div>
                      ) : (
                        // Editorial: AI response is prose, not a bubble. No border, no shadow, no avatar gutter.
                        <div className="text-[15px] leading-[1.65] text-ink-800 max-w-[66ch]">
                          {msg.text}
                        </div>
                      )
                    ) : null}

                    {/* AI Recommended Follow-up Questions */}
                    {msg.role === 'assistant' && msg.followUps && msg.followUps.length > 0 && msgIdx === messages.length - 1 && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-3 ml-7"
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <Lightbulb size={11} className="text-primary/50" />
                          <span className="text-[12px] font-semibold text-text-muted">Suggested follow-ups</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {msg.followUps.map((q, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + i * 0.1 }}
                            >
                              <BorderGlow
                                borderRadius={12}
                                glowRadius={25}
                                glowIntensity={0.9}
                                coneSpread={25}
                                edgeSensitivity={30}
                                backgroundColor="#ffffff"
                                colors={['#6a12cd', '#9b59d6', '#c084fc']}
                              >
                                <div
                                  className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer group rounded-xl"
                                  onClick={() => handleFollowUpClick(q)}
                                >
                                  <div className="w-5 h-5 rounded-md bg-primary/5 flex items-center justify-center shrink-0">
                                    <ArrowRight size={11} className="text-primary/50 group-hover:text-primary transition-colors" />
                                  </div>
                                  <span className="text-[12px] text-text-secondary group-hover:text-text transition-colors">{q}</span>
                                </div>
                              </BorderGlow>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking animation */}
            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center shadow-sm-infinite">
                        <Sparkles size={14} className="text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[12px] font-semibold text-primary">Auditify Copilot</span>
                        <span className="text-[12px] text-text-muted">is thinking...</span>
                      </div>

                      {thinkingSteps.length > 0 && (
                        <div className="mb-2">
                          <div className="pl-3 border-l-2 border-primary/20 space-y-1">
                            {thinkingSteps.map((step, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-[12px] text-text-muted flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${i === thinkingSteps.length - 1 ? 'bg-primary' : 'bg-primary/30'}`} />
                                {step}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      {thinkingSteps.length === 0 && (
                        <div className="inline-flex items-center gap-1.5 px-1 py-2">
                          <div className="flex gap-1.5 items-center h-5">
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Inline rich messages render the loader + clarification — no global panel */}
        </div>

        {/* Input area */}
        <div className="shrink-0 px-4 sm:px-6 pb-5 max-w-3xl mx-auto w-full">
          {/* Workflow clarification (legacy ClarificationCard kept for the workflow flow only) */}
          <AnimatePresence>
            {showClarificationCard && workflowBuildPhase > 0 && (
              <div className="mb-0">
                <ClarificationCard
                  questions={clarificationQuestions}
                  onComplete={handleClarificationCardComplete}
                  onSkipAll={() => {
                    setShowClarificationCard(false);
                    handleWorkflowClarificationComplete({});
                  }}
                />
              </div>
            )}
          </AnimatePresence>

          {openClarification ? (
            // Audit-query clarification — docked picker replaces the chat input until submitted/dismissed
            <ClarificationBlock
              data={openClarification.richData as unknown as ClarificationData}
              onAnswer={(qi, ans) => updateClarificationAnswer(openClarification.id, qi, ans)}
              onSubmit={() => submitClarification(openClarification.id)}
              onSkipAll={() => submitClarification(openClarification.id, true)}
              onSkipCurrent={(qi) => skipClarificationQuestion(openClarification.id, qi)}
            />
          ) : (
            <>
              {/* Locked Workflow-mode pill — appears once Path 3 has flipped the
                  thread. Non-clickable on purpose: PRD says toggle is irreversible
                  per thread. To do a query again, user starts + New chat. */}
              {lockedAsWorkflow && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-xlight text-primary text-[11.5px] font-semibold cursor-default select-none">
                    <Lock size={10} /> Workflow mode
                  </div>
                  <span className="text-[11px] text-text-muted">
                    Switched at save. Start a <button onClick={() => { setMessages([]); setInput(''); setShowClarificationCard(false); setShowProgressiveLoader(false); setWorkflowBuildPhase(0); setCurrentWorkflowType(null); setLockedAsWorkflow(false); setAttachedSources([]); setFiles([]); clearTimers(); }} className="underline hover:text-primary cursor-pointer">new chat</button> for a query.
                  </span>
                </div>
              )}
              {(files.length > 0 || attachedSources.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {/* Source attachments — picked from existing data (DBs / files / APIs / cloud) */}
                  {attachedSources.map((s, i) => (
                    <div key={`src-${i}`} className="flex items-center gap-1 bg-evidence-50 text-evidence-700 text-[12px] px-2 py-1 rounded-md font-medium border border-evidence-200">
                      {s.kind === 'source' && (
                        <>
                          <span className="text-[10px] uppercase font-bold tracking-wide opacity-60">{s.type === 'database' ? 'DB' : s.type === 'api' ? 'API' : s.type === 'cloud' ? 'CLOUD' : s.type === 'session' ? 'SESS' : 'FILE'}</span>
                          <span className="truncate max-w-[160px]">{s.name}</span>
                        </>
                      )}
                      <button
                        onClick={() => setAttachedSources(prev => prev.filter((_, j) => j !== i))}
                        className="hover:text-evidence-700 ml-0.5 cursor-pointer"
                        aria-label={`Remove ${s.kind === 'source' ? s.name : ''}`}
                      ><X size={10} /></button>
                    </div>
                  ))}
                  {/* Fresh uploads — raw files added via the Upload tab or legacy path */}
                  {files.map((f, i) => (
                    <div key={`file-${i}`} className="flex items-center gap-1 bg-primary-light text-primary text-[12px] px-2 py-1 rounded-md font-medium">
                      <FileText size={11} />
                      <span className="truncate max-w-[100px]">{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-primary-hover ml-0.5 cursor-pointer"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ai-border">
                <div className="relative bg-white rounded-[18px]">
                  <textarea
                    value={input}
                    onChange={e => { setInput(e.target.value); handleTextareaInput(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything or describe a workflow to build..."
                    className="w-full bg-transparent border-none outline-none resize-none py-4 pl-4 pr-28 text-[13.5px] text-text placeholder:text-text-muted min-h-[48px] max-h-[160px] rounded-[18px]"
                    rows={1}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowDataPicker(true)}
                      className="p-2 text-text-muted hover:text-primary hover:bg-primary-xlight rounded-lg transition-colors cursor-pointer"
                      aria-label="Attach data sources or files"
                    >
                      <Paperclip size={15} />
                    </button>
                    <button onClick={handleSend} disabled={!input.trim() && files.length === 0 && attachedSources.length === 0} className="p-2 bg-gradient-to-r from-primary to-primary-medium hover:from-primary-hover hover:to-primary disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all cursor-pointer">
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save-as-Workflow modal — Path 3 commit step */}
      <AnimatePresence>
        {showSaveAsWfModal && (
          <SaveAsWorkflowModal
            open={showSaveAsWfModal}
            defaultName="Duplicate Invoice Detection — Q1 ±3 days"
            defaultDescription="Detects duplicate invoices in Q1 2026 with same vendor, amount, and date within ±3 days at 90% match threshold."
            onCancel={() => setShowSaveAsWfModal(false)}
            onConfirm={handleSaveAsWorkflowConfirm}
          />
        )}
      </AnimatePresence>

      {/* Data picker modal — attach existing sources or upload fresh files */}
      <DataPickerModal
        open={showDataPicker}
        onClose={() => setShowDataPicker(false)}
        onConfirm={handleDataPickerConfirm}
      />

      {/* Add to Dashboard modal */}
      <AddToDashboardModal
        open={showDashboardModal}
        onClose={() => { setShowDashboardModal(false); setActiveAddMsgId(null); }}
        dashboards={availableDashboards || []}
        alreadyAddedIds={activeAddMsgId ? (messages.find(m => m.id === activeAddMsgId)?.addedTo?.dashboards || []).map(d => d.id) : []}
        resultData={{
          kpis: AUDIT_RESULT.kpis,
          charts: AUDIT_RESULT.charts,
          table: { columns: AUDIT_RESULT.table.columns, rows: AUDIT_RESULT.table.rows },
        }}
        onConfirm={handleDashboardConfirm}
      />

      {/* Add to Report modal */}
      <AddToReportModal
        open={showReportModal}
        onClose={() => { setShowReportModal(false); setActiveAddMsgId(null); }}
        reports={availableReports || []}
        alreadyAddedIds={activeAddMsgId ? (messages.find(m => m.id === activeAddMsgId)?.addedTo?.reports || []).map(r => r.id) : []}
        resultData={{
          kpis: AUDIT_RESULT.kpis,
          charts: AUDIT_RESULT.charts,
          table: { columns: AUDIT_RESULT.table.columns, rows: AUDIT_RESULT.table.rows },
        }}
        onConfirm={handleReportConfirm}
      />
    </div>
  );
}
