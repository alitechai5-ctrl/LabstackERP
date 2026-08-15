'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDateTime } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Banknote, Smartphone, CreditCard } from 'lucide-react';

type PaymentMethodRow = {
  id: string;
  date: string;
  receipt_no: string;
  order_code: string;
  patient_name: string;
  payment_method: string;
  amount: number;
};

export default function PaymentMethodsReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentMethodRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    { key: 'method', label: 'Payment Method', type: 'select', options: [{ label: 'Cash', value: 'cash' }, { label: 'Online', value: 'online' }, { label: 'Card', value: 'card' }] },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('lab_order_payments')
      .select('id, amount, payment_method, transaction_reference, received_at, lab_order_id')
      .gte('received_at', `${from}T00:00:00`)
      .lte('received_at', `${to}T23:59:59`)
      .order('received_at', { ascending: false });
    if (filters.method) q = q.eq('payment_method', filters.method);
    const { data: payments } = await q;

    const orderIds = Array.from(new Set((payments as any[])?.map((p) => p.lab_order_id).filter(Boolean) || []));
    let orderMap: Record<string, any> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase.from('lab_orders').select('id, order_code, patient:patients(full_name)').in('id', orderIds);
      for (const o of (orders as any[]) || []) orderMap[o.id] = o;
    }

    const rows: PaymentMethodRow[] = ((payments as any[]) || []).map((p) => {
      const o = orderMap[p.lab_order_id];
      return {
        id: p.id,
        date: p.received_at,
        receipt_no: p.transaction_reference || p.id.slice(0, 8).toUpperCase(),
        order_code: o?.order_code || '-',
        patient_name: o?.patient?.full_name || '-',
        payment_method: p.payment_method,
        amount: Number(p.amount) || 0,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.patient_name.toLowerCase().includes(s) || r.order_code.toLowerCase().includes(s) || r.receipt_no.toLowerCase().includes(s);
  });

  const methodTotals = {
    cash: filtered.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + r.amount, 0),
    online: filtered.filter((r) => r.payment_method === 'online').reduce((s, r) => s + r.amount, 0),
    card: filtered.filter((r) => r.payment_method === 'card').reduce((s, r) => s + r.amount, 0),
  };

  const totals = { amount: filtered.reduce((s, r) => s + r.amount, 0) };

  const columns: ReportColumn<PaymentMethodRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDateTime(r.date), exportValue: (r) => formatDateTime(r.date) },
    { key: 'receipt_no', label: 'Receipt No', className: 'font-mono text-sm' },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_name', label: 'Patient' },
    { key: 'payment_method', label: 'Method', render: (r) => { const Icon = r.payment_method === 'cash' ? Banknote : r.payment_method === 'card' ? CreditCard : Smartphone; return <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{r.payment_method}</span>; }, exportValue: (r) => r.payment_method },
    { key: 'amount', label: 'Amount', align: 'right', isNumeric: true, exportValue: (r) => r.amount },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Payment Method Report</h1>
        <p className="text-sm text-muted-foreground">Collections broken down by payment method</p>
      </div>
      <ReportFilterBar fields={filterFields} values={filters} onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))} onApply={load} onReset={() => setFilters({})} loading={loading} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-[hsl(var(--chart-1))]" /><p className="text-xs text-muted-foreground">Cash</p></div><p className="text-lg font-bold">Rs {formatCurrency(methodTotals.cash)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 mb-1"><Smartphone className="h-4 w-4 text-[hsl(var(--chart-4))]" /><p className="text-xs text-muted-foreground">Online</p></div><p className="text-lg font-bold">Rs {formatCurrency(methodTotals.online)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-[hsl(var(--chart-5))]" /><p className="text-xs text-muted-foreground">Card</p></div><p className="text-lg font-bold">Rs {formatCurrency(methodTotals.card)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Grand Total</p><p className="text-lg font-bold text-primary">Rs {formatCurrency(totals.amount)}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable columns={columns} data={filtered} search={search} searchPlaceholder="Search by patient, invoice, receipt..." onSearchChange={setSearch} exportFilename="payment-method-report" title="Payment Method Report" subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`} totalsRow={totals} pageSize={50} />
      )}
    </div>
  );
}
