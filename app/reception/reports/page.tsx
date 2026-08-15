'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Printer, Download, Mail, Loader2, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

type ReportItem = {
  id: string;
  order_code: string;
  status: string;
  created_at: string;
  patient: { full_name: string; patient_code: string; phone: string | null };
  items: { id: string; service_name: string; status: string; approved_at: string | null }[];
};

const FILTERS = [
  { value: 'all', label: 'All Reports' },
  { value: 'today', label: "Today's Reports" },
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready' },
  { value: 'verified', label: 'Verified' },
  { value: 'printed', label: 'Printed' },
];

export default function ReceptionReportCenterPage() {
  const supabase = getSupabaseClient();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('lab_orders')
      .select('id, order_code, status, created_at, patient:patients(full_name, patient_code, phone), items:lab_order_items(id, service_name, status, approved_at)')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data, error } = await q;
    if (error) { console.error(error); }
    let filtered = (data as any) || [];

    // Apply filters
    if (filter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r: ReportItem) => new Date(r.created_at) >= todayStart);
    } else if (filter === 'pending') {
      filtered = filtered.filter((r: ReportItem) => r.items.every(i => i.status !== 'approved' && i.status !== 'printed'));
    } else if (filter === 'ready') {
      filtered = filtered.filter((r: ReportItem) => r.items.some(i => i.status === 'approved'));
    } else if (filter === 'verified') {
      filtered = filtered.filter((r: ReportItem) => r.items.some(i => i.status === 'verified'));
    } else if (filter === 'printed') {
      filtered = filtered.filter((r: ReportItem) => r.items.some(i => i.status === 'printed'));
    }

    if (query) {
      const ql = query.toLowerCase();
      filtered = filtered.filter((r: ReportItem) =>
        r.order_code.toLowerCase().includes(ql) ||
        r.patient?.full_name?.toLowerCase().includes(ql) ||
        r.patient?.patient_code?.toLowerCase().includes(ql)
      );
    }

    setReports(filtered);
    setLoading(false);
  }, [supabase, filter, query]);

  useEffect(() => { load(); }, [load]);

  const getStatusBadge = (items: ReportItem['items']) => {
    if (items.every(i => i.status === 'printed')) return <Badge variant="secondary">Printed</Badge>;
    if (items.some(i => i.status === 'approved')) return <Badge variant="default">Ready</Badge>;
    if (items.some(i => i.status === 'verified')) return <Badge variant="outline">Verified</Badge>;
    return <Badge variant="destructive">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report Center</h1>
        <p className="text-muted-foreground">Search, preview, print, and track report delivery</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by invoice, patient name, or MR number..." className="pl-10" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Report List */}
      <Card>
        <CardHeader>
          <CardTitle>Reports ({reports.length})</CardTitle>
          <CardDescription>Click to view, print, or download reports</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : reports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reports found</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => {
                const isReady = r.items.some(i => i.status === 'approved' || i.status === 'printed');
                return (
                  <div key={r.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${isReady ? 'bg-[hsl(var(--chart-1))]/10' : 'bg-[hsl(var(--chart-2))]/10'}`}>
                        {isReady ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-1))]" /> : <Clock className="h-4 w-4 text-[hsl(var(--chart-2))]" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{r.patient?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground"><span className="data-mono">{r.order_code}</span> · <span className="data-mono">{r.patient?.patient_code}</span></p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(r.items)}
                      <div className="text-xs text-muted-foreground text-right">
                        {r.items.length} test(s)
                      </div>
                      {isReady ? (
                        <div className="flex gap-1">
                          <Link href={`/lab/reports/${r.id}`}>
                            <Button size="sm" variant="outline"><Printer className="mr-1 h-3 w-3" /> Print</Button>
                          </Link>
                          <Link href={`/lab/reports/${r.id}`}>
                            <Button size="sm" variant="ghost"><FileText className="h-3 w-3" /></Button>
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not ready</span>
                      )}
                    </div>
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
