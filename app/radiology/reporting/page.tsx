'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Save, CheckCircle2, Bold, Italic, Underline, List, ListOrdered, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import type { LabOrderItem, LabOrder, Patient, Service, Doctor } from '@/lib/types';

type ItemWithRelations = LabOrderItem & { order?: LabOrder; patient?: Patient; service?: Service };

const REPORT_TEMPLATES: { name: string; findings: string; impression: string }[] = [
  {
    name: 'X-Ray Chest PA',
    findings: '<b>Findings:</b><br>Lung fields are clear. Cardiac silhouette is normal in size and contour. Costophrenic angles are sharp. Bony thorax is unremarkable.<br><br><b>Technique:</b> PA view chest radiograph.',
    impression: 'Normal chest radiograph. No acute cardiopulmonary abnormality detected.',
  },
  {
    name: 'Ultrasound Abdomen',
    findings: '<b>Findings:</b><br>Liver: Normal in size and echogenicity. No focal lesion.<br>Gallbladder: Well-distended, no stones or wall thickening.<br>Pancreas: Normal.<br>Spleen: Normal size.<br>Kidneys: Normal in size and corticomedullary differentiation.<br>No free fluid seen.',
    impression: 'Normal abdominal ultrasound examination.',
  },
  {
    name: 'CT Head (Plain)',
    findings: '<b>Findings:</b><br>Brain parenchyma shows normal density. Ventricular system is normal in size and position. Midline is not shifted. Basal cisterns are unremarkable. No intracranial hemorrhage or infarct detected. Bone windows show no fracture.',
    impression: 'Normal CT scan of the head. No acute intracranial abnormality.',
  },
  {
    name: 'MRI Lumbar Spine',
    findings: '<b>Findings:</b><br>Lumbar vertebral bodies show normal signal intensity. Disc spaces are maintained. Conus medullaris ends at L1 level. No spinal canal stenosis. Nerve roots exit normally.',
    impression: 'No significant abnormality detected in the lumbar spine.',
  },
];

