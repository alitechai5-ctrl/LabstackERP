'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LabOrderItem, LabResult, Doctor } from '@/lib/types';

type ItemWithRelations = LabOrderItem & { order?: any; patient?: any; results?: LabResult[]; service?: any };

export default function RadiologyApprovalPage() {
  const supabase = getSupabaseClient();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveDoctorId, setApproveDoctorId] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, dRes] = await Promise.all([
      supabase.from('lab_order_items')
        .select('*, order:lab_orders(*, patient:patients(*)), results:lab_results(*), service:services(category)')
        .in('status', ['result_entered', 'verified'])
        .order('created_at', { ascending: false }),
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (iRes.error) toast.error('Failed to load: ' + iRes.error.message);
    else setItems(((iRes.data as any) || []).filter((i: any) => i.service?.category === 'radiology'));
    setDoctors((dRes.data as Doctor[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (item: ItemWithRelations) => {
    const doctorId = approveDoctorId[item.id];
    if (!doctorId) { toast.error('Select an approving doctor'); return; }
    setApproving(item.id);
    const { error } = await supabase.from('lab_order_items').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      verified_by_doctor_id: doctorId,
    }).eq('id', item.id);
    if (error) toast.error('Failed: ' + error.message);
    else { toast.success('Report approved'); loadData(); }
    setApproving(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Radiology Approval</h1>
        <p className="text-muted-foreground">Review and approve radiology reports</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Examination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported At</TableHead>
                <TableHead>Approve By</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No reports pending approval</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                    <TableCell>{item.order?.patient?.full_name ?? 'Unknown'}</TableCell>
                    <TableCell>{item.service_name}</TableCell>
                    <TableCell><Badge variant={item.status === 'verified' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.result_entered_at ? new Date(item.result_entered_at).toLocaleString() : '-'}</TableCell>
                    <TableCell>
                      <Select value={approveDoctorId[item.id] ?? ''} onValueChange={(v) => setApproveDoctorId((prev) => ({ ...prev, [item.id]: v }))}>
                        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                        <SelectContent>
                          {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleApprove(item)} disabled={approving === item.id}>
                        {approving === item.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                        Approve
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
