'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, User, Phone, Calendar, FlaskConical, CheckCircle2, Clock, Printer, ArrowRight } from 'lucide-react';
import type { LabOrder, LabOrderItem, Patient } from '@/lib/types';

type OrderWithRelations = LabOrder & {
  patient?: Patient;
  doctor?: { full_name: string } | null;
  referral_source?: { name: string } | null;
  items?: (LabOrderItem & { results?: any[] })[];
};

const STAGES = [
  { key: 'registered', label: 'Registered', icon: User },
  { key: 'sample_collected', label: 'Sample Collected', icon: FlaskConical },
  { key: 'processing', label: 'Processing', icon: Clock },
  { key: 'result_entered', label: 'Result Entered', icon: FileText },
  { key: 'verified', label: 'Verified', icon: CheckCircle2 },
  { key: 'approved', label: 'Report Ready', icon: CheckCircle2 },
  { key: 'printed', label: 'Printed', icon: Printer },
];

function getStageStatus(item: LabOrderItem): 'done' | 'current' | 'pending' {
  const statusOrder = ['pending', 'sample_collected', 'processing', 'result_entered', 'verified', 'approved', 'printed'];
  const idx = statusOrder.indexOf(item.status);
  if (idx >= 5) return 'done';
  if (idx >= 1) return 'current';
  return 'pending';
}

export default function ReceptionSearchPage() {
  const supabase = getSupabaseClient();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderWithRelations[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setSearched(true);
    let dataQuery = supabase
      .from('lab_orders')
      .select('*, patient:patients(*), doctor:doctors(full_name), referral_source:referral_sources(name), items:lab_order_items(*, results:lab_results(*))')
      .order('created_at', { ascending: false })
      .limit(20);

    if (q.trim()) {
      // Search by order code or patient name via join
      const { data: patients } = await supabase.from('patients').select('id').ilike('full_name', `%${q}%`);
      const patientIds = (patients || []).map((p: any) => p.id);
      if (patientIds.length > 0) {
        dataQuery = dataQuery.in('patient_id', patientIds);
      } else {
        // Try order code match
        dataQuery = dataQuery.ilike('order_code', `%${q}%`);
      }
    }

    const { data, error } = await dataQuery;
    if (error) { console.error(error); }
    setResults((data as any) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (orderId) {
      setQuery(orderId);
      search(orderId);
    }
  }, [orderId, search]);

  useEffect(() => {
    // Load recent orders on mount
    search('');
  }, [search]);

  const handleSelect = (order: OrderWithRelations) => {
    setSelectedOrder(order);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Search</h1>
        <p className="text-muted-foreground">Search by name, MR number, invoice number, or phone</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(query)}
            placeholder="Search patient name, invoice number, MR number..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => search(query)} disabled={loading}>
          {loading ? <Clock className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Search Results */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{searched && query ? `Results (${results.length})` : 'Recent Orders'}</h2>
          {results.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No orders found</CardContent></Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {results.map((order) => (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedOrder?.id === order.id ? 'border-primary' : ''}`}
                  onClick={() => handleSelect(order)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="font-medium text-sm">{order.patient?.full_name ?? 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.order_code} · {order.patient?.patient_code}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'partial' ? 'secondary' : 'destructive'}>{order.payment_status}</Badge>
                        <span className="text-sm font-medium">Rs {Number(order.net_amount).toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Patient Journey / Status Tracker */}
        <div className="space-y-4">
          {selectedOrder ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Patient Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="font-medium">{selectedOrder.patient?.full_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">MR Number:</span><span className="font-mono">{selectedOrder.patient?.patient_code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span>{selectedOrder.patient?.phone ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice:</span><span className="font-mono">{selectedOrder.order_code}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Doctor:</span><span>{selectedOrder.doctor?.full_name ?? 'Walk-in'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Referral:</span><span>{selectedOrder.referral_source?.name ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span>{new Date(selectedOrder.created_at).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-medium">Rs {Number(selectedOrder.total_amount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Net:</span><span className="font-medium">Rs {Number(selectedOrder.net_amount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span className="font-medium">Rs {Number(selectedOrder.paid_amount).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Balance:</span><span className="font-medium text-destructive data-mono">Rs {(Number(selectedOrder.net_amount) - Number(selectedOrder.paid_amount)).toLocaleString()}</span></div>
                </CardContent>
              </Card>

              {/* Test Status Tracker */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Status Tracker</CardTitle>
                  <CardDescription>Track each test through the workflow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(selectedOrder.items || []).map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.service_name}</span>
                        <Badge variant={item.status === 'approved' || item.status === 'printed' ? 'default' : item.status === 'pending' ? 'secondary' : 'outline'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {/* Stage Progress Bar */}
                      <div className="flex items-center gap-1">
                        {STAGES.map((stage, idx) => {
                          const itemStatus = getStageStatus(item);
                          const stageIdx = ['pending', 'sample_collected', 'processing', 'result_entered', 'verified', 'approved', 'printed'].indexOf(item.status);
                          const isDone = idx <= stageIdx && item.status !== 'pending';
                          const isCurrent = idx === stageIdx && item.status !== 'pending' && item.status !== 'approved' && item.status !== 'printed';
                          return (
                            <div key={stage.key} className="flex items-center flex-1">
                              <div className={`flex flex-col items-center gap-1 ${idx > 0 ? 'flex-1' : ''}`}>
                                {idx > 0 && <div className={`h-0.5 w-full ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
                                <div className={`rounded-full p-1 ${isDone ? 'bg-primary text-primary-foreground' : isCurrent ? 'bg-primary/20 border-2 border-primary' : 'bg-muted text-muted-foreground'}`}>
                                  <stage.icon className="h-3 w-3" />
                                </div>
                                <span className="text-[10px] text-muted-foreground hidden sm:block">{stage.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {item.collected_at && (
                        <p className="text-xs text-muted-foreground">Collected: {new Date(item.collected_at).toLocaleString()}</p>
                      )}
                      {item.approved_at && (
                        <p className="text-xs text-[hsl(var(--chart-1))]">Approved: {new Date(item.approved_at).toLocaleString()}</p>
                      )}
                    </div>
                  ))}
                  {/* Print Actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link href={`/reception/receipt/${selectedOrder.id}`} className="flex-1">
                      <Button variant="outline" className="w-full"><Printer className="mr-2 h-4 w-4" /> Receipt</Button>
                    </Link>
                    <Link href={`/reception/barcode/${selectedOrder.id}`} className="flex-1">
                      <Button variant="outline" className="w-full"><Printer className="mr-2 h-4 w-4" /> Barcodes</Button>
                    </Link>
                    {(selectedOrder.items || []).every(i => i.status === 'approved' || i.status === 'printed') && (selectedOrder.items || []).length > 0 && (
                      <Link href={`/lab/reports/${selectedOrder.id}`} className="flex-1">
                        <Button className="w-full"><Printer className="mr-2 h-4 w-4" /> Report</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Select an order to view patient journey</p>
                <p className="text-sm text-muted-foreground mt-1">Click any order on the left to see the full status tracker</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
