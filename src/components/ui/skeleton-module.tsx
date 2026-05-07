import { DS } from '@/constants';

export function ModuleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-20 rounded mb-2" style={{ background: DS.borderLight }} />
          <div className="h-6 w-48 rounded" style={{ background: DS.borderLight }} />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-24 rounded-lg" style={{ background: DS.borderLight }} />
          <div className="h-7 w-24 rounded-lg" style={{ background: DS.borderLight }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-16 rounded-xl" style={{ background: DS.borderLight }} />
        ))}
      </div>
      <div className="space-y-2">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-14 rounded-xl" style={{ background: DS.borderLight }} />
        ))}
      </div>
    </div>
  );
}
