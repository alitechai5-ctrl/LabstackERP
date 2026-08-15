'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatDate } from '@/lib/utils/export';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type ReferralShareRow = {
  id: string;
  date: string;
  referral_name: string;
  source_type: string;
  order_code: string;
  patient_name: string;
  service_name: string;
  commission_type: string;
  commission_amount: number;
  calculation_basis: string;
  settled: boolean;
};

export default function ReferralShareDetailPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralShareRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [referrals, setReferrals] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: refData } = await supabase.from('referral_sources').select('id, name').eq('is_active', true).order('name');
      setReferrals((refData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'referral', label: 'Referral Source', type: 'select', options: referrals.map((r) => ({ label: r.name, value: r.id })) },
    { key: 'status', label: 'Settlement Status', type: 'select', options: [{ label: 'Settled', value: 'settled' }, { label: 'Pending', value: 'pending' }] },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('referral_settlements')
      .select('id, created_at, referral_source_id, lab_order_id, service_name, commission_type, commission_amount, calculation_basis, source_type, settled, referral_source:referral_sources(name, source_type)')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });
    if (filters.referral) q = q.eq('referral_source_id', filters.referral);
    if (filters.status === 'settled') q = q.eq('settled', true);
    if (filters.status === 'pending') q = q.eq('settled', false);
    const { data: settlements } = await q;

    const orderIds = Array.from(new Set((settlements as any[])?.map((s) => s.lab_order_id).filter(Boolean) || []));
    let orderMap: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase.from('lab_orders').select('id, order_code, patient:patients(full_name)').in('id', orderIds);
      for (const o of (orders as any[]) || []) orderMap[o.id] = o;
    }

    const rows: ReferralShareRow[] = ((settlements as any[]) || []).map((s) => {
      const o = s.lab_order_id ? orderMap[s.lab_order_id] : null;
      return {
        id: s.id,
        date: s.created_at,
        referral_name: s.referral_source?.name || 'Unknown',
        source_type: s.source_type || s.referral_source?.source_type || '-',
        order_code: o?.order_code || '-',
        patient_name: o?.patient?.full_name || '-',
        service_name: s.service_name || '-',
        commission_type: s.commission_type || '-',
        commission_amount: Number(s.commission_amount) || 0,
        calculation_basis: (s.calculation_basis || 'net_amount').replace(/_/g, ' '),
        settled: s.settled,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.referral_name.toLowerCase().includes(s) || r.patient_name.toLowerCase().includes(s) || r.order_code.toLowerCase().includes(s);
  });

  const totals = { commission_amount: filtered.reduce((s, r) => s + r.commission_amount, 0) };

  const columns: ReportColumn<ReferralShareRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'referral_name', label: 'Referral Source' },
    { key: 'source_type', label: 'Type', render: (r) => <Badge variant="outline" className="text-xs">{r.source_type === 'in_source' ? 'IN' : 'OUT'}</Badge>, exportValue: (r) => r.source_type },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'service_name', label: 'Service' },
    { key: 'commission_type', label: 'Commission Type', render: (r) => <Badge variant="outline" className="text-xs">{r.commission_type}</Badge>, exportValue: (r) => r.commission_type },
    { key: 'commission_amount', label: 'Commission', align: 'right', isNumeric: true, exportValue: (r) => r.commission_amount },
    { key: 'settled', label: 'Status', render: (r) => r.settled ? <Badge variant="default">Settled</Badge> : <Badge variant="secondary">Pending</Badge>, exportValue: (r) => r.settled ? 'Settled' : 'Pending' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Referral Share Detail Report</h1>
        <p className="text-sm text-muted-foreground">Individual commission transactions for each referral source</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search by referral, patient, invoice..." onSearchChange={setSearch} exportFilename="referral-share-detail" title="Referral Share Detail Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
