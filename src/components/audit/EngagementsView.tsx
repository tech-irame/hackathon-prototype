import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardCheck, Calendar, ArrowUpRight, Search, Plus,
  Play, Pencil, Trash2, AlertTriangle, Clock,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { ENGAGEMENTS, type AutomationSubtype, type EngStatus, type EngType, type ProcessCode } from '../../data/engagements';

interface Props {
  onOpenEngagement: (engagementId: string) => void;
  onOpenAuditPlanning: () => void;
}

const STATUS_CLS: Record<EngStatus, string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-gray-100 text-gray-600',
};

const STATUS_DOT: Record<EngStatus, string> = {
  Active: 'bg-compliant',
  'In Progress': 'bg-evidence-600',
  Review: 'bg-mitigated-600',
  Planned: 'bg-brand-500',
  Draft: 'bg-gray-400',
  Closed: 'bg-gray-400',
};

const TYPE_CLS: Record<EngType, string> = {
  Compliance: 'bg-brand-50 text-brand-700 border-brand-100',
  'Internal Audit': 'bg-evidence-50 text-evidence-700 border-evidence-100',
  Automation: 'bg-compliant-50 text-compliant-700 border-compliant-100',
};

const TYPE_LABEL: Record<EngType, string> = {
  Compliance: 'Compliance',
  'Internal Audit': 'Internal Audit',
  Automation: 'Automation',
};

/** Short label for the Automation subtype shown as a small tag next to the type pill. */
const SUBTYPE_LABEL: Record<AutomationSubtype, string> = {
  CCM: 'CCM',
  Reconciliation: 'Reconciliation',
  MIS: 'MIS',
  Forensic: 'Forensic',
  'Image Analytics': 'Image Analytics',
  Custom: 'Custom',
};

const TYPE_FILTERS: ('All' | EngType)[] = ['All', 'Compliance', 'Internal Audit', 'Automation'];
const STATUS_FILTERS: ('All' | EngStatus)[] = ['All', 'Active', 'In Progress', 'Planned', 'Review', 'Draft'];

/** Pick a colour for the health bar by tier. */
function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

/** Per-type labels for the activity column. */
function activityLabels(type: EngType): { last: string; next: string } {
  switch (type) {
    case 'Automation':     return { last: 'Last run',     next: 'Next run' };
    case 'Compliance':     return { last: 'Last tested',  next: 'Next milestone' };
    case 'Internal Audit': return { last: 'Last activity',next: 'Next milestone' };
  }
}

