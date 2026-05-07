import { DS } from '@/constants';
import { validateModuleData, buildDataInventoryDisplay, MODULE_CONTRACTS } from '@/lib/dq-data-contracts';
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

interface Props {
  moduleId: string;
  data: any;
  onNavigate?: (moduleId: string) => void;
}

export function ModuleDataBanner({ moduleId, data, onNavigate }: Props) {
  const validation = validateModuleData(moduleId, data);
  const inventory = buildDataInventoryDisplay(data);
  const contract = MODULE_CONTRACTS[moduleId];

  if (!contract || contract.consumes.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {validation.missingRequired.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} style={{ color: '#EF4444' }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: '#EF4444' }}>Required data missing — AI results will be limited</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {validation.missingRequired.map((m, i) => (
              <button key={i} onClick={() => onNavigate?.(m.source)}
                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg"
                style={{ background: '#FEE2E2', color: '#EF4444' }}>
                Complete {m.moduleLabel} <ChevronRight size={8} />
              </button>
            ))}
          </div>
        </div>
      )}
      {validation.missingOptional.length > 0 && validation.missingRequired.length === 0 && (
        <div className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} style={{ color: '#D97706' }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: '#D97706' }}>Better results with more upstream data</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {validation.missingOptional.map((m, i) => (
              <button key={i} onClick={() => onNavigate?.(m.source)}
                className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg"
                style={{ background: '#FEF3C7', color: '#D97706' }}>
                Add {m.moduleLabel} <ChevronRight size={8} />
              </button>
            ))}
          </div>
        </div>
      )}
      {inventory.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: DS.bg, border: '1px solid ' + DS.borderLight }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={12} style={{ color: DS.success }} />
            <span className="text-[10px] font-bold uppercase" style={{ color: DS.inkDis }}>This module uses</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inventory.map((item, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: DS.successSoft, color: DS.success }}>{item}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
