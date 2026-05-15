import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowUpRight, AlertTriangle, Calendar,
  CheckCircle2, Clock, FileText, FolderOpen, Layers, Play,
  Shield, ShieldCheck, Sparkles, User, Workflow, Zap, Upload,
  ChevronRight, Plus, Activity, MessageSquare, ListChecks,
  RefreshCw,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import {
  ENGAGEMENTS,
  PROCESS_COLORS,
  type AutomationSubtype,
  type Engagement,
  type EngType,
} from '../../data/engagements';
import {
  ENGAGEMENT_ACTIVITY,
  AVG_TIME_TO_CLOSE,
  dailyCounts,
  formatDay,
  formatChartDay,
  type ActivityEvent,
  type ActivityType,
} from '../../data/engagement-activity';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'racm' | 'controls' | 'workflows' | 'evidence' | 'exceptions' | 'trail';

interface Props {
  engagementId: string;
  onBack: () => void;
  onOpenExecution: (engagementId: string) => void;
}

// ─── Tabs per engagement type ─────────────────────────────────────────────────

function tabsForType(type: EngType): { id: TabId; label: string; icon: React.ElementType }[] {
  switch (type) {
    case 'Automation':
      return [
        { id: 'overview', label: 'Overview', icon: Layers },
        { id: 'workflows', label: 'Workflows', icon: Workflow },
        { id: 'exceptions', label: 'Exception Management', icon: AlertTriangle },
        { id: 'trail', label: 'Action Trail', icon: Activity },
      ];
    case 'Compliance':
    case 'Internal Audit':
      return [
        { id: 'overview', label: 'Overview', icon: Layers },
        { id: 'racm', label: 'RACM', icon: FileText },
        { id: 'controls', label: 'Controls', icon: Shield },
        { id: 'workflows', label: 'Workflows', icon: Workflow },
        { id: 'evidence', label: 'Evidence', icon: FolderOpen },
        { id: 'trail', label: 'Action Trail', icon: Activity },
      ];
  }
}

// ─── Mock content (per type — kept small + realistic) ─────────────────────────

const MOCK_CONTROLS: Record<string, { id: string; ref: string; name: string; status: 'Effective' | 'In Test' | 'Failed' | 'Pending'; key: boolean }[]> = {
  default: [
    { id: 'c1', ref: 'P2P-C-01', name: 'Vendor master add/change requires dual approval', status: 'Effective', key: true },
    { id: 'c2', ref: 'P2P-C-02', name: 'PO approval threshold enforced by amount tier', status: 'Effective', key: true },
    { id: 'c3', ref: 'P2P-C-03', name: 'Three-way match (PO · GRN · Invoice) before payment', status: 'In Test', key: true },
    { id: 'c4', ref: 'P2P-C-04', name: 'Duplicate invoice prevention check on AP posting', status: 'Failed', key: false },
    { id: 'c5', ref: 'P2P-C-05', name: 'Segregation of duties between PO creator and approver', status: 'Effective', key: true },
    { id: 'c6', ref: 'P2P-C-06', name: 'Payment release dual sign-off above ₹10L threshold', status: 'Pending', key: true },
  ],
};

type InputSource = 'Excel' | 'PDF' | 'SQL';
type Cadence = { kind: 'Frequency'; label: string } | { kind: 'Ad-hoc' };

const MOCK_WORKFLOWS: {
  id: string;
  code: string;
  name: string;
  type: string;
  inputs: InputSource[];
  cadence: Cadence;
  lastRun: string;
  status: 'Success' | 'Failed' | 'Running';
}[] = [
  { id: 'wf1', code: 'WF-P2P-001', name: 'Three-Way Match (PO · GRN · Invoice)', type: 'Reconciliation', inputs: ['Excel', 'PDF'], cadence: { kind: 'Frequency', label: 'Daily 6 AM' }, lastRun: '2h ago', status: 'Success' },
  { id: 'wf2', code: 'WF-P2P-002', name: 'Duplicate Invoice Detector', type: 'Detection', inputs: ['SQL'], cadence: { kind: 'Frequency', label: 'Hourly' }, lastRun: '8m ago', status: 'Success' },
  { id: 'wf3', code: 'WF-P2P-003', name: 'PO Approval Threshold Scan', type: 'Compliance', inputs: ['SQL'], cadence: { kind: 'Ad-hoc' }, lastRun: '12h ago', status: 'Running' },
  { id: 'wf4', code: 'WF-P2P-004', name: 'Vendor Master Change Monitor', type: 'Monitoring', inputs: ['Excel', 'SQL'], cadence: { kind: 'Frequency', label: 'Hourly' }, lastRun: '34m ago', status: 'Success' },
];