export default function EngagementsView({ onOpenEngagement, onOpenAuditPlanning }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | EngType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | EngStatus>('All');
  const [processFilter, setProcessFilter] = useState<'All' | ProcessCode>('All');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENGAGEMENTS.filter(e => {
      if (typeFilter !== 'All' && e.type !== typeFilter) return false;
      if (statusFilter !== 'All' && e.status !== statusFilter) return false;
      if (processFilter !== 'All' && e.process !== processFilter) return false;
      if (q && !e.name.toLowerCase().includes(q)
            && !e.owner.toLowerCase().includes(q)
            && !e.description.toLowerCase().includes(q)
            && !e.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, typeFilter, statusFilter, processFilter]);

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="text-[11px] font-semibold text-text-muted tracking-wider uppercase mb-1">Engagements</div>
            <h1 className="font-display text-[32px] font-bold text-text leading-tight">Engagement Library</h1>
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-xl">
              Browse all engagements — compliance audits, internal audits, and automation programs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenAuditPlanning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
              title="See engagements laid out on the FY timeline"
            >
              <Calendar size={13} />
              Audit Planning Timeline
              <ArrowUpRight size={12} />
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Plus size={14} />New Engagement
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xl">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search engagement, owner, framework, or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2.5 text-[13px] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-4 mb-5 flex-wrap text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted uppercase tracking-wide">Type</span>
            <div className="flex gap-1">
              {TYPE_FILTERS.map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-border-light" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted uppercase tracking-wide">Status</span>
            <div className="flex gap-1">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    statusFilter === s
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-border-light" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted uppercase tracking-wide">Process</span>
            <div className="flex gap-1">
              {(['All', 'P2P', 'O2C', 'R2R', 'S2C', 'ITGC'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setProcessFilter(p)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    processFilter === p
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="border border-border-light rounded-xl p-14 text-center bg-white">
            <ClipboardCheck size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-text mb-1">No engagements match your filters</p>
            <p className="text-[12px] text-text-muted">Try clearing the type, status, process, or search filter.</p>
          </div>
        ) : (
          <div className="border border-border-light rounded-xl bg-white overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr_110px] gap-5 px-6 py-3 border-b border-border-light text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 bg-surface-2/30">
              <div>Engagement</div>
              <div>Type</div>
              <div>Health</div>
              <div>Activity</div>
              <div className="text-right">Actions</div>
            </div>

            {filtered.map((eng, i) => {
              const health = healthTier(eng.health);
              const labels = activityLabels(eng.type);
              const notStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
              return (
                <motion.div
                  key={eng.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => onOpenEngagement(eng.id)}
                  className="grid grid-cols-[2.4fr_1fr_1.3fr_1.4fr_110px] gap-5 px-6 py-5 border-b border-border-light last:border-0 hover:bg-surface-2/30 transition-colors cursor-pointer group items-start"
                >
                  {/* Engagement column */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[14.5px] font-semibold text-text leading-snug">{eng.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold ${STATUS_CLS[eng.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[eng.status]}`} aria-hidden="true" />
                        {eng.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed line-clamp-2 max-w-2xl">
                      {eng.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted flex-wrap">
                      <span className="font-mono tracking-tight">{eng.code}</span>
                      <span className="text-border">·</span>
                      <span>{eng.owner}</span>
                      <span className="text-border">·</span>
                      <span className="tabular-nums">{eng.periodStart} – {eng.periodEnd}</span>
                      <span className="text-border">·</span>
                      <span>{eng.controls} controls</span>
                    </div>
                    {/* Inline tag badges */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                        {eng.process}
                      </span>
                      <span className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-medium bg-white text-text-muted border border-border-light">
                        {eng.framework}
                      </span>
                    </div>
                  </div>

                  {/* Type column */}
                  <div className="flex flex-col items-start gap-1.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${TYPE_CLS[eng.type]}`}>
                      {TYPE_LABEL[eng.type]}
                    </span>
                    {eng.type === 'Automation' && eng.subtype && (
                      <span className="inline-flex items-center px-1.5 h-4 rounded text-[9.5px] font-bold uppercase tracking-wide bg-compliant-50/60 text-compliant-700 border border-compliant-100/70">
                        {SUBTYPE_LABEL[eng.subtype]}
                      </span>
                    )}
                  </div>

                  {/* Health column */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {notStarted ? (
                      <div className="text-[11px] text-text-muted italic">Not yet started</div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-bold tabular-nums ${health.text}`}>{eng.health}%</span>
                          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Effective</span>
                        </div>
                        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div className={`h-full ${health.bar} rounded-full transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                        </div>
                      </>
                    )}
                    {eng.openIssues > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} className="text-risk-700" />
                        <span className="text-[11px] font-semibold text-risk-700">{eng.openIssues}</span>
                        <span className="text-[11px] text-text-muted">open</span>
                      </div>
                    )}
                  </div>

                  {/* Activity column */}
                  <div className="flex flex-col gap-1 min-w-0 text-[11px]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-text-muted shrink-0">{labels.last}</span>
                      <span className="text-text font-medium truncate">{eng.lastActivity}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <Clock size={10} className="text-text-muted shrink-0 self-center" />
                      <span className="text-text-muted shrink-0">{labels.next}</span>
                      <span className="text-text font-medium truncate">{eng.nextScheduled}</span>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-start justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenEngagement(eng.id); }}
                      className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                      title="Open engagement"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Footer */}
            <div className="px-6 py-2.5 text-[11px] text-text-muted bg-surface-2/30 border-t border-border-light">
              {filtered.length} of {ENGAGEMENTS.length} engagements
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
