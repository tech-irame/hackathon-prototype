/**
 * RACM (Risk and Control Matrix) seed for the Compliance / Internal Audit
 * engagement detail pages.
 *
 * Each `RACMRow` is a single risk-to-control mapping with sub-controls
 * (called "attributes" or "plan steps") and SOX assertion metadata.
 *
 * Seeded for P2P sub-processes — the demo Compliance engagements (ENG-001,
 * ENG-005) primarily test P2P controls. ITGC, O2C, R2R rows can be added in
 * follow-ups without touching consumer code.
 */

import type { ProcessCode } from './engagements';

export type SoxAssertion =
  | 'Completeness'
  | 'Accuracy'
  | 'Existence'
  | 'Cutoff'
  | 'Valuation'
  | 'Rights & Obligations'
  | 'Presentation';

export type Frequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual' | 'Event-driven';
export type ControlType = 'Preventive' | 'Detective';
export type Automation = 'Manual' | 'IT-dependent' | 'Automated';

export interface ControlAttribute {
  id: string;
  description: string;
  testProcedure: string;
}

export interface RACMRow {
  id: string;
  process: ProcessCode;
  subProcess: string;

  riskId: string;
  riskDescription: string;

  controlId: string;
  controlDescription: string;
  attributes: ControlAttribute[];

  assertion: SoxAssertion;
  frequency: Frequency;
  controlType: ControlType;
  automation: Automation;
  isKey: boolean;
}

