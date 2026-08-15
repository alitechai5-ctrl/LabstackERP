'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type COA = { id: string; code: string; name: string; type: string; parent_id: string | null; is_active: boolean };

export default function AccountingCOAPage() {
  const supabase = getSupabaseClient();
  const [accounts, setAccounts] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('chart_of_accounts').select('*').order('code');
    if (error) toast.error('Failed to load: ' + error.message);
    else setAccounts((data as COA[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  const columns: Column<COA>[] = [
    { key: 'code', label: 'Code', render: (a) => <span className="font-mono text-sm">{a.code}</span> },
    { key: 'name', label: 'Account Name' },
    { key: 'type', label: 'Type', render: (a) => <Badge variant="secondary">{a.type}</Badge> },
    { key: 'is_active', label: 'Status', render: (a) => <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Active' : 'Inactive'}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Chart of Accounts</h1><p className="text-muted-foreground">View and manage chart of accounts</p></div>
      <DataTable columns={columns} data={filtered} loading={loading} search={search} searchPlaceholder="Search accounts..." onSearchChange={setSearch} />
    </div>
  );
}
