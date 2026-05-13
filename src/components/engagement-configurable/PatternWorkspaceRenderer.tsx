// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────
// Routes the active tab to the correct component based on pattern type.
// Overview renders a real component. Pattern-specific tabs render real
// components as they are built; all others fall back to placeholders.

import React from 'react';
import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { EngagementPatternType } from './configurableEngagementTypes';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';
import ComplianceControlScopeTab from './patterns/compliance/ComplianceControlScopeTab';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel }: Props) {
  // Common overview tab
  if (activeTabId === 'overview') {
    return <WorkspaceOverview engagement={engagement} />;
  }

  // Compliance-specific tabs
  if (engagement.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING) {
    if (activeTabId === 'control-scope') {
      return <ComplianceControlScopeTab engagement={engagement} />;
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
