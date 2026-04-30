import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import RacmMappingWorkspace from './RacmMappingWorkspace';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RacmEntry {
  id: string; name: string; version: string; process: string; framework: string;
  risks: number; controls: number; mappedRisks: number; unmappedRisks: number;
  keyControls: number; workflowCoverage: number; attributesCoverage: number;
  isValidated: boolean; linkedToEngagement: boolean;
}

// ─── Derived columns ────────────────────────────────────────────────────────

type MappingStatus = 'Not Started' | 'In Progress' | 'Complete';

function getMappingStatus(racm: RacmEntry): MappingStatus {
  if (racm.mappedRisks === 0) return 'Not Started';
  if (racm.mappedRisks < racm.risks) return 'In Progress';
  return 'Complete';
}

const MAPPING_STYLES: Record<MappingStatus, string> = {
  'Not Started': 'bg-gray-100 text-gray-500',
  'In Progress': 'bg-amber-50 text-amber-600',
  'Complete': 'bg-emerald-50 text-emerald-600',
};

type Readiness = 'Needs Mapping' | 'Needs Workflow Setup' | 'Ready';

function getReadiness(racm: RacmEntry): Readiness {
  if (racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Needs Mapping';
  if (racm.workflowCoverage < 100) return 'Needs Workflow Setup';
  return 'Ready';
}

const READINESS_STYLES: Record<Readiness, string> = {
  'Needs Mapping': 'bg-amber-50 text-amber-700',
  'Needs Workflow Setup': 'bg-amber-50/60 text-amber-600',
  'Ready': 'bg-emerald-50 text-emerald-700',
};

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
}

export default function RacmListTable({ processFilter, initialMappingRacm, onMappingOpened, extraRacms }: Props) {
  const [racmList] = useState<RacmEntry[]>(RACM_SEED_DATA);
  const allRacms = extraRacms && extraRacms.length > 0 ? [...racmList, ...extraRacms] : racmList;
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

  const notReadyCount = filtered.filter(r => getReadiness(r) !== 'Ready').length;

  return (
    <div className="space-y-3">
      {/* Insight banner */}
      {notReadyCount > 0 && (
        <div className="rounded-lg border border-amber-200/50 bg-amber-50/30 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="text-[12px] text-amber-800 flex-1">
            <span className="font-semibold">{notReadyCount} RACM{notReadyCount !== 1 ? 's' : ''}</span> {notReadyCount !== 1 ? 'require' : 'requires'} attention — complete mapping and workflow setup before execution.
          </span>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                {['RACM', 'Process', 'Framework', 'Risks', 'Controls', 'Key Controls', 'Mapping Status', 'Readiness', ''].map(h => (
                  <th key={h || 'action'} className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-[12px] text-text-muted">No RACMs found</td></tr>
              ) : filtered.map((racm, i) => {
                const mapping = getMappingStatus(racm);
                const readiness = getReadiness(racm);
                return (
                  <motion.tr key={racm.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {racm.linkedToEngagement && <Lock size={10} className="text-gray-400 shrink-0" />}
                        <span className="text-[12px] font-medium text-text">{racm.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200/60">{racm.process}</span>
                    </td>
                    <td className="px-3 py-3"><span className="text-[11px] text-gray-500">{racm.framework}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-text tabular-nums">{racm.risks}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-text tabular-nums">{racm.controls}</span></td>
                    <td className="px-3 py-3"><span className="text-[12px] text-gray-500 tabular-nums">{racm.keyControls}</span></td>
                    <td className="px-3 py-3">
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${MAPPING_STYLES[mapping]}`}>{mapping}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 h-5 rounded-full text-[9px] font-semibold inline-flex items-center ${READINESS_STYLES[readiness]}`}>{readiness}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => { setMappingRacm(racm); setShowMappingWorkspace(true); }}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-gray-100 text-gray-600 hover:bg-gray-200/70">
                        View<ChevronRight size={8} />
                      </button>
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
