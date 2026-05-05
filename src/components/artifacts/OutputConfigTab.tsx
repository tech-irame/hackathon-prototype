// Ported from auditify-app commit aa19493 (Chat UI Fixes).
// Upstream depends on `UiAuditResult.kpis` flowing in from the QnA adapter;
// the prototype mocks responses, so the fixture here mirrors AUDIT_RESULT.kpis
// in ChatView.tsx — the same shape (label / value / color) the upstream uses.

interface KPI {
  label: string;
  value: string;
  color: string;
}

interface Props {
  kpis?: KPI[];
}

const DEFAULT_KPIS: KPI[] = [
  { label: 'Records scanned', value: '1.2M', color: 'text-ink-800' },
  { label: 'Duplicates found', value: '8', color: 'text-risk-700' },
  { label: 'Total amount', value: '₹6.16L', color: 'text-mitigated-700' },
  { label: 'Highest match', value: '96%', color: 'text-evidence-700' },
];

// Map a KPI's text-color class to an accent strip + tone label so each tile
// carries its semantic weight without painting the whole card.
type Tone = 'risk' | 'mitigated' | 'evidence' | 'compliant' | 'neutral';

function toneFromColor(cls: string): Tone {
  if (cls.includes('risk')) return 'risk';
  if (cls.includes('mitigated')) return 'mitigated';
  if (cls.includes('evidence')) return 'evidence';
  if (cls.includes('compliant')) return 'compliant';
  return 'neutral';
}

const ACCENT_BG: Record<Tone, string> = {
  risk: 'bg-risk',
  mitigated: 'bg-mitigated',
  evidence: 'bg-evidence',
  compliant: 'bg-compliant',
  neutral: 'bg-ink-300',
};

const TONE_LABEL: Record<Tone, string | null> = {
  risk: 'High risk',
  mitigated: 'Mitigated',
  evidence: 'High confidence',
  compliant: 'Compliant',
  neutral: null,
};

const TONE_LABEL_COLOR: Record<Tone, string> = {
  risk: 'text-risk-700',
  mitigated: 'text-mitigated-700',
  evidence: 'text-evidence-700',
  compliant: 'text-compliant-700',
  neutral: 'text-ink-500',
};

export default function OutputConfigTab({ kpis = DEFAULT_KPIS }: Props) {
  return (
    <div className="space-y-6 pt-4">
      <section>
        <header className="mb-4">
          <h3 className="text-[14px] font-semibold text-ink-800 leading-tight">Dashboard KPIs</h3>
          <p className="font-display italic text-[12.5px] text-ink-500 mt-0.5">
            From the latest audit run
          </p>
        </header>

        {kpis.length === 0 ? (
          <p className="text-[12.5px] text-ink-500">
            Run a query once to populate dashboard KPIs from the latest result.
          </p>
        ) : (
          <div
            className={`grid gap-3 ${
              kpis.length >= 4
                ? 'grid-cols-2'
                : kpis.length === 3
                  ? 'grid-cols-3'
                  : kpis.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
            }`}
          >
            {kpis.map((kpi, ki) => {
              const tone = toneFromColor(kpi.color);
              const toneLabel = TONE_LABEL[tone];
              return (
                <article
                  key={`${kpi.label}-${ki}`}
                  className="relative rounded-xl border border-canvas-border bg-white pl-5 pr-4 py-4 overflow-hidden"
                >
                  <div
                    aria-hidden="true"
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${ACCENT_BG[tone]}`}
                  />
                  <div
                    className={`font-display tabular-nums leading-none tracking-tight text-[30px] font-semibold ${kpi.color}`}
                  >
                    {kpi.value}
                  </div>
                  <div className="text-[12px] text-ink-500 mt-2 leading-tight">{kpi.label}</div>
                  {toneLabel && (
                    <div
                      className={`mt-3 inline-flex items-center text-[10px] font-medium uppercase tracking-wider ${TONE_LABEL_COLOR[tone]}`}
                    >
                      {toneLabel}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
