import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Brain, Plus, Pencil, Trash2, X, Check,
  Sparkles, ArrowRight, ThumbsUp, ThumbsDown, TrendingUp,
} from 'lucide-react';
import DataSourcesView from '../data-sources/DataSourcesView';

type TabId = 'data' | 'learn';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'data',  label: 'Data Sources', icon: Database },
  { id: 'learn', label: 'Smart Learn',  icon: Brain },
];

// ─── Smart Learn data shapes ─────────────────────────────────────────────────

interface BehaviourPref {
  id: string;
  label: string;            // "Prefer tabular layouts for risk lists"
  scope: 'Output' | 'Tone' | 'Structure' | 'Formatting' | 'Vocabulary' | 'Evidence';
  confidence: number;       // 0–100
  source: 'chat' | 'manual';
  learnedAt: string;        // ISO date string
}

interface MemoryEntry {
  id: string;
  term: string;             // "revenue"
  mapsTo: string;           // "Net_revenue"
  scope: string;            // e.g. "SAP exports", "Workday API", "All sources"
  confidence: number;
  source: 'chat' | 'manual';
  learnedAt: string;
}

const BEHAV_KEY  = 'knowledge.behaviour.v1';
const MEMORY_KEY = 'knowledge.memory.v1';

const SEED_BEHAVIOURS: BehaviourPref[] = [
  { id: 'b-1', label: 'Prefers tabular output for risk and control lists',                  scope: 'Output',     confidence: 92, source: 'chat',   learnedAt: '2026-04-19' },
  { id: 'b-2', label: 'Spells out severity (Critical / High / Medium / Low) — never P0-P3', scope: 'Vocabulary', confidence: 98, source: 'chat',   learnedAt: '2026-04-15' },
  { id: 'b-3', label: 'Leads with executive summary, then details',                         scope: 'Structure',  confidence: 87, source: 'chat',   learnedAt: '2026-04-12' },
  { id: 'b-4', label: 'Cites source IDs inline (CTR-004, RSK-007, ENG-2026-001)',           scope: 'Evidence',   confidence: 95, source: 'chat',   learnedAt: '2026-04-10' },
  { id: 'b-5', label: 'Numbers shown with thousand separators and tabular alignment',        scope: 'Formatting', confidence: 90, source: 'manual', learnedAt: '2026-04-08' },
  { id: 'b-6', label: 'Dates use "Apr 28, 2026" format, never numeric (04/28/26)',          scope: 'Formatting', confidence: 88, source: 'chat',   learnedAt: '2026-04-05' },
  { id: 'b-7', label: 'IRA speaks first-person ("I found…", not "The AI thinks…")',         scope: 'Tone',       confidence: 84, source: 'manual', learnedAt: '2026-04-02' },
];

const SEED_MEMORY: MemoryEntry[] = [
  { id: 'm-1', term: 'invoice',         mapsTo: 'invoiceUrl',                  scope: 'SAP exports',         confidence: 96, source: 'chat',   learnedAt: '2026-04-20' },
  { id: 'm-2', term: 'revenue',         mapsTo: 'Net_revenue (not total_revenue)', scope: 'All financial reports', confidence: 99, source: 'manual', learnedAt: '2026-04-18' },
  { id: 'm-3', term: 'vendor name',     mapsTo: 'vendor_master.name',          scope: 'SAP exports',         confidence: 93, source: 'chat',   learnedAt: '2026-04-17' },
  { id: 'm-4', term: 'approval date',   mapsTo: 'po.approval_ts',              scope: 'P2P workflow',        confidence: 89, source: 'chat',   learnedAt: '2026-04-15' },
  { id: 'm-5', term: 'customer',        mapsTo: 'account.customer_id',         scope: 'O2C workflow',        confidence: 91, source: 'chat',   learnedAt: '2026-04-12' },
  { id: 'm-6', term: 'amount',          mapsTo: 'txn.amount_usd (USD only)',   scope: 'All transactions',    confidence: 94, source: 'manual', learnedAt: '2026-04-10' },
  { id: 'm-7', term: 'engagement',      mapsTo: 'audit_engagement.id (eng-XXX)', scope: 'Execution surfaces', confidence: 87, source: 'chat',   learnedAt: '2026-04-08' },
  { id: 'm-8', term: 'control number',  mapsTo: 'control.id (CTR-XXX format)', scope: 'Governance',          confidence: 92, source: 'manual', learnedAt: '2026-04-05' },
];

