import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';

export interface Organisation {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role?: string;
}

export function useOrganisation() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: memberships } = await supabase
        .from('organisation_members')
        .select('role, organisations(id, name, slug, plan)')
        .eq('user_id', user.id);
      const orgList: Organisation[] = (memberships || []).map((m: any) => ({ ...m.organisations, role: m.role }));
      setOrgs(orgList);
      const savedOrgId = localStorage.getItem('vdq_current_org');
      const saved = orgList.find(o => o.id.toString() === savedOrgId);
      setCurrentOrg(saved || orgList[0] || null);
    } catch(e) { console.error('[useOrganisation]', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const createOrg = useCallback(async (name: string): Promise<Organisation | null> => {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Date.now().toString(36);
    const { data: org, error } = await supabase.from('organisations').insert({ name, slug, owner_id: user.id, plan: 'free' }).select().single();
    if (error || !org) { console.error('[createOrg]', error); return null; }
    await supabase.from('organisation_members').insert({ organisation_id: org.id, user_id: user.id, role: 'owner' });
    await fetchOrgs();
    return { ...org, role: 'owner' };
  }, [fetchOrgs]);

  const switchOrg = useCallback((org: Organisation) => {
    setCurrentOrg(org);
    localStorage.setItem('vdq_current_org', org.id.toString());
  }, []);

  return { orgs, currentOrg, loading, createOrg, switchOrg, refetch: fetchOrgs };
}
