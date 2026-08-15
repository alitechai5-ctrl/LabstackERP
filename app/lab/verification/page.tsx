'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { LabOrderItem, LabResult, Doctor } from '@/lib/types';

type ItemWithRelations = LabOrderItem & { order?: any; results?: LabResult[]; service?: any };

export default function LabVerificationPage() {
  const supabase = getSupabaseClient();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyDoctorId, setVerifyDoctorId] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [iRes, dRes] = await Promise.all([
      supabase.from('lab_order_items')
        .select('*, order:lab_orders(*, patient:patients(*)), results:lab_results(*), service:services(category)')
        .eq('status', 'result_entered')
        .order('result_entered_at', { ascending: false }),
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (iRes.error) toast.error('Failed to load: ' + iRes.error.message);
    else setItems(((iRes.data as any) || []).filter((i: any) => i.service?.category === 'lab'));
    setDoctors((dRes.data as Doctor[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleVerify = async (item: ItemWithRelations) => {
    const doctorId = verifyDoctorId[item.id];
    if (!doctorId) { toast.error('Select a verifying doctor'); return; }
    setVerifying(item.id);
    const { error } = await supabase.from('lab_order_items').update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by_doctor_id: doctorId,
    }).eq('id', item.id);
    if (error) toast.error('Failed: ' + error.message);
    else { toast.success('Result verified'); loadData(); }
    setVerifying(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verification</h1>
        <p className="text-muted-foreground">Review and verify entered results before approval</p>
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
                <TableHead>Entered</TableHead>
                <TableHead>Verify By</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No results pending verification</TableCell></TableRow>
              ) : (
                items.map((item) => {
                  const result = item.results?.[0];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                      <TableCell>{item.order?.patient?.full_name}</TableCell>
                      <TableCell>{item.service_name}</TableCell>
                      <TableCell>{result?.result_value ?? '-'} {result?.unit}</TableCell>
                      <TableCell><Badge variant={result?.flag === 'normal' ? 'secondary' : 'destructive'}>{result?.flag ?? '-'}</Badge></TableCell>
                      <TableCell>{item.result_entered_at ? new Date(item.result_entered_at).toLocaleString() : '-'}</TableCell>
                      <TableCell>
                        <Select value={verifyDoctorId[item.id] ?? ''} onValueChange={(v) => setVerifyDoctorId((prev) => ({ ...prev, [item.id]: v }))}>
                          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                          <SelectContent>
                            {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleVerify(item)} disabled={verifying === item.id}>
                          {verifying === item.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                          Verify
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
