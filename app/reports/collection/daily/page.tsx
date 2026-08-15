'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ReportFilterBar, type FilterField } from '@/components/shared/report-filter-bar';
import { ReportTable, type ReportColumn } from '@/components/shared/report-table';
import { formatCurrency, formatDateTime } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Banknote, Smartphone, CreditCard } from 'lucide-react';

type CollectionRow = {
  id: string;
  date: string;
  receipt_no: string;
  order_code: string;
  patient_name: string;
  patient_code: string;
  payment_method: string;
  amount: number;
  received_by: string | null;
  branch_name: string | null;
};

export default function DailyCollectionReportPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CollectionRow[]>([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true);
      setBranches((branchData as { id: string; name: string }[]) || []);
    })();
  }, [supabase]);

  const filterFields: FilterField[] = [
    { key: 'dateFrom', label: 'From Date', type: 'date' },
    { key: 'dateTo', label: 'To Date', type: 'date' },
    {
      key: 'branch',
      label: 'Branch',
      type: 'select',
      options: branches.map((b) => ({ label: b.name, value: b.id })),
    },
    {
      key: 'method',
      label: 'Payment Method',
      type: 'select',
      options: [
        { label: 'Cash', value: 'cash' },
        { label: 'Online', value: 'online' },
        { label: 'Card', value: 'card' },
      ],
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.dateFrom || today;
    const to = filters.dateTo || today;

    let q = supabase
      .from('lab_order_payments')
      .select(
        'id, amount, payment_method, transaction_reference, received_at, received_by, lab_order_id, branch_id',
      )
      .gte('received_at', `${from}T00:00:00`)
      .lte('received_at', `${to}T23:59:59`)
      .order('received_at', { ascending: false });

    if (filters.method) q = q.eq('payment_method', filters.method);

    const { data: payments } = await q;
    const payData = (payments as any[]) || [];

    const orderIds = Array.from(new Set(payData.map((p) => p.lab_order_id)));
    let orderMap: Record<string, any> = {};
    let branchMap: Record<string, string> = {};

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('lab_orders')
        .select('id, order_code, patient:patients(full_name, patient_code), branch_id, branch:branches(name)')
        .in('id', orderIds);
      for (const o of (orders as any[]) || []) {
        orderMap[o.id] = o;
        if (o.branch?.name) branchMap[o.id] = o.branch.name;
      }
    }

    const rows: CollectionRow[] = payData.map((p) => {
      const o = orderMap[p.lab_order_id];
      return {
        id: p.id,
        date: p.received_at,
        receipt_no: p.transaction_reference || p.id.slice(0, 8).toUpperCase(),
        order_code: o?.order_code || p.lab_order_id.slice(0, 8),
        patient_name: o?.patient?.full_name || '-',
        patient_code: o?.patient?.patient_code || '-',
        payment_method: p.payment_method,
        amount: Number(p.amount) || 0,
        received_by: p.received_by,
        branch_name: o?.branch?.name || null,
      };
    });

    setData(rows);
    setLoading(false);
  }, [supabase, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.patient_name.toLowerCase().includes(s) ||
      r.patient_code.toLowerCase().includes(s) ||
      r.order_code.toLowerCase().includes(s) ||
      r.receipt_no.toLowerCase().includes(s)
    );
  });

  const totals = {
    amount: filtered.reduce((s, r) => s + r.amount, 0),
  };

  const methodTotals = {
    cash: filtered.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + r.amount, 0),
    online: filtered.filter((r) => r.payment_method === 'online').reduce((s, r) => s + r.amount, 0),
    card: filtered.filter((r) => r.payment_method === 'card').reduce((s, r) => s + r.amount, 0),
  };

  const columns: ReportColumn<CollectionRow>[] = [
    { key: 'date', label: 'Date', render: (r) => formatDateTime(r.date), exportValue: (r) => formatDateTime(r.date) },
    { key: 'receipt_no', label: 'Receipt No', className: 'font-mono text-sm' },
    { key: 'order_code', label: 'Invoice', className: 'font-mono text-sm' },
    { key: 'patient_code', label: 'PIN' },
    { key: 'patient_name', label: 'Patient' },
    {
      key: 'payment_method',
      label: 'Method',
      render: (r) => {
        const icon = r.payment_method === 'cash' ? Banknote : r.payment_method === 'card' ? CreditCard : Smartphone;
        const Icon = icon;
        return <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{r.payment_method}</span>;
      },
      exportValue: (r) => r.payment_method,
    },
    { key: 'amount', label: 'Amount', align: 'right', isNumeric: true, exportValue: (r) => r.amount },
    { key: 'received_by', label: 'Received By', render: (r) => r.received_by || '-' },
    { key: 'branch_name', label: 'Branch', render: (r) => r.branch_name || '-' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Daily Collection Report</h1>
        <p className="text-sm text-muted-foreground">Payment receipts with method-wise breakdown</p>
      </div>

      <ReportFilterBar
        fields={filterFields}
        values={filters}
        onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        onApply={load}
        onReset={() => { setFilters({}); }}
        loading={loading}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-[hsl(var(--chart-1))]" /><p className="text-xs text-muted-foreground">Cash</p></div>
          <p className="text-lg font-bold">Rs {formatCurrency(methodTotals.cash)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1"><Smartphone className="h-4 w-4 text-[hsl(var(--chart-4))]" /><p className="text-xs text-muted-foreground">Online</p></div>
          <p className="text-lg font-bold">Rs {formatCurrency(methodTotals.online)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-[hsl(var(--chart-5))]" /><p className="text-xs text-muted-foreground">Card</p></div>
          <p className="text-lg font-bold">Rs {formatCurrency(methodTotals.card)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-1"><p className="text-xs text-muted-foreground">Grand Total</p></div>
          <p className="text-lg font-bold text-primary">Rs {formatCurrency(totals.amount)}</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ReportTable
          columns={columns}
          data={filtered}
          search={search}
          searchPlaceholder="Search by patient, invoice, or receipt..."
          onSearchChange={setSearch}
          exportFilename="daily-collection"
          title="Daily Collection Report"
          subtitle={`${filters.dateFrom || 'Today'} to ${filters.dateTo || 'Today'}`}
          totalsRow={totals}
          pageSize={50}
        />
      )}
    </div>
  );
}
