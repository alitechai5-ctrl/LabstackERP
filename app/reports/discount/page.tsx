'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDate } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type DiscountRow = {
  id: string;
  date: string;
  order_code: string;
  patient_name: string;
  patient_code: string;
  panel_name: string;
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  discount_percent: number;
};

export default function DiscountReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiscountRow[]>([]);
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
      .select('id, order_code, total_amount, discount_amount, net_amount, created_at, branch_id, patient:patients(full_name, patient_code), corporate_client:corporate_clients(name)')
      .gt('discount_amount', 0)
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at', { ascending: false });
    if (filters.branch) q = q.eq('branch_id', filters.branch);
    const { data: orders } = await q;

    const rows: DiscountRow[] = ((orders as any[]) || []).map((o) => {
      const total = Number(o.total_amount) || 0;
      const discount = Number(o.discount_amount) || 0;
      return {
        id: o.id,
        date: o.created_at,
        order_code: o.order_code,
        patient_name: o.patient?.full_name || '-',
        patient_code: o.patient?.patient_code || '-',
        panel_name: o.corporate_client?.name || 'Private',
        total_amount: total,
        discount_amount: discount,
        net_amount: Number(o.net_amount) || 0,
        discount_percent: total > 0 ? (discount / total) * 100 : 0,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.patient_name.toLowerCase().includes(s) || r.order_code.toLowerCase().includes(s) || r.panel_name.toLowerCase().includes(s);
  });

  const totals = { total_amount: filtered.reduce((s, r) => s + r.total_amount, 0), discount_amount: filtered.reduce((s, r) => s + r.discount_amount, 0), net_amount: filtered.reduce((s, r) => s + r.net_amount, 0) };

  const columns: ReportColumn<DiscountRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date), exportValue: (r) => formatDate(r.date) },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_code', label: 'PIN' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'panel_name', label: 'Panel' },
    { key: 'total_amount', label: 'Gross', align: 'right', isNumeric: true, exportValue: (r) => r.total_amount },
    { key: 'discount_amount', label: 'Discount', align: 'right', isNumeric: true, exportValue: (r) => r.discount_amount },
    { key: 'discount_percent', label: 'Disc %', align: 'right', isNumeric: true, exportValue: (r) => r.discount_percent.toFixed(1) },
    { key: 'net_amount', label: 'Net', align: 'right', isNumeric: true, exportValue: (r) => r.net_amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Discount Report</h1>
        <p className="text-sm text-muted-foreground">All invoices with discounts applied</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Gross</p><p className="text-lg font-bold">Rs {formatCurrency(totals.total_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Discount</p><p className="text-lg font-bold text-orange-600">Rs {formatCurrency(totals.discount_amount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Net</p><p className="text-lg font-bold">Rs {formatCurrency(totals.net_amount)}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search by patient, invoice, panel..." onSearchChange={setSearch} exportFilename="discount-report" title="Discount Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
