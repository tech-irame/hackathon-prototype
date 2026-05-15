import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, FileCode,
  Database, BarChart3, Sparkles, Copy, Download,
  AlertTriangle, LayoutDashboard
} from 'lucide-react';
import type { ArtifactTab } from '../../hooks/useAppState';
import OutputConfigTab from './OutputConfigTab';

interface ArtifactPanelProps {
  activeTab: ArtifactTab;
  setActiveTab: (t: ArtifactTab) => void;
  onClose: () => void;
  onManageExceptions?: () => void;
  onAddToReport?: () => void;
  onShareResults?: () => void;
}

const TABS: { id: ArtifactTab; label: string; icon: React.ElementType }[] = [
  { id: 'plan', label: 'Plan', icon: Sparkles },
  { id: 'code', label: 'Code', icon: FileCode },
  { id: 'sources', label: 'Sources', icon: Database },
  { id: 'output', label: 'Output', icon: LayoutDashboard },
];

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, actions }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border-light rounded-xl bg-white overflow-hidden">
      <div className="flex items-center px-4 py-3 hover:bg-paper-50 transition-colors">
        <button
          onClick={() => setOpen(p => !p)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-2 text-sm font-medium text-text cursor-pointer"
        >
          <Icon size={14} className="text-primary" />
          <span className="flex-1 text-left">{title}</span>
        </button>
        {actions && <div className="flex items-center gap-1 ml-2">{actions}</div>}
        <button
          onClick={() => setOpen(p => !p)}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="ml-1 p-1 text-text-muted hover:text-text-secondary rounded cursor-pointer"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border-light">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanTab() {
  const steps = [
    { step: 1, title: 'Parse user query', desc: 'Identified intent: risk analysis query for P2P process', status: 'done' },
    { step: 2, title: 'Identify data sources', desc: 'Selected: SAP ERP AP Module, Vendor Master Data', status: 'done' },
    { step: 3, title: 'Generate query plan', desc: 'Built SQL joins across 3 tables with risk severity filter', status: 'done' },
    { step: 4, title: 'Execute query', desc: 'Processed 1.2M records, filtered to 9 matching risks', status: 'done' },
    { step: 5, title: 'Format results', desc: 'Generated table view with severity indicators and control mapping', status: 'done' },
  ];

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection title="Query Execution Plan" icon={Sparkles}>
        <div className="space-y-3 pt-3">
          {steps.map((s, i) => (
            <div key={s.step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                  s.status === 'done' ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-50 text-ink-500'
                }`}>
                  {s.step}
                </div>
                {i < steps.length - 1 && <div className="w-px h-full bg-border-light mt-1" />}
              </div>
              <div className="pb-3">
                <div className="text-[13px] font-medium text-text">{s.title}</div>
                <div className="text-[12px] text-text-muted mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Assumptions Section */}
      <div className="mt-4 p-3 bg-mitigated-50/50 border border-mitigated/50 rounded-xl">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle size={12} className="text-mitigated-700" />
          <span className="text-[12px] font-bold text-mitigated-700">Assumptions Made</span>
        </div>
        <div className="space-y-1.5">
          {[
            'Date range: Full FY26 (Apr 2025 – Mar 2026)',
            'Amount tolerance: ± 5% on invoice amounts',
            'Vendor scope: All vendors in SAP AP Module',
            'Matching logic: Fuzzy match on invoice number + vendor + amount',
            'Excluded: Voided and reversed invoices',
            'Currency: INR (converted at booking rate)',
          ].map((assumption, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-mitigated mt-1.5 shrink-0" />
              <span className="text-[12px] text-mitigated-700">{assumption}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodeTab() {
  const sql = `SELECT
  r.id AS risk_id,
  r.name AS risk_name,
  r.severity,
  COUNT(c.id) AS control_count,
  SUM(CASE WHEN c.is_key THEN 1 ELSE 0 END) AS key_controls
FROM risks r
LEFT JOIN controls c ON c.risk_id = r.id
WHERE r.bp_id = 'p2p'
  AND r.severity IN ('critical', 'high')
GROUP BY r.id, r.name, r.severity
ORDER BY
  CASE r.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
  END;`;

  return (
    <div className="space-y-3 pt-4">
      <CollapsibleSection title="Generated SQL Query" icon={FileCode}>
        <div className="mt-3 relative">
          <pre className="bg-ink-900 text-paper-50 rounded-lg p-4 text-[12px] font-mono overflow-x-auto leading-relaxed">
            <code>{sql}</code>
          </pre>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button
              aria-label="Download SQL"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer"
            >
              <Download size={12} />
            </button>
            <button
              aria-label="Copy SQL"
              className="p-1.5 bg-ink-700 hover:bg-ink-600 text-paper-50 rounded-md transition-colors cursor-pointer"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Execution Stats" icon={BarChart3} defaultOpen={false}>
        <div className="grid grid-cols-3 gap-3 pt-3">
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">1.2M</div>
            <div className="text-[12px] text-text-muted">Records Scanned</div>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">0.3s</div>
            <div className="text-[12px] text-text-muted">Query Time</div>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-text">9</div>
            <div className="text-[12px] text-text-muted">Results</div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function SourcesTab() {
  const sources = [
    { name: 'SAP ERP — AP Module', type: 'SQL Database', records: '1.2M rows', tables: ['risks', 'controls', 'risk_control_map'] },
    { name: 'Vendor Master Data', type: 'CSV File', records: '892 vendors', tables: ['vendor_master.csv'] },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
      {sources.map((src, i) => (
        <CollapsibleSection
          key={i}
          title={src.name}
          icon={Database}
          actions={
            <button
              aria-label={`Download ${src.name}`}
              className="p-1 text-text-muted hover:text-text-secondary rounded cursor-pointer"
            >
              <Download size={13} />
            </button>
          }
        >
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-muted">Type</span>
              <span className="text-text font-medium">{src.type}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-muted">Records</span>
              <span className="text-text font-medium">{src.records}</span>
            </div>
            <div className="text-[12px] text-text-muted mt-2">Tables/Files used:</div>
            <div className="flex flex-wrap gap-1.5">
              {src.tables.map(t => (
                <span key={t} className="text-[12px] bg-primary-xlight text-primary px-2 py-0.5 rounded font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}

export default function ArtifactPanel({ activeTab, setActiveTab, onClose }: ArtifactPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full w-full bg-surface-2 border-l border-border-light flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="h-12 bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white border-brand-600 hover:bg-brand-500'
                  : 'bg-white text-ink-700 border-paper-200 hover:bg-paper-50 hover:text-ink-800'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 text-text-muted hover:text-text-secondary rounded-md hover:bg-paper-50 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'plan' && <PlanTab />}
            {activeTab === 'code' && <CodeTab />}
            {activeTab === 'sources' && <SourcesTab />}
            {activeTab === 'output' && <OutputConfigTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
