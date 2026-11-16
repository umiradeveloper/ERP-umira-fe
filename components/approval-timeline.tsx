'use client';

import { Check, CornerUpLeft, X } from 'lucide-react';
import { Badge, Panel } from './ui';
import { useApi } from '@/lib/api';
import { dateTime, rupiahShort } from '@/lib/format';

const ICON: Record<string, any> = { APPROVE: Check, REJECT: X, REVISION: CornerUpLeft };
const VERB: Record<string, string> = { APPROVE: 'menyetujui', REJECT: 'menolak', REVISION: 'meminta revisi' };

export function ApprovalTimeline({ entityType, entityId, refreshKey }: { entityType: string; entityId: string; refreshKey?: unknown }) {
  const { data } = useApi<any[]>(`/approvals/history/${entityType}/${entityId}?k=${String(refreshKey ?? '')}`);
  return (
    <Panel title="Riwayat approval">
      {!data?.length ? (
        <p className="text-sm text-muted">Belum diajukan untuk approval.</p>
      ) : (
        <div className="space-y-6">
          {data.map((r) => {
            const steps = r.stepsSnapshot as any[];
            return (
              <div key={r.id}>
                <div className="mb-3 flex items-center justify-between text-xs text-muted">
                  <span>Diajukan {r.requestedByName} — {dateTime(r.createdAt)}</span>
                  <Badge status={r.status} />
                </div>
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {steps.length === 0 && <li className="text-sm text-muted">Disetujui otomatis (nilai {rupiahShort(r.amount)} di bawah batas approval)</li>}
                  {steps.map((s) => {
                    const d = r.decisions.find((x: any) => x.step === s.step);
                    const current = r.status === 'IN_APPROVAL' && r.currentStep === s.step;
                    const Icon = d ? ICON[d.decision] : null;
                    return (
                      <li key={s.step} className="relative">
                        <span
                          className={`absolute -left-[27px] top-0.5 grid size-3.5 place-items-center rounded-full ring-4 ring-surface ${
                            d?.decision === 'APPROVE' ? 'bg-ok' : d ? 'bg-bad' : current ? 'bg-signal' : 'bg-line-strong'
                          }`}
                        >
                          {Icon && <Icon className="size-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <div className="text-sm">
                          <span className="font-medium">{s.roleName}</span>
                          {d ? (
                            <span className="text-muted"> — {d.approverName} {VERB[d.decision]}</span>
                          ) : current ? (
                            <span className="text-warn"> — menunggu keputusan</span>
                          ) : (
                            <span className="text-faint"> — menunggu langkah sebelumnya</span>
                          )}
                        </div>
                        {d?.comment && <p className="mt-1 rounded-md bg-canvas px-2.5 py-1.5 text-[13px] text-ink-2">“{d.comment}”</p>}
                        {d && <p className="mt-0.5 text-xs text-faint">{dateTime(d.decidedAt)}</p>}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-xs text-faint">Workflow versi {r.workflowVersion}</p>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
