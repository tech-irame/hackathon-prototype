// ─── Configurable Engagement V3 — Workspace Shell ─────────────────────────
// Pattern-driven workspace with dynamic tabs. Dev-only, not persisted.
// See docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md for product rules.

import React, { useState, useMemo, useCallback } from 'react';
import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import { getWorkspaceTabsForPattern } from './configurableEngagementState';
import { WorkspaceHeader, WorkspaceTabs } from './components';
import PatternWorkspaceRenderer from './PatternWorkspaceRenderer';
import { MOCK_PBC_REQUESTS, type PBCRequest, type PBCRequestStatus, type ComplianceWorkspaceState } from './patterns/compliance/complianceRequestsData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import type { AttributeTestingState } from './patterns/compliance/complianceAttributeTestingData';
import type { ComplianceReviewState } from './patterns/compliance/complianceReviewData';
import type { ComplianceConclusionState } from './patterns/compliance/complianceConclusionData';
import { DEFAULT_IA_SCOPE, type InternalAuditScopeState, type InternalAuditWorkspaceState } from './patterns/internal-audit/internalAuditScopeData';
import { DEFAULT_ANNOUNCEMENT, type InternalAuditAnnouncementState } from './patterns/internal-audit/internalAuditAnnouncementData';
import { MOCK_IA_REQUESTS, type InternalAuditRequestState } from './patterns/internal-audit/internalAuditRequestsData';
import type { InternalAuditAnalysisState } from './patterns/internal-audit/internalAuditAnalysisData';
import type { InternalAuditObservationsState } from './patterns/internal-audit/internalAuditObservationsData';
import type { InternalAuditDiscussionState } from './patterns/internal-audit/internalAuditDiscussionData';
import { DEFAULT_FINAL_REPORT, type InternalAuditFinalReportState } from './patterns/internal-audit/internalAuditFinalReportData';
import type { InternalAuditActionPlanState } from './patterns/internal-audit/internalAuditActionPlanData';
import type { AutomationInputDataState, AutomationProjectWorkspaceState } from './patterns/automation/automationInputData';

interface Props {
  engagement: ConfigurableEngagement;
  onBack?: () => void;
  onEditSetup?: () => void;
}

