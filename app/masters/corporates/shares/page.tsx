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
import { Plus, Trash2, Save, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { BASIS_OPTIONS, computePriority, validateShareValue } from '@/lib/utils/shares';
import type { CorporateClient, Department, Service, PanelShareRule } from '@/lib/types';

export default function PanelShareConfigPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<PanelShareRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<PanelShareRule | null>(null);
  const [selectedCorporate, setSelectedCorporate] = useState('');

  const [form, setForm] = useState({
    corporate_client_id: '',
    department_id: '',
    section_id: '',
    service_ids: [] as string[],
    share_type: 'percentage',
    share_value: '15',
    calculation_basis: 'net_amount',
    effective_date: new Date().toISOString().slice(0, 10),
    effective_to: '',
    applyToAllServices: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [cRes, dRes, sRes] = await Promise.all([
      supabase.from('corporate_clients').select('*').eq('is_active', true).order('name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
    ]);
    setCorporates((cRes.data as CorporateClient[]) || []);
    setDepartments((dRes.data as Department[]) || []);
    setServices((sRes.data as Service[]) || []);
    setLoading(false);
  }, [supabase]);

  const loadRules = useCallback(async () => {
    if (!selectedCorporate) { setRules([]); return; }
    setLoading(true);
    const { data } = await supabase.from('panel_share_rules')
      .select('*, corporate_client:corporate_clients(name), department:departments(name), service:services(name)')
      .eq('corporate_client_id', selectedCorporate)
      .order('priority', { ascending: false });
    setRules((data as PanelShareRule[]) || []);
    setLoading(false);
  }, [supabase, selectedCorporate]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadRules(); }, [loadRules]);

  const toggleService = (id: string) => {
    setForm((prev) => ({
      ...prev,
      service_ids: prev.service_ids.includes(id) ? prev.service_ids.filter((s) => s !== id) : [...prev.service_ids, id],
    }));
  };

  const resetForm = () => {
    setForm({
      corporate_client_id: selectedCorporate, department_id: '', section_id: '', service_ids: [],
      share_type: 'percentage', share_value: '15', calculation_basis: 'net_amount',
      effective_date: new Date().toISOString().slice(0, 10), effective_to: '',
      applyToAllServices: false,
    });
    setEditingRule(null);
  };

  const handleSave = async () => {
    const value = parseFloat(form.share_value);
    const err = validateShareValue(form.share_type, value);
    if (err) { toast.error(err); return; }
    if (!form.corporate_client_id && !selectedCorporate) { toast.error('Select a corporate client'); return; }
    if (form.service_ids.length === 0 && !form.applyToAllServices && !form.department_id) {
      toast.error('Select services or a department'); return;
    }

    setSubmitting(true);
    const corpId = form.corporate_client_id || selectedCorporate;

    if (editingRule) {
      const { error } = await supabase.from('panel_share_rules').update({
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
      const serviceIds = form.applyToAllServices ? [null] : form.service_ids;
      const rows: any[] = [];
      for (const svcId of serviceIds) {
        const priority = computePriority(corpId, svcId, form.department_id || null, form.section_id || null, null);
        rows.push({
          company_id: appUser?.company_id,
          branch_id: appUser?.branch_id,
          corporate_client_id: corpId,
          department_id: form.department_id || null,
          section_id: form.section_id || null,
          service_id: svcId,
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
      const { error } = await supabase.from('panel_share_rules').insert(rows);
      if (error) { toast.error('Failed to save: ' + error.message); setSubmitting(false); return; }
      toast.success(`${rows.length} rule(s) created`);
    }

    resetForm();
    setShowForm(false);
    setSubmitting(false);
    loadRules();
  };

  const handleEdit = (rule: PanelShareRule) => {
    setEditingRule(rule);
    setForm({
      corporate_client_id: rule.corporate_client_id,
      department_id: rule.department_id || '',
      section_id: rule.section_id || '',
      service_ids: rule.service_id ? [rule.service_id] : [],
      share_type: rule.share_type,
      share_value: String(rule.share_value),
      calculation_basis: rule.calculation_basis,
      effective_date: rule.effective_date,
      effective_to: rule.effective_to || '',
      applyToAllServices: !rule.service_id,
    });
    setShowForm(true);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('panel_share_rules').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    loadRules();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase.from('panel_share_rules').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Rule deleted');
    loadRules();
  };

  const handleExport = () => {
    const exportData = rules.map((r) => ({
      corporate_client: r.corporate_client?.name ?? null,
      department: r.department?.name ?? null,
      service: r.service?.name ?? null,
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
    a.download = `panel-share-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported configuration');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panel Share Configuration</h1>
          <p className="text-muted-foreground">Configure share rates per corporate client / panel with hierarchy support</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!selectedCorporate}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} disabled={!selectedCorporate}>
            <Plus className="mr-2 h-4 w-4" /> New Rule
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCorporate} onValueChange={setSelectedCorporate}>
            <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Choose a corporate client..." /></SelectTrigger>
            <SelectContent>
              {corporates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {showForm && selectedCorporate && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRule ? 'Edit Panel Share Rule' : 'Create Panel Share Rule'}</CardTitle>
            <CardDescription>Configure share rates for {corporates.find((c) => c.id === selectedCorporate)?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <div className="space-y-2">
                <Label>Calculation Basis</Label>
                <Select value={form.calculation_basis} onValueChange={(v) => setForm({ ...form, calculation_basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BASIS_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                <Label>Section (optional)</Label>
                <Select value={form.section_id} onValueChange={(v) => setForm({ ...form, section_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All sections" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Services</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, service_ids: services.map((s) => s.id), applyToAllServices: true })}>Select All</Button>
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, service_ids: [], applyToAllServices: false })}>Clear</Button>
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                  {services.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted/50">
                      <Checkbox checked={form.service_ids.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                      <span className="text-sm">{s.name}</span>
                      <Badge variant="outline" className="text-xs">{s.category}</Badge>
                      <span className="ml-auto text-xs text-muted-foreground">Rs {Number(s.price).toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Panel Share Rules ({rules.length})</CardTitle>
          <CardDescription>Hierarchy: Panel+Service &gt; Panel+Section &gt; Panel+Department &gt; Panel (all services)</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCorporate ? (
            <p className="text-center text-muted-foreground py-8">Select a corporate client to view its rules</p>
          ) : loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No panel share rules configured for this client</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Section</TableHead>
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
                    <TableCell>{r.department?.name ?? '-'}</TableCell>
                    <TableCell>{r.section_id ? departments.find((d) => d.id === r.section_id)?.name ?? '-' : '-'}</TableCell>
                    <TableCell>{r.service?.name ?? 'All Services'}</TableCell>
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
