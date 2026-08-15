'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency } from '@/lib/utils/export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

type ReferralPerfRow = {
  id: string;
  name: string;
  source_type: string;
  order_count: number;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  commission_amount: number;
};

const chartConfig: ChartConfig = { net_amount: { label: 'Net Revenue', color: 'hsl(var(--chart-2))' } };

export default function ReferralPerformancePage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralPerfRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: branchData } = await supabase.from('branches').select('id, name').eq('is_active', true);
      setBranches((branchData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'branch', label: 'Branch', type: 'select', options: branches.map((b) => ({ label: b.name, value: b.id })) },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('lab_orders')
      .select('id, total_amount, discount_amount, net_amount, referral_source_id, referral_source:referral_sources(id, name, source_type)')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .not('referral_source_id', 'is', null);
    if (filters.branch) q = q.eq('branch_id', filters.branch);
    const { data: orders } = await q;

    const grouped = new Map<string, ReferralPerfRow>();
    for (const o of (orders as any[]) || []) {
      const refId = o.referral_source?.id || o.referral_source_id;
      const existing = grouped.get(refId);
      if (existing) {
        existing.order_count += 1;
        existing.total_amount += Number(o.total_amount) || 0;
        existing.discount_amount += Number(o.discount_amount) || 0;
        existing.net_amount += Number(o.net_amount) || 0;
      } else {
        grouped.set(refId, {
          id: refId,
          name: o.referral_source?.name || 'Unknown',
          source_type: o.referral_source?.source_type || '-',
          order_count: 1,
          total_amount: Number(o.total_amount) || 0,
          discount_amount: Number(o.discount_amount) || 0,
          net_amount: Number(o.net_amount) || 0,
          commission_amount: 0,
        });
      }
    }

    // Get referral commission amounts
    const refIds = Array.from(grouped.keys());
    if (refIds.length > 0) {
      const { data: settlements } = await supabase
        .from('referral_settlements')
        .select('referral_source_id, commission_amount')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`);
      for (const s of (settlements as any[]) || []) {
        const row = grouped.get(s.referral_source_id);
        if (row) row.commission_amount += Number(s.commission_amount) || 0;
      }
    }

    setData(Array.from(grouped.values()).sort((a, b) => b.net_amount - a.net_amount));
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const totals = { order_count: filtered.reduce((s, r) => s + r.order_count, 0), total_amount: filtered.reduce((s, r) => s + r.total_amount, 0), discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0), net_amount: filtered.reduce((s, r) => s + r.net_amount, 0), commission_amount: filtered.reduce((s, r) => s + r.commission_amount, 0) };

  const columns: ReportColumn<ReferralPerfRow>[] = [
    { key: 'name', label: 'Referral Source' },
    { key: 'source_type', label: 'Type', render: (r) => r.source_type === 'in_source' ? 'IN' : 'OUT' },
    { key: 'order_count', label: 'Orders', align: 'right', isNumeric: true, exportValue: (r) => r.order_count },
    { key: 'total_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.total_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net Revenue', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'commission_amount', label: 'Commission', align: 'right', isNumeric: true, exportValue: (r) => r.commission_amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Referral Performance Report</h1>
        <p className="text-sm text-muted-foreground">Revenue and commission by referral source</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {data.length > 0 && !loading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Referral Source</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={filtered.slice(0, 10)} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="net_amount" fill="var(--color-net_amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search referral sources..." onSearchChange={setSearch} exportFilename="referral-performance" title="Referral Performance Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={25} />
      )}
    </div>
  );
}
