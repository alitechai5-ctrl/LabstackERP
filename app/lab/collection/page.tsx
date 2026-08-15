'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { TestTube, CheckCircle2 } from 'lucide-react';
import type { LabOrder, LabOrderItem, Patient } from '@/lib/types';

export default function LabCollectionPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<(LabOrderItem & { order?: LabOrder; patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_order_items')
      .select('*, order:lab_orders(*, patient:patients(*)), service:services(category)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
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

  const handleCollect = async (item: LabOrderItem) => {
    const sampleId = `S-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase
      .from('lab_order_items')
      .update({
        status: 'sample_collected',
        sample_id: sampleId,
        collected_at: new Date().toISOString(),
        collected_by: appUser?.id ?? null,
      })
      .eq('id', item.id);
    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success(`Sample collected: ${sampleId}`);
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sample Collection</h1>
        <p className="text-muted-foreground">Collect samples for pending lab tests</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Sample Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No pending samples</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                    <TableCell>{item.order?.patient?.full_name}</TableCell>
                    <TableCell>{item.service_name}</TableCell>
                    <TableCell>{item.service?.sample_type ?? '-'}</TableCell>
                    <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleCollect(item)}>
                        <TestTube className="mr-1 h-3 w-3" />
                        Collect
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
