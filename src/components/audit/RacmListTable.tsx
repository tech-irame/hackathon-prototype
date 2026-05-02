import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, AlertTriangle, Lock, Pencil, Settings, Play, FolderOpen } from 'lucide-react';
import RacmMappingWorkspace from './RacmMappingWorkspace';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RacmEntry {
  id: string; name: string; version: string; process: string; framework: string;
  risks: number; controls: number; mappedRisks: number; unmappedRisks: number;
  keyControls: number; workflowCoverage: number; attributesCoverage: number;
  isValidated: boolean; linkedToEngagement: boolean;
  /** false = still in draft review (editable Excel grid); true | undefined = frozen / active */
  isFrozen?: boolean;
  /** Original uploaded file name — used when re-opening the review editor */
  sourceFileName?: string;
}

// ─── RACM Lifecycle ─────────────────────────────────────────────────────────

type RacmLifecycle = 'Draft Review' | 'Needs Setup' | 'Setup In Progress' | 'Ready';

function getRacmLifecycle(racm: RacmEntry): RacmLifecycle {
  // Draft = not yet frozen
  if (racm.isFrozen === false) return 'Draft Review';
  // Frozen but nothing mapped yet
  if (racm.mappedRisks === 0 && racm.risks === 0) return 'Needs Setup';
  if (racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Needs Setup';
  // Mapped but workflows/attributes not complete
  if (racm.workflowCoverage < 100 || racm.attributesCoverage < 100) return 'Setup In Progress';
  return 'Ready';
}

const LIFECYCLE_BADGE: Record<RacmLifecycle, string> = {
  'Draft Review':      'bg-amber-50 text-amber-600 border-amber-200/50',
  'Needs Setup':       'bg-yellow-50 text-yellow-700 border-yellow-200/50',
  'Setup In Progress': 'bg-blue-50 text-blue-600 border-blue-200/50',
  'Ready':             'bg-emerald-50 text-emerald-700 border-emerald-200/50',
};

interface LifecycleCTA {
  label: string;
  icon: React.ElementType;
  cls: string;
}

function getLifecycleCTA(lifecycle: RacmLifecycle): LifecycleCTA {
  switch (lifecycle) {
    case 'Draft Review':
      return { label: 'Edit Draft', icon: Pencil, cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100' };
    case 'Needs Setup':
      return { label: 'Configure', icon: Settings, cls: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' };
    case 'Setup In Progress':
      return { label: 'Continue Setup', icon: Play, cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100' };
    case 'Ready':
      return { label: 'Open RACM', icon: FolderOpen, cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' };
  }
}

// ─── Seed Data ──────────────────────────────────────────────────────────────

export const RACM_SEED_DATA: RacmEntry[] = [
  { id: 'racm-001', name: 'FY26 P2P — Vendor Payment', version: 'v2.1', process: 'P2P', framework: 'SOX ICFR', risks: 9, controls: 24, mappedRisks: 9, unmappedRisks: 0, keyControls: 6, workflowCoverage: 92, attributesCoverage: 88, isValidated: true, linkedToEngagement: true },
  { id: 'racm-002', name: 'FY26 O2C — Revenue & AR', version: 'v2.1', process: 'O2C', framework: 'SOX ICFR', risks: 7, controls: 18, mappedRisks: 6, unmappedRisks: 1, keyControls: 4, workflowCoverage: 78, attributesCoverage: 65, isValidated: false, linkedToEngagement: false },
  { id: 'racm-003', name: 'FY26 R2R — Financial Close', version: 'v2.1', process: 'R2R', framework: 'SOX ICFR', risks: 11, controls: 31, mappedRisks: 10, unmappedRisks: 1, keyControls: 8, workflowCoverage: 85, attributesCoverage: 80, isValidated: true, linkedToEngagement: true },
  { id: 'racm-004', name: 'FY26 S2C — Contract Review', version: 'v1.8', process: 'S2C', framework: 'Internal Policy', risks: 5, controls: 14, mappedRisks: 3, unmappedRisks: 2, keyControls: 2, workflowCoverage: 60, attributesCoverage: 45, isValidated: false, linkedToEngagement: false },
  { id: 'racm-005', name: 'FY26 ITGC — Access & Change', version: 'v2.1', process: 'ITGC', framework: 'ISO 27001', risks: 6, controls: 15, mappedRisks: 6, unmappedRisks: 0, keyControls: 5, workflowCoverage: 100, attributesCoverage: 100, isValidated: true, linkedToEngagement: true },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  processFilter?: string;
  initialMappingRacm?: { id: string; name: string; process: string } | null;
  onMappingOpened?: () => void;
  extraRacms?: RacmEntry[];
  /** Called when user clicks Edit Draft on a draft RACM — opens the Excel editing page */
  onEditDraft?: (racm: RacmEntry) => void;
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms, onEditDraft }: Props) {
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  // Merge seed + extra, deduplicating by id (extras override seeds)
  const allRacms = (() => {
    if (!extraRacms || extraRacms.length === 0) return racmList;
    const extraIds = new Set(extraRacms.map(r => r.id));
    return [...racmList.filter(r => !extraIds.has(r.id)), ...extraRacms];
  })();
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);

  useEffect(() => {
    if (initialMappingRacm && !showMappingWorkspace) {
      const found = allRacms.find(r => r.id === initialMappingRacm.id);
      if (found) {
        setMappingRacm(found);
      } else {
        setMappingRacm({
          id: initialMappingRacm.id, name: initialMappingRacm.name, version: 'v1.0',
          process: initialMappingRacm.process, framework: 'SOX ICFR',
          risks: 0, controls: 0, mappedRisks: 0, unmappedRisks: 0, keyControls: 0,
          workflowCoverage: 0, attributesCoverage: 0, isValidated: false, linkedToEngagement: false,
        });
      }
      setShowMappingWorkspace(true);
      onMappingOpened?.();
    }
  }, [initialMappingRacm]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = processFilter
    ? allRacms.filter(r => r.process === processFilter)
    : allRacms;

  if (showMappingWorkspace && mappingRacm) {
    return (
      <RacmMappingWorkspace
        racmId={mappingRacm.id}
        racmName={mappingRacm.name}
        racmProcess={mappingRacm.process}
        isEmpty={mappingRacm.risks === 0}
        onBack={() => { setShowMappingWorkspace(false); setMappingRacm(null); }}
      />
    );
  }

  const actionNeededCount = filtered.filter(r => getRacmLifecycle(r) !== 'Ready').length;

  return (
    <div className="space-y-3">
      {/* Insight banner */}
      {actionNeededCount > 0 && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-[12px] text-amber-800 flex-1">
            <span className="font-semibold">{actionNeededCount} RACM{actionNeededCount !== 1 ? 's' : ''}</span> {actionNeededCount !== 1 ? 'require' : 'requires'} attention — complete setup before execution.
          </span>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                {['RACM', 'Status', 'Process', 'Framework', 'Risks', 'Controls', 'Key Controls', ''].map(h => (
                  <th key={h || 'action'} className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[12px] text-text-muted">No RACMs found</td></tr>
              ) : filtered.map((racm, i) => {
                const lifecycle = getRacmLifecycle(racm);
                const cta = getLifecycleCTA(lifecycle);
                const isDraftRacm = lifecycle === 'Draft Review';

                const handleRowClick = () => {
                  if (isDraftRacm && onEditDraft) {
                    onEditDraft(racm);
                  } else {
                    setMappingRacm(racm);
                    setShowMappingWorkspace(true);
                  }
                };

                const handleCTAClick = () => {
                  if (isDraftRacm && onEditDraft) {
                    onEditDraft(racm);
                  } else {
                    setMappingRacm(racm);
                    setShowMappingWorkspace(true);
                  }
                };

                return (
                  <motion.tr key={racm.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={handleRowClick}
                    className="border-b border-border/50 hover:bg-gray-50/60 transition-colors cursor-pointer">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {racm.linkedToEngagement && <Lock size={10} className="text-gray-400 shrink-0" />}
                        <span className="text-[12px] font-medium text-text">{racm.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center border ${LIFECYCLE_BADGE[lifecycle]}`}>{lifecycle}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{racm.process}</span>
                    </td>
                    <td className="px-3 py-3"><span className="text-[11px] text-gray-500">{racm.framework}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-text tabular-nums">{racm.risks}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-text tabular-nums">{racm.controls}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-gray-500 tabular-nums">{racm.keyControls}</span></td>
                    <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 justify-end">
                        {!isDraftRacm && onEditDraft && (
                          <button onClick={() => onEditDraft(racm)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200/70">
                            <Pencil size={9} />Edit
                          </button>
                        )}
                        <button onClick={handleCTAClick}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${cta.cls}`}>
                          <cta.icon size={10} />{cta.label}<ChevronRight size={8} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
          <span className="text-[11px] text-text-muted">{filtered.length} RACM{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
