import { DS } from '@/constants';

interface TrustResult {
  level: string; color: string; label: string; reason: string;
}

export function DQTrustBadge({ trust, meta }: { trust: TrustResult | null; meta?: any }) {
  if (!trust) return null;
  return (
    <div className="flex flex-wrap items-start gap-2 p-3 rounded-xl" style={{ background: trust.color + '10', border: `1px solid ${trust.color}25` }}>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ background: trust.color }} />
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: trust.color }}>{trust.label}</span>
      </div>
      <span className="text-[10px]" style={{ color: DS.inkSub }}>{trust.reason}</span>
      {meta?.dqWarnings?.length > 0 && (
        <div className="w-full mt-1 space-y-0.5">
          {meta.dqWarnings.slice(0,3).map((w: string, i: number) => (
            <div key={i} className="text-[9px] flex items-start gap-1" style={{ color: DS.warning }}>
              <span>⚠</span><span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {meta?.assumptionsMade?.length > 0 && (
        <div className="w-full mt-1">
          <span className="text-[9px] font-bold" style={{ color: DS.inkDis }}>ASSUMPTIONS: </span>
          <span className="text-[9px]" style={{ color: DS.inkDis }}>{meta.assumptionsMade.slice(0,2).join(' · ')}</span>
        </div>
      )}
      <div className="w-full mt-1 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: DS.information.fill }} />
        <span className="text-[9px] font-bold" style={{ color: DS.information.fill }}>DQ GOVERNED</span>
        <span className="text-[9px]" style={{ color: DS.inkDis }}>· Frame · Alternatives · Information · Values · Reasoning · Commitment</span>
      </div>
    </div>
  );
}