/** Visual style per input source. SQL gets a distinct evidence-blue treatment because it's the live/connected source. */
const INPUT_BADGE_CLS: Record<InputSource, string> = {
  Excel: 'bg-surface-2 text-text-secondary border-border-light',
  PDF:   'bg-surface-2 text-text-secondary border-border-light',
  SQL:   'bg-evidence-50 text-evidence-700 border-evidence-100',
};

const MOCK_EXCEPTIONS: { id: string; ref: string; title: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; assignee: string; opened: string; status: 'Open' | 'Triaging' | 'Resolved' }[] = [
  { id: 'ex1', ref: 'EX-1248', title: 'Duplicate invoice posted — vendor V-3344 (₹2.4L)', severity: 'High', assignee: 'Priya Singh', opened: '4h ago', status: 'Open' },
  { id: 'ex2', ref: 'EX-1247', title: 'PO threshold override used without justification', severity: 'Medium', assignee: 'Tushar Goel', opened: '8h ago', status: 'Triaging' },
  { id: 'ex3', ref: 'EX-1246', title: 'Payment release missing dual sign-off (₹14.5L)', severity: 'Critical', assignee: 'Neha Joshi', opened: '1d ago', status: 'Triaging' },
  { id: 'ex4', ref: 'EX-1242', title: 'Vendor onboarded without KYC completion', severity: 'High', assignee: 'Sneha Desai', opened: '2d ago', status: 'Resolved' },
];

const MOCK_EVIDENCE: { id: string; name: string; kind: 'PDF' | 'XLSX' | 'CSV' | 'IMG'; size: string; uploaded: string; uploader: string }[] = [
  { id: 'e1', name: 'Walkthrough notes — P2P FY26.pdf', kind: 'PDF', size: '1.4 MB', uploaded: '2d ago', uploader: 'Tushar Goel' },
  { id: 'e2', name: 'Control testing sample — Q4.xlsx', kind: 'XLSX', size: '320 KB', uploaded: '4d ago', uploader: 'Neha Joshi' },
  { id: 'e3', name: 'Vendor master extract.csv', kind: 'CSV', size: '12 MB', uploaded: '1w ago', uploader: 'Priya Singh' },
  { id: 'e4', name: 'PO approval screenshot.png', kind: 'IMG', size: '480 KB', uploaded: '1w ago', uploader: 'Tushar Goel' },
];

// ─── Visual maps ──────────────────────────────────────────────────────────────

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
const SUBTYPE_LABEL: Record<AutomationSubtype, string> = {
  CCM: 'CCM',
  Reconciliation: 'Reconciliation',
  MIS: 'MIS',
  Forensic: 'Forensic',
  'Image Analytics': 'Image Analytics',
  Custom: 'Custom',
};
const STATUS_CLS: Record<Engagement['status'], string> = {
  Active: 'bg-compliant-50 text-compliant-700',
  'In Progress': 'bg-evidence-50 text-evidence-700',
  Review: 'bg-mitigated-50 text-mitigated-700',
  Planned: 'bg-brand-50 text-brand-700',
  Draft: 'bg-draft-50 text-draft-700',
  Closed: 'bg-gray-100 text-gray-600',
};
const SEV_CLS: Record<string, string> = {
  Critical: 'bg-risk-50 text-risk-700',
  High: 'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low: 'bg-compliant-50 text-compliant-700',
};
const CONTROL_STATUS_CLS: Record<string, string> = {
  Effective: 'bg-compliant-50 text-compliant-700',
  'In Test': 'bg-evidence-50 text-evidence-700',
  Failed: 'bg-risk-50 text-risk-700',
  Pending: 'bg-draft-50 text-draft-700',
};

