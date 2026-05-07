import { useState } from 'react';
import { DS } from '@/constants';
import { useOrganisation } from '@/hooks/useOrganisation';
import { Building2, Plus, ChevronDown, Check } from 'lucide-react';

export function OrgSwitcher() {
  const { orgs, currentOrg, createOrg, switchOrg } = useOrganisation();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  if (!currentOrg && orgs.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors"
        style={{ background: open ? DS.information.soft : DS.bg, border: '1px solid ' + DS.borderLight, color: DS.ink }}>
        <Building2 size={11} style={{ color: DS.information.fill }} />
        <span className="font-medium max-w-24 truncate">{currentOrg?.name || 'Personal'}</span>
        <ChevronDown size={10} style={{ color: DS.inkDis }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-9 left-0 z-50 rounded-xl shadow-xl border min-w-52" style={{ background: DS.canvas, borderColor: DS.borderLight }}>
            <div className="px-3 py-2 border-b" style={{ borderColor: DS.borderLight }}>
              <span className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Workspace</span>
            </div>
            <div className="p-1.5 space-y-0.5">
              {orgs.map(org => (
                <button key={org.id} onClick={() => { switchOrg(org); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left"
                  style={{ background: currentOrg?.id === org.id ? DS.information.soft : 'transparent', color: DS.ink }}>
                  <Building2 size={11} style={{ color: DS.information.fill }} />
                  <span className="flex-1 font-medium">{org.name}</span>
                  {currentOrg?.id === org.id && <Check size={10} style={{ color: DS.information.fill }} />}
                  <span className="text-[9px] capitalize" style={{ color: DS.inkDis }}>{org.role}</span>
                </button>
              ))}
            </div>
            <div className="border-t p-1.5" style={{ borderColor: DS.borderLight }}>
              {creating ? (
                <div className="flex gap-1 px-1">
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="Organisation name" className="flex-1 text-xs px-2 py-1 rounded-lg border outline-none"
                    style={{ borderColor: DS.borderLight, background: DS.bg }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newName.trim()) {
                        await createOrg(newName.trim());
                        setCreating(false); setNewName(''); setOpen(false);
                      }
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                    }} />
                  <button onClick={() => { setCreating(false); setNewName(''); }}
                    className="text-xs px-2 py-1 rounded" style={{ color: DS.inkDis }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs"
                  style={{ color: DS.information.fill }}>
                  <Plus size={11} /> New Organisation
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
