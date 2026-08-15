'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, Loader2, Copy, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { BASIS_OPTIONS, computePriority, validateShareValue } from '@/lib/utils/shares';
import type { Doctor, Department, Service, ShareRule } from '@/lib/types';

const CATEGORIES = [
  { value: 'lab', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'opd', label: 'OPD' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'package', label: 'Package' },
];

export default function DoctorShareConfigPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<ShareRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ShareRule | null>(null);
  const [copyFromDoctor, setCopyFromDoctor] = useState('');

  const [form, setForm] = useState({
    doctor_type: 'performing_doctor' as 'performing_doctor' | 'opd_doctor',
    doctor_ids: [] as string[],
    department_id: '',
    service_ids: [] as string[],
    service_category: '',
    share_type: 'percentage',
    share_value: '30',
    calculation_basis: 'net_amount',
    effective_date: new Date().toISOString().slice(0, 10),
    effective_to: '',
    applyToAllDoctors: false,
    applyToAllServices: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dRes, depRes, sRes, rRes] = await Promise.all([
      supabase.from('doctors').select('*').eq('is_active', true).order('full_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('share_rules')
        .select('*, doctor:doctors(full_name), department:departments(name), service:services(name)')
        .in('share_for', ['performing_doctor', 'opd_doctor'])
        .order('priority', { ascending: false }),
    ]);
    setDoctors((dRes.data as Doctor[]) || []);
    setDepartments((depRes.data as Department[]) || []);
    setServices((sRes.data as Service[]) || []);
    setRules((rRes.data as ShareRule[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleDoctor = (id: string) => {
    setForm((prev) => ({
      ...prev,
      doctor_ids: prev.doctor_ids.includes(id) ? prev.doctor_ids.filter((d) => d !== id) : [...prev.doctor_ids, id],
    }));
  };

  const toggleService = (id: string) => {
    setForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(id) ? prev.service_ids.filter((s) => s !== id) : [...prev.service_ids, id],
    }));
  };

  const resetForm = () => {
    setForm({
      doctor_type: 'performing_doctor', doctor_ids: [], department_id: '', service_ids: [],
      service_category: '', share_type: 'percentage', share_value: '30',
      calculation_basis: 'net_amount',
      effective_date: new Date().toISOString().slice(0, 10), effective_to: '',
      applyToAllDoctors: false, applyToAllServices: false,
    });
    setEditingRule(null);
  };

  const handleSave = async () => {
    const value = parseFloat(form.share_value);
    const err = validateShareValue(form.share_type, value);
    if (err) { toast.error(err); return; }
    if (form.doctor_ids.length === 0 && !form.applyToAllDoctors) { toast.error('Select at least one doctor or "All Doctors"'); return; }
    if (form.service_ids.length === 0 && !form.applyToAllServices && !form.service_category && !form.department_id) {
      toast.error('Select services, a category, or a department'); return;
    }

    setSubmitting(true);

    if (editingRule) {
      const { error } = await supabase.from('share_rules').update({
        doctor_type: form.doctor_type,
        share_type: form.share_type,
        share_value: value,
        calculation_basis: form.calculation_basis,
        effective_date: form.effective_date,
        effective_to: form.effective_to || null,
        updated_at: new Date().toISOString(),
        updated_by: appUser?.id,
      }).eq('id', editingRule.id);
      if (error) { toast.error('Failed to update: ' + error.message); setSubmitting(false); return; }
      toast.success('Rule updated');
    } else {
      const doctorIds = form.applyToAllDoctors ? [null] : form.doctor_ids;
      const serviceIds = form.applyToAllServices ? [null] : form.service_ids;
      const rows: any[] = [];
      for (const docId of doctorIds) {
        for (const svcId of serviceIds) {
          const priority = computePriority(docId, svcId, form.department_id || null, null, form.service_category || null);
          rows.push({
            company_id: appUser?.company_id,
            branch_id: appUser?.branch_id,
            share_for: form.doctor_type,
            doctor_type: form.doctor_type,
            doctor_id: docId,
            department_id: form.department_id || null,
            service_id: svcId,
            service_category: form.service_category || null,
            share_type: form.share_type,
            share_value: value,
            calculation_basis: form.calculation_basis,
            effective_date: form.effective_date,
            effective_to: form.effective_to || null,
            priority,
            is_active: true,
            created_by: appUser?.id,
          });
        }
      }
      const { error } = await supabase.from('share_rules').insert(rows);
      if (error) { toast.error('Failed to save: ' + error.message); setSubmitting(false); return; }
      toast.success(`${rows.length} rule(s) created`);
    }

    resetForm();
    setShowForm(false);
    setSubmitting(false);
    loadData();
  };

  const handleEdit = (rule: ShareRule) => {
    setEditingRule(rule);
    setForm({
      doctor_type: (rule.doctor_type as 'performing_doctor' | 'opd_doctor') || 'performing_doctor',
      doctor_ids: rule.doctor_id ? [rule.doctor_id] : [],
      department_id: rule.department_id || '',
      service_ids: rule.service_id ? [rule.service_id] : [],
      service_category: rule.service_category || '',
      share_type: rule.share_type,
      share_value: String(rule.share_value),
      calculation_basis: rule.calculation_basis,
      effective_date: rule.effective_date,
      effective_to: rule.effective_to || '',
      applyToAllDoctors: !rule.doctor_id,
      applyToAllServices: !rule.service_id,
    });
    setShowForm(true);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('share_rules').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    loadData();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from('share_rules').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Rule deleted');
    loadData();
  };

  const handleCopyConfig = async () => {
    if (!copyFromDoctor) { toast.error('Select a source doctor'); return; }
    const targetDoctors = form.doctor_ids;
    if (targetDoctors.length === 0) { toast.error('Select target doctors to copy to'); return; }
    setSubmitting(true);
    const { data: sourceRules } = await supabase.from('share_rules')
      .select('*').eq('doctor_id', copyFromDoctor).eq('is_active', true);
    if (!sourceRules || sourceRules.length === 0) { toast.error('No active rules found for source doctor'); setSubmitting(false); return; }
    const newRules = sourceRules.map((r: any) => ({
      company_id: r.company_id,
      branch_id: r.branch_id,
      share_for: r.share_for,
      doctor_type: r.doctor_type,
      doctor_id: targetDoctors,
      department_id: r.department_id,
      service_id: r.service_id,
      service_category: r.service_category,
      share_type: r.share_type,
      share_value: r.share_value,
      calculation_basis: r.calculation_basis,
      effective_date: r.effective_date,
      effective_to: r.effective_to,
      priority: r.priority,
      is_active: true,
      created_by: appUser?.id,
    })).flatMap((r: any) => targetDoctors.map((docId: string) => ({ ...r, doctor_id: docId })));
    const { error } = await supabase.from('share_rules').insert(newRules);
    if (error) { toast.error('Failed to copy: ' + error.message); setSubmitting(false); return; }
    toast.success(`Copied ${newRules.length} rule(s) to ${targetDoctors.length} doctor(s)`);
    setCopyFromDoctor('');
    setSubmitting(false);
    loadData();
  };

  const handleExport = () => {
    const exportData = rules.map((r) => ({
      share_for: r.share_for,
      doctor_type: r.doctor_type,
      doctor: r.doctor?.full_name ?? null,
      department: r.department?.name ?? null,
      service: r.service?.name ?? null,
      service_category: r.service_category,
      share_type: r.share_type,
      share_value: r.share_value,
      calculation_basis: r.calculation_basis,
      effective_date: r.effective_date,
      effective_to: r.effective_to,
      priority: r.priority,
      is_active: r.is_active,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctor-share-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported configuration');
  };

  const filteredServices = form.service_category
    ? services.filter((s) => s.category === form.service_category)
    : services;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Doctor Share Configuration</h1>
          <p className="text-muted-foreground">Configure OPD and Performing doctor shares with priority-based matching</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRule ? 'Edit Rule' : 'Create Share Rule'}</CardTitle>
            <CardDescription>Specific rules override general ones. The highest-priority matching rule applies per transaction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Doctor Type</Label>
                <Select value={form.doctor_type} onValueChange={(v) => setForm({ ...form, doctor_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performing_doctor">Performing Doctor</SelectItem>
                    <SelectItem value="opd_doctor">OPD Doctor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Share Type</Label>
                <Select value={form.share_type} onValueChange={(v) => setForm({ ...form, share_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.share_type === 'percentage' ? 'Percentage' : 'Amount (Rs)'}</Label>
                <Input type="number" value={form.share_value} onChange={(e) => setForm({ ...form, share_value: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Calculation Basis</Label>
                <Select value={form.calculation_basis} onValueChange={(v) => setForm({ ...form, calculation_basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BASIS_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Effective To (optional)</Label>
                <Input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
              </div>
            </div>

            {!editingRule && (
              <>
                <div className="space-y-2">
                  <Label>Department (optional)</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Doctors</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, doctor_ids: doctors.map((d) => d.id), applyToAllDoctors: true })}>Select All</Button>
                      <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, doctor_ids: [], applyToAllDoctors: false })}>Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                    {doctors.map((d) => (
                      <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted/50">
                        <Checkbox checked={form.doctor_ids.includes(d.id)} onCheckedChange={() => toggleDoctor(d.id)} />
                        <span className="text-sm">{d.full_name}{d.specialization ? ` · ${d.specialization}` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Service Category (optional filter)</Label>
                  <Select value={form.service_category} onValueChange={(v) => setForm({ ...form, service_category: v, service_ids: [] })}>
                    <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Services</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, service_ids: services.map((s) => s.id), applyToAllServices: true })}>Select All</Button>
                      <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, service_ids: [], applyToAllServices: false })}>Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                    {filteredServices.length === 0 ? (
                      <p className="p-2 text-center text-sm text-muted-foreground">No services in this category</p>
                    ) : (
                      filteredServices.map((s) => (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted/50">
                          <Checkbox checked={form.service_ids.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                          <span className="text-sm">{s.name}</span>
                          <Badge variant="outline" className="text-xs">{s.category}</Badge>
                          <span className="ml-auto text-xs text-muted-foreground">Rs {Number(s.price).toLocaleString()}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> {editingRule ? 'Update' : 'Save'} Rule(s)</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Copy Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Copy Configuration</CardTitle>
          <CardDescription>Copy share rules from one doctor to others</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>From Doctor</Label>
              <Select value={copyFromDoctor} onValueChange={setCopyFromDoctor}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>To Doctors</Label>
              <div className="flex flex-wrap gap-2">
                {doctors.slice(0, 6).map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-muted/50">
                    <Checkbox checked={form.doctor_ids.includes(d.id)} onCheckedChange={() => toggleDoctor(d.id)} />
                    {d.full_name.split(' ')[0]}
                  </label>
                ))}
                {doctors.length > 6 && <span className="text-xs text-muted-foreground self-center">+{doctors.length - 6} more...</span>}
              </div>
            </div>
            <Button onClick={handleCopyConfig} disabled={submitting} variant="secondary">
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Rules ({rules.length})</CardTitle>
          <CardDescription>Higher priority rules take precedence. Priority: Doctor+Service &gt; Doctor+Category &gt; Doctor+All &gt; All Doctors+Service &gt; Global</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No rules configured yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor Type</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                    <TableCell><Badge variant="outline">{r.doctor_type === 'opd_doctor' ? 'OPD' : 'Performing'}</Badge></TableCell>
                    <TableCell>{r.doctor?.full_name ?? 'All Doctors'}</TableCell>
                    <TableCell>{r.department?.name ?? '-'}</TableCell>
                    <TableCell>{r.service?.name ?? r.service_category ?? 'All Services'}</TableCell>
                    <TableCell>{r.share_type}</TableCell>
                    <TableCell className="font-medium">{r.share_type === 'percentage' ? `${r.share_value}%` : `Rs ${Number(r.share_value).toLocaleString()}`}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(r.calculation_basis || 'net_amount').replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge variant="secondary">{r.priority}</Badge></TableCell>
                    <TableCell className="text-xs">{r.effective_date}{r.effective_to ? ` → ${r.effective_to}` : ''}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(r.id, r.is_active)}>
                        {r.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(r)}>
                          <Save className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
