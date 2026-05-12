// ─── Configurable Engagement V3 — Creation Wizard ─────────────────────────
// 4-step wizard: Choose Work Type → Details → Pattern Setup → Review & Create
// Not wired to app routing yet. Local state only.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import type { EngagementPatternType, EngagementConfig, ConfigurableEngagement, ValidationResult } from './configurableEngagementTypes';
import {
  EngagementPatternType as EPT, EngagementStatus, PATTERN_DISPLAY_LABELS,
  ComplianceFramework, ControlScopeSource, TestingInputMethod,
  AuditScopeLevel, AutomationInputType, AutomationSetupMode, AutomationOutputType, RunType,
} from './configurableEngagementTypes';
import { getEngagementPatternDefinition } from './engagementPatterns';
import { validateConfigurableEngagementDraft } from './configurableEngagementState';
import { PatternSelectionStep, CommonDetailsStep, PatternConfigStep, ReviewCreateStep } from './components';
import type { CommonDetails } from './components';

// ─── Step definitions ─────────────────────────────────────────────────────

const STEPS = [
  { id: 'pattern', label: 'Work Type' },
  { id: 'details', label: 'Details' },
  { id: 'config', label: 'Setup' },
  { id: 'review', label: 'Review & Create' },
] as const;

// ─── Default configs per pattern ──────────────────────────────────────────

function getDefaultConfig(patternType: EngagementPatternType): EngagementConfig {
  if (patternType === EPT.COMPLIANCE_CONTROL_TESTING) {
    return {
      patternType: EPT.COMPLIANCE_CONTROL_TESTING,
      framework: ComplianceFramework.SOX_ICFR,
      auditType: 'Financial Internal Control',
      auditPeriodStart: '',
      auditPeriodEnd: '',
      controlScopeSource: ControlScopeSource.RACM_VERSION,
      defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES,
      allowControlLevelOverride: true,
      reviewerRequired: true,
    };
  }
  if (patternType === EPT.INTERNAL_AUDIT_ASSIGNMENT) {
    return {
      patternType: EPT.INTERNAL_AUDIT_ASSIGNMENT,
      auditPeriodStart: '',
      auditPeriodEnd: '',
      scopeLevel: AuditScopeLevel.PROCESS,
      processOwner: '',
      idrEnabled: true,
      announcementRequired: true,
      finalReportRequired: true,
      actionTrackingEnabled: true,
    };
  }
  return {
    patternType: EPT.WORKFLOW_AUTOMATION_PROJECT,
    inputType: AutomationInputType.EXCEL_CSV,
    automationSetupMode: AutomationSetupMode.QA_ADHOC_ANALYSIS,
    outputTypes: [AutomationOutputType.REPORT],
    reportRequired: true,
    reviewRequired: false,
    caseCreationEnabled: false,
    runType: RunType.AD_HOC,
  };
}

const DEFAULT_DETAILS: CommonDetails = {
  name: '',
  description: '',
  owner: '',
  reviewer: '',
  businessProcess: '',
  entityOrLocation: '',
  plannedStartDate: '',
  plannedEndDate: '',
};

// ─── Component ────────────────────────────────────────────────────────────

export default function ConfigurableEngagementWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState<EngagementPatternType | null>(null);
  const [details, setDetails] = useState<CommonDetails>(DEFAULT_DETAILS);
  const [config, setConfig] = useState<EngagementConfig>(getDefaultConfig(EPT.COMPLIANCE_CONTROL_TESTING));
  const [isCreated, setIsCreated] = useState(false);

  // When pattern changes, reset config to defaults
  const handlePatternSelect = (pt: EngagementPatternType) => {
    if (pt !== selectedPattern) {
      setConfig(getDefaultConfig(pt));
    }
    setSelectedPattern(pt);
  };

  // Build draft engagement for validation
  const draftEngagement = useMemo<ConfigurableEngagement | null>(() => {
    if (!selectedPattern) return null;
    return {
      id: 'draft-new',
      name: details.name,
      patternType: selectedPattern,
      displayLabel: PATTERN_DISPLAY_LABELS[selectedPattern],
      description: details.description,
      owner: details.owner,
      reviewer: details.reviewer || undefined,
      businessProcess: details.businessProcess || undefined,
      entityOrLocation: details.entityOrLocation || undefined,
      status: EngagementStatus.DRAFT,
      stage: 'Draft',
      plannedStartDate: details.plannedStartDate || undefined,
      plannedEndDate: details.plannedEndDate || undefined,
      config,
      outputs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [selectedPattern, details, config]);

  const validation: ValidationResult = useMemo(() => {
    if (!draftEngagement) return { isValid: false, errors: [{ field: 'patternType', message: 'Select a work type.', severity: 'error' }] };
    return validateConfigurableEngagementDraft(draftEngagement);
  }, [draftEngagement]);

  const reviewerRequired = selectedPattern === EPT.COMPLIANCE_CONTROL_TESTING;

  // Step navigation
  const canGoNext = () => {
    if (currentStep === 0) return !!selectedPattern;
    if (currentStep === 1) return !!details.name.trim() && !!details.owner.trim() && !!details.description.trim();
    if (currentStep === 2) return true; // validation shown on review step
    return false;
  };

  const handleCreate = () => {
    if (!validation.isValid) return;
    setIsCreated(true);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <React.Fragment key={step.id}>
              {i > 0 && <div className={`flex-1 h-px ${isDone ? 'bg-primary' : 'bg-border-light'}`} />}
              <button
                onClick={() => { if (isDone && !isCreated) setCurrentStep(i); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  isActive ? 'bg-primary text-white' :
                  isDone ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20' :
                  'bg-gray-100 text-gray-400'
                } ${isDone && !isCreated ? 'cursor-pointer' : ''}`}
              >
                {isDone ? <CheckCircle2 size={11} /> : <span className="w-4 h-4 rounded-full bg-white/20 inline-flex items-center justify-center text-[9px]">{i + 1}</span>}
                {step.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="mb-6">
        {currentStep === 0 && (
          <PatternSelectionStep selectedPattern={selectedPattern} onSelect={handlePatternSelect} />
        )}
        {currentStep === 1 && selectedPattern && (
          <CommonDetailsStep
            patternType={selectedPattern}
            details={details}
            onChange={setDetails}
            reviewerRequired={reviewerRequired}
          />
        )}
        {currentStep === 2 && selectedPattern && (
          <PatternConfigStep
            patternType={selectedPattern}
            config={config}
            onChange={setConfig}
          />
        )}
        {currentStep === 3 && selectedPattern && (
          <ReviewCreateStep
            patternType={selectedPattern}
            details={details}
            config={config}
            validation={validation}
            isCreated={isCreated}
            onCreate={handleCreate}
          />
        )}
      </div>

      {/* Navigation */}
      {!isCreated && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border-light text-[12px] font-medium text-text-muted hover:bg-surface-2/30 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} />Back
          </button>
          {currentStep < 3 && (
            <button
              onClick={() => setCurrentStep(s => Math.min(3, s + 1))}
              disabled={!canGoNext()}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next<ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
