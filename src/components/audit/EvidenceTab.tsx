/**
 * Evidence Tab — the auditor's per-attribute evidence workspace.
 *
 * Flow per attribute:
 *   1. Identify required evidence types (declared on ControlAttribute).
 *   2. Upload the population for the engagement period (Excel).
 *   3. Generate N samples from the population.
 *   4. For each sample, upload each required evidence type (PDF / image / scan).
 *   5. Validate each sample Pass / Fail / Pending with a remark.
 *
 * KPIs roll up across all attributes for this engagement's process. All
 * mutations are local state + a toast — no backend.
 */

import { useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen, FileText, Upload, Sparkles, CheckCircle2, XCircle,
  Clock, ChevronRight, X, Plus, Search, Layers, Shield, ClipboardList,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement } from '../../data/engagements';
import { racmRowsForProcess, type RACMRow, type ControlAttribute } from '../../data/racm';

interface Props { engagement: Engagement }

// ─── Types ───────────────────────────────────────────────────────────────────

type Validation = 'Pass' | 'Fail' | 'Pending';
type SampleMethod = 'Random' | 'Statistical' | 'Business-rule';
type StatusFilter = 'All' | 'Complete' | 'In progress' | 'Not started';
type WorkingPaperStatus = 'Draft' | 'Reviewed' | 'Signed-off';

interface PopulationState { rows: number; filename: string; uploadedAgo: string }
interface EvidenceFile { filename: string; size: string }
interface GeneratedSample {
  id: string;
  evidence: Record<string, EvidenceFile | null>;
  validation: Validation;
  remark: string;
}
interface DistinctControl {
  controlId: string;
  description: string;
  subProcess: string;
  attributes: ControlAttribute[];
}
interface AttrProgress {
  hasPopulation: boolean;
  samplesTotal: number;
  samplesValidated: number;
  passCount: number;
  failCount: number;
  pendingCount: number;
  evidenceUploaded: number;
  evidenceRequired: number;
  requiredSampleSize: number;
  completion: number; // 0..1
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 — deterministic PRNG seeded from a string. */
function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function workingPaperFor(id: string): WorkingPaperStatus {
  const r = hash(id) % 100;
  return r < 38 ? 'Draft' : r < 78 ? 'Reviewed' : 'Signed-off';
}

function evidenceIconFor(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('screenshot') || l.includes('photo') || l.includes('image')) return '🖼️';
  if (l.includes('email')) return '✉️';
  if (l.includes('log') || l.includes('export')) return '📊';
  return '📄';
}

function uploadedAgoFor(seed: string): string {
  const d = Math.floor(rng(`ago-${seed}`)() * 9) + 1;
  return d === 1 ? '1d ago' : `${d}d ago`;
}

function mockFilename(et: string, sampleId: string): string {
  const slug = et.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  const num = (hash(`${et}|${sampleId}`) % 9000) + 1000;
  const ext = slug.includes('email') ? 'eml'
    : slug.includes('log') || slug.includes('export') || slug.includes('sheet') ? 'xlsx'
      : slug.includes('photo') || slug.includes('screenshot') ? 'png' : 'pdf';
  return `${slug}_${num}.${ext}`;
}