export default function RadiologyReportingPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ItemWithRelations | null>(null);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, docsRes] = await Promise.all([
      supabase
        .from('lab_order_items')
        .select('*, order:lab_orders(*, patient:patients(*)), service:services(*)')
        .in('status', ['pending', 'sample_collected', 'processing', 'result_entered'])
        .order('created_at', { ascending: false }),
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (itemsRes.error) { toast.error(itemsRes.error.message); setLoading(false); return; }
    const all = (itemsRes.data as any) || [];
    const radio = all.filter((i: any) => i.service?.category === 'radiology');
    setItems(radio);
    setDoctors((docsRes.data as Doctor[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const openReport = (item: ItemWithRelations) => {
    setSelected(item);
    setFindings('');
    setImpression('');
    setSelectedDoctorId(item.verified_by_doctor_id ?? '');
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ''; }, 50);
  };

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) setFindings(editorRef.current.innerHTML);
    editorRef.current?.focus();
  };

  const onEditorInput = () => {
    if (editorRef.current) setFindings(editorRef.current.innerHTML);
  };

  const applyTemplate = (templateName: string) => {
    const tpl = REPORT_TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    if (editorRef.current) editorRef.current.innerHTML = tpl.findings;
    setFindings(tpl.findings);
    setImpression(tpl.impression);
    toast.success(`Applied template: ${templateName}`);
  };

  const handleSave = async () => {
    if (!selected || !findings.trim()) return;
    setSaving(true);
    const { error: rError } = await supabase.from('lab_results').insert({
      lab_order_item_id: selected.id,
      service_id: selected.service_id,
      result_value: findings,
      remarks: impression,
      flag: 'normal',
    });
    if (rError) { toast.error(rError.message); setSaving(false); return; }
    const { error: uError } = await supabase.from('lab_order_items').update({
      status: 'result_entered',
      result_entered_at: new Date().toISOString(),
      result_entered_by: appUser?.id ?? null,
      verified_by_doctor_id: selectedDoctorId || null,
    }).eq('id', selected.id);
    if (uError) { toast.error(uError.message); setSaving(false); return; }
    toast.success('Report saved and sent for verification');
    setSelected(null);
    setSaving(false);
    load();
  };

  const handleApprove = async () => {
    if (!selected || !findings.trim()) return;
    setApproving(true);
    const { error: rError } = await supabase.from('lab_results').insert({
      lab_order_item_id: selected.id,
      service_id: selected.service_id,
      result_value: findings,
      remarks: impression,
      flag: 'normal',
    });
    if (rError) { toast.error(rError.message); setApproving(false); return; }
    const { error: uError } = await supabase.from('lab_order_items').update({
      status: 'approved',
      result_entered_at: new Date().toISOString(),
      result_entered_by: appUser?.id ?? null,
      verified_at: new Date().toISOString(),
      verified_by: appUser?.id ?? null,
      verified_by_doctor_id: selectedDoctorId || null,
    }).eq('id', selected.id);
    if (uError) { toast.error(uError.message); setApproving(false); return; }
    toast.success('Report approved and signed off');
    setSelected(null);
    setApproving(false);
    load();
  };

  const pendingItems = items.filter((i) => i.status !== 'result_entered' && i.status !== 'approved');
  const reviewItems = items.filter((i) => i.status === 'result_entered');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Radiology Reporting</h1>
        <p className="text-muted-foreground">Enter findings and impressions for radiology examinations</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingItems.length})</TabsTrigger>
          <TabsTrigger value="review">Awaiting Sign-off ({reviewItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Reports ({pendingItems.length})</CardTitle>
              <CardDescription>Radiology examinations awaiting report entry</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Examination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
                  ) : pendingItems.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No pending radiology examinations</TableCell></TableRow>
                  ) : (
                    pendingItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                        <TableCell>{item.order?.patient?.full_name ?? 'Unknown'}</TableCell>
                        <TableCell>{item.service_name}</TableCell>
                        <TableCell><Badge variant="secondary">{item.status.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openReport(item)}>
                            <FileText className="mr-1 h-3 w-3" /> Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Awaiting Sign-off ({reviewItems.length})</CardTitle>
              <CardDescription>Reports entered but not yet approved</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Examination</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No reports awaiting sign-off</TableCell></TableRow>
                  ) : (
                    reviewItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.order?.order_code}</TableCell>
                        <TableCell>{item.order?.patient?.full_name ?? 'Unknown'}</TableCell>
                        <TableCell>{item.service_name}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => openReport(item)}>
                            <Stethoscope className="mr-1 h-3 w-3" /> Review & Sign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Radiology Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{selected?.order?.patient?.full_name}</span></div>
              <div><span className="text-muted-foreground">Order:</span> <span className="font-mono">{selected?.order?.order_code}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Examination:</span> <span className="font-medium">{selected?.service_name}</span></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Apply Template</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TEMPLATES.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Findings</Label>
              <div className="rounded-lg border">
                <div className="flex gap-1 border-b p-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('bold')}><Bold className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('italic')}><Italic className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('underline')}><Underline className="h-4 w-4" /></Button>
                  <div className="mx-1 w-px bg-border" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('insertUnorderedList')}><List className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={onEditorInput}
                  className="min-h-[200px] p-3 text-sm outline-none prose prose-sm max-w-none"
                  data-placeholder="Enter detailed radiological findings..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Impression</Label>
              <textarea
                rows={3}
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                placeholder="Enter radiological impression..."
                className="w-full rounded-lg border p-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Verified / Signed by Doctor</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger><SelectValue placeholder="Select a doctor to sign off..." /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}{d.specialization ? ` — ${d.specialization}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="secondary" onClick={handleSave} disabled={saving || !findings.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Draft
            </Button>
            <Button onClick={handleApprove} disabled={approving || !findings.trim()}>
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Save & Sign Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
