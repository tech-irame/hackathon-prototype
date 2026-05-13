// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import type { ComplianceWorkspaceState, PBCRequest, PBCRequestStatus } from './patterns/compliance/complianceRequestsData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import type { AttributeTestingState } from './patterns/compliance/complianceAttributeTestingData';
import type { ComplianceReviewState } from './patterns/compliance/complianceReviewData';
import type { ComplianceConclusionState } from './patterns/compliance/complianceConclusionData';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';
import ComplianceRequestsPBCTab from './patterns/compliance/ComplianceRequestsPBCTab';
import ComplianceSamplesEvidenceTab from './patterns/compliance/ComplianceSamplesEvidenceTab';
import ComplianceAttributeTestingTab from './patterns/compliance/ComplianceAttributeTestingTab';
import ComplianceWorkingPaperTab from './patterns/compliance/ComplianceWorkingPaperTab';
import ComplianceReviewTab from './patterns/compliance/ComplianceReviewTab';
import ComplianceConclusionTab from './patterns/compliance/ComplianceConclusionTab';
import ComplianceSummaryTab from './patterns/compliance/ComplianceSummaryTab';

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
  onNavigateTab?: (tabId: string) => void;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel, complianceState, onCreateRequest, onUpdateRequestStatus, onAddBatch, onAddEvidence, onUpdateAttributeTesting, onUpdateReview, onUpdateConclusion, onNavigateTab }: Props) {
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

  return (
    <PatternPlaceholderTab
      tabId={activeTabId}
      tabLabel={activeTabLabel}
      patternType={engagement.patternType}
    />
  );
}