const BEHAV_SCOPES: BehaviourPref['scope'][] = ['Output', 'Tone', 'Structure', 'Formatting', 'Vocabulary', 'Evidence'];

const SCOPE_TONE: Record<BehaviourPref['scope'], string> = {
  Output:     'bg-brand-50 text-brand-700',
  Tone:       'bg-evidence-50 text-evidence-700',
  Structure:  'bg-compliant-50 text-compliant-700',
  Formatting: 'bg-mitigated-50 text-mitigated-700',
  Vocabulary: 'bg-brand-50 text-brand-700',
  Evidence:   'bg-evidence-50 text-evidence-700',
};

// ─── Smart Learn tab ─────────────────────────────────────────────────────────

// ─── Coming-soon overlay for Smart Learn ─────────────────────────────────────
// The underlying tab content stays in DOM (blurred + non-interactive) so users
// get a hint of what's landing without being able to touch placeholder data.

function SmartLearnComingSoon() {
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center pt-16 px-6 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        className="pointer-events-auto max-w-lg w-full text-center rounded-2xl bg-canvas-elevated border border-canvas-border shadow-xl px-8 py-8"
      >
        {/* Coming-soon pill */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold tracking-wide uppercase mb-4">
          <Sparkles size={11} />
          Coming soon
        </span>

        {/* Animated chef-hat / brain icon */}
        <div className="relative w-14 h-14 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-100 to-brand-50" />
          <motion.div
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <Brain size={26} className="text-brand-700" />
          </motion.div>
        </div>

        {/* Witty hero — keeps the "IRA is cooking" cue */}
        <h2 className="font-display text-[22px] font-[420] text-ink-900 leading-tight mb-2">
          IRA is still cooking this one up.
        </h2>

        {/* Sub-line — explains the feature so the placeholder isn't just a mystery */}
        <p className="text-[13px] text-ink-500 leading-relaxed max-w-md mx-auto">
          Smart Learn will remember your output preferences and your organisation's vocabulary — so IRA writes the way <em className="not-italic font-semibold text-ink-700">you</em> would. We're tasting before we serve.
        </p>

        {/* Quiet animated dots — shows it's actively in motion, not stalled */}
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function SmartLearnTab() {
  const [behaviours, setBehaviours] = useState<BehaviourPref[]>(() => {
    try {
      const saved = localStorage.getItem(BEHAV_KEY);
      return saved ? JSON.parse(saved) : SEED_BEHAVIOURS;
    } catch { return SEED_BEHAVIOURS; }
  });
  const [memory, setMemory] = useState<MemoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(MEMORY_KEY);
      return saved ? JSON.parse(saved) : SEED_MEMORY;
    } catch { return SEED_MEMORY; }
  });

  useEffect(() => { localStorage.setItem(BEHAV_KEY, JSON.stringify(behaviours)); }, [behaviours]);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); }, [memory]);

  const [editingBehav, setEditingBehav] = useState<string | null>(null);
  const [behavDraft, setBehavDraft] = useState<{ label: string; scope: BehaviourPref['scope'] }>({ label: '', scope: 'Output' });

  const [editingMem, setEditingMem] = useState<string | null>(null);
  const [memDraft, setMemDraft] = useState<{ term: string; mapsTo: string; scope: string }>({ term: '', mapsTo: '', scope: '' });

  const startNewBehav = () => {
    const id = `b-${Date.now()}`;
    setBehaviours(prev => [{ id, label: '', scope: 'Output', confidence: 80, source: 'manual', learnedAt: new Date().toISOString().slice(0, 10) }, ...prev]);
    setBehavDraft({ label: '', scope: 'Output' });
    setEditingBehav(id);
  };
  const startNewMem = () => {
    const id = `m-${Date.now()}`;
    setMemory(prev => [{ id, term: '', mapsTo: '', scope: 'All sources', confidence: 80, source: 'manual', learnedAt: new Date().toISOString().slice(0, 10) }, ...prev]);
    setMemDraft({ term: '', mapsTo: '', scope: 'All sources' });
    setEditingMem(id);
  };

  const startEditBehav = (b: BehaviourPref) => { setBehavDraft({ label: b.label, scope: b.scope }); setEditingBehav(b.id); };
  const startEditMem = (m: MemoryEntry) => { setMemDraft({ term: m.term, mapsTo: m.mapsTo, scope: m.scope }); setEditingMem(m.id); };

  const saveBehav = (id: string) => {
    setBehaviours(prev => prev.map(b => b.id === id ? { ...b, label: behavDraft.label.trim() || b.label, scope: behavDraft.scope } : b));
    setEditingBehav(null);
  };
  const saveMem = (id: string) => {
    setMemory(prev => prev.map(m => m.id === id ? { ...m, term: memDraft.term.trim() || m.term, mapsTo: memDraft.mapsTo.trim() || m.mapsTo, scope: memDraft.scope.trim() || m.scope } : m));
    setEditingMem(null);
  };

  const cancelBehavEdit = (id: string) => {
    // If a brand-new row was empty, drop it on cancel.
    setBehaviours(prev => prev.filter(b => !(b.id === id && !b.label.trim())));
    setEditingBehav(null);
  };
  const cancelMemEdit = (id: string) => {
    setMemory(prev => prev.filter(m => !(m.id === id && !m.term.trim() && !m.mapsTo.trim())));
    setEditingMem(null);
  };

  const removeBehav = (id: string) => setBehaviours(prev => prev.filter(b => b.id !== id));
  const removeMem   = (id: string) => setMemory(prev => prev.filter(m => m.id !== id));

  // ── Aggregations for the modern dashboard view ────────────────────────────
  const avgConfidence = behaviours.length
    ? Math.round(behaviours.reduce((s, b) => s + b.confidence, 0) / behaviours.length)
    : 0;

  const scopeAgg = BEHAV_SCOPES.map(scope => {
    const items = behaviours.filter(b => b.scope === scope);
    return {
      scope,
      count: items.length,
      avg: items.length ? Math.round(items.reduce((s, b) => s + b.confidence, 0) / items.length) : 0,
    };
  }).filter(s => s.count > 0);

  const likes: string[] = [
    'Tabular layouts for risk and control lists',
    'Spelled-out severity (Critical / High / Medium / Low)',
    'Executive summary first, details second',
    'Inline source IDs (CTR-004, RSK-007, ENG-XXX)',
    'Numbers with thousand separators + tabular alignment',
    'IRA in first person ("I found…")',
  ];
  const avoids: string[] = [
    'Severity codes (P0–P3, MW/SD/CD)',
    'Numeric date formats (04/28/26)',
    'Avatar circles next to AI responses',
    'Decorative gradients and drop shadows',
    'Filler intros ("Here is what I found…")',
    'Centered body paragraphs outside hero moments',
  ];

  return (
    <div className="relative">
      {/* Coming-soon overlay — Smart Learn is masked behind a witty placeholder */}
      <SmartLearnComingSoon />

      {/* Underlying content — blurred + non-interactive so the layout shows
          through without exposing placeholder data the user can edit. */}
      <div className="space-y-8 filter blur-[6px] opacity-50 pointer-events-none select-none" aria-hidden="true">
        {/* ── Hero stats ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
          <div className="font-mono text-[11px] text-ink-500 tabular-nums mb-2">Behavioural preferences</div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-[36px] font-[420] text-ink-900 tabular-nums leading-none">{behaviours.length}</div>
            <div className="text-[12px] text-ink-500">learned across {scopeAgg.length} scopes</div>
          </div>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
          <div className="font-mono text-[11px] text-ink-500 tabular-nums mb-2">Enterprise terms</div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-[36px] font-[420] text-ink-900 tabular-nums leading-none">{memory.length}</div>
            <div className="text-[12px] text-ink-500">field aliases mapped</div>
          </div>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
          <div className="font-mono text-[11px] text-ink-500 tabular-nums mb-2">Average confidence</div>
          <div className="flex items-baseline gap-3">
            <div className="font-display text-[36px] font-[420] text-brand-700 tabular-nums leading-none">{avgConfidence}%</div>
            <div className="text-[12px] text-ink-500 inline-flex items-center gap-1"><TrendingUp size={11} className="text-compliant-700" /> trending up</div>
          </div>
        </div>
      </section>

      {/* ── Reasoning flow ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="font-mono text-[11px] text-ink-500 tabular-nums mb-1">How IRA answers a question</div>
        <h3 className="font-display text-[20px] font-[420] text-ink-900 leading-tight mb-4">Reasoning flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {[
            { label: 'Receive query',           tone: 'bg-paper-50 text-ink-700' },
            { label: 'Match enterprise memory', tone: 'bg-evidence-50 text-evidence-700' },
            { label: 'Apply behavioural prefs', tone: 'bg-brand-50 text-brand-700' },
            { label: 'Generate answer',         tone: 'bg-mitigated-50 text-mitigated-700' },
            { label: 'Cite sources',            tone: 'bg-compliant-50 text-compliant-700' },
          ].map((step, i, arr) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 h-8 rounded-md font-medium ${step.tone}`}>{step.label}</span>
              {i < arr.length - 1 && <ArrowRight size={14} className="text-ink-400 shrink-0" />}
            </span>
          ))}
        </div>
        <p className="text-[12px] text-ink-500 mt-3 leading-relaxed">
          Every IRA response runs through these five steps. Memory and behaviour are pulled from the lists below — edit them and the next answer reflects the change.
        </p>
      </section>

      {/* ── Behaviour confidence chart ─────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="font-mono text-[11px] text-ink-500 tabular-nums mb-1">Confidence by behavioural scope</div>
        <h3 className="font-display text-[20px] font-[420] text-ink-900 leading-tight mb-4">Where IRA is most confident</h3>
        <div className="space-y-3">
          {scopeAgg.map(s => (
            <div key={s.scope} className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2 h-5 rounded-full text-[11px] font-medium w-[88px] justify-center ${SCOPE_TONE[s.scope]}`}>{s.scope}</span>
              <div className="flex-1 h-2.5 rounded-full bg-paper-50 overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${s.avg}%` }} />
              </div>
              <span className="text-[12px] tabular-nums text-ink-700 w-10 text-right">{s.avg}%</span>
              <span className="text-[11px] tabular-nums text-ink-400 w-8 text-right">×{s.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Likes vs avoids ────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-compliant/30 bg-compliant-50/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp size={14} className="text-compliant-700" />
            <span className="font-mono text-[11px] text-compliant-700 tabular-nums">What IRA leans into</span>
          </div>
          <ul className="space-y-2">
            {likes.map(l => (
              <li key={l} className="flex items-start gap-2 text-[13px] text-ink-800">
                <Check size={12} className="text-compliant-700 mt-1 shrink-0" />
                {l}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-risk/30 bg-risk-50/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ThumbsDown size={14} className="text-risk-700" />
            <span className="font-mono text-[11px] text-risk-700 tabular-nums">What IRA avoids</span>
          </div>
          <ul className="space-y-2">
            {avoids.map(a => (
              <li key={a} className="flex items-start gap-2 text-[13px] text-ink-800">
                <X size={12} className="text-risk-700 mt-1 shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Behavioral preferences (editable list) ────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="font-mono text-[11px] text-ink-500 tabular-nums tracking-tight">
              Smart Learn · Behavioural · {behaviours.length} learned
            </div>
            <h2 className="font-display text-[24px] font-[420] text-ink-900 leading-tight">How IRA writes for you</h2>
            <p className="text-[13px] text-ink-500 mt-1">Output preferences and prompt style learned from your conversations. All editable.</p>
          </div>
          <button
            onClick={startNewBehav}
            className="flex items-center gap-2 px-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[13px] font-medium text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Add preference
          </button>
        </div>

        <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
          {behaviours.map((b, i) => (
            <BehaviourRow
              key={b.id}
              behav={b}
              isFirst={i === 0}
              editing={editingBehav === b.id}
              draft={behavDraft}
              setDraft={setBehavDraft}
              onEdit={() => startEditBehav(b)}
              onSave={() => saveBehav(b.id)}
              onCancel={() => cancelBehavEdit(b.id)}
              onRemove={() => removeBehav(b.id)}
            />
          ))}
          {behaviours.length === 0 && (
            <div className="text-center py-12 text-[13px] text-ink-500">
              No behaviour preferences yet. Use IRA in a few conversations and they will appear here.
            </div>
          )}
        </div>
      </section>

      {/* ── Enterprise memory ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="font-mono text-[11px] text-ink-500 tabular-nums tracking-tight">
              Smart Learn · Enterprise memory · {memory.length} terms
            </div>
            <h2 className="font-display text-[24px] font-[420] text-ink-900 leading-tight">Your organisation's vocabulary</h2>
            <p className="text-[13px] text-ink-500 mt-1">
              Field aliases and corporate naming IRA learned from your data sources. e.g. "revenue" maps to <span className="font-mono text-[12px] text-ink-700">Net_revenue</span>, not <span className="font-mono text-[12px] text-ink-700">total_revenue</span>.
            </p>
          </div>
          <button
            onClick={startNewMem}
            className="flex items-center gap-2 px-3 h-9 rounded-md border border-canvas-border bg-canvas-elevated text-[13px] font-medium text-ink-700 hover:border-brand-200 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Add term
          </button>
        </div>

        <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-4 h-10 items-center bg-paper-50/40 border-b border-canvas-border">
            <div className="col-span-3 text-[11px] font-semibold text-ink-500">Term</div>
            <div className="col-span-5 text-[11px] font-semibold text-ink-500">Maps to</div>
            <div className="col-span-2 text-[11px] font-semibold text-ink-500">Scope</div>
            <div className="col-span-1 text-[11px] font-semibold text-ink-500 text-right">Conf.</div>
            <div className="col-span-1" />
          </div>
          {memory.map((m, i) => (
            <MemoryRow
              key={m.id}
              entry={m}
              isFirst={i === 0}
              editing={editingMem === m.id}
              draft={memDraft}
              setDraft={setMemDraft}
              onEdit={() => startEditMem(m)}
              onSave={() => saveMem(m.id)}
              onCancel={() => cancelMemEdit(m.id)}
              onRemove={() => removeMem(m.id)}
            />
          ))}
          {memory.length === 0 && (
            <div className="text-center py-12 text-[13px] text-ink-500">
              No enterprise terms yet. Connect a data source and IRA will start mapping aliases.
            </div>
          )}
        </div>
      </section>

      <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-brand-50 border border-brand-200">
        <Sparkles size={14} className="text-brand-700 mt-0.5 shrink-0" />
        <p className="text-[13px] text-ink-800 leading-relaxed">
          Edits here teach IRA permanently. If you correct a mapping in chat, the new value lands here within a few minutes.
        </p>
      </div>
      </div>
    </div>
  );
}

// ─── Behaviour row ───────────────────────────────────────────────────────────

interface BehavRowProps {
  behav: BehaviourPref;
  isFirst: boolean;
  editing: boolean;
  draft: { label: string; scope: BehaviourPref['scope'] };
  setDraft: React.Dispatch<React.SetStateAction<{ label: string; scope: BehaviourPref['scope'] }>>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

function BehaviourRow({ behav, isFirst, editing, draft, setDraft, onEdit, onSave, onCancel, onRemove }: BehavRowProps) {
  return (
    <div className={`group flex items-center gap-3 px-4 py-3 ${isFirst ? '' : 'border-t border-canvas-border'} ${editing ? 'bg-brand-50/30' : 'hover:bg-brand-50/20'} transition-colors`}>
      {editing ? (
        <>
          <select
            value={draft.scope}
            onChange={(e) => setDraft(d => ({ ...d, scope: e.target.value as BehaviourPref['scope'] }))}
            className="h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[12px] text-ink-700 focus:outline-none focus:border-brand-600"
          >
            {BEHAV_SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            value={draft.label}
            onChange={(e) => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Describe the preference IRA should remember…"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
            className="flex-1 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600"
          />
          <button onClick={onSave}   className="p-1 rounded-md text-compliant-700 hover:bg-compliant-50 transition-colors cursor-pointer" title="Save"><Check size={14} /></button>
          <button onClick={onCancel} className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 transition-colors cursor-pointer" title="Cancel"><X size={14} /></button>
        </>
      ) : (
        <>
          <span className={`inline-flex items-center px-2 h-5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 w-[88px] justify-center ${SCOPE_TONE[behav.scope]}`}>
            {behav.scope}
          </span>
          <span className="flex-1 text-[14px] text-ink-800 leading-snug">{behav.label}</span>
          <span className="text-[11px] tabular-nums text-ink-500 shrink-0 w-12 text-right">{behav.confidence}%</span>
          <span className="text-[11px] tabular-nums text-ink-400 shrink-0 w-20 text-right hidden md:inline">{behav.learnedAt}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit}   className="p-1 rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer" title="Edit"><Pencil size={13} /></button>
            <button onClick={onRemove} className="p-1 rounded-md text-ink-500 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer" title="Remove"><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Memory row ──────────────────────────────────────────────────────────────

interface MemoryRowProps {
  entry: MemoryEntry;
  isFirst: boolean;
  editing: boolean;
  draft: { term: string; mapsTo: string; scope: string };
  setDraft: React.Dispatch<React.SetStateAction<{ term: string; mapsTo: string; scope: string }>>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

function MemoryRow({ entry, isFirst, editing, draft, setDraft, onEdit, onSave, onCancel, onRemove }: MemoryRowProps) {
  return (
    <div className={`group grid grid-cols-12 gap-4 px-4 py-3 items-center ${isFirst ? '' : 'border-t border-canvas-border'} ${editing ? 'bg-brand-50/30' : 'hover:bg-brand-50/20'} transition-colors`}>
      {editing ? (
        <>
          <input value={draft.term}   onChange={(e) => setDraft(d => ({ ...d, term: e.target.value }))}   placeholder="term"     autoFocus
                 onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                 className="col-span-3 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600" />
          <input value={draft.mapsTo} onChange={(e) => setDraft(d => ({ ...d, mapsTo: e.target.value }))} placeholder="maps to (e.g. table.column)"
                 onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                 className="col-span-5 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[13px] font-mono text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600" />
          <input value={draft.scope}  onChange={(e) => setDraft(d => ({ ...d, scope: e.target.value }))}  placeholder="scope"
                 onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
                 className="col-span-2 h-7 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[12px] text-ink-700 placeholder:text-ink-400 focus:outline-none focus:border-brand-600" />
          <div className="col-span-1 text-right">
            <span className="text-[11px] tabular-nums text-ink-400">{entry.confidence}%</span>
          </div>
          <div className="col-span-1 flex items-center justify-end gap-1">
            <button onClick={onSave}   className="p-1 rounded-md text-compliant-700 hover:bg-compliant-50 transition-colors cursor-pointer" title="Save"><Check size={14} /></button>
            <button onClick={onCancel} className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 transition-colors cursor-pointer" title="Cancel"><X size={14} /></button>
          </div>
        </>
      ) : (
        <>
          <span className="col-span-3 text-[14px] text-ink-800">{entry.term}</span>
          <span className="col-span-5 text-[13px] font-mono text-ink-700 truncate flex items-center gap-1.5">
            <ArrowRight size={11} className="text-ink-400 shrink-0" />
            {entry.mapsTo}
          </span>
          <span className="col-span-2 text-[12px] text-ink-500 truncate">{entry.scope}</span>
          <span className="col-span-1 text-[11px] tabular-nums text-ink-500 text-right">{entry.confidence}%</span>
          <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit}   className="p-1 rounded-md text-ink-500 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer" title="Edit"><Pencil size={13} /></button>
            <button onClick={onRemove} className="p-1 rounded-md text-ink-500 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer" title="Remove"><Trash2 size={13} /></button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── KnowledgeHubView ────────────────────────────────────────────────────────

export default function KnowledgeHubView() {
  const [tab, setTab] = useState<TabId>('data');

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      {/* Page header */}
      <div className="border-b border-canvas-border bg-canvas-elevated">
        <div className="max-w-6xl mx-auto px-8 pt-8 pb-0">
          <div className="font-mono text-[11px] text-ink-500 mb-2 tracking-tight">
            Knowledge Hub · {TABS.find(t => t.id === tab)!.label}
          </div>
          <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">Knowledge Hub</h1>
          <p className="text-[14px] text-ink-500 mt-1 mb-6">Sources IRA can read, and what IRA has learned from working with you.</p>

          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-transparent -mb-px">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 h-11 text-[13px] font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {isActive && (
                    <motion.div
                      layoutId="kh-tab-bar"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-brand-600"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        <AnimatePresence mode="wait">
          {tab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              <DataSourcesView />
            </motion.div>
          )}

          {tab === 'learn' && (
            <motion.div
              key="learn"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              <SmartLearnTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
