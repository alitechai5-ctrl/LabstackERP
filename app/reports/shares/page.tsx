'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, Download, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Doctor, ReferralSource, CorporateClient, DoctorSettlement, ReferralSettlement, PanelSettlement } from '@/lib/types';

type DoctorRow = DoctorSettlement & { doctor?: Doctor };
type ReferralRow = ReferralSettlement & { referral_source?: ReferralSource };
type PanelRow = PanelSettlement & { corporate_client?: CorporateClient };

export default function ShareReportsPage() {
  const supabase = getSupabaseClient();
  const [activeTab, setActiveTab] = useState('doctor');
  const [loading, setLoading] = useState(true);
  const [doctorRows, setDoctorRows] = useState<DoctorRow[]>([]);
  const [referralRows, setReferralRows] = useState<ReferralRow[]>([]);
  const [panelRows, setPanelRows] = useState<PanelRow[]>([]);
  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [panelCorpFilter, setPanelCorpFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [dRes, rRes, cRes] = await Promise.all([
      supabase.from('doctor_settlements').select('*, doctor:doctors(*)').order('created_at', { ascending: false }).limit(500),
      supabase.from('referral_settlements').select('*, referral_source:referral_sources(*)').order('created_at', { ascending: false }).limit(500),
      supabase.from('corporate_clients').select('*').eq('is_active', true).order('name'),
    ]);
    setDoctorRows((dRes.data as DoctorRow[]) || []);
    setReferralRows((rRes.data as ReferralRow[]) || []);
    setCorporates((cRes.data as CorporateClient[]) || []);
    setLoading(false);
  }, [supabase]);

  const loadPanel = useCallback(async () => {
    if (activeTab !== 'panel') return;
    let q = supabase.from('panel_settlements').select('*, corporate_client:corporate_clients(*)').order('created_at', { ascending: false }).limit(500);
    if (panelCorpFilter !== 'all') q = q.eq('corporate_client_id', panelCorpFilter);
    const { data } = await q;
    setPanelRows((data as PanelRow[]) || []);
  }, [supabase, activeTab, panelCorpFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadPanel(); }, [loadPanel]);

  const filterByDate = (row: { created_at: string }) => {
    if (dateFrom && new Date(row.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(row.created_at) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  };

  const filterByStatus = (settled: boolean) => {
    if (statusFilter === 'settled' && !settled) return false;
    if (statusFilter === 'unsettled' && settled) return false;
    return true;
  };

  const filteredDoctor = doctorRows.filter(r => filterByDate(r) && filterByStatus(r.settled));
  const filteredReferral = referralRows.filter(r => filterByDate(r) && filterByStatus(r.settled));
  const filteredPanel = panelRows.filter(r => filterByDate(r) && filterByStatus(r.settled));

  const doctorUnsettled = filteredDoctor.filter(r => !r.settled).reduce((s, r) => s + Number(r.share_amount), 0);
  const doctorSettled = filteredDoctor.filter(r => r.settled).reduce((s, r) => s + Number(r.share_amount), 0);
  const referralUnsettled = filteredReferral.filter(r => !r.settled).reduce((s, r) => s + Number(r.commission_amount), 0);
  const referralSettled = filteredReferral.filter(r => r.settled).reduce((s, r) => s + Number(r.commission_amount), 0);
  const panelUnsettled = filteredPanel.filter(r => !r.settled).reduce((s, r) => s + Number(r.share_amount), 0);
  const panelSettled = filteredPanel.filter(r => r.settled).reduce((s, r) => s + Number(r.share_amount), 0);

  const exportCSV = (rows: any[], type: string) => {
    if (rows.length === 0) { toast.error('No data to export'); return; }
    const headers = type === 'doctor' ? ['Date', 'Doctor', 'Service', 'Type', 'Amount', 'Basis', 'Status'] :
      type === 'referral' ? ['Date', 'Referral Source', 'Service', 'Type', 'Amount', 'Source Type', 'Basis', 'Status'] :
      ['Date', 'Corporate Client', 'Service', 'Type', 'Amount', 'Basis', 'Status'];
    const data = rows.map(r => type === 'doctor' ? [
      new Date(r.created_at).toLocaleDateString(), r.doctor?.full_name ?? '-', r.service_name,
      r.share_type, r.share_amount, r.calculation_basis, r.settled ? 'Settled' : 'Pending'
    ] : type === 'referral' ? [
      new Date(r.created_at).toLocaleDateString(), r.referral_source?.name ?? '-', r.service_name,
      r.commission_type, r.commission_amount, r.source_type, r.calculation_basis, r.settled ? 'Settled' : 'Pending'
    ] : [
      new Date(r.created_at).toLocaleDateString(), r.corporate_client?.name ?? '-', r.service_name,
      r.share_type, r.share_amount, r.calculation_basis, r.settled ? 'Settled' : 'Pending'
    ]);
    const csv = [headers, ...data].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-share-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported CSV');
  };

  const printReport = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Share Reports</h1>
          <p className="text-muted-foreground">Comprehensive share reports for Doctor, Referral, and Panel shares</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printReport}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                  <SelectItem value="unsettled">Unsettled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeTab === 'panel' && (
              <div className="space-y-2">
                <Label>Corporate Client</Label>
                <Select value={panelCorpFilter} onValueChange={setPanelCorpFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {corporates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="doctor">Doctor Shares</TabsTrigger>
          <TabsTrigger value="referral">Referral Shares</TabsTrigger>
          <TabsTrigger value="panel">Panel Shares</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* DOCTOR TAB */}
        <TabsContent value="doctor" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-2))]" /></div>
              <div><p className="text-sm text-muted-foreground">Unsettled</p><p className="text-2xl font-bold">Rs {doctorUnsettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
              <div><p className="text-sm text-muted-foreground">Settled</p><p className="text-2xl font-bold">Rs {doctorSettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-4))]/10 p-3"><TrendingUp className="h-6 w-6 text-[hsl(var(--chart-4))]" /></div>
              <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">Rs {(doctorUnsettled + doctorSettled).toLocaleString()}</p></div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Doctor Share Transactions ({filteredDoctor.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredDoctor, 'doctor')}><Download className="mr-2 h-4 w-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                filteredDoctor.length === 0 ? <p className="text-center text-muted-foreground py-8">No records</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Doctor</TableHead><TableHead>Service</TableHead>
                      <TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Basis</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredDoctor.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{r.doctor?.full_name ?? '-'}</TableCell>
                          <TableCell>{r.service_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{r.share_type}</Badge></TableCell>
                          <TableCell className="font-medium">Rs {Number(r.share_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{(r.calculation_basis || 'net_amount').replace(/_/g, ' ')}</TableCell>
                          <TableCell>{r.settled ? <Badge variant="default">Settled</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REFERRAL TAB */}
        <TabsContent value="referral" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-2))]" /></div>
              <div><p className="text-sm text-muted-foreground">Unsettled</p><p className="text-2xl font-bold">Rs {referralUnsettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
              <div><p className="text-sm text-muted-foreground">Settled</p><p className="text-2xl font-bold">Rs {referralSettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-4))]/10 p-3"><TrendingUp className="h-6 w-6 text-[hsl(var(--chart-4))]" /></div>
              <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">Rs {(referralUnsettled + referralSettled).toLocaleString()}</p></div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Referral Share Transactions ({filteredReferral.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredReferral, 'referral')}><Download className="mr-2 h-4 w-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                filteredReferral.length === 0 ? <p className="text-center text-muted-foreground py-8">No records</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Referral Source</TableHead><TableHead>Service</TableHead>
                      <TableHead>Source Type</TableHead><TableHead>Amount</TableHead><TableHead>Basis</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredReferral.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{r.referral_source?.name ?? '-'}</TableCell>
                          <TableCell>{r.service_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{r.source_type === 'in_source' ? 'IN' : 'OUT'}</Badge></TableCell>
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
        </TabsContent>

        {/* PANEL TAB */}
        <TabsContent value="panel" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-2))]/10 p-3"><DollarSign className="h-6 w-6 text-[hsl(var(--chart-2))]" /></div>
              <div><p className="text-sm text-muted-foreground">Unsettled</p><p className="text-2xl font-bold">Rs {panelUnsettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-3"><CheckCircle2 className="h-6 w-6 text-[hsl(var(--chart-1))]" /></div>
              <div><p className="text-sm text-muted-foreground">Settled</p><p className="text-2xl font-bold">Rs {panelSettled.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-[hsl(var(--chart-4))]/10 p-3"><TrendingUp className="h-6 w-6 text-[hsl(var(--chart-4))]" /></div>
              <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">Rs {(panelUnsettled + panelSettled).toLocaleString()}</p></div>
            </CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Panel Share Transactions ({filteredPanel.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredPanel, 'panel')}><Download className="mr-2 h-4 w-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                filteredPanel.length === 0 ? <p className="text-center text-muted-foreground py-8">No records</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Date</TableHead><TableHead>Corporate Client</TableHead><TableHead>Service</TableHead>
                      <TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Basis</TableHead><TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredPanel.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{r.corporate_client?.name ?? '-'}</TableCell>
                          <TableCell>{r.service_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{r.share_type}</Badge></TableCell>
                          <TableCell className="font-medium">Rs {Number(r.share_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{(r.calculation_basis || 'net_amount').replace(/_/g, ' ')}</TableCell>
                          <TableCell>{r.settled ? <Badge variant="default">Settled</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUMMARY TAB */}
        <TabsContent value="summary">
          <Card>
            <CardHeader><CardTitle>Share Summary Dashboard</CardTitle><CardDescription>Consolidated view of all share types</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Doctor Shares</p>
                    <p className="text-2xl font-bold">Rs {(doctorUnsettled + doctorSettled).toLocaleString()}</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-muted-foreground">Unsettled: <strong className="text-[hsl(var(--chart-2))]">Rs {doctorUnsettled.toLocaleString()}</strong></span>
                      <span className="text-muted-foreground">Settled: <strong className="text-[hsl(var(--chart-1))]">Rs {doctorSettled.toLocaleString()}</strong></span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/30">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground mb-1">Referral Shares</p>
                    <p className="text-2xl font-bold">Rs {(referralUnsettled + referralSettled).toLocaleString()}</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-muted-foreground">Unsettled: <strong className="text-[hsl(var(--chart-2))]">Rs {referralUnsettled.toLocaleString()}</strong></span>
                      <span className="text-muted-foreground">Settled: <strong className="text-[hsl(var(--chart-1))]">Rs {referralSettled.toLocaleString()}</strong></span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="pt-6">
                    <p className="text-sm-foreground mb-1">Panel Shares</p>
                    <p className="text-2xl font-bold">Rs {(panelUnsettled + panelSettled).toLocaleString()}</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-muted-foreground">Unsettled: <strong className="text-[hsl(var(--chart-2))]">Rs {panelUnsettled.toLocaleString()}</strong></span>
                      <span className="text-muted-foreground">Settled: <strong className="text-[hsl(var(--chart-1))]">Rs {panelSettled.toLocaleString()}</strong></span>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="mt-6 rounded-lg border p-4">
                <p className="text-sm font-medium">Grand Total</p>
                <p className="text-3xl font-bold mt-1">Rs {(doctorUnsettled + doctorSettled + referralUnsettled + referralSettled + panelUnsettled + panelSettled).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