function healthTier(pct: number): { bar: string; text: string } {
  if (pct >= 85) return { bar: 'bg-compliant', text: 'text-compliant-700' };
  if (pct >= 65) return { bar: 'bg-mitigated-500', text: 'text-mitigated-700' };
  return { bar: 'bg-risk', text: 'text-risk-700' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EngagementDetailView({ engagementId, onBack, onOpenExecution }: Props) {
  const { addToast } = useToast();
  const engagement = useMemo(() => ENGAGEMENTS.find(e => e.id === engagementId), [engagementId]);

  // Default the tab to overview; pick the first tab for the type once we know the engagement.
  const tabs = useMemo(() => engagement ? tabsForType(engagement.type) : [], [engagement]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  if (!engagement) {
    return (
      <div className="h-full overflow-y-auto bg-white">
        <div className="p-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
            <ArrowLeft size={14} />Back to Engagements
          </button>
          <div className="glass-card rounded-xl p-12 text-center">
            <p className="text-[14px] font-semibold text-text mb-1">Engagement not found</p>
            <p className="text-[12px] text-text-muted">It may have been deleted or moved.</p>
          </div>
        </div>
      </div>
    );
  }

  const eng = engagement;
  const health = healthTier(eng.health);
  const notStarted = eng.health === 0 && (eng.status === 'Planned' || eng.status === 'Draft');
  const processColor = PROCESS_COLORS[eng.process];

  // KPI strip — adapt the secondary numbers to the engagement type.
  const tested = Math.round(eng.controls * (eng.health > 0 ? eng.health / 100 : 0));
  const failed = eng.openIssues;
  const effective = Math.max(0, tested - failed);

  const kpis = eng.type === 'Automation'
    ? [
        { label: 'Controls Monitored', value: eng.controls, icon: Shield },
        { label: 'Workflows', value: MOCK_WORKFLOWS.length, icon: Workflow },
        { label: 'Open Exceptions', value: eng.openIssues, icon: AlertTriangle },
        { label: 'Pass Rate', value: notStarted ? '—' : `${eng.health}%`, icon: CheckCircle2 },
        { label: 'Last Run', value: eng.lastActivity, icon: Clock },
        { label: 'Next Run', value: eng.nextScheduled, icon: Calendar },
      ]
    : [
        { label: 'Controls in Scope', value: eng.controls, icon: Shield },
        { label: 'Tested', value: notStarted ? '—' : tested, icon: CheckCircle2 },
        { label: 'Effective', value: notStarted ? '—' : effective, icon: ShieldCheck },
        { label: 'Failed', value: notStarted ? '—' : failed, icon: AlertTriangle },
        { label: 'Workflows', value: MOCK_WORKFLOWS.length, icon: Workflow },
        { label: 'Evidence', value: MOCK_EVIDENCE.length, icon: FolderOpen },
      ];

  // Overview checklist — universal but slightly adapted per type.
  const checklist = eng.type === 'Automation'
    ? [
        { key: 'scope',    label: 'Define scope',               desc: 'Identify the data streams, controls, or accounts this automation covers.', done: true,  icon: Layers },
        { key: 'workflows',label: 'Configure workflows',        desc: 'Set up the workflow(s) and their input sources.',                          done: true,  icon: Workflow },
        { key: 'rules',    label: 'Tune detection rules',       desc: 'Calibrate thresholds and business rules to balance signal vs. noise.',     done: true,  icon: Zap },
        { key: 'routing',  label: 'Configure exception routing',desc: 'Assign owners and escalation rules for triggered exceptions.',             done: eng.health > 70, icon: AlertTriangle },
        { key: 'live',     label: 'Go live',                    desc: 'Activate the automation so it runs on its scheduled or ad-hoc cadence.',   done: eng.status === 'Active' || eng.status === 'In Progress', icon: Play },
      ]
    : [
        { key: 'scope',    label: 'Confirm engagement scope',    desc: 'Lock the controls and processes in scope for this engagement.',  done: true,  icon: Layers },
        { key: 'racm',     label: 'Map RACM',                    desc: 'Link the RACM version being tested for this engagement.',        done: true,  icon: FileText },
        { key: 'team',     label: 'Assign owner and reviewer',   desc: 'Owner runs testing; reviewer signs off on conclusions.',         done: true,  icon: User },
        { key: 'workflows',label: 'Link test workflows',         desc: 'Workflows automate sampling and evidence collection.',           done: eng.health > 0, icon: Workflow },
        { key: 'testing',  label: 'Complete testing',            desc: 'Test every key control and record results.',                     done: eng.health >= 95, icon: CheckCircle2 },
        { key: 'evidence', label: 'Attach evidence',             desc: 'Upload working papers, walkthroughs, and supporting docs.',      done: eng.health > 50, icon: Upload },
        { key: 'signoff',  label: 'Sign-off',                    desc: 'Reviewer signs off when testing is complete and evidence sufficient.', done: eng.status === 'Closed', icon: ShieldCheck },
      ];
  const completedCount = checklist.filter(c => c.done).length;
  const completedPct = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back to Engagements
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: processColor }}>
                {eng.process}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text">{eng.name}</h1>
                  <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${STATUS_CLS[eng.status]}`}>{eng.status}</span>
                  <span className={`inline-flex items-center px-2.5 h-5 rounded-md text-[10.5px] font-semibold border ${TYPE_CLS[eng.type]}`}>
                    {TYPE_LABEL[eng.type]}
                  </span>
                  {eng.type === 'Automation' && eng.subtype && (
                    <span className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wide bg-compliant-50/60 text-compliant-700 border border-compliant-100/70">
                      {SUBTYPE_LABEL[eng.subtype]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[12px] text-text-muted mt-1 flex-wrap">
                  <span className="font-mono tracking-tight">{eng.code}</span>
                  <span className="flex items-center gap-1"><User size={11} />{eng.owner}</span>
                  <span className="flex items-center gap-1"><Calendar size={11} />{eng.periodStart} – {eng.periodEnd}</span>
                  <span className="flex items-center gap-1"><Shield size={11} />{eng.framework}</span>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-text-secondary mt-2 max-w-3xl">{eng.description}</p>
          </div>

          {/* Health + Execution CTA */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center min-w-[80px]">
              <div className={`text-3xl font-bold tabular-nums ${notStarted ? 'text-text-muted' : health.text}`}>
                {notStarted ? '—' : `${eng.health}%`}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">
                {eng.type === 'Automation' ? 'Pass Rate' : 'Effective'}
              </div>
              {!notStarted && (
                <div className="mt-2 w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden mx-auto">
                  <div className={`h-full ${health.bar} rounded-full transition-all duration-500`} style={{ width: `${eng.health}%` }} />
                </div>
              )}
            </div>
            <button
              onClick={() => onOpenExecution(eng.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
              title="Open the full execution workspace for this engagement"
            >
              <Play size={14} />
              Open Execution Workspace
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card rounded-xl p-3 text-center"
            >
              <kpi.icon size={14} className="mx-auto text-text-muted mb-1" />
              <div className="text-[15px] font-bold text-text tabular-nums truncate">{kpi.value}</div>
              <div className="text-[10px] text-text-muted leading-tight">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-5 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {/* ═══ OVERVIEW (all types) ═══ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-text">
                        {eng.type === 'Automation' ? 'Set up this automation' : 'Set up this engagement'}
                      </h3>
                      <p className="text-[12px] text-text-muted mt-0.5">{completedCount} of {checklist.length} steps complete</p>
                    </div>
                    <div className="ml-auto">
                      <div className="w-20 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-medium transition-all" style={{ width: `${completedPct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {checklist.map((item, i) => (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${item.done ? 'border-compliant/20 bg-compliant-50/30' : 'border-border hover:border-primary/20 hover:bg-primary-xlight/30'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-compliant text-white' : 'bg-surface-2 text-text-muted'}`}>
                          {item.done ? <CheckCircle2 size={14} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[13px] font-medium ${item.done ? 'text-compliant-700 line-through' : 'text-text'}`}>{item.label}</div>
                          <div className="text-[11px] text-text-muted mt-0.5">{item.desc}</div>
                        </div>
                        {!item.done && (
                          <button
                            onClick={() => addToast({ message: `"${item.label}" — coming soon`, type: 'info' })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/15 transition-colors cursor-pointer shrink-0"
                          >
                            <item.icon size={11} />
                            Configure
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Quick stats / recent activity rail */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-[12px] font-bold text-ink-500 uppercase tracking-wider mb-3">Engagement at a glance</h3>
                    <dl className="space-y-2.5 text-[12.5px]">
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Type</dt><dd className="text-text font-medium">{TYPE_LABEL[eng.type]}{eng.type === 'Automation' && eng.subtype ? ` · ${SUBTYPE_LABEL[eng.subtype]}` : ''}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Process</dt><dd className="text-text font-medium">{eng.process}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Framework</dt><dd className="text-text font-medium">{eng.framework}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Period</dt><dd className="text-text font-medium">{eng.periodStart} – {eng.periodEnd}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Owner</dt><dd className="text-text font-medium">{eng.owner}</dd></div>
                      <div className="flex items-center justify-between"><dt className="text-text-muted">Status</dt><dd><span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${STATUS_CLS[eng.status]}`}>{eng.status}</span></dd></div>
                    </dl>
                  </div>
                  <div className="glass-card rounded-xl p-5">
                    <h3 className="text-[12px] font-bold text-ink-500 uppercase tracking-wider mb-3">Recent activity</h3>
                    <ul className="space-y-3 text-[12.5px]">
                      <li className="flex items-start gap-2.5">
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-compliant shrink-0" />
                        <div>
                          <div className="text-text">{eng.type === 'Automation' ? `Workflow run completed — ${eng.lastActivity}` : `Control test completed — ${eng.lastActivity}`}</div>
                          <div className="text-[11px] text-text-muted">{eng.owner}</div>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-evidence-500 shrink-0" />
                        <div>
                          <div className="text-text">{eng.openIssues > 0 ? `${eng.openIssues} ${eng.type === 'Automation' ? 'open exception(s)' : 'open issue(s)'} need attention` : 'No open issues'}</div>
                          <div className="text-[11px] text-text-muted">Updated {eng.lastActivity}</div>
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-mitigated-500 shrink-0" />
                        <div>
                          <div className="text-text">{eng.type === 'Automation' ? `Next run: ${eng.nextScheduled}` : `Next milestone: ${eng.nextScheduled}`}</div>
                          <div className="text-[11px] text-text-muted">On schedule</div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ RACM (Compliance / IA) ═══ */}
            {activeTab === 'racm' && (
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-[14px] font-bold text-text">Linked RACM</h3>
                      <p className="text-[12px] text-text-muted mt-0.5">The Risk and Control Matrix this engagement tests against.</p>
                    </div>
                    <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer">
                      View RACM <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/40 border border-border-light">
                    <div className="p-2 rounded-lg bg-brand-50"><FileText size={16} className="text-brand-600" /></div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-text">{eng.process} {eng.type === 'Compliance' ? eng.framework : 'Internal Audit'} RACM v2.1</div>
                      <div className="text-[11px] text-text-muted">{eng.controls} controls · {MOCK_CONTROLS.default.filter(c => c.key).length} key · Locked Feb 2026</div>
                    </div>
                    <span className="px-2 h-5 rounded-full text-[10px] font-semibold bg-compliant-50 text-compliant-700 inline-flex items-center">Locked</span>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-5">
                  <h3 className="text-[12px] font-bold text-ink-500 uppercase tracking-wider mb-3">RACM scope summary</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Risks', value: Math.round(eng.controls * 0.7) },
                      { label: 'Controls', value: eng.controls },
                      { label: 'Key Controls', value: MOCK_CONTROLS.default.filter(c => c.key).length },
                      { label: 'Frameworks', value: 1 },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg border border-border-light p-3 text-center">
                        <div className="text-[18px] font-bold text-text tabular-nums">{m.value}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ CONTROLS (Compliance / IA) ═══ */}
            {activeTab === 'controls' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-text">Controls in scope <span className="text-text-muted font-normal">({MOCK_CONTROLS.default.length})</span></h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer">
                    <Plus size={12} />Add Control
                  </button>
                </div>
                <div className="glass-card rounded-xl overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/50">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Ref</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Control</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Key</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_CONTROLS.default.map(c => (
                        <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3 text-[11.5px] font-mono text-text-secondary tabular-nums">{c.ref}</td>
                          <td className="px-4 py-3 text-text">{c.name}</td>
                          <td className="px-4 py-3">{c.key ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[10px] font-bold">K</span> : <span className="text-text-muted">—</span>}</td>
                          <td className="px-4 py-3"><span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${CONTROL_STATUS_CLS[c.status]}`}>{c.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ WORKFLOWS (all types) ═══ */}
            {activeTab === 'workflows' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-text">
                    Workflows <span className="text-text-muted font-normal">({MOCK_WORKFLOWS.length})</span>
                  </h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[12px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer">
                    <Plus size={12} />Link Workflow
                  </button>
                </div>
                <div className="space-y-2.5">
                  {MOCK_WORKFLOWS.map((wf, i) => (
                    <motion.div
                      key={wf.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-brand-50 shrink-0"><Workflow size={15} className="text-brand-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-text">{wf.name}</span>
                          <span className="px-1.5 h-4 rounded text-[9.5px] font-bold bg-surface-2 text-text-secondary font-mono">{wf.code}</span>
                          {/* Input source badges — SQL stands out as it's the live/connected source. */}
                          {wf.inputs.map(src => (
                            <span
                              key={src}
                              className={`inline-flex items-center gap-1 px-1.5 h-4 rounded text-[9.5px] font-bold uppercase tracking-wide border ${INPUT_BADGE_CLS[src]}`}
                              title={src === 'SQL' ? 'Live SQL data source' : `${src} input`}
                            >
                              {src === 'SQL' && <span className="w-1 h-1 rounded-full bg-evidence-600" aria-hidden="true" />}
                              {src}
                            </span>
                          ))}
                          {wf.inputs.length > 1 && (
                            <span className="px-1 text-[9px] font-semibold uppercase tracking-wider text-text-muted" title="Multiple input sources">Hybrid</span>
                          )}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{wf.type}</span>
                          <span>·</span>
                          {wf.cadence.kind === 'Ad-hoc' ? (
                            <span className="inline-flex items-center px-1.5 h-4 rounded text-[10px] font-semibold italic bg-mitigated-50/60 text-mitigated-700 border border-mitigated-100/60">Ad-hoc</span>
                          ) : (
                            <span className="text-text-secondary font-medium">{wf.cadence.label}</span>
                          )}
                          <span>·</span>
                          <span>Last run {wf.lastRun}</span>
                        </div>
                      </div>
                      <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${
                        wf.status === 'Success' ? 'bg-compliant-50 text-compliant-700'
                        : wf.status === 'Running' ? 'bg-evidence-50 text-evidence-700'
                        : 'bg-risk-50 text-risk-700'
                      }`}>{wf.status}</span>
                      <ChevronRight size={14} className="text-text-muted" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ EVIDENCE (Compliance / IA) ═══ */}
            {activeTab === 'evidence' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-text">Evidence & working papers <span className="text-text-muted font-normal">({MOCK_EVIDENCE.length})</span></h3>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors cursor-pointer">
                    <Upload size={12} />Upload
                  </button>
                </div>
                <div className="space-y-2.5">
                  {MOCK_EVIDENCE.map((doc, i) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/20 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-brand-50 shrink-0"><FileText size={15} className="text-brand-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-text truncate">{doc.name}</div>
                        <div className="text-[11px] text-text-muted mt-0.5">{doc.kind} · {doc.size} · Uploaded by {doc.uploader} · {doc.uploaded}</div>
                      </div>
                      <button className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">Open</button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ EXCEPTION MANAGEMENT (CCM) ═══ */}
            {activeTab === 'exceptions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-text">Exceptions <span className="text-text-muted font-normal">({MOCK_EXCEPTIONS.length})</span></h3>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-risk" />Open {MOCK_EXCEPTIONS.filter(e => e.status === 'Open').length}</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-mitigated-500" />Triaging {MOCK_EXCEPTIONS.filter(e => e.status === 'Triaging').length}</span>
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-compliant" />Resolved {MOCK_EXCEPTIONS.filter(e => e.status === 'Resolved').length}</span>
                  </div>
                </div>
                <div className="glass-card rounded-xl overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-border bg-surface-2/50">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Ref</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Exception</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Severity</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Assignee</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Opened</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_EXCEPTIONS.map(ex => (
                        <tr key={ex.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3 text-[11.5px] font-mono text-text-secondary tabular-nums">{ex.ref}</td>
                          <td className="px-4 py-3 text-text">{ex.title}</td>
                          <td className="px-4 py-3"><span className={`px-2 h-5 rounded-full text-[10px] font-bold uppercase inline-flex items-center ${SEV_CLS[ex.severity]}`}>{ex.severity}</span></td>
                          <td className="px-4 py-3 text-text-secondary">{ex.assignee}</td>
                          <td className="px-4 py-3 text-text-muted">{ex.opened}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 h-5 rounded-full text-[10px] font-semibold inline-flex items-center ${
                              ex.status === 'Open' ? 'bg-risk-50 text-risk-700'
                              : ex.status === 'Triaging' ? 'bg-mitigated-50 text-mitigated-700'
                              : 'bg-compliant-50 text-compliant-700'
                            }`}>{ex.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* ═══ ACTION TRAIL (all types) ═══ */}
            {activeTab === 'trail' && (
              <ActionTrailTab eng={eng} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Action Trail Tab — engagement-level activity feed + daily new/closed chart
// ═════════════════════════════════════════════════════════════════════════════

const EVENT_ICON: Record<ActivityType, React.ElementType> = {
  workflow_run: Workflow,
  exception_fired: AlertTriangle,
  exception_assigned: User,
  exception_classified: ListChecks,
  exception_closed: CheckCircle2,
  evidence_uploaded: Upload,
  control_tested: ShieldCheck,
  comment_added: MessageSquare,
  status_changed: RefreshCw,
  signoff: Shield,
};

const EVENT_ICON_CLS: Record<ActivityType, string> = {
  workflow_run: 'bg-evidence-50 text-evidence-700',
  exception_fired: 'bg-risk-50 text-risk-700',
  exception_assigned: 'bg-mitigated-50 text-mitigated-700',
  exception_classified: 'bg-brand-50 text-brand-700',
  exception_closed: 'bg-compliant-50 text-compliant-700',
  evidence_uploaded: 'bg-brand-50 text-brand-700',
  control_tested: 'bg-compliant-50 text-compliant-700',
  comment_added: 'bg-surface-2 text-text-secondary',
  status_changed: 'bg-mitigated-50 text-mitigated-700',
  signoff: 'bg-compliant-50 text-compliant-700',
};

type EventCategory = 'All' | 'Exceptions' | 'Workflow runs' | 'Other';

function categorize(t: ActivityType): EventCategory {
  if (t === 'workflow_run') return 'Workflow runs';
  if (t.startsWith('exception_')) return 'Exceptions';
  return 'Other';
}

function ActionTrailTab({ eng }: { eng: Engagement }) {
  const allEvents = ENGAGEMENT_ACTIVITY[eng.id] || [];

  const [workflowFilter, setWorkflowFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory>('All');

  // Unique workflows referenced in this engagement's events.
  const workflowOptions = useMemo(() => {
    const m = new Map<string, string>();
    allEvents.forEach(e => { if (e.workflowId && e.workflowName) m.set(e.workflowId, e.workflowName); });
    return Array.from(m.entries()); // [[id, name], ...]
  }, [allEvents]);

  const filtered = useMemo(() => allEvents.filter(e => {
    if (workflowFilter !== 'All' && e.workflowId !== workflowFilter) return false;
    if (categoryFilter !== 'All' && categorize(e.type) !== categoryFilter) return false;
    return true;
  }), [allEvents, workflowFilter, categoryFilter]);

  // KPIs (use full event list for the engagement-wide pending; new/closed week from filtered)
  const newThisWeek = filtered.filter(e => e.type === 'exception_fired' && e.dayOffset < 7).length;
  const closedThisWeek = filtered.filter(e => e.type === 'exception_closed' && e.dayOffset < 7).length;
  const avgClose = AVG_TIME_TO_CLOSE[eng.id] ?? '—';

  // Daily chart
  const daily = useMemo(() => dailyCounts(filtered, 30), [filtered]);
  const maxBar = Math.max(1, ...daily.map(d => d.created + d.closed));

  // Group filtered events by day for the feed (most recent first).
  const grouped = useMemo(() => {
    const map = new Map<number, ActivityEvent[]>();
    filtered.forEach(e => {
      const arr = map.get(e.dayOffset) ?? [];
      arr.push(e);
      map.set(e.dayOffset, arr);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayOffset, evs]) => ({
        dayOffset,
        events: evs.slice().sort((a, b) => b.hour - a.hour), // newest first within the day
      }));
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Pending', value: eng.openIssues, icon: AlertTriangle, tone: 'text-risk-700' },
          { label: 'New This Week', value: newThisWeek,    icon: Activity,       tone: 'text-evidence-700' },
          { label: 'Closed This Week', value: closedThisWeek, icon: CheckCircle2, tone: 'text-compliant-700' },
          { label: 'Avg Time to Close', value: avgClose,   icon: Clock,          tone: 'text-text' },
        ].map(kpi => (
          <div key={kpi.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] uppercase tracking-wide font-semibold text-text-muted">{kpi.label}</span>
              <kpi.icon size={13} className="text-text-muted" />
            </div>
            <div className={`text-[22px] font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Daily new/closed chart */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-semibold text-text">Daily new vs closed</h3>
            <p className="text-[11px] text-text-muted mt-0.5">Last 30 days — exceptions opened (top) and closed (bottom).</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-risk-500" />New</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-compliant" />Closed</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-24 mt-1">
          {daily.map((d, i) => {
            const total = d.created + d.closed;
            const newH = total > 0 ? (d.created / maxBar) * 100 : 0;
            const closedH = total > 0 ? (d.closed / maxBar) * 100 : 0;
            const isToday = d.dayOffset === 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end items-center min-w-0"
                title={`${formatChartDay(d.dayOffset)} — ${d.created} new · ${d.closed} closed`}
              >
                <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                  {d.created > 0 && (
                    <div className="w-full bg-risk-500/85 rounded-t-sm" style={{ height: `${newH}%`, minHeight: '2px' }} />
                  )}
                  {d.closed > 0 && (
                    <div className={`w-full bg-compliant/85 ${d.created === 0 ? 'rounded-t-sm' : ''}`} style={{ height: `${closedH}%`, minHeight: '2px' }} />
                  )}
                  {total === 0 && (
                    <div className="w-full bg-surface-3/60 rounded-sm" style={{ height: '2px' }} />
                  )}
                </div>
                {isToday && <div className="text-[9px] font-bold uppercase tracking-wider text-primary mt-1">Now</div>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-text-muted mt-2 tabular-nums">
          <span>{formatChartDay(29)}</span>
          <span>{formatChartDay(15)}</span>
          <span>{formatChartDay(0)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-muted uppercase tracking-wide">Workflow</span>
          <select
            value={workflowFilter}
            onChange={e => setWorkflowFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg border border-border bg-white text-[11px] text-text outline-none focus:border-primary/40 cursor-pointer"
          >
            <option value="All">All workflows</option>
            {workflowOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div className="w-px h-5 bg-border-light" />
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-muted uppercase tracking-wide">Type</span>
          <div className="flex gap-1">
            {(['All', 'Exceptions', 'Workflow runs', 'Other'] as EventCategory[]).map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                  categoryFilter === c
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-[11px] text-text-muted tabular-nums">
          {filtered.length} of {allEvents.length} events
        </div>
      </div>

      {/* Activity feed */}
      {grouped.length === 0 ? (
        <div className="border border-border-light rounded-xl p-12 text-center bg-white">
          <Activity size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-text mb-1">No activity for these filters</p>
          <p className="text-[12px] text-text-muted">Try clearing the workflow or type filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.dayOffset}>
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-text-muted mb-2 sticky top-0 bg-white/80 backdrop-blur-sm py-1">
                {formatDay(group.dayOffset)}
                <span className="ml-2 text-text-muted/60 normal-case font-normal tracking-normal">{formatChartDay(group.dayOffset)}</span>
              </div>
              <div className="space-y-1.5 border-l-2 border-border-light pl-4 ml-1">
                {group.events.map(ev => {
                  const Icon = EVENT_ICON[ev.type];
                  const iconCls = EVENT_ICON_CLS[ev.type];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface-2/40 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconCls}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-text leading-snug">{ev.title}</div>
                        {ev.detail && <div className="text-[12px] text-text-muted mt-0.5">{ev.detail}</div>}
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1 flex-wrap">
                          <span>{ev.actor}</span>
                          {ev.workflowName && (
                            <>
                              <span className="text-border">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Workflow size={10} />{ev.workflowName}
                              </span>
                            </>
                          )}
                          {ev.refId && (
                            <>
                              <span className="text-border">·</span>
                              <span className="font-mono tracking-tight">{ev.refId}</span>
                            </>
                          )}
                          <span className="text-border">·</span>
                          <span className="tabular-nums">{String(ev.hour).padStart(2, '0')}:00</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
