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

type RevenueRow = {
  id: string;
  date: string;
  order_count: number;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  collected_amount: number;
  outstanding_amount: number;
};

const chartConfig: ChartConfig = {
  net_amount: { label: 'Net Revenue', color: 'hsl(var(--chart-1))' },
  collected_amount: { label: 'Collected', color: 'hsl(var(--chart-2))' },
};

export default function RevenueSummaryPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RevenueRow[]>([]);
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
    const from = filters.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = filters.dateTo || today;

    let q = supabase
      .from('lab_orders')
      .select('id, total_amount, discount_amount, net_amount, paid_amount, created_at, branch_id')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: true });
    if (filters.branch) q = q.eq('branch_id', filters.branch);
    const { data: orders } = await q;

    // Group by date
    const grouped = new Map<string, RevenueRow>();
    for (const o of (orders as any[]) || []) {
      const dateStr = o.created_at.slice(0, 10);
      const existing = grouped.get(dateStr);
      if (existing) {
        existing.order_count += 1;
        existing.total_amount += Number(o.total_amount) || 0;
        existing.discount_amount += Number(o.discount_amount) || 0;
        existing.net_amount += Number(o.net_amount) || 0;
        existing.collected_amount += Number(o.paid_amount) || 0;
        existing.outstanding_amount += (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0);
      } else {
        grouped.set(dateStr, {
          id: dateStr,
          date: dateStr,
          order_count: 1,
          total_amount: Number(o.total_amount) || 0,
          discount_amount: Number(o.discount_amount) || 0,
          net_amount: Number(o.net_amount) || 0,
          collected_amount: Number(o.paid_amount) || 0,
          outstanding_amount: (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0),
        });
      }
    }

    setData(Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const totals = { order_count: data.reduce((s, r) => s + r.order_count, 0), total_amount: data.reduce((s, r) => s + r.total_amount, 0), discount_amount: data.reduce((s, r) => s + r.discount_amount, 0), net_amount: data.reduce((s, r) => s + r.net_amount, 0), collected_amount: data.reduce((s, r) => s + r.collected_amount, 0), outstanding_amount: data.reduce((s, r) => s + r.outstanding_amount, 0) };

  const columns: ReportColumn<RevenueRow>[] = [
    { key: 'date', label: 'Date' },
    { key: 'order_count', label: 'Orders', align: 'right', isNumeric: true, exportValue: (r) => r.order_count },
    { key: 'total_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.total_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'collected_amount', label: 'Collected', align: 'right', isNumeric: true, exportValue: (r) => r.collected_amount },
    { key: 'outstanding_amount', label: 'Outstanding', align: 'right', isNumeric: true, exportValue: (r) => r.outstanding_amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Revenue Summary Report</h1>
        <p className="text-sm text-muted-foreground">Daily revenue breakdown with collection analysis</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Net Revenue</p><p className="text-lg font-bold">Rs {formatCurrency(totals.net_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Collected</p><p className="text-lg font-bold text-green-600">Rs {formatCurrency(totals.collected_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Outstanding</p><p className="text-lg font-bold text-red-600">Rs {formatCurrency(totals.outstanding_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-lg font-bold">{totals.order_count}</p></CardContent></Card>
      </div>

      {data.length > 0 && !loading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue vs Collection Trend</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={data.slice(-30)}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="net_amount" fill="var(--color-net_amount)" radius={4} />
                <Bar dataKey="collected_amount" fill="var(--color-collected_amount)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={data} exportFilename="revenue-summary" title="Revenue Summary Report" subtitle={`${filters.dateFrom || 'Last 30 days'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={31} showSearch={false} />
      )}
    </div>
  );
}
