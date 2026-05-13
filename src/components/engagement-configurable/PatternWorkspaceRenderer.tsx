// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import type { ComplianceWorkspaceState, PBCRequest, PBCRequestStatus } from './patterns/compliance/complianceRequestsData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import type { AttributeTestingState } from './patterns/compliance/complianceAttributeTestingData';
import type { ComplianceReviewState } from './patterns/compliance/complianceReviewData';
import type { ComplianceConclusionState } from './patterns/compliance/complianceConclusionData';
import type { InternalAuditWorkspaceState, InternalAuditScopeState } from './patterns/internal-audit/internalAuditScopeData';
import type { InternalAuditAnnouncementState } from './patterns/internal-audit/internalAuditAnnouncementData';
import type { InternalAuditRequestState } from './patterns/internal-audit/internalAuditRequestsData';
import type { InternalAuditAnalysisState } from './patterns/internal-audit/internalAuditAnalysisData';
import type { InternalAuditObservationsState } from './patterns/internal-audit/internalAuditObservationsData';
import type { InternalAuditDiscussionState } from './patterns/internal-audit/internalAuditDiscussionData';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';
import ComplianceRequestsPBCTab from './patterns/compliance/ComplianceRequestsPBCTab';
import ComplianceSamplesEvidenceTab from './patterns/compliance/ComplianceSamplesEvidenceTab';
import ComplianceAttributeTestingTab from './patterns/compliance/ComplianceAttributeTestingTab';
import ComplianceWorkingPaperTab from './patterns/compliance/ComplianceWorkingPaperTab';
import ComplianceReviewTab from './patterns/compliance/ComplianceReviewTab';
import ComplianceConclusionTab from './patterns/compliance/ComplianceConclusionTab';
import ComplianceSummaryTab from './patterns/compliance/ComplianceSummaryTab';
import InternalAuditScopeTab from './patterns/internal-audit/InternalAuditScopeTab';
import InternalAuditAnnouncementTab from './patterns/internal-audit/InternalAuditAnnouncementTab';
import InternalAuditRequestsIDRTab from './patterns/internal-audit/InternalAuditRequestsIDRTab';
import InternalAuditAnalysisTab from './patterns/internal-audit/InternalAuditAnalysisTab';
import InternalAuditObservationsTab from './patterns/internal-audit/InternalAuditObservationsTab';
import InternalAuditDiscussionTab from './patterns/internal-audit/InternalAuditDiscussionTab';
import InternalAuditWorkingPaperTab from './patterns/internal-audit/InternalAuditWorkingPaperTab';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
  complianceState?: ComplianceWorkspaceState;
  onCreateRequest?: (req: PBCRequest) => void;
  onUpdateRequestStatus?: (id: string, status: PBCRequestStatus) => void;
  onAddBatch?: (batch: SampleBatch) => void;
  onAddEvidence?: (ev: EvidenceItem) => void;
  onUpdateAttributeTesting?: (state: AttributeTestingState) => void;
  onUpdateReview?: (state: ComplianceReviewState) => void;
  onUpdateConclusion?: (state: ComplianceConclusionState) => void;
  iaState?: InternalAuditWorkspaceState;
  onUpdateIAScope?: (scope: InternalAuditScopeState) => void;
  onUpdateIAAnnouncement?: (ann: InternalAuditAnnouncementState) => void;
  onUpdateIARequests?: (state: InternalAuditRequestState) => void;
  onUpdateIAAnalysis?: (state: InternalAuditAnalysisState) => void;
  onUpdateIAObservations?: (state: InternalAuditObservationsState) => void;
  onUpdateIADiscussion?: (state: InternalAuditDiscussionState) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel, complianceState, onCreateRequest, onUpdateRequestStatus, onAddBatch, onAddEvidence, onUpdateAttributeTesting, onUpdateReview, onUpdateConclusion, iaState, onUpdateIAScope, onUpdateIAAnnouncement, onUpdateIARequests, onUpdateIAAnalysis, onUpdateIAObservations, onUpdateIADiscussion, onNavigateTab }: Props) {
  if (activeTabId === 'overview') {
    return <WorkspaceOverview engagement={engagement} />;
  }

  if (engagement.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    if (activeTabId === 'control-scope') {
      return <ComplianceControlScopeTab engagement={engagement} />;
    }
    if (activeTabId === 'requests' && complianceState && onCreateRequest && onUpdateRequestStatus) {
      return (
        <ComplianceRequestsPBCTab
          engagement={engagement}
          requests={complianceState.requests}
          onCreateRequest={onCreateRequest}
          onUpdateRequestStatus={onUpdateRequestStatus}
        />
      );
    }
    if (activeTabId === 'summary' && complianceState) {
      return (
        <ComplianceSummaryTab
          engagement={engagement}
          complianceState={complianceState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'conclusion' && complianceState && onUpdateConclusion) {
      return (
        <ComplianceConclusionTab
          engagement={engagement}
          complianceState={complianceState}
          onUpdateConclusion={onUpdateConclusion}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'review' && complianceState && onUpdateReview) {
      return (
        <ComplianceReviewTab
          engagement={engagement}
          complianceState={complianceState}
          onUpdateReview={onUpdateReview}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'working-paper' && complianceState) {
      return (
        <ComplianceWorkingPaperTab
          engagement={engagement}
          complianceState={complianceState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'attr-testing' && complianceState && onUpdateAttributeTesting) {
      return (
        <ComplianceAttributeTestingTab
          engagement={engagement}
          samplesEvidence={complianceState.samplesEvidence}
          attributeTesting={complianceState.attributeTesting}
          onUpdateAttributeTesting={onUpdateAttributeTesting}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'samples-evidence' && complianceState && onAddBatch && onAddEvidence) {
      return (
        <ComplianceSamplesEvidenceTab
          engagement={engagement}
          samplesEvidence={complianceState.samplesEvidence}
          pbcRequests={complianceState.requests}
          onAddBatch={onAddBatch}
          onAddEvidence={onAddEvidence}
          onNavigateTab={onNavigateTab}
        />
      );
    }
  }

  // Internal Audit-specific tabs
  if (engagement.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT) {
    if (activeTabId === 'scope' && iaState && onUpdateIAScope) {
      return (
        <InternalAuditScopeTab
          engagement={engagement}
          scope={iaState.scope}
          onUpdateScope={onUpdateIAScope}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'announcement' && iaState && onUpdateIAAnnouncement) {
      return (
        <InternalAuditAnnouncementTab
          engagement={engagement}
          scope={iaState.scope}
          announcement={iaState.announcement}
          onUpdateAnnouncement={onUpdateIAAnnouncement}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'requests-idr' && iaState && onUpdateIARequests) {
      return (
        <InternalAuditRequestsIDRTab
          engagement={engagement}
          scope={iaState.scope}
          requestState={iaState.requests}
          onUpdateRequestState={onUpdateIARequests}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'analysis' && iaState && onUpdateIAAnalysis) {
      return (
        <InternalAuditAnalysisTab
          engagement={engagement}
          scope={iaState.scope}
          requestState={iaState.requests}
          analysisState={iaState.analysis}
          onUpdateAnalysis={onUpdateIAAnalysis}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'observations' && iaState && onUpdateIAObservations) {
      return (
        <InternalAuditObservationsTab
          engagement={engagement}
          analysisState={iaState.analysis}
          observationsState={iaState.observations}
          onUpdateObservations={onUpdateIAObservations}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'discussion' && iaState && onUpdateIADiscussion) {
      return (
        <InternalAuditDiscussionTab
          engagement={engagement}
          observationsState={iaState.observations}
          discussionState={iaState.discussion}
          onUpdateDiscussion={onUpdateIADiscussion}
          onNavigateTab={onNavigateTab}
        />
      );
    }
    if (activeTabId === 'working-paper' && iaState) {
      return (
        <InternalAuditWorkingPaperTab
          engagement={engagement}
          iaState={iaState}
          onNavigateTab={onNavigateTab}
        />
      );
    }
  }

  return (
    <PatternPlaceholderTab
      tabId={activeTabId}
      tabLabel={activeTabLabel}
      patternType={engagement.patternType}
    />
  );
}
