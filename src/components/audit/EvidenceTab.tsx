/**
 * Evidence Tab — auditor's per-control evidence workspace, restructured around
 * a 3-step vertical stepper: sub-process accordion → flat control list →
 * click control → inline expansion → stepper (1: Upload Population →
 * 2: Process Samples & Upload Evidence → 3: AI Validate + Working Paper).
 *
 * Per-control audit trail is captured locally and surfaced inline (also
 * captured in the engagement Action Trail tab, which is the canonical home).
 */

import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderOpen, FileText, Upload, Sparkles, CheckCircle2, XCircle,
  Clock, ChevronRight, ChevronDown, X, Plus, AlertTriangle, Filter, Search,
  Eye, Activity, BookText, Download, RefreshCw, Layers, Shield, ListChecks, User,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import type { Engagement } from '../../data/engagements';
import { racmRowsForProcess, type RACMRow, type ControlAttribute } from '../../data/racm';
import { CURRENT_USER } from '../../data/grc-domain';

interface Props { engagement: Engagement }

// ─── Types ───────────────────────────────────────────────────────────────────

type AiVerdict = 'Pass' | 'Fail' | 'Hold';
type HumanVerdict = 'Pass' | 'Fail' | 'Hold';
type SampleMethod = 'Random' | 'Statistical' | 'Business-rule';
type StatusFilter = 'All' | 'Complete' | 'In progress' | 'Not started';
type ControlStatus = 'Not started' | 'In progress' | 'Validated' | 'Working paper ready';
type StepNum = 1 | 2 | 3;
type Operator = '=' | '>' | '<' | 'contains';

interface PopulationState { rows: number; filename: string; uploadedAgo: string }
interface EvidenceFile { filename: string; size: string }
interface ColumnFilter { id: string; column: string; operator: Operator; value: string }
interface GeneratedSample {
  id: string;
  evidence: Record<string, EvidenceFile | null>;
  aiVerdict: AiVerdict | null;
  aiConfidence: number;
  aiRationale: string;
  useAi: boolean;
  humanVerdict: HumanVerdict;
  humanRemark: string;
}
interface DistinctControl {
  controlId: string; description: string; subProcess: string;
  isKey: boolean; attributes: ControlAttribute[];
}
interface AuditEvent {
  id: string; timestamp: number; relTime: string;
  actor: 'human' | 'ai' | 'system'; actorName: string;
  icon: 'upload' | 'sparkles' | 'check' | 'override' | 'download' | 'gear';
  type: string; text: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
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

const PASS_RATIONALES = [
  'All 3 required evidence files present and match policy',
  'Approval trail intact, vendor master entry matches PO',
  'Three-way match passes within tolerance band',
  'Dual sign-off captured in payment-run log',
];
const FAIL_RATIONALES = [
  'Sample missing approval signature — likely deficient',
  'Unit price exceeds tolerance vs PO',
  'Vendor mismatch vs master — KYC pack incomplete',
  'Approval timestamp out of sequence (post-payment)',
];
const HOLD_RATIONALES = [
  'Evidence legibility low — manual confirmation needed',
  'Filename suggests duplicate, awaiting clarification',
];

/** Deterministic AI verdict from a sample id; ~75% pass, ~20% fail, ~5% hold. */
function deterministicAiVerdict(seed: string): { v: AiVerdict; confidence: number; rationale: string } {
  const r = rng(`ai-${seed}`);
  const roll = r();
  let v: AiVerdict; let pool: string[];
  if (roll < 0.75) { v = 'Pass'; pool = PASS_RATIONALES; }
  else if (roll < 0.95) { v = 'Fail'; pool = FAIL_RATIONALES; }
  else { v = 'Hold'; pool = HOLD_RATIONALES; }
  return { v, confidence: 65 + Math.floor(r() * 33), rationale: pool[Math.floor(r() * pool.length)] ?? pool[0]! };
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
        isKey: r.isKey, attributes: [...r.attributes],
      });
    } else {
      r.attributes.forEach(a => { if (!existing.attributes.some(x => x.id === a.id)) existing.attributes.push(a); });
    }
  });
  const out = new Map<string, DistinctControl[]>();
  byProcess.forEach((m, sp) => out.set(sp, Array.from(m.values())));
  return out;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diff / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

// ─── Demo seeding (deterministic, varies state across controls) ──────────────

interface SeedBundle {
  populations: Record<string, PopulationState>;
  samples: Record<string, GeneratedSample[]>;
  methods: Record<string, SampleMethod>;
  trails: Record<string, AuditEvent[]>;
}