export default function ConfigurableEngagementWorkspace({ engagement, onBack, onEditSetup }: Props) {
  const allTabs = getWorkspaceTabsForPattern(engagement.patternType);

  // Hide Review tab for automation projects when review is not required
  const hiddenTabIds = useMemo(() => {
    if (
      engagement.config.patternType === EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT &&
      !engagement.config.reviewRequired
    ) {
      return ['review'];
    }
    return [];
  }, [engagement.config]);

  const visibleTabs = allTabs.filter(t => !hiddenTabIds.includes(t.id));
  const [activeTabId, setActiveTabId] = useState(visibleTabs[0]?.id || 'overview');
  const activeTab = visibleTabs.find(t => t.id === activeTabId) || visibleTabs[0];

  // ── Compliance workspace state (lifted from tab components) ──
  const [complianceState, setComplianceState] = useState<ComplianceWorkspaceState>(() => ({
    requests: MOCK_PBC_REQUESTS,
    samplesEvidence: { batches: [], evidence: [] },
    attributeTesting: { results: [], testingStarted: false },
    review: { reviews: [] },
    conclusion: { conclusions: [] },
  }));

  const handleCreateRequest = useCallback((req: PBCRequest) => {
    setComplianceState(prev => ({ ...prev, requests: [req, ...prev.requests] }));
  }, []);

  const handleUpdateRequestStatus = useCallback((id: string, status: PBCRequestStatus) => {
    setComplianceState(prev => ({
      ...prev,
      requests: prev.requests.map(r => r.id === id ? { ...r, status } : r),
    }));
  }, []);

  const handleAddBatch = useCallback((batch: SampleBatch) => {
    setComplianceState(prev => ({
      ...prev,
      samplesEvidence: { ...prev.samplesEvidence, batches: [...prev.samplesEvidence.batches, batch] },
    }));
  }, []);

  const handleAddEvidence = useCallback((ev: EvidenceItem) => {
    setComplianceState(prev => ({
      ...prev,
      samplesEvidence: { ...prev.samplesEvidence, evidence: [...prev.samplesEvidence.evidence, ev] },
    }));
  }, []);

  const handleUpdateAttributeTesting = useCallback((state: AttributeTestingState) => {
    setComplianceState(prev => ({ ...prev, attributeTesting: state }));
  }, []);

  const handleUpdateReview = useCallback((reviewState: ComplianceReviewState) => {
    setComplianceState(prev => ({ ...prev, review: reviewState }));
  }, []);

  const handleUpdateConclusion = useCallback((conclusionState: ComplianceConclusionState) => {
    setComplianceState(prev => ({ ...prev, conclusion: conclusionState }));
  }, []);

  // ── Internal Audit workspace state ──
  const [iaState, setIAState] = useState<InternalAuditWorkspaceState>(() => ({
    scope: { ...DEFAULT_IA_SCOPE, scopeLevel: (engagement.config as any).scopeLevel || 'PROCESS' },
    announcement: { ...DEFAULT_ANNOUNCEMENT },
    requests: { requests: MOCK_IA_REQUESTS, proceedWithoutIDR: false },
    analysis: { runs: [], potentialObservations: [] },
    observations: { observations: [], noObservationsConfirmed: false, noObservationsConfirmedBy: '', noObservationsConfirmedAt: null, dismissedPotentialObsIds: [] },
    discussion: { items: [], notes: [], noObsDiscussionConfirmed: false },
    finalReport: { ...DEFAULT_FINAL_REPORT },
    actionPlan: { actionItems: [], initializedFromReport: false, followUpRequired: false, followUpNotes: '' },
  }));

  const handleUpdateIAScope = useCallback((scope: InternalAuditScopeState) => {
    setIAState(prev => ({ ...prev, scope }));
  }, []);

  const handleUpdateIAAnnouncement = useCallback((announcement: InternalAuditAnnouncementState) => {
    setIAState(prev => ({ ...prev, announcement }));
  }, []);

  const handleUpdateIARequests = useCallback((requestState: InternalAuditRequestState) => {
    setIAState(prev => ({ ...prev, requests: requestState }));
  }, []);

  const handleUpdateIAAnalysis = useCallback((analysisState: InternalAuditAnalysisState) => {
    setIAState(prev => ({ ...prev, analysis: analysisState }));
  }, []);

  const handleUpdateIAObservations = useCallback((obsState: InternalAuditObservationsState) => {
    setIAState(prev => ({ ...prev, observations: obsState }));
  }, []);

  const handleUpdateIADiscussion = useCallback((discState: InternalAuditDiscussionState) => {
    setIAState(prev => ({ ...prev, discussion: discState }));
  }, []);

  const handleUpdateIAFinalReport = useCallback((reportState: InternalAuditFinalReportState) => {
    setIAState(prev => ({ ...prev, finalReport: reportState }));
  }, []);

  const handleUpdateIAActionPlan = useCallback((apState: InternalAuditActionPlanState) => {
    setIAState(prev => ({ ...prev, actionPlan: apState }));
  }, []);

  // ── Automation Project workspace state ──
  const [automationState, setAutomationState] = useState<AutomationProjectWorkspaceState>(() => ({
    inputData: { dataSources: [], selectedSourceIds: [], inputNotes: '', proceedWithoutData: false },
  }));

  const handleUpdateAutomationInputData = useCallback((inputData: AutomationInputDataState) => {
    setAutomationState(prev => ({ ...prev, inputData }));
  }, []);

  return (
    <div>
      <WorkspaceHeader engagement={engagement} onBack={onBack} onEditSetup={onEditSetup} />
      <WorkspaceTabs tabs={allTabs} activeTabId={activeTabId} onTabChange={setActiveTabId} hiddenTabIds={hiddenTabIds} />
      <PatternWorkspaceRenderer
        engagement={engagement}
        activeTabId={activeTab?.id || 'overview'}
        activeTabLabel={activeTab?.label || 'Overview'}
        complianceState={complianceState}
        onCreateRequest={handleCreateRequest}
        onUpdateRequestStatus={handleUpdateRequestStatus}
        onAddBatch={handleAddBatch}
        onAddEvidence={handleAddEvidence}
        onUpdateAttributeTesting={handleUpdateAttributeTesting}
        onUpdateReview={handleUpdateReview}
        onUpdateConclusion={handleUpdateConclusion}
        iaState={iaState}
        onUpdateIAScope={handleUpdateIAScope}
        onUpdateIAAnnouncement={handleUpdateIAAnnouncement}
        onUpdateIARequests={handleUpdateIARequests}
        onUpdateIAAnalysis={handleUpdateIAAnalysis}
        onUpdateIAObservations={handleUpdateIAObservations}
        onUpdateIADiscussion={handleUpdateIADiscussion}
        onUpdateIAFinalReport={handleUpdateIAFinalReport}
        onUpdateIAActionPlan={handleUpdateIAActionPlan}
        automationState={automationState}
        onUpdateAutomationInputData={handleUpdateAutomationInputData}
        onNavigateTab={setActiveTabId}
      />
    </div>
  );
}
