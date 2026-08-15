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

type PanelPerfRow = {
  id: string;
  panel_name: string;
  order_count: number;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  balance: number;
};

const chartConfig: ChartConfig = { net_amount: { label: 'Net Revenue', color: 'hsl(var(--chart-4))' } };

export default function PanelPerformancePage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PanelPerfRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    const { data: orders } = await supabase
      .from('lab_orders')
      .select('id, total_amount, discount_amount, net_amount, paid_amount, corporate_client_id, corporate_client:corporate_clients(id, name)')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .not('corporate_client_id', 'is', null);

    const grouped = new Map<string, PanelPerfRow>();
    for (const o of (orders as any[]) || []) {
      const corpId = o.corporate_client?.id || o.corporate_client_id;
      const existing = grouped.get(corpId);
      if (existing) {
        existing.order_count += 1;
        existing.total_amount += Number(o.total_amount) || 0;
        existing.discount_amount += Number(o.discount_amount) || 0;
        existing.net_amount += Number(o.net_amount) || 0;
        existing.paid_amount += Number(o.paid_amount) || 0;
        existing.balance += (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0);
      } else {
        grouped.set(corpId, {
          id: corpId,
          panel_name: o.corporate_client?.name || 'Unknown',
          order_count: 1,
          total_amount: Number(o.total_amount) || 0,
          discount_amount: Number(o.discount_amount) || 0,
          net_amount: Number(o.net_amount) || 0,
          paid_amount: Number(o.paid_amount) || 0,
          balance: (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0),
        });
      }
    }

    setData(Array.from(grouped.values()).sort((a, b) => b.net_amount - a.net_amount));
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => !search || r.panel_name.toLowerCase().includes(search.toLowerCase()));
  const totals = { order_count: filtered.reduce((s, r) => s + r.order_count, 0), total_amount: filtered.reduce((s, r) => s + r.total_amount, 0), discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0), net_amount: filtered.reduce((s, r) => s + r.net_amount, 0), paid_amount: filtered.reduce((s, r) => s + r.paid_amount, 0), balance: filtered.reduce((s, r) => s + r.balance, 0) };

  const columns: ReportColumn<PanelPerfRow>[] = [
    { key: 'panel_name', label: 'Panel' },
    { key: 'order_count', label: 'Orders', align: 'right', isNumeric: true, exportValue: (r) => r.order_count },
    { key: 'total_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.total_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'paid_amount', label: 'Paid', align: 'right', isNumeric: true, exportValue: (r) => r.paid_amount },
    { key: 'balance', label: 'Balance', align: 'right', isNumeric: true, exportValue: (r) => r.balance },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Panel Performance Report</h1>
        <p className="text-sm text-muted-foreground">Revenue and collection by corporate/panel client</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {data.length > 0 && !loading && (
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Panel</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={filtered.slice(0, 10)} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis dataKey="panel_name" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
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
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search panels..." onSearchChange={setSearch} exportFilename="panel-performance" title="Panel Performance Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={25} />
      )}
    </div>
  );
}
