'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDate } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type PanelOutstandingRow = {
  id: string;
  panel_name: string;
  date: string;
  order_code: string;
  patient_name: string;
  net_amount: number;
  paid_amount: number;
  balance: number;
  age_days: number;
};

export default function PanelOutstandingPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PanelOutstandingRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [corporates, setCorporates] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: corpData } = await supabase.from('corporate_clients').select('id, name').eq('is_active', true).order('name');
      setCorporates((corpData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'corporate', label: 'Panel', type: 'select', options: corporates.map((c) => ({ label: c.name, value: c.id })) },
  ];

  const load = useCallback(async () => {
    setLoading(true);

    let q = supabase
      .from('lab_orders')
      .select('id, order_code, net_amount, paid_amount, payment_status, created_at, corporate_client_id, patient:patients(full_name), corporate_client:corporate_clients(name)')
      .not('corporate_client_id', 'is', null)
      .in('payment_status', ['unpaid', 'partial'])
      .order('created_at', { ascending: false });
    if (filters.corporate) q = q.eq('corporate_client_id', filters.corporate);
    if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00`);
    if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59`);
    const { data: orders } = await q;

    const now = new Date();
    const rows: PanelOutstandingRow[] = ((orders as any[]) || [])
      .map((o) => {
        const balance = (Number(o.net_amount) || 0) - (Number(o.paid_amount) || 0);
        const ageDays = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: o.id,
          panel_name: o.corporate_client?.name || 'Unknown',
          date: o.created_at,
          order_code: o.order_code,
          patient_name: o.patient?.full_name || '-',
          net_amount: Number(o.net_amount) || 0,
          paid_amount: Number(o.paid_amount) || 0,
          balance,
          age_days: ageDays,
        };
      })
      .filter((r) => r.balance > 0);

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.panel_name.toLowerCase().includes(s) || r.patient_name.toLowerCase().includes(s) || r.order_code.toLowerCase().includes(s);
  });

  const totals = { net_amount: filtered.reduce((s, r) => s + r.net_amount, 0), paid_amount: filtered.reduce((s, r) => s + r.paid_amount, 0), balance: filtered.reduce((s, r) => s + r.balance, 0) };

  // Group by panel for summary
  const panelSummary = new Map<string, number>();
  for (const r of filtered) {
    panelSummary.set(r.panel_name, (panelSummary.get(r.panel_name) || 0) + r.balance);
  }

  const columns: ReportColumn<PanelOutstandingRow>[] = [
    { key: 'panel_name', label: 'Panel' },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
    { key: 'paid_amount', label: 'Paid', align: 'right', isNumeric: true, exportValue: (r) => r.paid_amount },
    { key: 'balance', label: 'Balance', align: 'right', isNumeric: true, exportValue: (r) => r.balance },
    { key: 'age_days', label: 'Age (Days)', align: 'right', isNumeric: true, exportValue: (r) => r.age_days },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Panel Outstanding Report</h1>
        <p className="text-sm text-muted-foreground">Unpaid invoices grouped by corporate/panel client</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      {data.length > 0 && !loading && (
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-3">Outstanding by Panel</p>
          <div className="space-y-2">
            {Array.from(panelSummary.entries()).sort((a, b) => b[1] - a[1]).map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-sm">{name}</span>
                <span className="text-sm font-bold text-red-600">Rs {formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search by panel, patient, invoice..." onSearchChange={setSearch} exportFilename="panel-outstanding" title="Panel Outstanding Report" subtitle="All unpaid panel invoices" totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
