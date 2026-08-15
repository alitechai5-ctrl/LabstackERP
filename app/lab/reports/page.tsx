'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Printer, FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import type { LabOrder, LabOrderItem, LabResult, Patient } from '@/lib/types';

type OrderWithRelations = LabOrder & {
  patient?: Patient;
  doctor?: any;
  lab_order_items?: (LabOrderItem & { results?: LabResult[] })[];
};

const STATUS_FLOW = ['pending', 'sample_collected', 'processing', 'result_entered', 'verified', 'approved', 'printed'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sample_collected: 'Sample Collected',
  processing: 'Processing',
  result_entered: 'Result Entered',
  verified: 'Verified',
  approved: 'Approved',
  printed: 'Printed',
};

export default function LabReportsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_orders')
      .select('*, patient:patients(*), doctor:doctors(*), lab_order_items:lab_order_items(*, results:lab_results(*), service:services(category))')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load: ' + error.message);
    } else {
      const allOrders = (data as any) || [];
      const labOnly = allOrders
        .map((o: any) => ({
          ...o,
          lab_order_items: (o.lab_order_items || []).filter((item: any) => item.service?.category === 'lab'),
        }))
        .filter((o: any) => o.lab_order_items.length > 0);
      setOrders(labOnly as any);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkPrinted = async (item: LabOrderItem) => {
    const { error } = await supabase
      .from('lab_order_items')
      .update({ status: 'printed' })
      .eq('id', item.id);
    if (error) toast.error('Failed: ' + error.message);
    else loadData();
  };

  const filtered = statusFilter === 'all'
    ? orders
    : orders.filter((o) =>
        o.lab_order_items?.some((item) => item.status === statusFilter)
      );

  const allApproved = (order: OrderWithRelations) =>
    order.lab_order_items?.every((item) => item.status === 'approved' || item.status === 'printed');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Reports</h1>
        <p className="text-muted-foreground">Track report status and print ready reports</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All
        </Button>
        {STATUS_FLOW.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No lab orders found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {order.order_code}
                    </CardTitle>
                    <CardDescription>
                      {order.patient?.full_name} | <span className="data-mono">{order.patient?.patient_code}</span> |
                      {' '}{new Date(order.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                      {order.status.replace('_', ' ')}
                    </Badge>
                    {allApproved(order) && (
                      <Button
                        size="sm"
                        onClick={() => window.open(`/lab/reports/${order.id}`, '_blank')}
                      >
                        <Printer className="mr-1 h-3 w-3" />
                        Print Report
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Range</TableHead>
                      <TableHead>Flag</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lab_order_items?.map((item) => {
                      const result = item.results?.[0];
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.service_name}</TableCell>
                          <TableCell>{result?.result_value ?? '-'}</TableCell>
                          <TableCell>{result?.unit ?? '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{result?.normal_range ?? '-'}</TableCell>
                          <TableCell>
                            {result?.flag && result.flag !== 'normal' ? (
                              <Badge variant="destructive">{result.flag}</Badge>
                            ) : (
                              <Badge variant="secondary">normal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {STATUS_LABELS[item.status] || item.status}
                              </Badge>
                              {item.status === 'approved' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkPrinted(item)}
                                >
                                  Mark Printed
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
