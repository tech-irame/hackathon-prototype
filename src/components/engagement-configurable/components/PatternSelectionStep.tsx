import React from 'react';
import { Shield, ClipboardCheck, Workflow, CheckCircle2 } from 'lucide-react';
import type { EngagementPatternType } from '../configurableEngagementTypes';
import { ENGAGEMENT_PATTERNS_LIST, type EngagementPatternDefinition } from '../engagementPatterns';

const PATTERN_ICONS: Record<string, React.ElementType> = {
  Shield,
  ClipboardCheck,
  Workflow,
};

interface Props {
  selectedPattern: EngagementPatternType | null;
  onSelect: (pattern: EngagementPatternType) => void;
}

export default function PatternSelectionStep({ selectedPattern, onSelect }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-text mb-1">Choose Work Type</h3>
        <p className="text-[12px] text-text-muted">Select the type of engagement, assignment, or project you want to create.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ENGAGEMENT_PATTERNS_LIST.map((pattern: EngagementPatternDefinition) => {
          const isSelected = selectedPattern === pattern.id;
          const Icon = PATTERN_ICONS[pattern.iconName || 'Shield'] || Shield;
          return (
            <button
              key={pattern.id}
              onClick={() => onSelect(pattern.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border-light bg-white hover:border-primary/30 hover:bg-surface-2/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-primary/10' : 'bg-surface-2/40'}`}>
                  <Icon size={18} className={isSelected ? 'text-primary' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-text">{pattern.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                      {pattern.displayLabel}
                    </span>
                    {isSelected && <CheckCircle2 size={14} className="text-primary ml-auto shrink-0" />}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed mb-2">{pattern.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {pattern.workspaceTabs.slice(0, 6).map(tab => (
                      <span key={tab.id} className="px-1.5 py-0.5 rounded bg-surface-2/40 text-[8px] text-gray-500 font-medium">
                        {tab.label}
                      </span>
                    ))}
                    {pattern.workspaceTabs.length > 6 && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-2/40 text-[8px] text-gray-400">
                        +{pattern.workspaceTabs.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
