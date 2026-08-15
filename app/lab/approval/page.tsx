'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import type { LabOrderItem, LabResult } from '@/lib/types';

type ItemWithRelations = LabOrderItem & { order?: any; results?: LabResult[] };

export default function LabApprovalPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_order_items')
      .select('*, order:lab_orders(*, patient:patients(*)), results:lab_results(*), service:services(category)')
      .eq('status', 'verified')
      .order('verified_at', { ascending: false });
    if (error) {
      toast.error('Failed to load: ' + error.message);
    } else {
      setItems(((data as any) || []).filter((i: any) => i.service?.category === 'lab'));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (item: LabOrderItem) => {
    const { error } = await supabase
      .from('lab_order_items')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: appUser?.id ?? null,
      })
      .eq('id', item.id);
    if (error) toast.error('Failed: ' + error.message);
    else {
      toast.success('Result approved - ready for printing');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval</h1>
        <p className="text-muted-foreground">Approve verified results to make them available for printing</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No results pending approval</TableCell></TableRow>
              ) : (
                items.map((item) => {
                  const result = item.results?.[0];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                      <TableCell>{item.order?.patient?.full_name}</TableCell>
                      <TableCell>{item.service_name}</TableCell>
                      <TableCell>{result?.result_value ?? '-'} {result?.unit}</TableCell>
                      <TableCell>
                        <Badge variant={result?.flag === 'normal' ? 'secondary' : 'destructive'}>
                          {result?.flag ?? '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.verified_at ? new Date(item.verified_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleApprove(item)}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