function mockFileSize(seed: string): string {
  const kb = Math.floor(rng(`size-${seed}`)() * 1800) + 80;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function buildControlGroups(rows: RACMRow[]): Map<string, DistinctControl[]> {
  const byProcess = new Map<string, Map<string, DistinctControl>>();
  rows.forEach(r => {
    if (!byProcess.has(r.subProcess)) byProcess.set(r.subProcess, new Map());
    const ctrlMap = byProcess.get(r.subProcess)!;
    const existing = ctrlMap.get(r.controlId);
    if (!existing) {
      ctrlMap.set(r.controlId, {
        controlId: r.controlId, description: r.controlDescription, subProcess: r.subProcess,
        attributes: [...r.attributes],
      });
    } else {
      r.attributes.forEach(a => { if (!existing.attributes.some(x => x.id === a.id)) existing.attributes.push(a); });
    }
  });
  const out = new Map<string, DistinctControl[]>();
  byProcess.forEach((m, sp) => out.set(sp, Array.from(m.values())));
  return out;
}

function seedPopulations(rows: RACMRow[]): Record<string, PopulationState> {
  const out: Record<string, PopulationState> = {};
  rows.forEach(r => r.attributes.forEach(a => {
    if (hash(`pop-${a.id}`) % 100 < 70) {
      out[a.id] = {
        rows: a.populationSize,
        filename: `population_${a.id.toLowerCase()}_FY26.xlsx`,
        uploadedAgo: uploadedAgoFor(a.id),
      };
    }
  }));
  return out;
}

const FAIL_REMARKS = [
  'Missing signature on supporting doc',
  'Unit price exceeds tolerance',
  'Approval timestamp out of sequence',
  'Vendor mismatch vs master',
  'Quantity variance > 2%',
];

function seedSamples(rows: RACMRow[], pops: Record<string, PopulationState>): Record<string, GeneratedSample[]> {
  const out: Record<string, GeneratedSample[]> = {};
  rows.forEach(r => r.attributes.forEach(attr => {
    if (!pops[attr.id]) return;
    if (hash(`samp-${attr.id}`) % 100 >= 55) return;
    const r2 = rng(`seed-${attr.id}`);
    const evRate = 0.35 + r2() * 0.05;
    const valRate = 0.20 + r2() * 0.10;
    out[attr.id] = Array.from({ length: attr.defaultSampleSize }).map((_, i) => {
      const sid = `S${String(i + 1).padStart(3, '0')}`;
      const evidence: Record<string, EvidenceFile | null> = {};
      attr.requiredEvidence.forEach(et => {
        const has = rng(`ev-${attr.id}-${sid}-${et}`)() < evRate;
        evidence[et] = has ? { filename: mockFilename(et, sid), size: mockFileSize(`${sid}-${et}`) } : null;
      });
      const vRoll = rng(`val-${attr.id}-${sid}`)();
      let validation: Validation = 'Pending';
      let remark = '';
      if (vRoll < valRate) {
        const pass = rng(`pass-${attr.id}-${sid}`)() < 0.75;
        if (pass) { validation = 'Pass'; }
        else {
          validation = 'Fail';
          remark = FAIL_REMARKS[Math.floor(rng(`fr-${attr.id}-${sid}`)() * FAIL_REMARKS.length)] ?? FAIL_REMARKS[0];
        }
      }
      return { id: sid, evidence, validation, remark };
    });
  }));
  return out;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvidenceTab(props: Props): JSX.Element {
  const { engagement } = props;
  const { addToast } = useToast();

  const allRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);
  const groupsBySub = useMemo(() => buildControlGroups(allRows), [allRows]);
  const subProcessNames = useMemo(() => Array.from(groupsBySub.keys()), [groupsBySub]);

  const allAttributes = useMemo(() => {
    const out: { attr: ControlAttribute; controlId: string; subProcess: string }[] = [];
    groupsBySub.forEach((ctrls, sp) => ctrls.forEach(c => c.attributes.forEach(a =>
      out.push({ attr: a, controlId: c.controlId, subProcess: sp }))));
    return out;
  }, [groupsBySub]);

  const seededPops = useMemo(() => seedPopulations(allRows), [allRows]);
  const seededSamples = useMemo(() => seedSamples(allRows, seededPops), [allRows, seededPops]);

  // State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [subProcessFilter, setSubProcessFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [expandedSub, setExpandedSub] = useState<Set<string>>(() => new Set(subProcessNames.slice(0, 1)));
  const [expandedControl, setExpandedControl] = useState<Set<string>>(() => new Set());
  const [populationsByAttr, setPopulationsByAttr] = useState<Record<string, PopulationState>>(seededPops);
  const [samplesByAttr, setSamplesByAttr] = useState<Record<string, GeneratedSample[]>>(seededSamples);
  const [sampleSizeByAttr, setSampleSizeByAttr] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    allAttributes.forEach(({ attr }) => { out[attr.id] = attr.defaultSampleSize; });
    return out;
  });
  const [methodByAttr, setMethodByAttr] = useState<Record<string, SampleMethod>>({});

  // Per-attribute progress
  const attrProgress = useMemo(() => {
    const out = new Map<string, AttrProgress>();
    allAttributes.forEach(({ attr }) => {
      const hasPopulation = !!populationsByAttr[attr.id];
      const samples = samplesByAttr[attr.id] ?? [];
      const samplesTotal = samples.length;
      const passCount = samples.filter(s => s.validation === 'Pass').length;
      const failCount = samples.filter(s => s.validation === 'Fail').length;
      const pendingCount = samples.filter(s => s.validation === 'Pending').length;
      const samplesValidated = passCount + failCount;
      const evidenceRequiredPerSample = attr.requiredEvidence.length;
      const evidenceRequired = samplesTotal * evidenceRequiredPerSample;
      let evidenceUploaded = 0;
      samples.forEach(s => attr.requiredEvidence.forEach(et => { if (s.evidence[et]) evidenceUploaded += 1; }));
      const requiredSampleSize = sampleSizeByAttr[attr.id] ?? attr.defaultSampleSize;
      const popPart = hasPopulation ? 1 : 0;
      const sampPart = samplesTotal > 0 ? Math.min(1, samplesTotal / requiredSampleSize) : 0;
      const evPart = evidenceRequired > 0 ? evidenceUploaded / evidenceRequired : 0;
      const valPart = samplesTotal > 0 ? samplesValidated / samplesTotal : 0;
      const completion = (popPart + sampPart + evPart + valPart) / 4;
      out.set(attr.id, {
        hasPopulation, samplesTotal, samplesValidated, passCount, failCount, pendingCount,
        evidenceUploaded, evidenceRequired, requiredSampleSize, completion,
      });
    });
    return out;
  }, [allAttributes, populationsByAttr, samplesByAttr, sampleSizeByAttr]);

  // KPIs
  const kpis = useMemo(() => {
    const totalAttrs = allAttributes.length;
    let withPopulation = 0, samplesGenerated = 0, samplesValidated = 0;
    let passCount = 0, failCount = 0, evidenceUploaded = 0, evidenceRequired = 0, completionSum = 0;
    allAttributes.forEach(({ attr }) => {
      const p = attrProgress.get(attr.id);
      if (!p) return;
      if (p.hasPopulation) withPopulation += 1;
      samplesGenerated += p.samplesTotal;
      samplesValidated += p.samplesValidated;
      passCount += p.passCount;
      failCount += p.failCount;
      evidenceUploaded += p.evidenceUploaded;
      evidenceRequired += p.evidenceRequired;
      completionSum += p.completion;
    });
    const evidencePending = Math.max(0, evidenceRequired - evidenceUploaded);
    const passRate = samplesValidated === 0 ? 0 : Math.round((passCount / samplesValidated) * 100);
    const overall = totalAttrs === 0 ? 0 : Math.round((completionSum / totalAttrs) * 100);
    return {
      totalAttrs, withPopulation, samplesGenerated, samplesValidated,
      passCount, failCount, evidenceUploaded, evidencePending, passRate, overall,
    };
  }, [allAttributes, attrProgress]);

  const attrStatusBucket = (attrId: string): Exclude<StatusFilter, 'All'> => {
    const p = attrProgress.get(attrId);
    if (!p) return 'Not started';
    if (p.completion >= 0.999) return 'Complete';
    if (p.hasPopulation || p.samplesTotal > 0 || p.evidenceUploaded > 0) return 'In progress';
    return 'Not started';
  };

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: { subProcess: string; controls: { control: DistinctControl; attributes: ControlAttribute[] }[] }[] = [];
    groupsBySub.forEach((ctrls, sp) => {
      if (subProcessFilter !== 'All' && sp !== subProcessFilter) return;
      const cFiltered: { control: DistinctControl; attributes: ControlAttribute[] }[] = [];
      ctrls.forEach(c => {
        const aFiltered = c.attributes.filter(a => {
          if (statusFilter !== 'All' && attrStatusBucket(a.id) !== statusFilter) return false;
          if (q.length > 0) {
            const inA = a.id.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
            const inC = c.controlId.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
            const inE = a.requiredEvidence.some(e => e.toLowerCase().includes(q));
            if (!inA && !inC && !inE) return false;
          }
          return true;
        });
        if (aFiltered.length > 0) cFiltered.push({ control: c, attributes: aFiltered });
      });
      if (cFiltered.length > 0) out.push({ subProcess: sp, controls: cFiltered });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsBySub, statusFilter, subProcessFilter, search, attrProgress]);

  const subProgressFor = (controls: { control: DistinctControl; attributes: ControlAttribute[] }[]) => {
    let attrs = 0, samples = 0, validated = 0, completionSum = 0;
    controls.forEach(({ attributes }) => attributes.forEach(a => {
      attrs += 1;
      const p = attrProgress.get(a.id);
      if (!p) return;
      samples += p.samplesTotal;
      validated += p.samplesValidated;
      completionSum += p.completion;
    }));
    return { attrs, samples, validated, completion: attrs === 0 ? 0 : Math.round((completionSum / attrs) * 100) };
  };

  const controlProgressFor = (attributes: ControlAttribute[]) => {
    let s = 0;
    attributes.forEach(a => { const p = attrProgress.get(a.id); if (p) s += p.completion; });
    return { completion: attributes.length === 0 ? 0 : Math.round((s / attributes.length) * 100) };
  };

  // Handlers
  const toggleSet = (setter: typeof setExpandedSub) => (key: string) =>
    setter(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleSub = toggleSet(setExpandedSub);
  const toggleControl = toggleSet(setExpandedControl);

  const onUploadPopulation = (attr: ControlAttribute, file: File) => {
    setPopulationsByAttr(prev => ({
      ...prev,
      [attr.id]: { rows: attr.populationSize, filename: file.name, uploadedAgo: 'just now' },
    }));
    addToast({ type: 'success', message: `Uploaded \`${file.name}\` — ${attr.populationSize.toLocaleString()} rows parsed` });
  };

  const onReplacePopulation = (attr: ControlAttribute) => {
    setPopulationsByAttr(prev => { const n = { ...prev }; delete n[attr.id]; return n; });
    setSamplesByAttr(prev => { const n = { ...prev }; delete n[attr.id]; return n; });
    addToast({ type: 'info', message: `Population cleared for ${attr.id} — upload a new file to continue` });
  };

  const onGenerateSamples = (attr: ControlAttribute) => {
    const size = sampleSizeByAttr[attr.id] ?? attr.defaultSampleSize;
    const method = methodByAttr[attr.id] ?? 'Random';
    const samples: GeneratedSample[] = Array.from({ length: size }).map((_, i) => {
      const evidence: Record<string, EvidenceFile | null> = {};
      attr.requiredEvidence.forEach(et => { evidence[et] = null; });
      return { id: `S${String(i + 1).padStart(3, '0')}`, evidence, validation: 'Pending' as Validation, remark: '' };
    });
    setSamplesByAttr(prev => ({ ...prev, [attr.id]: samples }));
    addToast({ type: 'success', message: `Generated ${size} ${method.toLowerCase()} samples for ${attr.id}` });
  };

  const onSetSampleSize = (attrId: string, n: number) =>
    setSampleSizeByAttr(prev => ({ ...prev, [attrId]: Math.max(1, Math.min(500, n)) }));

  const onSetMethod = (attrId: string, m: SampleMethod) =>
    setMethodByAttr(prev => ({ ...prev, [attrId]: m }));

  const onUploadEvidence = (attrId: string, sampleId: string, et: string, file: File) => {
    setSamplesByAttr(prev => ({
      ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId
        ? { ...s, evidence: { ...s.evidence, [et]: { filename: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` } } }
        : s),
    }));
    addToast({ type: 'success', message: `Attached \`${file.name}\` to ${sampleId}` });
  };

  const onRemoveEvidence = (attrId: string, sampleId: string, et: string) =>
    setSamplesByAttr(prev => ({
      ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId
        ? { ...s, evidence: { ...s.evidence, [et]: null } } : s),
    }));

  const onSetValidation = (attrId: string, sampleId: string, v: Validation) =>
    setSamplesByAttr(prev => ({
      ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId ? { ...s, validation: v } : s),
    }));

  const onSetRemark = (attrId: string, sampleId: string, remark: string) =>
    setSamplesByAttr(prev => ({
      ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId ? { ...s, remark } : s),
    }));

  const onRemoveSample = (attrId: string, sampleId: string) =>
    setSamplesByAttr(prev => ({
      ...prev,
      [attrId]: (prev[attrId] ?? []).filter(s => s.id !== sampleId),
    }));

  const onConfirm = (attr: ControlAttribute) =>
    addToast({ type: 'success', message: `${attr.id} marked complete — working paper ready for reviewer` });

  // Empty state
  if (allRows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 flex flex-col items-center text-center">
        <div className="p-3 rounded-2xl bg-brand-50 mb-4">
          <FolderOpen size={28} className="text-brand-600" />
        </div>
        <h3 className="text-[15px] font-semibold text-text mb-1.5">No controls in scope — upload a RACM first</h3>
        <p className="text-[12.5px] text-text-muted max-w-md mb-5 leading-relaxed">
          Once the RACM is uploaded, every attribute appears here as a workspace for population,
          sampling, and evidence validation.
        </p>
        <button
          onClick={() => addToast({ type: 'info', message: 'Heading back to RACM…' })}
          className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
        >
          Go to RACM tab
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        <KpiTile label="Attributes" value={kpis.totalAttrs} sub="in scope" />
        <KpiTile label="Population up" value={`${kpis.withPopulation}/${kpis.totalAttrs}`} sub="uploaded" />
        <KpiTile label="Samples" value={kpis.samplesGenerated} sub="generated" />
        <KpiTile label="Validated" value={kpis.samplesValidated}
          sub={`${kpis.passCount}P · ${kpis.failCount}F`}
          tone={kpis.failCount > 0 ? 'text-risk-700' : 'text-text'} />
        <KpiTile label="Evidence" value={kpis.evidenceUploaded} sub="files attached" />
        <KpiTile label="Pass rate" value={`${kpis.passRate}%`}
          sub={kpis.samplesValidated === 0 ? '—' : `of ${kpis.samplesValidated}`}
          tone={kpis.passRate >= 90 ? 'text-compliant-700' : kpis.passRate >= 70 ? 'text-mitigated-700' : 'text-risk-700'} />
        <KpiTile label="Pending" value={kpis.evidencePending} sub="evidence gaps"
          tone={kpis.evidencePending > 0 ? 'text-mitigated-700' : 'text-text'} />
        <KpiTile label="Completion" value={`${kpis.overall}%`} sub="overall"
          tone={kpis.overall >= 80 ? 'text-compliant-700' : kpis.overall >= 50 ? 'text-mitigated-700' : 'text-text'} />
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex items-center gap-1">
            {(['All', 'Complete', 'In progress', 'Not started'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                  statusFilter === s
                    ? 'bg-brand-50 text-brand-700 border border-brand-100'
                    : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Sub-process</span>
            {['All', ...subProcessNames].map(sp => (
              <button key={sp} onClick={() => setSubProcessFilter(sp)}
                className={`px-2.5 h-7 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${
                  subProcessFilter === sp
                    ? 'bg-ink-800 text-white border border-ink-800'
                    : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{sp}</button>
            ))}
          </div>
          <div className="relative w-[320px] max-w-full ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search attribute id, control, or evidence type…"
              className="w-full pl-7 pr-2.5 h-7 border border-canvas-border rounded-md text-[12px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 placeholder:text-ink-400" />
          </div>
        </div>
      </div>

      {/* Sub-process accordion */}
      <div className="space-y-3">
        {visibleGroups.length === 0 && (
          <div className="glass-card rounded-xl p-10 text-center">
            <p className="text-[13px] font-semibold text-text mb-1">No attributes match these filters</p>
            <p className="text-[12px] text-text-muted">Try clearing a filter or broadening your search.</p>
          </div>
        )}
        {visibleGroups.map(group => {
          const isOpen = expandedSub.has(group.subProcess);
          const sp = subProgressFor(group.controls);
          return (
            <div key={group.subProcess} className="glass-card rounded-xl overflow-hidden">
              <button onClick={() => toggleSub(group.subProcess)} aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors cursor-pointer text-left">
                <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><Layers size={13} className="text-brand-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-text">{group.subProcess}</span>
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {sp.attrs} attribute{sp.attrs === 1 ? '' : 's'}
                      <span className="text-border mx-1.5">·</span>
                      {sp.samples} samples
                      <span className="text-border mx-1.5">·</span>
                      <span className="text-compliant-700 font-semibold">{sp.validated} validated</span>
                    </span>
                  </div>
                </div>
                <ProgressPill value={sp.completion} />
                <ChevronRight size={14}
                  className={`text-text-muted transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden border-t border-canvas-border">
                    <div className="p-3 space-y-2.5 bg-canvas/30">
                      {group.controls.map(({ control, attributes }) => {
                        const cOpen = expandedControl.has(control.controlId);
                        const cp = controlProgressFor(attributes);
                        return (
                          <div key={control.controlId} className="rounded-xl border border-canvas-border bg-white overflow-hidden">
                            <button onClick={() => toggleControl(control.controlId)} aria-expanded={cOpen}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-canvas/40 transition-colors cursor-pointer text-left">
                              <ChevronRight size={14}
                                className={`text-ink-400 shrink-0 transition-transform ${cOpen ? 'rotate-90' : ''}`} />
                              <Shield size={13} className="text-brand-600 shrink-0" />
                              <span className="font-mono text-[12px] font-semibold text-brand-700 shrink-0">{control.controlId}</span>
                              <span className="text-[12.5px] text-text truncate flex-1 min-w-0">{control.description}</span>
                              <span className="text-[11px] text-text-muted shrink-0 tabular-nums">{attributes.length} attr</span>
                              <ProgressPill value={cp.completion} />
                            </button>
                            <AnimatePresence initial={false}>
                              {cOpen && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                  className="overflow-hidden border-t border-canvas-border">
                                  <div className="p-3 space-y-3 bg-canvas/40">
                                    {attributes.map(attr => (
                                      <AttributeWorkspace
                                        key={attr.id}
                                        attribute={attr}
                                        progress={attrProgress.get(attr.id)!}
                                        population={populationsByAttr[attr.id] ?? null}
                                        samples={samplesByAttr[attr.id] ?? []}
                                        sampleSize={sampleSizeByAttr[attr.id] ?? attr.defaultSampleSize}
                                        method={methodByAttr[attr.id] ?? 'Random'}
                                        onUploadPopulation={(f) => onUploadPopulation(attr, f)}
                                        onReplacePopulation={() => onReplacePopulation(attr)}
                                        onGenerate={() => onGenerateSamples(attr)}
                                        onSetSampleSize={(n) => onSetSampleSize(attr.id, n)}
                                        onSetMethod={(m) => onSetMethod(attr.id, m)}
                                        onUploadEvidence={(sid, et, f) => onUploadEvidence(attr.id, sid, et, f)}
                                        onRemoveEvidence={(sid, et) => onRemoveEvidence(attr.id, sid, et)}
                                        onSetValidation={(sid, v) => onSetValidation(attr.id, sid, v)}
                                        onSetRemark={(sid, r) => onSetRemark(attr.id, sid, r)}
                                        onRemoveSample={(sid) => onRemoveSample(attr.id, sid)}
                                        onConfirm={() => onConfirm(attr)}
                                      />
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
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

// ─── KpiTile / ProgressPill / ValidationPills ────────────────────────────────

function KpiTile({ label, value, sub, tone = 'text-text' }:
  { label: string; value: number | string; sub: string; tone?: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-canvas-border bg-white px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1 truncate">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
      <div className="text-[10.5px] text-text-muted mt-1 truncate">{sub}</div>
    </div>
  );
}

function ProgressPill({ value }: { value: number }): JSX.Element {
  const t = value >= 85
    ? { bg: 'bg-compliant-50', text: 'text-compliant-700', bar: 'bg-compliant', border: 'border-compliant-50' }
    : value >= 50
      ? { bg: 'bg-evidence-50', text: 'text-evidence-700', bar: 'bg-evidence-600', border: 'border-evidence-100' }
      : value > 0
        ? { bg: 'bg-mitigated-50', text: 'text-mitigated-700', bar: 'bg-mitigated-500', border: 'border-mitigated-50' }
        : { bg: 'bg-draft-50', text: 'text-draft-700', bar: 'bg-ink-300', border: 'border-canvas-border' };
  return (
    <span className={`inline-flex items-center gap-2 px-2 h-6 rounded-full text-[10.5px] font-semibold border tabular-nums shrink-0 ${t.bg} ${t.text} ${t.border}`}>
      <span className="w-10 h-1 rounded-full bg-white/70 overflow-hidden">
        <span className={`block h-full ${t.bar}`} style={{ width: `${value}%` }} />
      </span>
      {value}%
    </span>
  );
}

const VALIDATION_OPTS: { v: Validation; Icon: typeof CheckCircle2; active: string; idle: string }[] = [
  { v: 'Pass', Icon: CheckCircle2,
    active: 'bg-compliant-50 text-compliant-700 border-compliant-50 ring-2 ring-compliant/20',
    idle: 'border-canvas-border text-ink-500 hover:bg-compliant-50/40 hover:text-compliant-700' },
  { v: 'Fail', Icon: XCircle,
    active: 'bg-risk-50 text-risk-700 border-risk-50 ring-2 ring-risk/20',
    idle: 'border-canvas-border text-ink-500 hover:bg-risk-50/40 hover:text-risk-700' },
  { v: 'Pending', Icon: Clock,
    active: 'bg-draft-50 text-draft-700 border-canvas-border ring-2 ring-draft/15',
    idle: 'border-canvas-border text-ink-400 hover:bg-canvas' },
];

function ValidationPills({ current, onChange }: { current: Validation; onChange: (v: Validation) => void }): JSX.Element {
  return (
    <div className="inline-flex items-center gap-0.5">
      {VALIDATION_OPTS.map(({ v, Icon, active, idle }) => {
        const isActive = current === v;
        return (
          <button key={v} onClick={() => onChange(v)} aria-pressed={isActive} title={v} aria-label={v}
            className={`w-6 h-6 inline-flex items-center justify-center rounded border text-[10px] font-semibold transition-colors cursor-pointer ${isActive ? active : idle}`}>
            <Icon size={11} />
          </button>
        );
      })}
    </div>
  );
}

// ─── AttributeWorkspace ──────────────────────────────────────────────────────

interface AttributeWorkspaceProps {
  attribute: ControlAttribute;
  progress: AttrProgress;
  population: PopulationState | null;
  samples: GeneratedSample[];
  sampleSize: number;
  method: SampleMethod;
  onUploadPopulation: (file: File) => void;
  onReplacePopulation: () => void;
  onGenerate: () => void;
  onSetSampleSize: (n: number) => void;
  onSetMethod: (m: SampleMethod) => void;
  onUploadEvidence: (sampleId: string, evidenceType: string, file: File) => void;
  onRemoveEvidence: (sampleId: string, evidenceType: string) => void;
  onSetValidation: (sampleId: string, v: Validation) => void;
  onSetRemark: (sampleId: string, remark: string) => void;
  onRemoveSample: (sampleId: string) => void;
  onConfirm: () => void;
}

function AttributeWorkspace(p: AttributeWorkspaceProps): JSX.Element {
  const { attribute, progress, population, samples } = p;
  const populationInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const wp = workingPaperFor(attribute.id);

  const fullyDone = progress.hasPopulation
    && progress.samplesTotal >= progress.requiredSampleSize
    && progress.evidenceUploaded === progress.evidenceRequired
    && progress.samplesValidated === progress.samplesTotal
    && progress.samplesTotal > 0;

  const wpCls = wp === 'Draft' ? 'bg-draft-50 text-draft-700 border-canvas-border'
    : wp === 'Reviewed' ? 'bg-evidence-50 text-evidence-700 border-evidence-100'
      : 'bg-compliant-50 text-compliant-700 border-compliant-50';

  return (
    <div className="rounded-xl border border-canvas-border bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-canvas-border bg-canvas/40">
        <div className="flex items-start gap-3">
          <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5 tabular-nums shrink-0">
            {attribute.id}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text leading-snug">{attribute.description}</p>
            <p className="text-[11.5px] italic text-text-muted mt-0.5 leading-snug">{attribute.testProcedure}</p>
          </div>
          <ProgressPill value={Math.round(progress.completion * 100)} />
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted shrink-0">Required evidence</span>
          {attribute.requiredEvidence.map(et => (
            <span key={et}
              className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-evidence-50 text-evidence-700 border border-evidence-100 text-[11px] font-medium">
              <span aria-hidden="true">{evidenceIconFor(et)}</span>
              {et}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Population */}
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText size={12} className="text-text-muted" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Population</span>
          </div>
          {population ? (
            <div className="rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2 flex items-center gap-3">
              <span className="w-7 h-7 rounded-md bg-compliant-50 text-compliant-700 inline-flex items-center justify-center shrink-0">
                <CheckCircle2 size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-text truncate">{population.filename}</p>
                <p className="text-[10.5px] text-text-muted tabular-nums mt-0.5">
                  {population.rows.toLocaleString()} rows uploaded
                  <span className="text-border mx-1.5">·</span>{population.uploadedAgo}
                </p>
              </div>
              <button onClick={p.onReplacePopulation}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer shrink-0">
                Replace
              </button>
            </div>
          ) : (
            <label
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0]; if (f) p.onUploadPopulation(f);
              }}
              className={`block cursor-pointer rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
                dragOver ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-brand-50/30'
              }`}
            >
              <input ref={populationInputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) p.onUploadPopulation(f);
                  if (populationInputRef.current) populationInputRef.current.value = '';
                }} />
              <Upload size={16} className="mx-auto text-ink-400 mb-1.5" />
              <p className="text-[12px] font-medium text-text leading-tight">Upload population for the engagement period</p>
              <p className="text-[11px] text-text-muted mt-0.5 tabular-nums">
                Excel only · ~{attribute.populationSize.toLocaleString()} rows expected
              </p>
            </label>
          )}
        </section>

        {/* Sample generation */}
        {population && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-brand-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Sample generation</span>
            </div>
            <div className="rounded-lg border border-canvas-border bg-canvas/40 p-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">Size</span>
                <input type="number" min={1} max={500} value={p.sampleSize}
                  onChange={(e) => p.onSetSampleSize(parseInt(e.target.value || '0', 10))}
                  className="w-16 px-2 h-7 border border-canvas-border rounded-md text-[12px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 tabular-nums" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-0.5">Method</span>
                {(['Random', 'Statistical', 'Business-rule'] as SampleMethod[]).map(m => (
                  <button key={m} onClick={() => p.onSetMethod(m)}
                    className={`px-2.5 h-7 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer ${
                      p.method === m
                        ? 'bg-brand-50 text-brand-700 border-brand-100'
                        : 'bg-white text-ink-600 border-canvas-border hover:bg-canvas'}`}>{m}</button>
                ))}
              </div>
              <button onClick={p.onGenerate}
                className="ml-auto inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-[12px] font-semibold border border-brand-600 bg-brand-600 text-white hover:bg-brand-500 transition-colors cursor-pointer">
                <Sparkles size={11} />
                {samples.length > 0 ? 'Regenerate samples' : 'Generate samples'}
              </button>
            </div>
          </section>
        )}

        {/* Samples table */}
        {population && samples.length > 0 && (
          <SamplesTable
            attribute={attribute}
            samples={samples}
            onUploadEvidence={p.onUploadEvidence}
            onRemoveEvidence={p.onRemoveEvidence}
            onSetValidation={p.onSetValidation}
            onSetRemark={p.onSetRemark}
            onRemoveSample={p.onRemoveSample}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-canvas-border bg-canvas/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted min-w-0">
          <ClipboardList size={12} className="text-text-muted shrink-0" />
          <span className="uppercase tracking-wider font-semibold shrink-0">Working paper</span>
          <span className={`px-2 h-5 rounded-full text-[10.5px] font-semibold border inline-flex items-center shrink-0 ${wpCls}`}>{wp}</span>
          {samples.length > 0 && (
            <span className="tabular-nums truncate hidden md:inline">
              <span className="text-border mx-1.5">·</span>
              {progress.samplesValidated}/{progress.samplesTotal} validated
              <span className="text-border mx-1.5">·</span>
              {progress.evidenceUploaded}/{progress.evidenceRequired} evidence
            </span>
          )}
        </div>
        <button onClick={p.onConfirm} disabled={!fullyDone}
          title={fullyDone ? 'Mark attribute complete' : 'Complete sampling, evidence, and validation first'}
          className={`inline-flex items-center gap-1 px-2.5 h-6 rounded-md text-[11px] font-semibold border transition-colors ${
            fullyDone
              ? 'bg-compliant-50 text-compliant-700 border-compliant-50 hover:bg-compliant-50/80 cursor-pointer'
              : 'bg-canvas text-ink-400 border-canvas-border cursor-not-allowed'
          }`}>
          <CheckCircle2 size={11} />
          Confirm completeness
        </button>
      </div>
    </div>
  );
}

// ─── SamplesTable ────────────────────────────────────────────────────────────

interface SamplesTableProps {
  attribute: ControlAttribute;
  samples: GeneratedSample[];
  onUploadEvidence: (sampleId: string, evidenceType: string, file: File) => void;
  onRemoveEvidence: (sampleId: string, evidenceType: string) => void;
  onSetValidation: (sampleId: string, v: Validation) => void;
  onSetRemark: (sampleId: string, remark: string) => void;
  onRemoveSample: (sampleId: string) => void;
}

function SamplesTable(p: SamplesTableProps): JSX.Element {
  const { attribute, samples } = p;
  const evidenceTypes = attribute.requiredEvidence;
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2">
        <FolderOpen size={12} className="text-text-muted" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Samples</span>
        <span className="ml-auto text-[10.5px] tabular-nums text-text-muted">
          {samples.length} row{samples.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="rounded-lg border border-canvas-border overflow-hidden bg-white">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead className="sticky top-0 bg-canvas/80 backdrop-blur-sm z-10">
              <tr className="text-[10px] uppercase tracking-wider font-bold text-text-muted">
                <th className="text-left px-2.5 py-2 border-b border-canvas-border w-[80px]">Sample ID</th>
                {evidenceTypes.map(et => (
                  <th key={et} className="text-left px-2.5 py-2 border-b border-canvas-border min-w-[160px]">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden="true" className="opacity-70">{evidenceIconFor(et)}</span>
                      <span className="truncate" title={et}>{et}</span>
                    </span>
                  </th>
                ))}
                <th className="text-left px-2.5 py-2 border-b border-canvas-border w-[110px]">Validation</th>
                <th className="text-left px-2.5 py-2 border-b border-canvas-border min-w-[160px]">Remark</th>
                <th className="text-right px-2.5 py-2 border-b border-canvas-border w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {samples.map((s, i) => (
                <tr key={s.id} className={`hover:bg-brand-50/30 transition-colors ${i % 2 === 1 ? 'bg-canvas/40' : 'bg-white'}`}>
                  <td className="px-2.5 py-2 border-b border-canvas-border align-middle">
                    <span className="font-mono text-[11px] font-semibold text-ink-700 tabular-nums">{s.id}</span>
                  </td>
                  {evidenceTypes.map(et => (
                    <td key={et} className="px-2.5 py-2 border-b border-canvas-border align-middle">
                      <EvidenceSlot
                        slotId={`${attribute.id}-${s.id}-${et}`}
                        file={s.evidence[et] ?? null}
                        onUpload={(f) => p.onUploadEvidence(s.id, et, f)}
                        onRemove={() => p.onRemoveEvidence(s.id, et)}
                      />
                    </td>
                  ))}
                  <td className="px-2.5 py-2 border-b border-canvas-border align-middle">
                    <ValidationPills current={s.validation} onChange={(v) => p.onSetValidation(s.id, v)} />
                  </td>
                  <td className="px-2.5 py-2 border-b border-canvas-border align-middle">
                    <input type="text" value={s.remark}
                      placeholder={s.validation === 'Fail' ? 'Fail reason…' : 'Remark…'}
                      onChange={(e) => p.onSetRemark(s.id, e.target.value)}
                      className="w-full px-1.5 h-6 border border-transparent rounded text-[11px] text-ink-700 bg-canvas/60 outline-none focus:border-brand-300 focus:bg-white focus:ring-1 focus:ring-brand-500/15 placeholder:text-ink-400 transition-colors" />
                  </td>
                  <td className="px-2.5 py-2 border-b border-canvas-border align-middle text-right">
                    <button onClick={() => p.onRemoveSample(s.id)} aria-label={`Remove ${s.id}`}
                      className="w-5 h-5 inline-flex items-center justify-center rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50/60 cursor-pointer">
                      <X size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── EvidenceSlot ────────────────────────────────────────────────────────────

function EvidenceSlot({ slotId, file, onUpload, onRemove }:
  { slotId: string; file: EvidenceFile | null; onUpload: (file: File) => void; onRemove: () => void }): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `evslot-${slotId.replace(/[^a-z0-9]/gi, '-')}`;

  if (file) {
    return (
      <div className="inline-flex items-center gap-1 max-w-full px-1.5 h-6 rounded-md border border-evidence-100 bg-evidence-50/50 text-[10.5px] text-evidence-700"
        title={`${file.filename} · ${file.size}`}>
        <span aria-hidden="true">📎</span>
        <span className="truncate max-w-[140px] font-medium">{file.filename}</span>
        <button onClick={onRemove} aria-label={`Remove ${file.filename}`}
          className="w-3.5 h-3.5 inline-flex items-center justify-center rounded text-evidence-700/70 hover:text-risk-700 hover:bg-risk-50/60 cursor-pointer shrink-0">
          <X size={9} />
        </button>
      </div>
    );
  }

  return (
    <>
      <label htmlFor={inputId}
        className="inline-flex items-center gap-1 px-1.5 h-6 rounded-md border border-dashed border-canvas-border text-[10.5px] text-ink-500 bg-white hover:bg-brand-50/40 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors">
        <Plus size={10} />
        Upload
      </label>
      <input id={inputId} ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]; if (f) onUpload(f);
          if (inputRef.current) inputRef.current.value = '';
        }} />
    </>
  );
}
