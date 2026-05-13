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
        onNavigateTab={setActiveTabId}
      />
    </div>
  );
}