export const RACM_LIBRARY: RACMRow[] = [
  // ─── P2P · Vendor Onboarding ──────────────────────────────────────────────
  {
    id: 'racm-1', process: 'P2P', subProcess: 'Vendor Onboarding',
    riskId: 'RSK-VO-01', riskDescription: 'Vendor onboarded without KYC / due diligence — fictitious vendor risk',
    controlId: 'P2P-C-01', controlDescription: 'Vendor master add/change requires dual approval with KYC pack attached',
    attributes: [
      { id: 'P2P-C-01.1', description: 'KYC documents collected (PAN, GST, bank cancelled cheque)', testProcedure: 'Inspect KYC pack in vendor master record for completeness.' },
      { id: 'P2P-C-01.2', description: 'Dual approval recorded in ERP audit log',                       testProcedure: 'Sample 25 new vendors; verify two distinct approvers in ERP log.' },
      { id: 'P2P-C-01.3', description: 'Vendor screened against sanctions list',                        testProcedure: 'Run vendor list against sanctions DB; verify timestamp ≤ 24h before activation.' },
    ],
    assertion: 'Existence', frequency: 'Event-driven', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },
  {
    id: 'racm-2', process: 'P2P', subProcess: 'Vendor Onboarding',
    riskId: 'RSK-VO-02', riskDescription: 'Vendor master changes made without authorization',
    controlId: 'P2P-C-02', controlDescription: 'Vendor master change log reviewed monthly; unauthorized changes investigated',
    attributes: [
      { id: 'P2P-C-02.1', description: 'Monthly change-log report generated from ERP',     testProcedure: 'Inspect report timestamps for past 12 months — confirm monthly cadence.' },
      { id: 'P2P-C-02.2', description: 'Review evidence (sign-off) by AP Lead',             testProcedure: 'Sample 3 months; verify reviewer sign-off captured.' },
    ],
    assertion: 'Accuracy', frequency: 'Monthly', controlType: 'Detective', automation: 'Manual', isKey: false,
  },

  // ─── P2P · Purchase Order Management ──────────────────────────────────────
  {
    id: 'racm-3', process: 'P2P', subProcess: 'Purchase Order Management',
    riskId: 'RSK-PO-01', riskDescription: 'Unauthorized purchases above approval threshold',
    controlId: 'P2P-C-03', controlDescription: 'PO approval threshold enforced by amount tier (DOA matrix)',
    attributes: [
      { id: 'P2P-C-03.1', description: 'DOA matrix configured in ERP per latest policy version',   testProcedure: 'Inspect ERP configuration vs current DOA policy — match approvers to amount tiers.' },
      { id: 'P2P-C-03.2', description: 'Threshold-override events require justification + 2-up approval', testProcedure: 'Sample all overrides; verify justification text + escalation approver.' },
      { id: 'P2P-C-03.3', description: 'POs > ₹10L require CFO approval',                          testProcedure: 'Sample 15 POs > ₹10L; verify CFO approval in workflow.' },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-4', process: 'P2P', subProcess: 'Purchase Order Management',
    riskId: 'RSK-PO-02', riskDescription: 'PO created and approved by the same user (SoD violation)',
    controlId: 'P2P-C-04', controlDescription: 'Segregation of duties — PO creator cannot approve own PO',
    attributes: [
      { id: 'P2P-C-04.1', description: 'ERP role configuration prevents create + approve by same user', testProcedure: 'Inspect role-permission matrix; attempt to approve self-created PO — must fail.' },
      { id: 'P2P-C-04.2', description: 'Quarterly SoD review by IT Audit',                              testProcedure: 'Inspect Q1-Q4 review reports + sign-off.' },
    ],
    assertion: 'Rights & Obligations', frequency: 'Quarterly', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },

  // ─── P2P · Goods Receipt ─────────────────────────────────────────────────
  {
    id: 'racm-5', process: 'P2P', subProcess: 'Goods Receipt',
    riskId: 'RSK-GR-01', riskDescription: 'GRN raised without physical receipt verification',
    controlId: 'P2P-C-05', controlDescription: 'GRN requires warehouse + receiver signatures with timestamp',
    attributes: [
      { id: 'P2P-C-05.1', description: 'GRN form captures both signatures',          testProcedure: 'Sample 25 GRNs; inspect for two signatures + receipt timestamp.' },
      { id: 'P2P-C-05.2', description: 'Quantity received matches PO within tolerance', testProcedure: 'Compare GRN qty to PO qty; verify within ±2% tolerance.' },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Manual', isKey: false,
  },

  // ─── P2P · Invoice Processing ─────────────────────────────────────────────
  {
    id: 'racm-6', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-01', riskDescription: 'Invoice posted without matching PO and GRN — three-way match bypass',
    controlId: 'P2P-C-06', controlDescription: 'Three-way match enforced (PO · GRN · Invoice) before AP posting',
    attributes: [
      { id: 'P2P-C-06.1', description: 'Invoice qty ≤ GRN qty AND GRN qty ≤ PO qty',                  testProcedure: 'Sample 50 invoices; recompute the three-way match — must pass for all.' },
      { id: 'P2P-C-06.2', description: 'Unit price on invoice matches PO unit price (within tolerance)', testProcedure: 'Sample 50 invoices; verify unit-price tolerance ≤ 2%.' },
      { id: 'P2P-C-06.3', description: 'Tolerance break requires AP Manager approval',                testProcedure: 'Inspect all tolerance-breaks for the period; verify AP Manager approval.' },
    ],
    assertion: 'Completeness', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-7', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-02', riskDescription: 'Duplicate invoice posted from same vendor',
    controlId: 'P2P-C-07', controlDescription: 'Duplicate-invoice detection on PAN + invoice-number + amount + date',
    attributes: [
      { id: 'P2P-C-07.1', description: 'ERP duplicate-check rule active (PAN + invoice number)', testProcedure: 'Inspect ERP rule config; attempt duplicate posting — must block.' },
      { id: 'P2P-C-07.2', description: 'Fuzzy match catches near-duplicates (amount ± 1%)',     testProcedure: 'Inspect detection threshold + last 90 days of detections.' },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Automated', isKey: true,
  },
  {
    id: 'racm-8', process: 'P2P', subProcess: 'Invoice Processing',
    riskId: 'RSK-IP-03', riskDescription: 'Invoice amount tampered after approval',
    controlId: 'P2P-C-08', controlDescription: 'Post-approval edits to invoice fields trigger re-approval workflow',
    attributes: [
      { id: 'P2P-C-08.1', description: 'ERP locks amount/vendor/date fields after approval', testProcedure: 'Attempt edit of approved invoice; system must require re-approval.' },
      { id: 'P2P-C-08.2', description: 'Audit log captures all post-approval edits',         testProcedure: 'Inspect audit log for 60 days; spot-check 10 entries.' },
    ],
    assertion: 'Accuracy', frequency: 'Daily', controlType: 'Detective', automation: 'IT-dependent', isKey: false,
  },

  // ─── P2P · Payment Release ────────────────────────────────────────────────
  {
    id: 'racm-9', process: 'P2P', subProcess: 'Payment Release',
    riskId: 'RSK-PR-01', riskDescription: 'Payment released without dual sign-off above threshold',
    controlId: 'P2P-C-09', controlDescription: 'Payments > ₹10L require dual sign-off (Treasury + CFO)',
    attributes: [
      { id: 'P2P-C-09.1', description: 'Treasury sign-off recorded in payment-run log',  testProcedure: 'Sample all > ₹10L payments; verify Treasury sign-off in log.' },
      { id: 'P2P-C-09.2', description: 'CFO sign-off recorded in payment-run log',       testProcedure: 'Same sample — verify CFO sign-off.' },
      { id: 'P2P-C-09.3', description: 'Payment-run report reviewed weekly by Controller', testProcedure: 'Inspect weekly review evidence for the engagement period.' },
    ],
    assertion: 'Existence', frequency: 'Daily', controlType: 'Preventive', automation: 'Manual', isKey: true,
  },
  {
    id: 'racm-10', process: 'P2P', subProcess: 'Payment Release',
    riskId: 'RSK-PR-02', riskDescription: 'Payment made to unauthorized bank account',
    controlId: 'P2P-C-10', controlDescription: 'Vendor bank account on file matches payment instruction; changes require dual approval',
    attributes: [
      { id: 'P2P-C-10.1', description: 'Bank-account match validation in payment run',         testProcedure: 'Sample 30 payments; verify bank account on payment matches vendor master.' },
      { id: 'P2P-C-10.2', description: 'Bank-account change events require dual approval log', testProcedure: 'Inspect all bank-account change events; verify dual approval.' },
    ],
    assertion: 'Rights & Obligations', frequency: 'Daily', controlType: 'Preventive', automation: 'IT-dependent', isKey: true,
  },
];

/** All RACM rows that belong to a given process. */
export function racmRowsForProcess(process: ProcessCode): RACMRow[] {
  return RACM_LIBRARY.filter(r => r.process === process);
}

/** Group RACM rows by sub-process — returns ordered groups for rendering. */
export function groupRacmBySubProcess(rows: RACMRow[]): { subProcess: string; rows: RACMRow[] }[] {
  const map = new Map<string, RACMRow[]>();
  rows.forEach(r => {
    const arr = map.get(r.subProcess) ?? [];
    arr.push(r);
    map.set(r.subProcess, arr);
  });
  return Array.from(map.entries()).map(([subProcess, rows]) => ({ subProcess, rows }));
}

/** Available RACM versions per process for the version dropdown. */
export const RACM_VERSIONS: { id: string; label: string; locked: boolean; lockedAt?: string }[] = [
  { id: 'v2.1', label: 'v2.1 — Current (Feb 2026)', locked: true,  lockedAt: 'Feb 12, 2026' },
  { id: 'v2.0', label: 'v2.0 — Nov 2025',           locked: true,  lockedAt: 'Nov 14, 2025' },
  { id: 'v1.9', label: 'v1.9 — Aug 2025',           locked: true,  lockedAt: 'Aug 30, 2025' },
];
