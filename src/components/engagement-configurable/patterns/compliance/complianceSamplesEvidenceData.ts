// ─── Compliance Samples & Evidence — Types & Mock Data ────────────────────

export type EvidenceSource = 'USER_UPLOADED' | 'RECEIVED_FROM_PBC' | 'SYSTEM_GENERATED';
export type EvidenceStatus = 'ATTACHED' | 'NEEDS_MAPPING' | 'MISSING';
export type TestItemEvidenceStatus = 'Missing' | 'Partial' | 'Ready';

export interface TestItem {
  id: string;
  referenceId: string;
  description: string;
  linkedControlId: string;
  sourceRow: number | null;
  evidenceStatus: TestItemEvidenceStatus;
  mappedAttrCount: number;
  totalAttrCount: number;
}

export interface SampleBatch {
  id: string;
  name: string;
  inputMethod: string;
  sourceName: string;
  uploadedAt: string;
  status: 'Uploaded' | 'Generated' | 'Processing';
  sampleCount: number;
  linkedControlIds: string[];
  testItems: TestItem[];
}

export interface EvidenceItem {
  id: string;
  fileName: string;
  evidenceType: string;
  linkedControlId: string;
  linkedAttributeIds: string[];
  linkedTestItemIds: string[];
  uploadedBy: string;
  uploadedAt: string;
  source: EvidenceSource;
  status: EvidenceStatus;
}

export interface SamplesEvidenceState {
  batches: SampleBatch[];
  evidence: EvidenceItem[];
}

export const EVIDENCE_TYPES = [
  'Invoice Copy', 'PO Copy', 'GRN Copy', 'Approval Log', 'Budget File',
  'Historical Spend Report', 'Project Plan', 'System Report', 'Exception Report',
  'Workflow Run Log', 'Override Approval', 'Other',
];

// ─── Mock Data Generators ─────────────────────────────────────────────────

export function createUploadSamplesBatch(): SampleBatch {
  return {
    id: `batch-${Date.now()}`, name: 'Uploaded Invoice Samples',
    inputMethod: 'Upload Selected Samples', sourceName: 'invoice_samples_fy26_q1.xlsx',
    uploadedAt: new Date().toISOString().slice(0, 10), status: 'Uploaded', sampleCount: 5,
    linkedControlIds: ['C001', 'C002'],
    testItems: [
      { id: 'ti-001', referenceId: 'INV-1001', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 1, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-002', referenceId: 'INV-1002', description: 'Vendor B — Invoice', linkedControlId: 'C001', sourceRow: 2, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-003', referenceId: 'INV-1003', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 3, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-004', referenceId: 'INV-1004', description: 'Vendor C — Invoice', linkedControlId: 'C002', sourceRow: 4, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-005', referenceId: 'INV-1005', description: 'Vendor D — Invoice', linkedControlId: 'C002', sourceRow: 5, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
    ],
  };
}

export function createPopulationBatch(): SampleBatch {
  return {
    id: `batch-${Date.now()}`, name: 'Sampled from Invoice Population',
    inputMethod: 'Generate Samples from Population', sourceName: 'invoice_population_fy26_q1.xlsx (10,000 records → 5 sampled)',
    uploadedAt: new Date().toISOString().slice(0, 10), status: 'Generated', sampleCount: 5,
    linkedControlIds: ['C001', 'C002'],
    testItems: [
      { id: 'ti-001', referenceId: 'INV-1001', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 142, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-002', referenceId: 'INV-1002', description: 'Vendor B — Invoice', linkedControlId: 'C001', sourceRow: 891, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-003', referenceId: 'INV-1003', description: 'Vendor A — Invoice', linkedControlId: 'C001', sourceRow: 2204, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
      { id: 'ti-004', referenceId: 'INV-1004', description: 'Vendor C — Invoice', linkedControlId: 'C002', sourceRow: 5670, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-005', referenceId: 'INV-1005', description: 'Vendor D — Invoice', linkedControlId: 'C002', sourceRow: 8320, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
    ],
  };
}

export function createFullPopulationBatch(): SampleBatch {
  const items: TestItem[] = [];
  for (let i = 1; i <= 5; i++) {
    items.push({ id: `ti-${String(i).padStart(3, '0')}`, referenceId: `TXN-${String(i).padStart(4, '0')}`, description: `Transaction record ${i}`, linkedControlId: i <= 3 ? 'C001' : 'C002', sourceRow: i, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: i <= 3 ? 4 : 3 });
  }
  return {
    id: `batch-${Date.now()}`, name: 'Full Invoice Population',
    inputMethod: 'Test Full Population', sourceName: 'invoice_population_fy26_q1.xlsx (100 records)',
    uploadedAt: new Date().toISOString().slice(0, 10), status: 'Uploaded', sampleCount: 100,
    linkedControlIds: ['C001', 'C002'], testItems: items,
  };
}

export function createDocumentBasedBatch(): SampleBatch {
  return {
    id: `batch-${Date.now()}`, name: 'Uploaded Document Test Items',
    inputMethod: 'Document-Based Testing', sourceName: '5 documents uploaded',
    uploadedAt: new Date().toISOString().slice(0, 10), status: 'Uploaded', sampleCount: 5,
    linkedControlIds: ['C003'],
    testItems: [
      { id: 'ti-001', referenceId: 'DOC-001', description: 'Approval_Form_001.pdf', linkedControlId: 'C003', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-002', referenceId: 'DOC-002', description: 'Approval_Form_002.pdf', linkedControlId: 'C003', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-003', referenceId: 'DOC-003', description: 'Approval_Form_003.pdf', linkedControlId: 'C003', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-004', referenceId: 'DOC-004', description: 'Vendor_Change_001.pdf', linkedControlId: 'C003', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
      { id: 'ti-005', referenceId: 'DOC-005', description: 'Vendor_Change_002.pdf', linkedControlId: 'C003', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 3 },
    ],
  };
}

export function createWalkthroughBatch(): SampleBatch {
  return {
    id: `batch-${Date.now()}`, name: 'Design Effectiveness Review',
    inputMethod: 'No Sample-Based Testing', sourceName: 'Walkthrough / Design Review',
    uploadedAt: new Date().toISOString().slice(0, 10), status: 'Uploaded', sampleCount: 1,
    linkedControlIds: ['C001'],
    testItems: [
      { id: 'ti-001', referenceId: 'WT-001', description: 'Design Effectiveness Review — Control Walkthrough', linkedControlId: 'C001', sourceRow: null, evidenceStatus: 'Missing', mappedAttrCount: 0, totalAttrCount: 4 },
    ],
  };
}

export function deriveSamplesEvidenceSummary(state: SamplesEvidenceState) {
  const batchCount = state.batches.length;
  const testItemCount = state.batches.reduce((s, b) => s + b.testItems.length, 0);
  const evidenceCount = state.evidence.length;
  const mapped = state.evidence.filter(e => e.status === 'ATTACHED').length;
  const needsMapping = state.evidence.filter(e => e.status === 'NEEDS_MAPPING').length;
  const ready = batchCount > 0 && testItemCount > 0 && needsMapping === 0;
  return { batchCount, testItemCount, evidenceCount, mapped, needsMapping, ready };
}
