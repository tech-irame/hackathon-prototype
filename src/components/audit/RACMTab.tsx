/**
 * RACM Tab — Risk and Control Matrix view for a Compliance / Internal Audit
 * engagement. Renders a toolbar (version + download/upload/key-filter), a
 * compact stats strip, and a sub-process accordion. Each accordion section
 * holds a dense RACM table; each row can expand to show its control
 * attributes (sub-steps + test procedures).
 */

import { useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, Download, Upload, Filter, FileText, Layers,
  AlertTriangle, Shield, Key, ListTree, Library,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement } from '../../data/engagements';
import {
  RACM_VERSIONS,
  racmRowsForProcess,
  groupRacmBySubProcess,
  type RACMRow,
  type ControlAttribute,
  type ControlType,
  type Automation,
} from '../../data/racm';

interface Props {
  engagement: Engagement;
}

// ─── Token maps ───────────────────────────────────────────────────────────────

const TYPE_CLS: Record<ControlType, string> = {
  Preventive: 'bg-compliant-50 text-compliant-700 border-compliant-100/70',
  Detective:  'bg-evidence-50 text-evidence-700 border-evidence-100/70',
};

const AUTOMATION_CLS: Record<Automation, string> = {
  Manual:         'bg-mitigated-50 text-mitigated-700 border-mitigated-100/70',
  'IT-dependent': 'bg-surface-2 text-text-secondary border-border-light',
  Automated:      'bg-brand-50 text-brand-600 border-brand-100/70',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RACMTab(props: Props): JSX.Element {
  const { engagement } = props;
  const { addToast } = useToast();

  const allRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);

  const [versionId, setVersionId] = useState<string>(RACM_VERSIONS[0].id);
  const [keyOnly, setKeyOnly] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredRows = useMemo(
    () => (keyOnly ? allRows.filter(r => r.isKey) : allRows),
    [allRows, keyOnly],
  );

  const groups = useMemo(() => groupRacmBySubProcess(filteredRows), [filteredRows]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const riskIds = new Set(allRows.map(r => r.riskId));
    const controlIds = new Set(allRows.map(r => r.controlId));
    const keyControlIds = new Set(allRows.filter(r => r.isKey).map(r => r.controlId));
    const attributes = allRows.reduce((acc, r) => acc + r.attributes.length, 0);
    return {
      risks: riskIds.size,
      controls: controlIds.size,
      keyControls: keyControlIds.size,
      attributes,
    };
  }, [allRows]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const toggleGroup = (subProcess: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(subProcess)) next.delete(subProcess);
      else next.add(subProcess);
      return next;
    });
  };

  const toggleRow = (rowId: string) => {
    setExpandedRow(prev => (prev === rowId ? null : rowId));
  };

  const onChangeVersion = (id: string) => {
    setVersionId(id);
    const version = RACM_VERSIONS.find(v => v.id === id);
    addToast({
      message: `Switched to RACM ${version?.label ?? id}`,
      type: 'info',
    });
  };

  const onDownload = () => {
    addToast({
      message: `Downloading ${versionId} as XLSX…`,
      type: 'info',
    });
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addToast({
        message: `Imported \`${file.name}\` — 24 rows parsed`,
        type: 'success',
      });
    }
    // reset so selecting the same file again still fires onChange
    e.target.value = '';
  };

  const onToggleKeyOnly = () => {
    setKeyOnly(v => !v);
  };

  const onClickRiskOrControl = () => {
    addToast({
      message: 'Risk/Control detail opening soon',
      type: 'info',
    });
  };

  // ─── Empty State ────────────────────────────────────────────────────────────
  if (allRows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 flex flex-col items-center text-center">
        <div className="p-3 rounded-2xl bg-brand-50 mb-4">
          <FileText size={28} className="text-brand-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-text mb-1.5">
          No RACM rows for this process yet
        </h3>
        <p className="text-[12.5px] text-text-muted max-w-md mb-5 leading-relaxed">
          The RACM library for {engagement.process} is empty. Import an existing
          matrix as XLSX to seed risks, controls, and attributes for this engagement.
        </p>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
        >
          <Upload size={14} /> Upload RACM
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap">
        {/* Left — title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-brand-50 shrink-0">
            <FileText size={16} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold text-text leading-tight">
              Risk and Control Matrix
            </div>
            <div className="text-[11px] text-text-muted mt-0.5 tabular-nums">
              {engagement.process} · {engagement.framework}
            </div>
          </div>
        </div>

        {/* Middle — version dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wide">
            Version
          </span>
          <div className="relative">
            <select
              value={versionId}
              onChange={(e) => onChangeVersion(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-[12px] font-medium border border-border-light rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              {RACM_VERSIONS.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
          </div>
        </div>

        {/* Right — action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
            title="Export this RACM as an XLSX file"
          >
            <Download size={12} /> Download RACM
          </button>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
            title="Import a RACM from an XLSX file"
          >
            <Upload size={12} /> Upload RACM
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={onFileSelected}
          />
          <button
            onClick={onToggleKeyOnly}
            aria-pressed={keyOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors cursor-pointer ${
              keyOnly
                ? 'bg-brand-50 border-brand-100/70 text-brand-600 hover:bg-brand-50/80'
                : 'bg-white border-border-light text-text-secondary hover:bg-primary-xlight/40 hover:border-primary/30 hover:text-primary'
            }`}
            title="Filter to key controls only"
          >
            <Filter size={12} /> Key controls only
            {keyOnly && (
              <span className="ml-1 px-1.5 h-4 rounded-full text-[9.5px] font-bold bg-brand-600 text-white inline-flex items-center tabular-nums">
                {stats.keyControls}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        <StatTile
          icon={<AlertTriangle size={11} className="text-risk-700" />}
          label="Risks"
          value={stats.risks}
          sub="unique"
        />
        <StatTile
          icon={<Shield size={11} className="text-brand-600" />}
          label="Controls"
          value={stats.controls}
          sub="mapped"
        />
        <StatTile
          icon={<Key size={11} className="text-mitigated-700" />}
          label="Key Controls"
          value={stats.keyControls}
          sub={`of ${stats.controls}`}
        />
        <StatTile
          icon={<ListTree size={11} className="text-evidence-700" />}
          label="Attributes"
          value={stats.attributes}
          sub="across rows"
        />
        <StatTile
          icon={<Library size={11} className="text-compliant-700" />}
          label="Frameworks"
          value={1}
          sub="SOX ICFR"
        />
      </div>

      {/* ── Filtered empty state ─────────────────────────────────────────── */}
      {filteredRows.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <Filter size={22} className="text-text-muted mx-auto mb-2" />
          <p className="text-[13px] font-semibold text-text mb-1">
            No key controls in this RACM
          </p>
          <p className="text-[12px] text-text-muted">
            Turn off the “Key controls only” filter to see all rows.
          </p>
        </div>
      ) : (
        /* ── Sub-process accordion ───────────────────────────────────────── */
        <div className="space-y-3">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.subProcess);
            const groupRisks = new Set(group.rows.map(r => r.riskId)).size;
            const groupControls = new Set(group.rows.map(r => r.controlId)).size;
            const groupKey = group.rows.filter(r => r.isKey).length;
            return (
              <div key={group.subProcess} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.subProcess)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer text-left"
                  aria-expanded={!isCollapsed}
                >
                  <div className="p-1.5 rounded-lg bg-brand-50 shrink-0">
                    <Layers size={13} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold text-text">
                        {group.subProcess}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {groupRisks} risk{groupRisks === 1 ? '' : 's'}
                        <span className="text-border mx-1.5">·</span>
                        {groupControls} control{groupControls === 1 ? '' : 's'}
                        {groupKey > 0 && (
                          <>
                            <span className="text-border mx-1.5">·</span>
                            <span className="text-mitigated-700 font-semibold">{groupKey} key</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`text-text-muted transition-transform shrink-0 ${
                      isCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                      className="overflow-hidden border-t border-border-light"
                    >
                      <RACMTable
                        rows={group.rows}
                        expandedRow={expandedRow}
                        onToggleRow={toggleRow}
                        onIdClick={onClickRiskOrControl}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[22px] font-bold text-text leading-none tabular-nums">
        {value}
      </div>
      <div className="text-[10.5px] text-text-muted mt-1">{sub}</div>
    </div>
  );
}

function RACMTable({
  rows,
  expandedRow,
  onToggleRow,
  onIdClick,
}: {
  rows: RACMRow[];
  expandedRow: string | null;
  onToggleRow: (id: string) => void;
  onIdClick: () => void;
}) {
  return (
    <div className="text-[12px]">
      {/* Column header */}
      <div
        className="grid items-center gap-3 px-4 py-2 bg-surface-2/40 border-b border-border-light text-[10px] uppercase tracking-wider font-semibold text-text-muted/80"
        style={{ gridTemplateColumns: '24% 30% 11% 9% 10% 11% 5% 32px' }}
      >
        <div>Risk</div>
        <div>Control</div>
        <div>Assertion</div>
        <div>Frequency</div>
        <div>Type</div>
        <div>Automation</div>
        <div>Key</div>
        <div></div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border-light/60">
        {rows.map(row => {
          const isOpen = expandedRow === row.id;
          return (
            <div key={row.id} className="bg-white">
              <div
                className="grid items-start gap-3 px-4 py-3 hover:bg-surface-2/30 transition-colors"
                style={{ gridTemplateColumns: '24% 30% 11% 9% 10% 11% 5% 32px' }}
              >
                {/* Risk */}
                <div className="min-w-0">
                  <button
                    onClick={onIdClick}
                    className="text-[10.5px] font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline tabular-nums cursor-pointer"
                  >
                    {row.riskId}
                  </button>
                  <p className="text-[12px] text-text mt-1 leading-snug line-clamp-3">
                    {row.riskDescription}
                  </p>
                </div>

                {/* Control */}
                <div className="min-w-0">
                  <button
                    onClick={onIdClick}
                    className="text-[10.5px] font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline tabular-nums cursor-pointer"
                  >
                    {row.controlId}
                  </button>
                  <p className="text-[12px] text-text mt-1 leading-snug line-clamp-3">
                    {row.controlDescription}
                  </p>
                </div>

                {/* Assertion */}
                <div className="min-w-0">
                  <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                    {row.assertion}
                  </span>
                </div>

                {/* Frequency */}
                <div className="text-[11.5px] text-text-secondary">
                  {row.frequency}
                </div>

                {/* Type */}
                <div>
                  <span className={`inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold border ${TYPE_CLS[row.controlType]}`}>
                    {row.controlType}
                  </span>
                </div>

                {/* Automation */}
                <div>
                  <span className={`inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold border ${AUTOMATION_CLS[row.automation]}`}>
                    {row.automation}
                  </span>
                </div>

                {/* Key */}
                <div>
                  {row.isKey ? (
                    <span
                      title="Key control"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10px] font-bold border border-mitigated-100/70"
                    >
                      K
                    </span>
                  ) : (
                    <span className="text-text-muted text-[11px]">—</span>
                  )}
                </div>

                {/* Expand */}
                <div className="flex justify-end">
                  <button
                    onClick={() => onToggleRow(row.id)}
                    className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    aria-label={isOpen ? 'Collapse attributes' : 'Expand attributes'}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Attributes */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <AttributesList attributes={row.attributes} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttributesList({ attributes }: { attributes: ControlAttribute[] }) {
  return (
    <div className="px-4 pb-4 pt-1 bg-surface-2/30">
      <div className="border-l-2 border-brand-100 pl-4 ml-7 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
          <ListTree size={11} className="text-brand-600" />
          Attributes & test procedures
          <span className="ml-0.5 text-text-muted/80 normal-case tracking-normal font-medium">
            ({attributes.length})
          </span>
        </div>
        <ul className="space-y-2">
          {attributes.map(attr => (
            <li
              key={attr.id}
              className="grid grid-cols-[88px_1fr] gap-3 items-start"
            >
              <span className="text-[10.5px] font-mono font-semibold text-brand-600 bg-brand-50 border border-brand-100/70 rounded px-1.5 py-0.5 tabular-nums leading-tight inline-flex items-center justify-center text-center">
                {attr.id}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-text leading-snug">
                  {attr.description}
                </p>
                <p className="text-[11px] italic text-text-muted mt-1 leading-snug">
                  {attr.testProcedure}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
