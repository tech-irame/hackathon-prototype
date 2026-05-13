// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────
// Routes the active tab to the correct component based on pattern type.

import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import type { ComplianceWorkspaceState, PBCRequest, PBCRequestStatus } from './patterns/compliance/complianceRequestsData';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';
import ComplianceRequestsPBCTab from './patterns/compliance/ComplianceRequestsPBCTab';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
  complianceState?: ComplianceWorkspaceState;
  onCreateRequest?: (req: PBCRequest) => void;
  onUpdateRequestStatus?: (id: string, status: PBCRequestStatus) => void;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel, complianceState, onCreateRequest, onUpdateRequestStatus }: Props) {
  // Common overview tab
  if (activeTabId === 'overview') {
    return <WorkspaceOverview engagement={engagement} />;
  }

  // Compliance-specific tabs
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
  }

  // Fallback placeholder
  return (
    <PatternPlaceholderTab
      tabId={activeTabId}
      tabLabel={activeTabLabel}
      patternType={engagement.patternType}
    />
  );
}
