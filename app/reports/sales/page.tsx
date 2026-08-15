'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, Smartphone, CreditCard, Loader2, TrendingUp, Receipt, ArrowDownToLine } from 'lucide-react';
import type { LabOrderPayment } from '@/lib/types';

type OrderRow = {
  id: string;
  order_code: string;
  net_amount: number;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  patient: { full_name: string; patient_code: string } | null;
};

const METHOD_META: Record<string, { icon: typeof Banknote; label: string; color: string }> = {
  cash: { icon: Banknote, label: 'Cash', color: 'text-[hsl(var(--chart-1))]' },
  online: { icon: Smartphone, label: 'Online', color: 'text-[hsl(var(--chart-4))]' },
  card: { icon: CreditCard, label: 'Card', color: 'text-[hsl(var(--chart-5))]' },
};

export default function SalesReportPage() {
  const supabase = getSupabaseClient();
  const [payments, setPayments] = useState<LabOrderPayment[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderRow>>({});
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('lab_order_payments')
      .select('*')
      .order('received_at', { ascending: false });
    if (fromDate) q = q.gte('received_at', `${fromDate}T00:00:00`);
    if (toDate) q = q.lte('received_at', `${toDate}T23:59:59`);
    const { data, error } = await q;
    if (error) { console.error(error); }
    const payData = (data as LabOrderPayment[]) || [];
    setPayments(payData);

    const orderIds = Array.from(new Set(payData.map(p => p.lab_order_id)));
    if (orderIds.length > 0) {
      const { data: orderData } = await supabase
        .from('lab_orders')
        .select('id, order_code, net_amount, paid_amount, payment_status, created_at, patient:patients(full_name, patient_code)')
        .in('id', orderIds);
      const map: Record<string, OrderRow> = {};
      for (const o of (orderData as any[]) || []) map[o.id] = o;
      setOrders(map);
    } else {
      setOrders({});
    }
    setLoading(false);
  }, [supabase, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = methodFilter === 'all' ? payments : payments.filter(p => p.payment_method === methodFilter);

  const totals = {
    cash: payments.filter(p => p.payment_method === 'cash').reduce((s, p) => s + Number(p.amount), 0),
    online: payments.filter(p => p.payment_method === 'online').reduce((s, p) => s + Number(p.amount), 0),
    card: payments.filter(p => p.payment_method === 'card').reduce((s, p) => s + Number(p.amount), 0),
  };
  const grandTotal = totals.cash + totals.online + totals.card;

  const exportCsv = () => {
    const rows = [['Date', 'Invoice', 'Patient', 'MR Number', 'Method', 'Reference', 'Amount']];
    filtered.forEach(p => {
      const o = orders[p.lab_order_id];
      rows.push([
        new Date(p.received_at).toLocaleString(),
        o?.order_code ?? '',
        o?.patient?.full_name ?? '',
        o?.patient?.patient_code ?? '',
        p.payment_method,
        p.transaction_reference ?? '',
        String(p.amount),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <p className="text-muted-foreground">Payment collection breakdown by cash, online, and card</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <ArrowDownToLine className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Rs {grandTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{payments.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash</CardTitle>
            <Banknote className="h-4 w-4 text-[hsl(var(--chart-1))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--chart-1))]">Rs {totals.cash.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{payments.filter(p => p.payment_method === 'cash').length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Smartphone className="h-4 w-4 text-[hsl(var(--chart-4))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--chart-4))]">Rs {totals.online.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{payments.filter(p => p.payment_method === 'online').length} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Card</CardTitle>
            <CreditCard className="h-4 w-4 text-[hsl(var(--chart-5))]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[hsl(var(--chart-5))]">Rs {totals.card.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{payments.filter(p => p.payment_method === 'card').length} payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-44" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-44" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); setMethodFilter('all'); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions ({filtered.length})</CardTitle>
          <CardDescription>Individual payment records with invoice details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payments found for the selected filters</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Invoice</th>
                    <th className="pb-2 pr-4 font-medium">Patient</th>
                    <th className="pb-2 pr-4 font-medium">Method</th>
                    <th className="pb-2 pr-4 font-medium">Reference</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const o = orders[p.lab_order_id];
                    const meta = METHOD_META[p.payment_method];
                    const Icon = meta.icon;
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{new Date(p.received_at).toLocaleString()}</td>
                        <td className="py-2.5 pr-4 font-medium data-mono">{o?.order_code ?? p.lab_order_id.slice(0, 8)}</td>
                        <td className="py-2.5 pr-4">{o?.patient?.full_name ?? '—'}{o?.patient?.patient_code && <span className="text-xs text-muted-foreground ml-1">({o.patient.patient_code})</span>}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`flex items-center gap-1.5 ${meta.color}`}>
                            <Icon className="h-3.5 w-3.5" /> {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{p.transaction_reference ?? '—'}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">Rs {Number(p.amount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={5} className="pt-3 text-right font-medium">Total:</td>
                    <td className="pt-3 text-right font-bold">Rs {filtered.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
