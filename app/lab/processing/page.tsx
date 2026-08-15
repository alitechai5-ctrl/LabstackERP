'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FlaskConical } from 'lucide-react';
import type { LabOrderItem } from '@/lib/types';

export default function LabProcessingPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<(LabOrderItem & { order?: any })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_order_items')
      .select('*, order:lab_orders(*, patient:patients(*)), service:services(category)')
      .eq('status', 'sample_collected')
      .order('collected_at', { ascending: false });
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

  const handleStartProcessing = async (item: LabOrderItem) => {
    const { error } = await supabase
      .from('lab_order_items')
      .update({ status: 'processing' })
      .eq('id', item.id);
    if (error) toast.error('Failed: ' + error.message);
    else {
      toast.success('Processing started');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Processing</h1>
        <p className="text-muted-foreground">Samples currently being processed</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sample ID</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Collected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No samples in processing</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="data-mono text-sm">{item.sample_id ?? '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                    <TableCell>{item.order?.patient?.full_name}</TableCell>
                    <TableCell>{item.service_name}</TableCell>
                    <TableCell>{item.collected_at ? new Date(item.collected_at).toLocaleString() : '-'}</TableCell>
                    <TableCell><Badge>Collected</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleStartProcessing(item)}>
                        <FlaskConical className="mr-1 h-3 w-3" />
                        Start
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