function seedFor(controls: DistinctControl[]): SeedBundle {
  const populations: Record<string, PopulationState> = {};
  const samples: Record<string, GeneratedSample[]> = {};
  const methods: Record<string, SampleMethod> = {};
  const trails: Record<string, AuditEvent[]> = {};
  controls.forEach(ctrl => {
    const r = rng(`ctrl-${ctrl.controlId}`);
    const roll = r();
    // 30% all 3 done · 40% partial step 2 · 15% step 1 only · 15% nothing
    const bucket = roll < 0.30 ? 'done' : roll < 0.70 ? 'partial' : roll < 0.85 ? 'pop' : 'empty';
    const trail: AuditEvent[] = [];
    let t = Date.now() - Math.floor(r() * 4 + 1) * 86_400_000;
    const push = (e: Omit<AuditEvent, 'timestamp' | 'relTime'>) => {
      t += Math.floor(rng(`t-${e.id}`)() * 1800_000) + 60_000;
      trail.push({ ...e, timestamp: t, relTime: relTime(t) });
    };
    if (bucket === 'empty') { trails[ctrl.controlId] = trail; return; }
    // Step 1: populations for every attribute
    ctrl.attributes.forEach(attr => {
      populations[attr.id] = {
        rows: attr.populationSize,
        filename: `population_${attr.id.toLowerCase()}_FY26.xlsx`,
        uploadedAgo: uploadedAgoFor(attr.id),
      };
      methods[attr.id] = (['Random', 'Statistical', 'Business-rule'] as SampleMethod[])[Math.floor(rng(`m-${attr.id}`)() * 3)]!;
      push({ id: `${attr.id}-pop`, actor: 'human', actorName: CURRENT_USER.name, icon: 'upload',
        type: 'population_uploaded',
        text: `Population uploaded · ${populations[attr.id]!.filename} · ${attr.populationSize.toLocaleString()} rows` });
    });
    if (bucket === 'pop') { trails[ctrl.controlId] = trail; return; }
    // Step 2: generate samples (partial or full evidence)
    ctrl.attributes.forEach(attr => {
      const sR = rng(`samp-${attr.id}`);
      const evRate = bucket === 'done' ? 1 : 0.45 + sR() * 0.2;
      const list: GeneratedSample[] = Array.from({ length: attr.defaultSampleSize }).map((_, i) => {
        const sid = `S${String(i + 1).padStart(3, '0')}`;
        const evidence: Record<string, EvidenceFile | null> = {};
        attr.requiredEvidence.forEach(et => {
          const has = bucket === 'done' ? true : rng(`ev-${attr.id}-${sid}-${et}`)() < evRate;
          evidence[et] = has ? { filename: mockFilename(et, sid), size: mockFileSize(`${sid}-${et}`) } : null;
        });
        const sample: GeneratedSample = { id: sid, evidence, aiVerdict: null, aiConfidence: 0, aiRationale: '',
          useAi: true, humanVerdict: 'Pass', humanRemark: '' };
        if (bucket === 'done') {
          const ai = deterministicAiVerdict(`${attr.id}-${sid}`);
          sample.aiVerdict = ai.v; sample.aiConfidence = ai.confidence; sample.aiRationale = ai.rationale;
        }
        return sample;
      });
      samples[attr.id] = list;
      push({ id: `${attr.id}-gen`, actor: 'system', actorName: 'System', icon: 'gear',
        type: 'samples_generated',
        text: `Generated ${list.length} samples for ${attr.id} (method: ${methods[attr.id] ?? 'Random'})` });
      const evUploads = Math.min(bucket === 'done' ? 3 : 2, list.length);
      for (let i = 0; i < evUploads; i += 1) {
        const sample = list[i]!;
        const et = attr.requiredEvidence[0] ?? 'Evidence';
        const file = sample.evidence[et];
        if (!file) continue;
        push({ id: `${attr.id}-${sample.id}-ev`, actor: 'human', actorName: CURRENT_USER.name,
          icon: 'upload', type: 'evidence_uploaded',
          text: `Evidence '${file.filename}' uploaded for ${sample.id} · ${et}` });
      }
    });
    if (bucket === 'done') {
      ctrl.attributes.forEach(attr => {
        const samps = samples[attr.id] ?? [];
        const passes = samps.filter(s => s.aiVerdict === 'Pass').length;
        const fails = samps.filter(s => s.aiVerdict === 'Fail').length;
        push({ id: `${attr.id}-ai`, actor: 'ai', actorName: 'Ira AI', icon: 'sparkles',
          type: 'ai_validated',
          text: `AI validated ${samps.length} samples for ${attr.id} · ${passes} pass / ${fails} fail` });
      });
      push({ id: `${ctrl.controlId}-wp`, actor: 'human', actorName: CURRENT_USER.name, icon: 'download',
        type: 'working_paper_exported', text: 'Working paper exported as PDF' });
    }
    trails[ctrl.controlId] = trail;
  });
  return { populations, samples, methods, trails };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EvidenceTab(props: Props): JSX.Element {
  const { engagement } = props;
  const { addToast } = useToast();

  const allRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);
  const groupsBySub = useMemo(() => buildControlGroups(allRows), [allRows]);
  const subProcessNames = useMemo(() => Array.from(groupsBySub.keys()), [groupsBySub]);
  const allControls = useMemo(() => {
    const out: DistinctControl[] = [];
    groupsBySub.forEach(list => list.forEach(c => out.push(c)));
    return out;
  }, [groupsBySub]);
  const allAttributes = useMemo(() => {
    const out: { attr: ControlAttribute; controlId: string; subProcess: string }[] = [];
    groupsBySub.forEach((ctrls, sp) => ctrls.forEach(c => c.attributes.forEach(a =>
      out.push({ attr: a, controlId: c.controlId, subProcess: sp }))));
    return out;
  }, [groupsBySub]);
  const seeded = useMemo(() => seedFor(allControls), [allControls]);

  // State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [subProcessFilter, setSubProcessFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [expandedSub, setExpandedSub] = useState<Set<string>>(() => new Set(subProcessNames.slice(0, 1)));
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<Record<string, StepNum>>({});
  const [populationsByAttr, setPopulationsByAttr] = useState<Record<string, PopulationState>>(seeded.populations);
  const [samplesByAttr, setSamplesByAttr] = useState<Record<string, GeneratedSample[]>>(seeded.samples);
  const [sampleSizeByAttr, setSampleSizeByAttr] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    allAttributes.forEach(({ attr }) => { out[attr.id] = attr.defaultSampleSize; });
    return out;
  });
  const [methodByAttr, setMethodByAttr] = useState<Record<string, SampleMethod>>(seeded.methods);
  const [filtersByAttr, setFiltersByAttr] = useState<Record<string, ColumnFilter[]>>({});
  const [aiRunningByAttr, setAiRunningByAttr] = useState<Record<string, boolean>>({});
  const [auditTrails, setAuditTrails] = useState<Record<string, AuditEvent[]>>(seeded.trails);
  const [workingPaperModalCtrl, setWorkingPaperModalCtrl] = useState<DistinctControl | null>(null);
  const [trailToastFired, setTrailToastFired] = useState<boolean>(false);

  const pushEvent = useCallback((controlId: string, event: Omit<AuditEvent, 'id' | 'timestamp' | 'relTime'>) => {
    const ts = Date.now();
    const built: AuditEvent = { id: `${controlId}-${event.type}-${ts}-${Math.floor(Math.random() * 10_000)}`,
      timestamp: ts, relTime: 'just now', ...event };
    setAuditTrails(prev => ({ ...prev, [controlId]: [built, ...(prev[controlId] ?? [])] }));
    if (!trailToastFired) {
      setTrailToastFired(true);
      addToast({ type: 'info', message: 'Logged to audit trail · also captured in Action Trail tab' });
    }
  }, [addToast, trailToastFired]);

  // Per-attribute / per-control state derivations
  const attrHasPop = (attrId: string) => !!populationsByAttr[attrId];
  const attrSamples = (attrId: string) => samplesByAttr[attrId] ?? [];
  const attrAiDone = (attrId: string) => attrSamples(attrId).every(s => s.aiVerdict !== null);

  const controlStepDone = (ctrl: DistinctControl, step: StepNum): boolean => {
    if (step === 1) return ctrl.attributes.some(a => attrHasPop(a.id));
    if (step === 2) {
      const withPop = ctrl.attributes.filter(a => attrHasPop(a.id));
      if (withPop.length === 0) return false;
      return withPop.some(a => {
        const samps = attrSamples(a.id);
        return samps.length > 0 && samps.some(s => a.requiredEvidence.every(et => !!s.evidence[et]));
      });
    }
    const withSamples = ctrl.attributes.filter(a => attrSamples(a.id).length > 0);
    if (withSamples.length === 0) return false;
    return withSamples.every(a => attrAiDone(a.id));
  };

  const controlStatus = (ctrl: DistinctControl): ControlStatus => {
    const s1 = controlStepDone(ctrl, 1), s2 = controlStepDone(ctrl, 2), s3 = controlStepDone(ctrl, 3);
    if (s1 && s2 && s3) return 'Working paper ready';
    if (s1 && s2) return 'Validated';
    if (s1) return 'In progress';
    return 'Not started';
  };

  const controlBucket = (ctrl: DistinctControl): Exclude<StatusFilter, 'All'> => {
    const st = controlStatus(ctrl);
    if (st === 'Working paper ready') return 'Complete';
    if (st === 'Not started') return 'Not started';
    return 'In progress';
  };

  // KPIs (computed over all attributes)
  const kpis = useMemo(() => {
    const totalAttrs = allAttributes.length;
    let withPopulation = 0, samplesGenerated = 0, samplesValidated = 0;
    let passCount = 0, failCount = 0, evidenceUploaded = 0, evidenceRequired = 0, completionSum = 0;
    allAttributes.forEach(({ attr }) => {
      if (attrHasPop(attr.id)) withPopulation += 1;
      const samps = attrSamples(attr.id);
      samplesGenerated += samps.length;
      samps.forEach(s => {
        if (s.aiVerdict !== null) samplesValidated += 1;
        const effective = s.useAi ? s.aiVerdict : s.humanVerdict;
        if (effective === 'Pass') passCount += 1;
        else if (effective === 'Fail') failCount += 1;
        attr.requiredEvidence.forEach(et => {
          evidenceRequired += 1;
          if (s.evidence[et]) evidenceUploaded += 1;
        });
      });
      const popPart = attrHasPop(attr.id) ? 1 : 0;
      const sampPart = samps.length > 0 ? 1 : 0;
      const evPart = samps.length > 0
        ? samps.reduce((acc, s) => acc + attr.requiredEvidence.filter(et => s.evidence[et]).length, 0)
          / Math.max(1, samps.length * attr.requiredEvidence.length) : 0;
      const valPart = samps.length > 0 ? samps.filter(s => s.aiVerdict !== null).length / samps.length : 0;
      completionSum += (popPart + sampPart + evPart + valPart) / 4;
    });
    const evidencePending = Math.max(0, evidenceRequired - evidenceUploaded);
    const passRate = samplesValidated === 0 ? 0 : Math.round((passCount / samplesValidated) * 100);
    const overall = totalAttrs === 0 ? 0 : Math.round((completionSum / totalAttrs) * 100);
    return { totalAttrs, withPopulation, samplesGenerated, samplesValidated, passCount, failCount,
      evidenceUploaded, evidencePending, passRate, overall };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAttributes, populationsByAttr, samplesByAttr]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: { subProcess: string; controls: DistinctControl[] }[] = [];
    groupsBySub.forEach((ctrls, sp) => {
      if (subProcessFilter !== 'All' && sp !== subProcessFilter) return;
      const filtered = ctrls.filter(c => {
        if (statusFilter !== 'All' && controlBucket(c) !== statusFilter) return false;
        if (q.length > 0) {
          const inC = c.controlId.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
          const inA = c.attributes.some(a => a.id.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
          const inE = c.attributes.some(a => a.requiredEvidence.some(e => e.toLowerCase().includes(q)));
          if (!inC && !inA && !inE) return false;
        }
        return true;
      });
      if (filtered.length > 0) out.push({ subProcess: sp, controls: filtered });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsBySub, statusFilter, subProcessFilter, search, populationsByAttr, samplesByAttr]);

  const toggleSub = (key: string) => setExpandedSub(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const toggleControl = (controlId: string) => {
    setExpandedControl(prev => prev === controlId ? null : controlId);
    if (!activeStep[controlId]) setActiveStep(prev => ({ ...prev, [controlId]: 1 }));
  };
  const setStep = (controlId: string, step: StepNum) => setActiveStep(prev => ({ ...prev, [controlId]: step }));

  // Action handlers (each ends with pushEvent)
  const onUploadPopulation = (ctrl: DistinctControl, attr: ControlAttribute, file: File) => {
    setPopulationsByAttr(prev => ({ ...prev,
      [attr.id]: { rows: attr.populationSize, filename: file.name, uploadedAgo: 'just now' } }));
    addToast({ type: 'success', message: `Uploaded ${file.name} · ${attr.populationSize.toLocaleString()} rows parsed` });
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload',
      type: 'population_uploaded',
      text: `Population uploaded · ${file.name} · ${attr.populationSize.toLocaleString()} rows` });
  };
  const onReplacePopulation = (ctrl: DistinctControl, attr: ControlAttribute) => {
    setPopulationsByAttr(prev => { const n = { ...prev }; delete n[attr.id]; return n; });
    setSamplesByAttr(prev => { const n = { ...prev }; delete n[attr.id]; return n; });
    addToast({ type: 'info', message: `Population cleared for ${attr.id}` });
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'override',
      type: 'population_replaced', text: `Population cleared for ${attr.id} — awaiting new upload` });
  };
  const onGenerateSamples = (ctrl: DistinctControl, attr: ControlAttribute) => {
    const size = sampleSizeByAttr[attr.id] ?? attr.defaultSampleSize;
    const method = methodByAttr[attr.id] ?? 'Random';
    const samples: GeneratedSample[] = Array.from({ length: size }).map((_, i) => {
      const evidence: Record<string, EvidenceFile | null> = {};
      attr.requiredEvidence.forEach(et => { evidence[et] = null; });
      return { id: `S${String(i + 1).padStart(3, '0')}`, evidence, aiVerdict: null, aiConfidence: 0,
        aiRationale: '', useAi: true, humanVerdict: 'Pass', humanRemark: '' };
    });
    setSamplesByAttr(prev => ({ ...prev, [attr.id]: samples }));
    addToast({ type: 'success', message: `Generated ${size} ${method.toLowerCase()} samples for ${attr.id}` });
    pushEvent(ctrl.controlId, { actor: 'system', actorName: 'System', icon: 'gear',
      type: 'samples_generated', text: `Generated ${size} samples for ${attr.id} (method: ${method})` });
  };
  const onSetSampleSize = (attrId: string, n: number) =>
    setSampleSizeByAttr(prev => ({ ...prev, [attrId]: Math.max(1, Math.min(500, n)) }));
  const onSetMethod = (attrId: string, m: SampleMethod) => setMethodByAttr(prev => ({ ...prev, [attrId]: m }));
  const onAddFilter = (attrId: string, f: ColumnFilter) =>
    setFiltersByAttr(prev => ({ ...prev, [attrId]: [...(prev[attrId] ?? []), f] }));
  const onRemoveFilter = (attrId: string, filterId: string) =>
    setFiltersByAttr(prev => ({ ...prev, [attrId]: (prev[attrId] ?? []).filter(f => f.id !== filterId) }));
  const onUploadEvidence = (ctrl: DistinctControl, attrId: string, sampleId: string, et: string, file: File) => {
    setSamplesByAttr(prev => ({ ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId
        ? { ...s, evidence: { ...s.evidence, [et]: { filename: file.name,
          size: `${Math.max(1, Math.round(file.size / 1024))} KB` } } } : s) }));
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'upload',
      type: 'evidence_uploaded', text: `Evidence '${file.name}' uploaded for ${sampleId} · ${et}` });
  };
  const onRemoveEvidence = (attrId: string, sampleId: string, et: string) =>
    setSamplesByAttr(prev => ({ ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId
        ? { ...s, evidence: { ...s.evidence, [et]: null } } : s) }));
  const onRunAi = (ctrl: DistinctControl, attr: ControlAttribute) => {
    setAiRunningByAttr(prev => ({ ...prev, [attr.id]: true }));
    window.setTimeout(() => {
      setSamplesByAttr(prev => {
        const list = prev[attr.id] ?? [];
        return { ...prev, [attr.id]: list.map(s => {
          const ai = deterministicAiVerdict(`${attr.id}-${s.id}`);
          return { ...s, aiVerdict: ai.v, aiConfidence: ai.confidence, aiRationale: ai.rationale };
        }) };
      });
      setAiRunningByAttr(prev => ({ ...prev, [attr.id]: false }));
      const samps = samplesByAttr[attr.id] ?? [];
      let passes = 0, fails = 0;
      samps.forEach(s => {
        const v = deterministicAiVerdict(`${attr.id}-${s.id}`).v;
        if (v === 'Pass') passes += 1; else if (v === 'Fail') fails += 1;
      });
      addToast({ type: 'success', message: `Ira AI validated ${samps.length} samples for ${attr.id}` });
      pushEvent(ctrl.controlId, { actor: 'ai', actorName: 'Ira AI', icon: 'sparkles', type: 'ai_validated',
        text: `AI validated ${samps.length} samples for ${attr.id} · ${passes} pass / ${fails} fail` });
    }, 700);
  };
  const onToggleUseAi = (ctrl: DistinctControl, attrId: string, sampleId: string, useAi: boolean) => {
    setSamplesByAttr(prev => ({ ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId ? { ...s, useAi } : s) }));
    if (!useAi) {
      const sample = (samplesByAttr[attrId] ?? []).find(s => s.id === sampleId);
      if (sample && sample.aiVerdict) {
        pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'override',
          type: 'override_started', text: `Override started for ${sampleId} — switching from AI to human verdict` });
      }
    }
  };
  const onSetHumanVerdict = (ctrl: DistinctControl, attrId: string, sampleId: string, v: HumanVerdict) => {
    setSamplesByAttr(prev => ({ ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId ? { ...s, humanVerdict: v } : s) }));
    const sample = (samplesByAttr[attrId] ?? []).find(s => s.id === sampleId);
    if (sample && sample.aiVerdict && sample.aiVerdict !== v) {
      pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'override',
        type: 'verdict_overridden',
        text: `Verdict overridden for ${sampleId}: ${sample.aiVerdict} → ${v}${sample.humanRemark ? ` · '${sample.humanRemark}'` : ''}` });
    }
  };
  const onSetHumanRemark = (attrId: string, sampleId: string, remark: string) =>
    setSamplesByAttr(prev => ({ ...prev,
      [attrId]: (prev[attrId] ?? []).map(s => s.id === sampleId ? { ...s, humanRemark: remark } : s) }));
  const onDownloadWorkingPaper = (ctrl: DistinctControl) => {
    addToast({ type: 'success', message: `Generating ${ctrl.controlId}-Working-Paper.pdf …` });
    pushEvent(ctrl.controlId, { actor: 'human', actorName: CURRENT_USER.name, icon: 'download',
      type: 'working_paper_exported', text: 'Working paper exported as PDF' });
    setWorkingPaperModalCtrl(null);
  };

  if (allRows.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 flex flex-col items-center text-center">
        <div className="p-3 rounded-2xl bg-brand-50 mb-4"><FolderOpen size={28} className="text-brand-600" /></div>
        <h3 className="text-[15px] font-semibold text-text mb-1.5">No controls in scope — upload a RACM first</h3>
        <p className="text-[12.5px] text-text-muted max-w-md mb-5 leading-relaxed">
          Once the RACM is uploaded, every control appears here as a 3-step workspace for population, sampling, and AI-assisted validation.
        </p>
        <button onClick={() => addToast({ type: 'info', message: 'Heading back to RACM…' })}
          className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer">Go to RACM tab</button>
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
        <KpiTile label="Validated" value={kpis.samplesValidated} sub={`${kpis.passCount}P · ${kpis.failCount}F`}
          tone={kpis.failCount > 0 ? 'text-risk-700' : 'text-text'} />
        <KpiTile label="Evidence" value={kpis.evidenceUploaded} sub="files attached" />
        <KpiTile label="Pass rate" value={`${kpis.passRate}%`} sub={kpis.samplesValidated === 0 ? '—' : `of ${kpis.samplesValidated}`}
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
                className={`px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${statusFilter === s
                  ? 'bg-brand-50 text-brand-700 border border-brand-100'
                  : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Sub-process</span>
            {['All', ...subProcessNames].map(sp => (
              <button key={sp} onClick={() => setSubProcessFilter(sp)}
                className={`px-2.5 h-7 rounded-full text-[11.5px] font-medium transition-colors cursor-pointer ${subProcessFilter === sp
                  ? 'bg-ink-800 text-white border border-ink-800'
                  : 'border border-canvas-border bg-white text-ink-600 hover:bg-canvas'}`}>{sp}</button>
            ))}
          </div>
          <div className="relative w-[320px] max-w-full ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search control id, attribute, or evidence type…"
              className="w-full pl-7 pr-2.5 h-7 border border-canvas-border rounded-md text-[12px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 placeholder:text-ink-400" />
          </div>
        </div>
      </div>

      {/* Sub-process accordion */}
      <div className="space-y-3">
        {visibleGroups.length === 0 && (
          <div className="glass-card rounded-xl p-10 text-center">
            <p className="text-[13px] font-semibold text-text mb-1">No controls match these filters</p>
            <p className="text-[12px] text-text-muted">Try clearing a filter or broadening your search.</p>
          </div>
        )}
        {visibleGroups.map(group => {
          const isOpen = expandedSub.has(group.subProcess);
          const counts = subProcessCounts(group.controls, controlStatus);
          return (
            <div key={group.subProcess} className="glass-card rounded-xl overflow-hidden">
              <button onClick={() => toggleSub(group.subProcess)} aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-canvas/40 transition-colors cursor-pointer text-left">
                <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><Layers size={13} className="text-brand-600" /></div>
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-text">{group.subProcess}</span>
                  <span className="text-[11px] text-text-muted tabular-nums">
                    {group.controls.length} control{group.controls.length === 1 ? '' : 's'}
                    <span className="text-border mx-1.5">·</span>
                    <span className="text-compliant-700 font-semibold">{counts.complete} ready</span>
                    <span className="text-border mx-1.5">·</span>
                    <span className="text-evidence-700 font-semibold">{counts.inProgress} in progress</span>
                  </span>
                </div>
                <ChevronRight size={14} className={`text-text-muted transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    className="overflow-hidden border-t border-canvas-border">
                    <div className="p-3 space-y-2 bg-canvas/30">
                      {group.controls.map(ctrl => {
                        const isExpanded = expandedControl === ctrl.controlId;
                        const status = controlStatus(ctrl);
                        const stepCompletion: [boolean, boolean, boolean] = [
                          controlStepDone(ctrl, 1), controlStepDone(ctrl, 2), controlStepDone(ctrl, 3)];
                        const step = activeStep[ctrl.controlId] ?? 1;
                        return (
                          <div key={ctrl.controlId} className="rounded-xl border border-canvas-border bg-white overflow-hidden">
                            <button onClick={() => toggleControl(ctrl.controlId)} aria-expanded={isExpanded}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-canvas/40 transition-colors cursor-pointer text-left">
                              <ChevronRight size={14} className={`text-ink-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <Shield size={13} className="text-brand-600 shrink-0" />
                              <span className="font-mono text-[12px] font-semibold text-brand-700 shrink-0">{ctrl.controlId}</span>
                              {ctrl.isKey && (
                                <span className="px-1.5 h-5 inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-100 shrink-0">Key</span>
                              )}
                              <span className="text-[12.5px] text-text truncate flex-1 min-w-0">{ctrl.description}</span>
                              <span className="text-[11px] text-text-muted shrink-0 tabular-nums">{ctrl.attributes.length} attr</span>
                              <MiniStepIndicator stepCompletion={stepCompletion} />
                              <ControlStatusPill status={status} />
                            </button>
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                                  className="overflow-hidden border-t border-canvas-border">
                                  <div className="p-4 bg-canvas/40">
                                    <ControlStepperCard ctrl={ctrl} step={step} stepCompletion={stepCompletion}
                                      setStep={(s) => setStep(ctrl.controlId, s)}
                                      populations={populationsByAttr} samples={samplesByAttr}
                                      sampleSizes={sampleSizeByAttr} methods={methodByAttr}
                                      filters={filtersByAttr} aiRunning={aiRunningByAttr}
                                      trail={auditTrails[ctrl.controlId] ?? []}
                                      onUploadPopulation={(attr, f) => onUploadPopulation(ctrl, attr, f)}
                                      onReplacePopulation={(attr) => onReplacePopulation(ctrl, attr)}
                                      onSetSampleSize={onSetSampleSize} onSetMethod={onSetMethod}
                                      onAddFilter={onAddFilter} onRemoveFilter={onRemoveFilter}
                                      onGenerateSamples={(attr) => onGenerateSamples(ctrl, attr)}
                                      onUploadEvidence={(attrId, sid, et, f) => onUploadEvidence(ctrl, attrId, sid, et, f)}
                                      onRemoveEvidence={onRemoveEvidence}
                                      onRunAi={(attr) => onRunAi(ctrl, attr)}
                                      onToggleUseAi={(attrId, sid, useAi) => onToggleUseAi(ctrl, attrId, sid, useAi)}
                                      onSetHumanVerdict={(attrId, sid, v) => onSetHumanVerdict(ctrl, attrId, sid, v)}
                                      onSetHumanRemark={onSetHumanRemark}
                                      onOpenWorkingPaper={() => setWorkingPaperModalCtrl(ctrl)} />
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

      <AnimatePresence>
        {workingPaperModalCtrl && (
          <WorkingPaperModal ctrl={workingPaperModalCtrl} engagement={engagement}
            samplesByAttr={samplesByAttr}
            onClose={() => setWorkingPaperModalCtrl(null)}
            onDownload={() => onDownloadWorkingPaper(workingPaperModalCtrl)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers, small components ───────────────────────────────────────────────

function subProcessCounts(controls: DistinctControl[], statusFn: (c: DistinctControl) => ControlStatus) {
  let complete = 0, inProgress = 0;
  controls.forEach(c => {
    const s = statusFn(c);
    if (s === 'Working paper ready') complete += 1;
    else if (s !== 'Not started') inProgress += 1;
  });
  return { complete, inProgress };
}

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

function MiniStepIndicator({ stepCompletion }: { stepCompletion: [boolean, boolean, boolean] }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-0 shrink-0" aria-label="step progress">
      {[0, 1, 2].map(i => (
        <span key={i} className="inline-flex items-center">
          <span className={`w-2.5 h-2.5 rounded-full border ${stepCompletion[i] ? 'bg-compliant border-compliant' : 'bg-white border-border'}`} />
          {i < 2 && <span className={`w-3 h-px ${stepCompletion[i] && stepCompletion[i + 1] ? 'bg-compliant' : 'bg-border'}`} />}
        </span>
      ))}
    </span>
  );
}

function ControlStatusPill({ status }: { status: ControlStatus }): JSX.Element {
  const cls = status === 'Working paper ready' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : status === 'Validated' ? 'bg-evidence-50 text-evidence-700 border-evidence-100'
      : status === 'In progress' ? 'bg-mitigated-50 text-mitigated-700 border-mitigated-50'
        : 'bg-draft-50 text-draft-700 border-canvas-border';
  return <span className={`inline-flex items-center px-2 h-6 rounded-full text-[10.5px] font-semibold border shrink-0 ${cls}`}>{status}</span>;
}

function StepStatusPill({ label }: { label: string }): JSX.Element {
  const cls = label === 'Complete' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : label === 'In progress' ? 'bg-evidence-50 text-evidence-700 border-evidence-100'
      : 'bg-draft-50 text-draft-700 border-canvas-border';
  return <span className={`inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-semibold border ${cls}`}>{label}</span>;
}

// ─── ControlStepperCard (the centerpiece) ────────────────────────────────────

interface StepperCardProps {
  ctrl: DistinctControl;
  step: StepNum;
  stepCompletion: [boolean, boolean, boolean];
  setStep: (s: StepNum) => void;
  populations: Record<string, PopulationState>;
  samples: Record<string, GeneratedSample[]>;
  sampleSizes: Record<string, number>;
  methods: Record<string, SampleMethod>;
  filters: Record<string, ColumnFilter[]>;
  aiRunning: Record<string, boolean>;
  trail: AuditEvent[];
  onUploadPopulation: (attr: ControlAttribute, file: File) => void;
  onReplacePopulation: (attr: ControlAttribute) => void;
  onSetSampleSize: (attrId: string, n: number) => void;
  onSetMethod: (attrId: string, m: SampleMethod) => void;
  onAddFilter: (attrId: string, filter: ColumnFilter) => void;
  onRemoveFilter: (attrId: string, filterId: string) => void;
  onGenerateSamples: (attr: ControlAttribute) => void;
  onUploadEvidence: (attrId: string, sampleId: string, et: string, file: File) => void;
  onRemoveEvidence: (attrId: string, sampleId: string, et: string) => void;
  onRunAi: (attr: ControlAttribute) => void;
  onToggleUseAi: (attrId: string, sampleId: string, useAi: boolean) => void;
  onSetHumanVerdict: (attrId: string, sampleId: string, v: HumanVerdict) => void;
  onSetHumanRemark: (attrId: string, sampleId: string, remark: string) => void;
  onOpenWorkingPaper: () => void;
}

function ControlStepperCard(p: StepperCardProps): JSX.Element {
  const { step, stepCompletion, setStep } = p;
  const canJump = (target: StepNum) => target === step || target === 1 || stepCompletion[target - 2];
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex gap-5">
        {/* Vertical stepper */}
        <div className="relative w-[52px] shrink-0 flex flex-col items-center pt-1">
          {[1, 2, 3].map((n) => {
            const idx = n - 1;
            const done = stepCompletion[idx];
            const isActive = step === n;
            const jumpOk = canJump(n as StepNum);
            const circleCls = done ? 'bg-compliant text-white border-compliant'
              : isActive ? 'bg-brand-600 text-white border-brand-600 ring-2 ring-brand-200'
                : 'bg-surface-2 text-text-muted border-border';
            return (
              <div key={n} className="flex flex-col items-center">
                <button type="button" onClick={() => jumpOk && setStep(n as StepNum)} disabled={!jumpOk}
                  className={`w-7 h-7 rounded-full border-2 inline-flex items-center justify-center text-[11px] font-bold transition-colors ${circleCls} ${jumpOk ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  aria-label={`Go to step ${n}`} aria-current={isActive ? 'step' : undefined}>
                  {done ? <CheckCircle2 size={14} /> : n}
                </button>
                {n < 3 && <span className={`w-0.5 my-1 h-12 ${stepCompletion[idx] ? 'bg-compliant' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
        {/* Step content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
              {step === 1 && <Step1Population {...p} />}
              {step === 2 && <Step2Evidence {...p} />}
              {step === 3 && <Step3ValidateFinalize {...p} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Upload Population ───────────────────────────────────────────────

const POPULATION_COLUMNS = ['Amount', 'Vendor PAN', 'Date'];

function Step1Population(p: StepperCardProps): JSX.Element {
  const { ctrl, stepCompletion, setStep } = p;
  const anyPop = ctrl.attributes.some(a => !!p.populations[a.id]);
  const stepStatus = stepCompletion[0] ? 'Complete' : anyPop ? 'In progress' : 'Not started';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[13.5px] font-bold text-text">Upload Population</h3>
        <StepStatusPill label={stepStatus} />
        <button onClick={() => setStep(2)}
          className="ml-auto text-[11.5px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer">Skip to Step 2 →</button>
      </div>
      <div className="space-y-2.5">
        {ctrl.attributes.map(attr => (
          <Step1AttributeCard key={attr.id} attr={attr}
            population={p.populations[attr.id] ?? null}
            sampleSize={p.sampleSizes[attr.id] ?? attr.defaultSampleSize}
            method={p.methods[attr.id] ?? 'Random'}
            filters={p.filters[attr.id] ?? []}
            onUploadPopulation={(f) => p.onUploadPopulation(attr, f)}
            onReplacePopulation={() => p.onReplacePopulation(attr)}
            onSetSampleSize={(n) => p.onSetSampleSize(attr.id, n)}
            onSetMethod={(m) => p.onSetMethod(attr.id, m)}
            onAddFilter={(f) => p.onAddFilter(attr.id, f)}
            onRemoveFilter={(fid) => p.onRemoveFilter(attr.id, fid)} />
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={() => setStep(2)} disabled={!anyPop}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] font-semibold transition-colors ${anyPop
            ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
            : 'bg-canvas text-ink-400 cursor-not-allowed border border-canvas-border'}`}>
          Continue to Step 2 <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

interface Step1AttrProps {
  attr: ControlAttribute; population: PopulationState | null;
  sampleSize: number; method: SampleMethod; filters: ColumnFilter[];
  onUploadPopulation: (file: File) => void;
  onReplacePopulation: () => void;
  onSetSampleSize: (n: number) => void;
  onSetMethod: (m: SampleMethod) => void;
  onAddFilter: (f: ColumnFilter) => void;
  onRemoveFilter: (id: string) => void;
}

function Step1AttributeCard(p: Step1AttrProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filterPopover, setFilterPopover] = useState(false);
  const [pCol, setPCol] = useState<string>(POPULATION_COLUMNS[0]!);
  const [pOp, setPOp] = useState<Operator>('=');
  const [pVal, setPVal] = useState('');
  const onAdd = () => {
    if (!pVal.trim()) return;
    p.onAddFilter({ id: `f-${Date.now()}`, column: pCol, operator: pOp, value: pVal.trim() });
    setPVal(''); setFilterPopover(false);
  };
  return (
    <div className="rounded-lg border border-canvas-border bg-white p-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5 tabular-nums shrink-0">{p.attr.id}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-text leading-snug">{p.attr.description}</p>
          <p className="text-[11px] italic text-text-muted mt-0.5 leading-snug">{p.attr.testProcedure}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Required evidence</span>
        {p.attr.requiredEvidence.map(et => (
          <span key={et} className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-evidence-50 text-evidence-700 border border-evidence-100 text-[10.5px] font-medium">
            <span aria-hidden="true">{evidenceIconFor(et)}</span>{et}
          </span>
        ))}
      </div>
      {/* Sampling configuration */}
      <div className="rounded-md border border-canvas-border bg-canvas/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500 mr-0.5">Method</span>
            {(['Random', 'Statistical', 'Business-rule'] as SampleMethod[]).map(m => (
              <button key={m} onClick={() => p.onSetMethod(m)}
                className={`px-2 h-6 rounded text-[11px] font-medium border transition-colors cursor-pointer ${p.method === m
                  ? 'bg-brand-50 text-brand-700 border-brand-100'
                  : 'bg-white text-ink-600 border-canvas-border hover:bg-canvas'}`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-500">Size</span>
            <input type="number" min={1} max={500} value={p.sampleSize}
              onChange={(e) => p.onSetSampleSize(parseInt(e.target.value || '0', 10))}
              className="w-16 px-2 h-6 border border-canvas-border rounded text-[11.5px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 tabular-nums" />
          </div>
          <div className="relative ml-auto">
            <button onClick={() => setFilterPopover(v => !v)}
              className="inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium border border-canvas-border bg-white text-ink-600 hover:bg-canvas cursor-pointer">
              <Filter size={10} />+ Add filter
            </button>
            <AnimatePresence>
              {filterPopover && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-7 z-30 w-[280px] rounded-lg border border-canvas-border bg-white shadow-md p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <select value={pCol} onChange={e => setPCol(e.target.value)}
                      className="flex-1 px-1.5 h-7 border border-canvas-border rounded text-[11.5px] text-ink-800 bg-white outline-none focus:border-brand-400">
                      {POPULATION_COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={pOp} onChange={e => setPOp(e.target.value as Operator)}
                      className="w-[64px] px-1.5 h-7 border border-canvas-border rounded text-[11.5px] text-ink-800 bg-white outline-none focus:border-brand-400">
                      {(['=', '>', '<', 'contains'] as Operator[]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <input value={pVal} onChange={e => setPVal(e.target.value)} placeholder="Value"
                    onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
                    className="w-full px-2 h-7 border border-canvas-border rounded text-[11.5px] text-ink-800 bg-white outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15 mb-2" />
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setFilterPopover(false)} className="px-2 h-6 rounded text-[11px] font-medium border border-canvas-border bg-white text-ink-600 hover:bg-canvas cursor-pointer">Cancel</button>
                    <button onClick={onAdd} className="px-2 h-6 rounded text-[11px] font-semibold bg-brand-600 text-white hover:bg-brand-500 cursor-pointer">Add</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {p.filters.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.filters.map(f => (
              <span key={f.id} className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-canvas border border-canvas-border text-[10.5px] text-ink-700">
                <span className="font-medium">{f.column}</span><span className="text-ink-400">{f.operator}</span><span className="font-mono">{f.value}</span>
                <button onClick={() => p.onRemoveFilter(f.id)} className="text-ink-400 hover:text-risk-700 cursor-pointer"><X size={9} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Population status block */}
      {p.population ? (
        <div className="rounded-md border border-canvas-border bg-canvas/40 px-3 py-2 flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-compliant-50 text-compliant-700 inline-flex items-center justify-center shrink-0"><CheckCircle2 size={13} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-text tabular-nums">
              Population: {p.population.rows.toLocaleString()} rows uploaded · <span className="font-medium">{p.population.filename}</span> · {p.population.uploadedAgo}
            </p>
          </div>
          <button onClick={p.onReplacePopulation}
            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer shrink-0">Replace</button>
        </div>
      ) : (
        <label onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0]; if (f) p.onUploadPopulation(f); }}
          className={`block cursor-pointer rounded-md border border-dashed px-4 py-4 text-center transition-colors ${dragOver
            ? 'border-brand-400 bg-brand-50/50'
            : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-brand-50/30'}`}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onUploadPopulation(f);
              if (inputRef.current) inputRef.current.value = ''; }} />
          <Upload size={14} className="mx-auto text-ink-400 mb-1" />
          <p className="text-[11.5px] font-medium text-text leading-tight">Upload XLSX for ~{p.attr.populationSize.toLocaleString()} rows</p>
          <p className="text-[10.5px] text-text-muted mt-0.5">Excel only · drag &amp; drop or click to browse</p>
        </label>
      )}
    </div>
  );
}

// ─── Step 2: Process Samples & Upload Evidence ───────────────────────────────

function Step2Evidence(p: StepperCardProps): JSX.Element {
  const { ctrl, setStep, stepCompletion } = p;
  const withPop = ctrl.attributes.filter(a => !!p.populations[a.id]);
  const totalSamples = withPop.reduce((acc, a) => acc + (p.samples[a.id]?.length ?? 0), 0);
  const samplesWithFullEvidence = withPop.reduce((acc, a) => {
    const samps = p.samples[a.id] ?? [];
    return acc + samps.filter(s => a.requiredEvidence.every(et => !!s.evidence[et])).length;
  }, 0);
  const stepStatus = stepCompletion[1] ? 'Complete' : totalSamples > 0 ? 'In progress' : 'Not started';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[13.5px] font-bold text-text">Process samples &amp; upload evidence</h3>
        <StepStatusPill label={stepStatus} />
        <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-evidence-50 text-evidence-700 border border-evidence-100 text-[10.5px] font-semibold tabular-nums">
          {samplesWithFullEvidence} of {totalSamples} samples have evidence
        </span>
      </div>
      {withPop.length === 0 ? (
        <div className="rounded-md border border-dashed border-canvas-border bg-white px-3 py-6 text-center">
          <p className="text-[12px] font-medium text-text">No populations uploaded yet</p>
          <p className="text-[11px] text-text-muted mt-0.5">Go back to Step 1 to upload populations before generating samples.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {withPop.map(attr => (
            <Step2AttributeBlock key={attr.id} attr={attr}
              samples={p.samples[attr.id] ?? []}
              sampleSize={p.sampleSizes[attr.id] ?? attr.defaultSampleSize}
              method={p.methods[attr.id] ?? 'Random'}
              onGenerate={() => p.onGenerateSamples(attr)}
              onUploadEvidence={(sid, et, f) => p.onUploadEvidence(attr.id, sid, et, f)}
              onRemoveEvidence={(sid, et) => p.onRemoveEvidence(attr.id, sid, et)} />
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2">
        <button onClick={() => setStep(3)} disabled={!stepCompletion[1]}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] font-semibold transition-colors ${stepCompletion[1]
            ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
            : 'bg-canvas text-ink-400 cursor-not-allowed border border-canvas-border'}`}>
          Continue to Step 3 <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

interface Step2AttrProps {
  attr: ControlAttribute; samples: GeneratedSample[]; sampleSize: number; method: SampleMethod;
  onGenerate: () => void;
  onUploadEvidence: (sampleId: string, et: string, f: File) => void;
  onRemoveEvidence: (sampleId: string, et: string) => void;
}

function Step2AttributeBlock(p: Step2AttrProps): JSX.Element {
  const evidenceTypes = p.attr.requiredEvidence;
  const totalEvSlots = p.samples.length * evidenceTypes.length;
  const filledSlots = p.samples.reduce((acc, s) => acc + evidenceTypes.filter(et => !!s.evidence[et]).length, 0);
  return (
    <div className="rounded-lg border border-canvas-border bg-white p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5 shrink-0">{p.attr.id}</span>
        <span className="text-[12px] font-medium text-text truncate flex-1 min-w-0">{p.attr.description}</span>
        {totalEvSlots > 0 && (
          <span className="text-[10.5px] tabular-nums text-text-muted shrink-0">{filledSlots}/{totalEvSlots} evidence</span>
        )}
        <button onClick={p.onGenerate} disabled={p.samples.length > 0}
          className={`inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-semibold border transition-colors shrink-0 ${p.samples.length > 0
            ? 'bg-canvas text-ink-400 border-canvas-border cursor-not-allowed'
            : 'bg-brand-600 text-white border-brand-600 hover:bg-brand-500 cursor-pointer'}`}>
          <Sparkles size={10} />{p.samples.length > 0 ? `${p.samples.length} samples` : `Generate ${p.sampleSize} samples`}
        </button>
      </div>
      {p.samples.length === 0 ? (
        <div className="rounded-md border border-dashed border-canvas-border bg-canvas/40 px-3 py-4 text-center">
          <p className="text-[11.5px] text-text-muted">Population uploaded but samples not yet generated — click Generate</p>
        </div>
      ) : (
        <div className="rounded-md border border-canvas-border overflow-hidden bg-white">
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-[11.5px] border-collapse">
              <thead className="sticky top-0 bg-canvas/90 backdrop-blur-sm z-10">
                <tr className="text-[10px] uppercase tracking-wider font-bold text-text-muted">
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[72px]">Sample</th>
                  {evidenceTypes.map(et => (
                    <th key={et} className="text-left px-2 py-1.5 border-b border-canvas-border min-w-[140px]">
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden="true" className="opacity-70">{evidenceIconFor(et)}</span>
                        <span className="truncate" title={et}>{et}</span>
                      </span>
                    </th>
                  ))}
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[110px]">Status</th>
                  <th className="text-center px-2 py-1.5 border-b border-canvas-border w-[40px]">Val</th>
                </tr>
              </thead>
              <tbody>
                {p.samples.map((s, i) => {
                  const filled = evidenceTypes.filter(et => !!s.evidence[et]).length;
                  const pct = evidenceTypes.length > 0 ? filled / evidenceTypes.length : 0;
                  const evStatus: { label: string; cls: string } = pct === 1
                    ? { label: 'Evidence uploaded', cls: 'bg-evidence-50 text-evidence-700 border-evidence-100' }
                    : pct > 0 ? { label: 'Partial', cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated-50' }
                      : { label: 'Evidence pending', cls: 'bg-risk-50 text-risk-700 border-risk-50' };
                  return (
                    <tr key={s.id} className={`hover:bg-brand-50/30 transition-colors ${i % 2 === 1 ? 'bg-canvas/40' : 'bg-white'}`}>
                      <td className="px-2 py-1.5 border-b border-canvas-border align-middle">
                        <span className="font-mono text-[11px] font-semibold text-ink-700 tabular-nums">{s.id}</span>
                      </td>
                      {evidenceTypes.map(et => (
                        <td key={et} className="px-2 py-1.5 border-b border-canvas-border align-middle">
                          <EvidenceSlot slotId={`${p.attr.id}-${s.id}-${et}`} file={s.evidence[et] ?? null}
                            onUpload={(f) => p.onUploadEvidence(s.id, et, f)}
                            onRemove={() => p.onRemoveEvidence(s.id, et)} />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 border-b border-canvas-border align-middle">
                        <span className={`inline-flex items-center px-1.5 h-5 rounded text-[10px] font-semibold border ${evStatus.cls}`}>{evStatus.label}</span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-canvas-border align-middle text-center">
                        <Clock size={11} className="inline text-ink-300" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceSlot({ slotId, file, onUpload, onRemove }:
  { slotId: string; file: EvidenceFile | null; onUpload: (file: File) => void; onRemove: () => void }): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `evslot-${slotId.replace(/[^a-z0-9]/gi, '-')}`;
  if (file) {
    return (
      <div className="inline-flex items-center gap-1 max-w-full px-1.5 h-6 rounded border border-evidence-100 bg-evidence-50/50 text-[10.5px] text-evidence-700"
        title={`${file.filename} · ${file.size}`}>
        <span aria-hidden="true">📎</span>
        <span className="truncate max-w-[130px] font-medium">{file.filename}</span>
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
        className="inline-flex items-center gap-1 px-1.5 h-6 rounded border border-dashed border-canvas-border text-[10.5px] text-ink-500 bg-white hover:bg-brand-50/40 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors">
        <Plus size={10} />Upload
      </label>
      <input id={inputId} ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f);
          if (inputRef.current) inputRef.current.value = ''; }} />
    </>
  );
}

// ─── Step 3: Validate & Finalize ─────────────────────────────────────────────

function Step3ValidateFinalize(p: StepperCardProps): JSX.Element {
  const { ctrl } = p;
  const withSamples = ctrl.attributes.filter(a => (p.samples[a.id] ?? []).length > 0);

  // Aggregate verdicts across attributes
  let totalSamples = 0, passes = 0, fails = 0, holds = 0;
  const exceptions: { attrId: string; sampleId: string; rationale: string; overridden: boolean; remark: string }[] = [];
  withSamples.forEach(a => {
    (p.samples[a.id] ?? []).forEach(s => {
      const effective = s.useAi ? s.aiVerdict : s.humanVerdict;
      if (!effective) return;
      totalSamples += 1;
      if (effective === 'Pass') passes += 1;
      else if (effective === 'Fail') {
        fails += 1;
        exceptions.push({ attrId: a.id, sampleId: s.id,
          rationale: s.useAi ? s.aiRationale : (s.humanRemark || 'Manual fail override'),
          overridden: !s.useAi, remark: s.humanRemark });
      } else holds += 1;
    });
  });

  const conclusion: 'Effective' | 'Deficient' | 'Inconclusive' = totalSamples === 0 ? 'Inconclusive'
    : fails > 0 ? 'Deficient' : (passes / totalSamples) >= 0.95 ? 'Effective' : 'Inconclusive';
  const concCls = conclusion === 'Effective' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : conclusion === 'Deficient' ? 'bg-risk-50 text-risk-700 border-risk-50'
      : 'bg-mitigated-50 text-mitigated-700 border-mitigated-50';
  const stepStatus = p.stepCompletion[2] ? 'Complete' : (withSamples.length > 0 ? 'In progress' : 'Not started');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[13.5px] font-bold text-text">Validate &amp; finalize</h3>
        <StepStatusPill label={stepStatus} />
      </div>
      {/* a) AI Validation per attribute */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-brand-600" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">AI validation</span>
        </div>
        {withSamples.length === 0 ? (
          <div className="rounded-md border border-dashed border-canvas-border bg-white px-3 py-4 text-center">
            <p className="text-[11.5px] text-text-muted">Generate samples and upload evidence in Step 2 before validating.</p>
          </div>
        ) : (
          withSamples.map(attr => (
            <Step3AttributeBlock key={attr.id} attr={attr} samples={p.samples[attr.id] ?? []}
              isRunning={!!p.aiRunning[attr.id]}
              onRun={() => p.onRunAi(attr)}
              onToggleUseAi={(sid, useAi) => p.onToggleUseAi(attr.id, sid, useAi)}
              onSetHumanVerdict={(sid, v) => p.onSetHumanVerdict(attr.id, sid, v)}
              onSetHumanRemark={(sid, r) => p.onSetHumanRemark(attr.id, sid, r)} />
          ))
        )}
      </section>
      {/* b) Working paper summary */}
      {totalSamples > 0 && (
        <section className="rounded-lg border border-canvas-border bg-white p-3 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <BookText size={12} className="text-text-muted" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Working paper summary</span>
            <span className={`inline-flex items-center px-2 h-6 rounded-full text-[10.5px] font-semibold border ${concCls}`}>Conclusion: {conclusion}</span>
            <button onClick={p.onOpenWorkingPaper}
              className="ml-auto inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-semibold bg-brand-600 text-white hover:bg-brand-500 cursor-pointer">
              <Download size={10} />Download working paper
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SumStat label="Attributes" value={String(withSamples.length)} />
            <SumStat label="Samples" value={String(totalSamples)} />
            <SumStat label="Pass / Fail / Hold" value={`${passes} / ${fails} / ${holds}`} />
            <SumStat label="Pass rate" value={`${Math.round((passes / Math.max(1, totalSamples)) * 100)}%`} />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted mb-1.5">Scope</div>
            <div className="flex flex-wrap gap-1.5">
              {withSamples.map(a => (
                <span key={a.id} className="px-1.5 h-5 rounded border border-canvas-border bg-canvas/40 text-[10.5px] text-ink-700 inline-flex items-center font-mono">{a.id}</span>
              ))}
            </div>
          </div>
          {exceptions.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-bold text-text-muted mb-1.5 flex items-center gap-1">
                <AlertTriangle size={10} className="text-risk-700" />Exceptions ({exceptions.length})
              </div>
              <ul className="space-y-1">
                {exceptions.slice(0, 5).map(e => (
                  <li key={`${e.attrId}-${e.sampleId}`} className="text-[11px] text-text leading-snug">
                    <span className="font-mono text-ink-700">{e.attrId}/{e.sampleId}</span>
                    <span className="text-text-muted mx-1.5">·</span><span>{e.rationale}</span>
                    {e.overridden && (
                      <span className="ml-1.5 inline-flex items-center px-1 h-4 rounded text-[9.5px] font-bold bg-mitigated-50 text-mitigated-700 border border-mitigated-50">Override</span>
                    )}
                  </li>
                ))}
                {exceptions.length > 5 && (
                  <li className="text-[11px] text-text-muted italic">+ {exceptions.length - 5} more in working paper</li>
                )}
              </ul>
            </div>
          )}
        </section>
      )}
      {/* c) Audit Trail */}
      <section className="rounded-lg border border-canvas-border bg-white p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity size={12} className="text-text-muted" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Activity log</span>
          <span className="text-[10.5px] text-text-muted italic">Also captured in the engagement Action Trail tab</span>
        </div>
        {p.trail.length === 0 ? (
          <p className="text-[11.5px] text-text-muted italic">No activity yet. Actions on this control will appear here.</p>
        ) : (
          <ul className="space-y-1.5 max-h-[280px] overflow-auto pr-1">
            <AnimatePresence initial={false}>
              {p.trail.map(e => (
                <motion.li key={e.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }} className="flex items-start gap-2 text-[11.5px]">
                  <span className="mt-0.5 shrink-0"><TrailIcon icon={e.icon} actor={e.actor} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-text leading-snug">{e.text}</p>
                    <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
                      <ActorBadge actor={e.actor} name={e.actorName} />
                      <span className="text-border">·</span>
                      <span className="tabular-nums">{e.relTime}</span>
                    </p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

function SumStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas/40 px-2.5 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider font-bold text-text-muted truncate">{label}</div>
      <div className="text-[13px] font-bold text-text tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function TrailIcon({ icon, actor }: { icon: AuditEvent['icon']; actor: AuditEvent['actor'] }): JSX.Element {
  const Icon = icon === 'upload' ? Upload : icon === 'sparkles' ? Sparkles : icon === 'check' ? CheckCircle2
    : icon === 'override' ? RefreshCw : icon === 'download' ? FileText : ListChecks;
  const tone = actor === 'ai' ? 'bg-brand-50 text-brand-700 border-brand-100'
    : actor === 'system' ? 'bg-canvas text-ink-500 border-canvas-border'
      : 'bg-evidence-50 text-evidence-700 border-evidence-100';
  return <span className={`w-5 h-5 inline-flex items-center justify-center rounded border ${tone}`}><Icon size={10} /></span>;
}

function ActorBadge({ actor, name }: { actor: AuditEvent['actor']; name: string }): JSX.Element {
  if (actor === 'ai') return (
    <span className="inline-flex items-center gap-0.5 px-1 h-4 rounded text-[9.5px] font-semibold bg-brand-50 text-brand-700 border border-brand-100">
      <Sparkles size={8} />{name}
    </span>
  );
  if (actor === 'system') return <span className="text-text-muted">{name}</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-text-muted">
      <User size={9} className="text-ink-400" />{name}
    </span>
  );
}

interface Step3AttrProps {
  attr: ControlAttribute; samples: GeneratedSample[]; isRunning: boolean;
  onRun: () => void;
  onToggleUseAi: (sampleId: string, useAi: boolean) => void;
  onSetHumanVerdict: (sampleId: string, v: HumanVerdict) => void;
  onSetHumanRemark: (sampleId: string, remark: string) => void;
}

function Step3AttributeBlock(p: Step3AttrProps): JSX.Element {
  const allValidated = p.samples.every(s => s.aiVerdict !== null);
  const evidenceTypes = p.attr.requiredEvidence;
  return (
    <div className="rounded-lg border border-canvas-border bg-white p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded px-1.5 py-0.5 shrink-0">{p.attr.id}</span>
        <span className="text-[12px] font-medium text-text truncate flex-1 min-w-0">{p.attr.description}</span>
        <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded bg-brand-50 text-brand-700 border border-brand-100 text-[10px] font-bold shrink-0">
          <Sparkles size={9} />Ira AI
        </span>
        <button onClick={p.onRun} disabled={p.isRunning}
          className={`inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] font-semibold border transition-colors shrink-0 ${p.isRunning
            ? 'bg-canvas text-ink-400 border-canvas-border cursor-wait'
            : allValidated ? 'bg-white text-brand-700 border-brand-100 hover:bg-brand-50 cursor-pointer'
              : 'bg-brand-600 text-white border-brand-600 hover:bg-brand-500 cursor-pointer'}`}>
          {p.isRunning ? (
            <>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                <RefreshCw size={10} />
              </motion.span>Running…
            </>
          ) : (
            <>
              <Sparkles size={10} />{allValidated ? 'Re-run AI' : `Validate ${p.samples.length} samples with AI`}
            </>
          )}
        </button>
      </div>
      {!allValidated && !p.isRunning ? (
        <div className="rounded-md border border-dashed border-canvas-border bg-canvas/40 px-3 py-3 text-center">
          <p className="text-[11.5px] text-text-muted">Click &ldquo;Validate with AI&rdquo; to score each sample with a Pass/Fail verdict and confidence.</p>
        </div>
      ) : (
        <div className="rounded-md border border-canvas-border overflow-hidden bg-white">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-[11.5px] border-collapse">
              <thead className="sticky top-0 bg-canvas/90 backdrop-blur-sm z-10">
                <tr className="text-[10px] uppercase tracking-wider font-bold text-text-muted">
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[64px]">Sample</th>
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[64px]">Evidence</th>
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border min-w-[260px]">AI verdict</th>
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[220px]">Human override</th>
                  <th className="text-left px-2 py-1.5 border-b border-canvas-border w-[110px]">Final</th>
                </tr>
              </thead>
              <tbody>
                {p.samples.map((s, i) => {
                  const filled = evidenceTypes.filter(et => !!s.evidence[et]).length;
                  const effective = (s.useAi ? s.aiVerdict : s.humanVerdict) ?? null;
                  return (
                    <tr key={s.id} className={`align-top ${i % 2 === 1 ? 'bg-canvas/40' : 'bg-white'}`}>
                      <td className="px-2 py-1.5 border-b border-canvas-border">
                        <span className="font-mono text-[11px] font-semibold text-ink-700 tabular-nums">{s.id}</span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-canvas-border">
                        <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded bg-evidence-50 text-evidence-700 border border-evidence-100 text-[10px] font-semibold tabular-nums">
                          {filled}/{evidenceTypes.length}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-canvas-border">
                        {s.aiVerdict ? <AiVerdictCell verdict={s.aiVerdict} confidence={s.aiConfidence} rationale={s.aiRationale} />
                          : <span className="text-[10.5px] italic text-text-muted">Awaiting AI run</span>}
                      </td>
                      <td className="px-2 py-1.5 border-b border-canvas-border">
                        <HumanOverrideCell useAi={s.useAi} humanVerdict={s.humanVerdict} humanRemark={s.humanRemark}
                          onToggleUseAi={(v) => p.onToggleUseAi(s.id, v)}
                          onSetVerdict={(v) => p.onSetHumanVerdict(s.id, v)}
                          onSetRemark={(r) => p.onSetHumanRemark(s.id, r)} />
                      </td>
                      <td className="px-2 py-1.5 border-b border-canvas-border">
                        {effective ? <FinalVerdictPill verdict={effective} overridden={!s.useAi} />
                          : <span className="text-[10.5px] italic text-text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AiVerdictCell({ verdict, confidence, rationale }:
  { verdict: AiVerdict; confidence: number; rationale: string }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const cls = verdict === 'Pass' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : verdict === 'Fail' ? 'bg-risk-50 text-risk-700 border-risk-50'
      : 'bg-mitigated-50 text-mitigated-700 border-mitigated-50';
  const bar = verdict === 'Pass' ? 'bg-compliant' : verdict === 'Fail' ? 'bg-risk-500' : 'bg-mitigated-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-0.5 px-1.5 h-5 rounded text-[10px] font-semibold border ${cls}`}>
          {verdict === 'Pass' ? <CheckCircle2 size={9} /> : verdict === 'Fail' ? <XCircle size={9} /> : <Clock size={9} />}{verdict}
        </span>
        <span className="h-1 w-16 bg-surface-3 rounded-full overflow-hidden">
          <span className={`block h-full ${bar}`} style={{ width: `${confidence}%` }} />
        </span>
        <span className="text-[10.5px] tabular-nums font-semibold text-text">{confidence}%</span>
      </div>
      <button onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Collapse rationale' : 'Expand rationale'}
        className="text-[10.5px] text-text-muted text-left hover:text-text cursor-pointer flex items-start gap-1 leading-snug max-w-[260px]">
        {expanded ? <ChevronDown size={10} className="mt-0.5 shrink-0" /> : <Eye size={10} className="mt-0.5 shrink-0" />}
        <span className={expanded ? '' : 'truncate max-w-[230px]'}>{rationale}</span>
      </button>
    </div>
  );
}

function HumanOverrideCell({ useAi, humanVerdict, humanRemark, onToggleUseAi, onSetVerdict, onSetRemark }:
  { useAi: boolean; humanVerdict: HumanVerdict; humanRemark: string;
    onToggleUseAi: (v: boolean) => void; onSetVerdict: (v: HumanVerdict) => void; onSetRemark: (r: string) => void; }): JSX.Element {
  return (
    <div className="space-y-1">
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <span className="relative inline-flex w-6 h-3.5 items-center">
          <input type="checkbox" checked={useAi} onChange={e => onToggleUseAi(e.target.checked)} className="sr-only peer" />
          <span className="block w-6 h-3.5 rounded-full bg-canvas-border peer-checked:bg-brand-600 transition-colors" />
          <span className="absolute left-0.5 top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-2.5" />
        </span>
        <span className="text-[10.5px] font-semibold text-text-muted">Use AI</span>
      </label>
      {!useAi && (
        <div className="space-y-1">
          <div className="inline-flex items-center gap-0.5">
            {(['Pass', 'Fail', 'Hold'] as HumanVerdict[]).map(v => {
              const active = humanVerdict === v;
              const cls = v === 'Pass' ? (active ? 'bg-compliant-50 text-compliant-700 border-compliant-50' : 'bg-white text-ink-500 border-canvas-border hover:bg-canvas')
                : v === 'Fail' ? (active ? 'bg-risk-50 text-risk-700 border-risk-50' : 'bg-white text-ink-500 border-canvas-border hover:bg-canvas')
                  : (active ? 'bg-mitigated-50 text-mitigated-700 border-mitigated-50' : 'bg-white text-ink-500 border-canvas-border hover:bg-canvas');
              return (
                <button key={v} onClick={() => onSetVerdict(v)}
                  className={`px-1.5 h-5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${cls}`}>{v}</button>
              );
            })}
          </div>
          <input type="text" value={humanRemark} placeholder="Override remark…"
            onChange={e => onSetRemark(e.target.value)}
            className="w-full px-1.5 h-5 border border-canvas-border rounded text-[10.5px] text-ink-800 bg-white outline-none focus:border-brand-400" />
        </div>
      )}
    </div>
  );
}

function FinalVerdictPill({ verdict, overridden }: { verdict: HumanVerdict; overridden: boolean }): JSX.Element {
  const cls = verdict === 'Pass' ? 'bg-compliant-50 text-compliant-700 border-compliant-50'
    : verdict === 'Fail' ? 'bg-risk-50 text-risk-700 border-risk-50'
      : 'bg-mitigated-50 text-mitigated-700 border-mitigated-50';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-semibold border ${cls}`}>
      {verdict === 'Pass' ? <CheckCircle2 size={9} /> : verdict === 'Fail' ? <XCircle size={9} /> : <Clock size={9} />}{verdict}
      {overridden && <span className="ml-0.5 text-[9px] uppercase tracking-wider font-bold opacity-70">override</span>}
    </span>
  );
}

// ─── Working Paper Modal ─────────────────────────────────────────────────────

interface WorkingPaperModalProps {
  ctrl: DistinctControl; engagement: Engagement;
  samplesByAttr: Record<string, GeneratedSample[]>;
  onClose: () => void; onDownload: () => void;
}

function WorkingPaperModal(p: WorkingPaperModalProps): JSX.Element {
  const { ctrl, engagement, samplesByAttr } = p;
  let totalSamples = 0, passes = 0, fails = 0, holds = 0;
  const rows: { attrId: string; description: string; samples: number; pass: number; fail: number; hold: number }[] = [];
  const exceptions: { attrId: string; sampleId: string; rationale: string; overridden: boolean; remark: string }[] = [];
  ctrl.attributes.forEach(a => {
    const samps = samplesByAttr[a.id] ?? [];
    if (samps.length === 0) return;
    let aP = 0, aF = 0, aH = 0;
    samps.forEach(s => {
      const effective = s.useAi ? s.aiVerdict : s.humanVerdict;
      if (!effective) return;
      totalSamples += 1;
      if (effective === 'Pass') { passes += 1; aP += 1; }
      else if (effective === 'Fail') {
        fails += 1; aF += 1;
        exceptions.push({ attrId: a.id, sampleId: s.id,
          rationale: s.useAi ? s.aiRationale : (s.humanRemark || 'Manual fail override'),
          overridden: !s.useAi, remark: s.humanRemark });
      } else { holds += 1; aH += 1; }
    });
    rows.push({ attrId: a.id, description: a.description, samples: samps.length, pass: aP, fail: aF, hold: aH });
  });
  const conclusion: 'Effective' | 'Deficient' | 'Inconclusive' = totalSamples === 0 ? 'Inconclusive'
    : fails > 0 ? 'Deficient' : (passes / totalSamples) >= 0.95 ? 'Effective' : 'Inconclusive';
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={p.onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[680px] max-h-[80vh] z-50 bg-canvas-elevated rounded-2xl shadow-xl border border-canvas-border overflow-hidden flex flex-col">
        <header className="shrink-0 px-6 py-4 border-b border-canvas-border flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-text">Working paper · {ctrl.controlId}</h2>
            <p className="text-[11.5px] text-text-muted mt-0.5">Formatted preview · review before exporting to PDF.</p>
          </div>
          <button onClick={p.onClose} className="w-8 h-8 rounded-full text-ink-500 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
          <div className="text-[20px] font-bold text-text mb-1">{ctrl.controlId} · Working paper</div>
          <div className="text-[11px] text-text-muted mb-5">{engagement.code} · {engagement.framework} · {engagement.periodStart} – {engagement.periodEnd}</div>
          <h4 className="text-[12.5px] font-bold text-text mb-2 uppercase tracking-wide">1. Control</h4>
          <p className="text-[12.5px] text-text-secondary mb-4">{ctrl.description}</p>
          <h4 className="text-[12.5px] font-bold text-text mb-2 uppercase tracking-wide">2. Conclusion</h4>
          <p className="text-[12.5px] text-text-secondary mb-4">
            <span className="font-semibold text-text">{conclusion}.</span>{' '}
            {totalSamples > 0 ? `${passes} of ${totalSamples} samples passed · ${fails} failed · ${holds} on hold.` : 'No samples validated yet.'}
          </p>
          <h4 className="text-[12.5px] font-bold text-text mb-2 uppercase tracking-wide">3. Scope &amp; results</h4>
          {rows.length === 0 ? (
            <p className="text-[12px] text-text-muted italic mb-4">No attributes tested yet.</p>
          ) : (
            <table className="w-full text-[11.5px] border border-border-light mb-4">
              <thead className="bg-canvas/40">
                <tr>
                  <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[10.5px] uppercase tracking-wide text-text-muted">Attribute</th>
                  <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[10.5px] uppercase tracking-wide text-text-muted">Samples</th>
                  <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[10.5px] uppercase tracking-wide text-text-muted">Pass</th>
                  <th className="px-2 py-1.5 text-left border-r border-border-light/60 text-[10.5px] uppercase tracking-wide text-text-muted">Fail</th>
                  <th className="px-2 py-1.5 text-left text-[10.5px] uppercase tracking-wide text-text-muted">Hold</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.attrId} className="border-t border-border-light">
                    <td className="px-2 py-1.5 border-r border-border-light/60 font-mono text-text">{r.attrId}</td>
                    <td className="px-2 py-1.5 border-r border-border-light/60 tabular-nums">{r.samples}</td>
                    <td className="px-2 py-1.5 border-r border-border-light/60 tabular-nums text-compliant-700 font-semibold">{r.pass}</td>
                    <td className="px-2 py-1.5 border-r border-border-light/60 tabular-nums text-risk-700 font-semibold">{r.fail}</td>
                    <td className="px-2 py-1.5 tabular-nums text-mitigated-700 font-semibold">{r.hold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {exceptions.length > 0 && (
            <>
              <h4 className="text-[12.5px] font-bold text-text mb-2 uppercase tracking-wide">4. Exceptions</h4>
              <ul className="space-y-1.5 mb-4">
                {exceptions.map(e => (
                  <li key={`${e.attrId}-${e.sampleId}`} className="text-[12px] text-text-secondary leading-snug">
                    <span className="font-mono text-text">{e.attrId}/{e.sampleId}</span>
                    <span className="text-text-muted mx-1.5">·</span><span>{e.rationale}</span>
                    {e.overridden && (
                      <span className="ml-1.5 inline-flex items-center px-1 h-4 rounded text-[9.5px] font-bold bg-mitigated-50 text-mitigated-700 border border-mitigated-50">Human override</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4 className="text-[12.5px] font-bold text-text mb-2 uppercase tracking-wide">{exceptions.length > 0 ? '5' : '4'}. Sign-off</h4>
          <div className="text-[12px] text-text-secondary">
            <div><span className="font-semibold">Preparer:</span> {CURRENT_USER.name} (pending)</div>
            <div><span className="font-semibold">Reviewer:</span> pending</div>
          </div>
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border bg-canvas flex items-center justify-end gap-3">
          <button onClick={p.onClose} className="px-4 py-2 rounded-lg border border-canvas-border text-[12.5px] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
          <button onClick={p.onDownload}
            className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12.5px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
            <Download size={13} />Download PDF
          </button>
        </footer>
      </motion.div>
    </>
  );
}
