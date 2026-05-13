// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import type { ComplianceWorkspaceState, PBCRequest, PBCRequestStatus } from './patterns/compliance/complianceRequestsData';
import type { SampleBatch, EvidenceItem } from './patterns/compliance/complianceSamplesEvidenceData';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';
import ComplianceRequestsPBCTab from './patterns/compliance/ComplianceRequestsPBCTab';
import ComplianceSamplesEvidenceTab from './patterns/compliance/ComplianceSamplesEvidenceTab';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
  complianceState?: ComplianceWorkspaceState;
  onCreateRequest?: (req: PBCRequest) => void;
  onUpdateRequestStatus?: (id: string, status: PBCRequestStatus) => void;
  onAddBatch?: (batch: SampleBatch) => void;
  onAddEvidence?: (ev: EvidenceItem) => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel, complianceState, onCreateRequest, onUpdateRequestStatus, onAddBatch, onAddEvidence, onNavigateTab }: Props) {
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
