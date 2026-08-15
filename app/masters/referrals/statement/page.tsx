'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { ReferralSource, ReferralSettlement } from '@/lib/types';

type SettlementRow = ReferralSettlement & { referral_source?: ReferralSource };

export default function ReferralStatementPage() {
  const supabase = getSupabaseClient();
  const [referrals, setReferrals] = useState<ReferralSource[]>([]);
  const [selectedReferral, setSelectedReferral] = useState('');
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('referral_sources').select('*').eq('is_active', true).order('name');
      setReferrals((data as ReferralSource[]) || []);
    })();
  }, [supabase]);

  const loadStatement = useCallback(async () => {
    if (!selectedReferral) return;
    setLoading(true);
    let q = supabase.from('referral_settlements')
      .select('*, referral_source:referral_sources(*)')
      .eq('referral_source_id', selectedReferral)
      .order('created_at', { ascending: false });
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as SettlementRow[]) || []);
    setLoading(false);
  }, [supabase, selectedReferral, dateFrom, dateTo]);

  useEffect(() => { loadStatement(); }, [loadStatement]);

  const unsettledTotal = rows.filter(r => !r.settled).reduce((s, r) => s + Number(r.commission_amount), 0);
  const settledTotal = rows.filter(r => r.settled).reduce((s, r) => s + Number(r.commission_amount), 0);
  const inSourceTotal = rows.filter(r => r.source_type === 'in_source').reduce((s, r) => s + Number(r.commission_amount), 0);
  const outSourceTotal = rows.filter(r => r.source_type === 'out_source').reduce((s, r) => s + Number(r.commission_amount), 0);

  const exportCSV = () => {
    if (rows.length === 0) { toast.error('No data to export'); return; }
    const headers = ['Date', 'Service', 'Source Type', 'Type', 'Amount', 'Basis', 'Status', 'Settled At'];
    const data = rows.map(r => [
      new Date(r.created_at).toLocaleDateString(), r.service_name,
      r.source_type === 'in_source' ? 'IN SOURCE' : 'OUT SOURCE',
      r.commission_type, r.commission_amount, r.calculation_basis,
      r.settled ? 'Settled' : 'Pending', r.settled_at ? new Date(r.settled_at).toLocaleDateString() : '-'
    ]);
    const csv = [headers, ...data].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-statement-${selectedReferral}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported statement');
  };

  const selectedReferralObj = referrals.find(r => r.id === selectedReferral);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Referral Partner Statement</h1>
          <p className="text-muted-foreground">Detailed statement for a referral partner with IN/OUT source breakdown</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          <Button variant="outline" onClick={exportCSV} disabled={!selectedReferral}><Download className="mr-2 h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Select Referral Partner & Period</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Referral Source</Label>
              <Select value={selectedReferral} onValueChange={setSelectedReferral}>
                <SelectTrigger><SelectValue placeholder="Select referral..." /></SelectTrigger>
                <SelectContent>
                  {referrals.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedReferral && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Unsettled</p>
              <p className="text-2xl font-bold text-[hsl(var(--chart-2))]">Rs {unsettledTotal.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Settled</p>
              <p className="text-2xl font-bold text-[hsl(var(--chart-1))]">Rs {settledTotal.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">Rs {(unsettledTotal + settledTotal).toLocaleString()}</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="border-blue-200 bg-blue-50/30"><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">IN SOURCE Total</p>
              <p className="text-xl font-bold text-blue-600">Rs {inSourceTotal.toLocaleString()}</p>
            </CardContent></Card>
            <Card className="border-green-200 bg-green-50/30"><CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">OUT SOURCE Total</p>
              <p className="text-xl font-bold text-green-600">Rs {outSourceTotal.toLocaleString()}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Statement for {selectedReferralObj?.name}</CardTitle>
              <CardDescription>{selectedReferralObj?.type ?? ''} {selectedReferralObj?.phone ? `· ${selectedReferralObj.phone}` : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                rows.length === 0 ? <p className="text-center text-muted-foreground py-8">No transactions in this period</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Service</TableHead><TableHead>Source</TableHead>
                      <TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Basis</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {rows.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{r.service_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{r.source_type === 'in_source' ? 'IN' : 'OUT'}</Badge></TableCell>
                          <TableCell className="text-xs">{r.commission_type}</TableCell>
                          <TableCell className="font-medium">Rs {Number(r.commission_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{(r.calculation_basis || 'net_amount').replace(/_/g, ' ')}</TableCell>
                          <TableCell>{r.settled ? <Badge variant="default">Settled</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
