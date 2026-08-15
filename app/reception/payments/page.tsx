'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Loader2, Search, Banknote, Smartphone, CreditCard, History } from 'lucide-react';
import { toast } from 'sonner';
import type { LabOrderPayment } from '@/lib/types';

type OutstandingOrder = {
  id: string;
  order_code: string;
  net_amount: number;
  paid_amount: number;
  payment_status: string;
  patient?: { full_name: string; patient_code: string; phone: string | null };
};

const METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  online: Smartphone,
  card: CreditCard,
};

export default function ReceptionPaymentsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<OutstandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState<Record<string, 'cash' | 'online' | 'card'>>({});
  const [payRef, setPayRef] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, LabOrderPayment[]>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_orders')
      .select('id, order_code, net_amount, paid_amount, payment_status, patient:patients(full_name, patient_code, phone)')
      .neq('payment_status', 'paid')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setOrders((data as any) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    if (!query) return true;
    const q = query.toLowerCase();
    return o.order_code.toLowerCase().includes(q) || (o.patient?.full_name ?? '').toLowerCase().includes(q) || (o.patient?.patient_code ?? '').toLowerCase().includes(q);
  });

  const toggleHistory = async (orderId: string) => {
    if (history[orderId]) {
      setShowHistory({ ...showHistory, [orderId]: !showHistory[orderId] });
      return;
    }
    const { data } = await supabase
      .from('lab_order_payments')
      .select('*')
      .eq('lab_order_id', orderId)
      .order('received_at', { ascending: false });
    setHistory({ ...history, [orderId]: (data as LabOrderPayment[]) || [] });
    setShowHistory({ ...showHistory, [orderId]: true });
  };

  const handlePay = async (orderId: string, net: number, paid: number) => {
    const amt = parseFloat(payAmount[orderId] || '0');
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    const method = payMethod[orderId] || 'cash';
    setSubmitting(orderId);
    const newPaid = paid + amt;
    const status = newPaid >= net ? 'paid' : 'partial';

    const { error: payError } = await supabase.from('lab_order_payments').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      lab_order_id: orderId,
      amount: amt,
      payment_method: method,
      transaction_reference: payRef[orderId] || null,
      received_by: appUser?.id || null,
    });
    if (payError) { toast.error(payError.message); setSubmitting(null); return; }

    const { error } = await supabase
      .from('lab_orders')
      .update({ paid_amount: newPaid, payment_status: status })
      .eq('id', orderId);
    if (error) { toast.error(error.message); setSubmitting(null); return; }

    toast.success(`Rs ${amt.toLocaleString()} collected via ${method}`);
    setPayAmount({ ...payAmount, [orderId]: '' });
    setPayRef({ ...payRef, [orderId]: '' });
    setSubmitting(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Collection</h1>
        <p className="text-muted-foreground">Collect outstanding payments and record payment method</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by invoice or patient name..." className="pl-10 max-w-md" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
          <CardDescription>{filtered.length} unpaid or partially paid invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No outstanding payments</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((o) => {
                const balance = Number(o.net_amount) - Number(o.paid_amount);
                const method = payMethod[o.id] || 'cash';
                const MethodIcon = METHOD_ICONS[method];
                return (
                  <div key={o.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-2"><Wallet className="h-4 w-4 text-[hsl(var(--chart-2))]" /></div>
                        <div>
                          <p className="font-medium text-sm">{o.patient?.full_name ?? 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground"><span className="data-mono">{o.order_code}</span> · <span className="data-mono">{o.patient?.patient_code}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-xs text-muted-foreground">Net: Rs {Number(o.net_amount).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Paid: Rs {Number(o.paid_amount).toLocaleString()}</p>
                          <p className="font-medium text-destructive">Balance: Rs {balance.toLocaleString()}</p>
                        </div>
                        <Badge variant={o.payment_status === 'partial' ? 'secondary' : 'destructive'}>{o.payment_status}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="space-y-1.5 flex-1">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number"
                          placeholder="Rs"
                          value={payAmount[o.id] || ''}
                          onChange={(e) => setPayAmount({ ...payAmount, [o.id]: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 w-full sm:w-40">
                        <Label className="text-xs">Method</Label>
                        <Select
                          value={method}
                          onValueChange={(v) => setPayMethod({ ...payMethod, [o.id]: v as 'cash' | 'online' | 'card' })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash"><span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash</span></SelectItem>
                            <SelectItem value="online"><span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Online</span></SelectItem>
                            <SelectItem value="card"><span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Card</span></SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(method === 'online' || method === 'card') && (
                        <div className="space-y-1.5 flex-1">
                          <Label className="text-xs">Reference (optional)</Label>
                          <Input
                            placeholder="Txn ID / Card last 4"
                            value={payRef[o.id] || ''}
                            onChange={(e) => setPayRef({ ...payRef, [o.id]: e.target.value })}
                          />
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handlePay(o.id, Number(o.net_amount), Number(o.paid_amount))}
                        disabled={submitting === o.id}
                        className="sm:mb-0"
                      >
                        {submitting === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MethodIcon className="mr-1 h-4 w-4" /> Collect</>}
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => toggleHistory(o.id)} className="text-xs text-muted-foreground">
                      <History className="mr-1 h-3 w-3" /> {showHistory[o.id] ? 'Hide' : 'Show'} payment history
                    </Button>
                    {showHistory[o.id] && history[o.id] && (
                      <div className="rounded-md border p-2 space-y-1.5">
                        {history[o.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">No payments recorded yet</p>
                        ) : history[o.id].map((p) => {
                          const Icon = METHOD_ICONS[p.payment_method];
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-2">
                                <Icon className="h-3 w-3 text-muted-foreground" />
                                {p.payment_method}
                                {p.transaction_reference && <span className="text-muted-foreground">· {p.transaction_reference}</span>}
                              </span>
                              <span className="font-medium">Rs {Number(p.amount).toLocaleString()}</span>
                              <span className="text-muted-foreground">{new Date(p.received_at).toLocaleDateString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
