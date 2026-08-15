'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileEdit, Loader2, Plus, Trash2 } from 'lucide-react';
import type { LabOrderItem, LabResult, Service, TestParameter, LabResultParameter } from '@/lib/types';

type ItemWithRelations = LabOrderItem & { order?: any; results?: LabResult[]; service?: Service };

type ParamRow = {
  test_parameter_id: string | null;
  parameter_name: string;
  result_value: string;
  unit: string;
  normal_range: string;
  flag: 'normal' | 'low' | 'high' | 'critical';
};

export default function LabResultsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<ItemWithRelations | null>(null);
  const [testParameters, setTestParameters] = useState<TestParameter[]>([]);
  const [paramRows, setParamRows] = useState<ParamRow[]>([]);
  const [generalResult, setGeneralResult] = useState({ result_value: '', unit: '', normal_range: '', flag: 'normal' as const, method: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lab_order_items')
      .select('*, order:lab_orders(*, patient:patients(*)), results:lab_results(*, parameters:lab_result_parameters(*)), service:services(*)')
      .in('status', ['processing', 'result_entered'])
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load: ' + error.message);
    } else {
      setItems(((data as any) || []).filter((i: any) => i.service?.category === 'lab'));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTestParameters = async (serviceId: string) => {
    const { data } = await supabase.from('test_parameters').select('*').eq('service_id', serviceId).eq('is_active', true).order('display_order');
    return (data as TestParameter[]) || [];
  };

  const handleOpenResult = async (item: ItemWithRelations) => {
    setCurrentItem(item);
    const existing = item.results?.[0];
    setGeneralResult({
      result_value: existing?.result_value ?? '',
      unit: existing?.unit ?? '',
      normal_range: existing?.normal_range ?? '',
      flag: (existing?.flag as 'normal') ?? 'normal',
      method: existing?.method ?? '',
      remarks: existing?.remarks ?? '',
    });

    const params = await loadTestParameters(item.service_id);
    setTestParameters(params);

    const existingParams = existing?.parameters ?? [];
    if (params.length > 0) {
      const rows: ParamRow[] = params.map((p) => {
        const existingParam = existingParams.find((ep) => ep.test_parameter_id === p.id || ep.parameter_name === p.name);
        return {
          test_parameter_id: p.id,
          parameter_name: p.name,
          result_value: existingParam?.result_value ?? '',
          unit: existingParam?.unit ?? p.unit ?? '',
          normal_range: existingParam?.normal_range ?? p.normal_range ?? '',
          flag: (existingParam?.flag as 'normal') ?? 'normal',
        };
      });
      setParamRows(rows);
    } else {
      setParamRows(existingParams.map((ep) => ({
        test_parameter_id: ep.test_parameter_id,
        parameter_name: ep.parameter_name,
        result_value: ep.result_value ?? '',
        unit: ep.unit ?? '',
        normal_range: ep.normal_range ?? '',
        flag: (ep.flag as 'normal') ?? 'normal',
      })));
    }

    setDialogOpen(true);
  };

  const updateParamRow = (index: number, field: keyof ParamRow, value: string) => {
    const updated = [...paramRows];
    (updated[index] as any)[field] = value;
    setParamRows(updated);
  };

  const addParamRow = () => {
    setParamRows([...paramRows, { test_parameter_id: null, parameter_name: '', result_value: '', unit: '', normal_range: '', flag: 'normal' }]);
  };

  const removeParamRow = (index: number) => {
    setParamRows(paramRows.filter((_, i) => i !== index));
  };

  const handleSubmitResult = async () => {
    if (!currentItem) return;
    setSaving(true);
    const existing = currentItem.results?.[0];

    let resultId: string;
    if (existing) {
      const { data, error } = await supabase.from('lab_results').update(generalResult).eq('id', existing.id).select('id');
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return; }
      resultId = data[0].id;
      await supabase.from('lab_result_parameters').delete().eq('lab_result_id', resultId);
    } else {
      const { data, error } = await supabase.from('lab_results').insert({
        lab_order_item_id: currentItem.id,
        service_id: currentItem.service_id,
        ...generalResult,
      }).select('id');
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return; }
      resultId = data[0].id;
    }

    if (paramRows.length > 0) {
      const paramInserts = paramRows.filter(r => r.parameter_name.trim()).map(r => ({
        lab_result_id: resultId,
        test_parameter_id: r.test_parameter_id,
        parameter_name: r.parameter_name,
        result_value: r.result_value,
        unit: r.unit,
        normal_range: r.normal_range,
        flag: r.flag,
      }));
      if (paramInserts.length > 0) {
        const { error: pError } = await supabase.from('lab_result_parameters').insert(paramInserts);
        if (pError) toast.error('Failed to save parameters: ' + pError.message);
      }
    }

    const { error: statusErr } = await supabase
      .from('lab_order_items')
      .update({
        status: 'result_entered',
        result_entered_at: new Date().toISOString(),
        result_entered_by: appUser?.id ?? null,
      })
      .eq('id', currentItem.id);
    if (statusErr) toast.error('Failed to update status: ' + statusErr.message);

    setSaving(false);
    setDialogOpen(false);
    toast.success('Result saved');
    loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Result Entry</h1>
        <p className="text-muted-foreground">Enter lab test results with multi-parameter support</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Test</TableHead>
                <TableHead>Sample ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No items ready for result entry</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                    <TableCell>{item.order?.patient?.full_name}</TableCell>
                    <TableCell>{item.service_name}</TableCell>
                    <TableCell className="data-mono text-sm">{item.sample_id ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'result_entered' ? 'default' : 'secondary'}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleOpenResult(item)}>
                        <FileEdit className="mr-1 h-3 w-3" />
                        {item.results?.length ? 'Edit' : 'Enter'} Result
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enter Result - {currentItem?.service_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {paramRows.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Test Parameters</Label>
                  <Button variant="outline" size="sm" onClick={addParamRow}><Plus className="mr-1 h-3 w-3" /> Add Parameter</Button>
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Reference Range</TableHead>
                        <TableHead>Flag</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paramRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input value={row.parameter_name} onChange={(e) => updateParamRow(i, 'parameter_name', e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input value={row.result_value} onChange={(e) => updateParamRow(i, 'result_value', e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input value={row.unit} onChange={(e) => updateParamRow(i, 'unit', e.target.value)} className="h-8 w-20" />
                          </TableCell>
                          <TableCell>
                            <Input value={row.normal_range} onChange={(e) => updateParamRow(i, 'normal_range', e.target.value)} className="h-8 w-32" placeholder="3.5 - 5.5" />
                          </TableCell>
                          <TableCell>
                            <Select value={row.flag} onValueChange={(v) => updateParamRow(i, 'flag', v)}>
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeParamRow(i)}><Trash2 className="h-3 w-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Result Value</Label>
                <Input value={generalResult.result_value} onChange={(e) => setGeneralResult({ ...generalResult, result_value: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Input value={generalResult.method} onChange={(e) => setGeneralResult({ ...generalResult, method: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Overall Flag</Label>
                <Select value={generalResult.flag} onValueChange={(v) => setGeneralResult({ ...generalResult, flag: v as 'normal' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks / Notes</Label>
              <Textarea value={generalResult.remarks} onChange={(e) => setGeneralResult({ ...generalResult, remarks: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitResult} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
