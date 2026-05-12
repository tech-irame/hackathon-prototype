// ─── Configurable Engagement V3 — Pattern Workspace Renderer ──────────────
// Routes the active tab to the correct component based on pattern type.
// Overview renders a real component; all other tabs are placeholders for now.

import React from 'react';
import type { ConfigurableEngagement } from './configurableEngagementTypes';
import { WorkspaceOverview, PatternPlaceholderTab } from './components';

interface Props {
  engagement: ConfigurableEngagement;
  activeTabId: string;
  activeTabLabel: string;
}

export default function PatternWorkspaceRenderer({ engagement, activeTabId, activeTabLabel }: Props) {
  if (activeTabId === 'overview') {
    return <WorkspaceOverview engagement={engagement} />;
  }

  return (
    <PatternPlaceholderTab
      tabId={activeTabId}
      tabLabel={activeTabLabel}
      patternType={engagement.patternType}
    />
  );
}
