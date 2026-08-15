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
import type { ReferralSource, Service, ShareRule } from '@/lib/types';

const CATEGORIES = [
  { value: 'lab', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'opd', label: 'OPD' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'package', label: 'Package' },
];

export default function ReferralShareConfigPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [referrals, setReferrals] = useState<ReferralSource[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<ShareRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ShareRule | null>(null);

  const [form, setForm] = useState({
    share_for: 'referral_person' as 'referral_person' | 'referral_doctor',
    referral_ids: [] as string[],
    service_ids: [] as string[],
    service_category: '',
    share_type: 'percentage',
    share_value: '10',
    calculation_basis: 'net_amount',
    effective_date: new Date().toISOString().slice(0, 10),
    effective_to: '',
    applyToAllServices: false,
    has_in_source: false,
    in_source_share_type: 'percentage',
    in_source_share_value: '5',
    in_source_calculation_basis: 'net_amount',
    has_out_source: true,
    out_source_share_type: 'percentage',
    out_source_share_value: '10',
    out_source_calculation_basis: 'net_amount',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rRes, sRes, rulesRes] = await Promise.all([
      supabase.from('referral_sources').select('*').eq('is_active', true).order('name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('share_rules')
        .select('*, referral_source:referral_sources(name), service:services(name)')
        .in('share_for', ['referral_person', 'referral_doctor'])
        .order('priority', { ascending: false }),
    ]);
    setReferrals((rRes.data as ReferralSource[]) || []);
    setServices((sRes.data as Service[]) || []);
    setRules((rulesRes.data as ShareRule[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleReferral = (id: string) => {
    setForm((prev) => ({
      ...prev,
      referral_ids: prev.referral_ids.includes(id) ? prev.referral_ids.filter((d) => d !== id) : [...prev.referral_ids, id],
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
      share_for: 'referral_person', referral_ids: [], service_ids: [],
      service_category: '', share_type: 'percentage', share_value: '10',
      calculation_basis: 'net_amount',
      effective_date: new Date().toISOString().slice(0, 10), effective_to: '',
      applyToAllServices: false,
      has_in_source: false, in_source_share_type: 'percentage', in_source_share_value: '5', in_source_calculation_basis: 'net_amount',
      has_out_source: true, out_source_share_type: 'percentage', out_source_share_value: '10', out_source_calculation_basis: 'net_amount',
    });
    setEditingRule(null);
  };

  const handleSave = async () => {
    const value = parseFloat(form.share_value);
    const err = validateShareValue(form.share_type, value);
    if (err) { toast.error(err); return; }
    if (form.referral_ids.length === 0) { toast.error('Select at least one referral source'); return; }
    if (form.service_ids.length === 0 && !form.applyToAllServices && !form.service_category) {
      toast.error('Select services or a category'); return;
    }

    setSubmitting(true);

    if (editingRule) {
      const updateData: any = {
        share_type: form.share_type,
        share_value: value,
        calculation_basis: form.calculation_basis,
        effective_date: form.effective_date,
        effective_to: form.effective_to || null,
        updated_at: new Date().toISOString(),
        updated_by: appUser?.id,
      };
      if (form.has_in_source) {
        updateData.in_source_share_type = form.in_source_share_type;
        updateData.in_source_share_value = parseFloat(form.in_source_share_value) || 0;
        updateData.in_source_calculation_basis = form.in_source_calculation_basis;
      }
      if (form.has_out_source) {
        updateData.out_source_share_type = form.out_source_share_type;
        updateData.out_source_share_value = parseFloat(form.out_source_share_value) || 0;
        updateData.out_source_calculation_basis = form.out_source_calculation_basis;
      }
      const { error } = await supabase.from('share_rules').update(updateData).eq('id', editingRule.id);
      if (error) { toast.error('Failed to update: ' + error.message); setSubmitting(false); return; }
      toast.success('Rule updated');
    } else {
      const serviceIds = form.applyToAllServices ? [null] : form.service_ids;
      const rows: any[] = [];
      for (const refId of form.referral_ids) {
        for (const svcId of serviceIds) {
          const priority = computePriority(refId, svcId, null, null, form.service_category || null);
          const row: any = {
            company_id: appUser?.company_id,
            branch_id: appUser?.branch_id,
            share_for: form.share_for,
            referral_source_id: refId,
            doctor_id: null,
            department_id: null,
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
          };
          if (form.has_in_source) {
            row.in_source_share_type = form.in_source_share_type;
            row.in_source_share_value = parseFloat(form.in_source_share_value) || 0;
            row.in_source_calculation_basis = form.in_source_calculation_basis;
          }
          if (form.has_out_source) {
            row.out_source_share_type = form.out_source_share_type;
            row.out_source_share_value = parseFloat(form.out_source_share_value) || 0;
            row.out_source_calculation_basis = form.out_source_calculation_basis;
          }
          rows.push(row);
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
      share_for: rule.share_for as 'referral_person' | 'referral_doctor',
      referral_ids: rule.referral_source_id ? [rule.referral_source_id] : [],
      service_ids: rule.service_id ? [rule.service_id] : [],
      service_category: rule.service_category || '',
      share_type: rule.share_type,
      share_value: String(rule.share_value),
      calculation_basis: rule.calculation_basis,
      effective_date: rule.effective_date,
      effective_to: rule.effective_to || '',
      applyToAllServices: !rule.service_id,
      has_in_source: !!rule.in_source_share_type,
      in_source_share_type: rule.in_source_share_type || 'percentage',
      in_source_share_value: String(rule.in_source_share_value ?? 5),
      in_source_calculation_basis: rule.in_source_calculation_basis || 'net_amount',
      has_out_source: !!rule.out_source_share_type,
      out_source_share_type: rule.out_source_share_type || 'percentage',
      out_source_share_value: String(rule.out_source_share_value ?? 10),
      out_source_calculation_basis: rule.out_source_calculation_basis || 'net_amount',
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

  const handleExport = () => {
    const exportData = rules.map((r) => ({
      share_for: r.share_for,
      referral_source: r.referral_source?.name ?? null,
      service: r.service?.name ?? null,
      service_category: r.service_category,
      share_type: r.share_type,
      share_value: r.share_value,
      calculation_basis: r.calculation_basis,
      in_source: r.in_source_share_type ? { type: r.in_source_share_type, value: r.in_source_share_value, basis: r.in_source_calculation_basis } : null,
      out_source: r.out_source_share_type ? { type: r.out_source_share_type, value: r.out_source_share_value, basis: r.out_source_calculation_basis } : null,
      effective_date: r.effective_date,
      effective_to: r.effective_to,
      priority: r.priority,
      is_active: r.is_active,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-share-rules-${new Date().toISOString().slice(0, 10)}.json`;
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
          <h1 className="text-2xl font-bold">Referral Share Configuration</h1>
          <p className="text-muted-foreground">Configure commission shares with IN SOURCE and OUT SOURCE support</p>
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
            <CardTitle>{editingRule ? 'Edit Rule' : 'Create Referral Share Rule'}</CardTitle>
            <CardDescription>Configure IN SOURCE (internal referral) and OUT SOURCE (external referral) commission rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Share For</Label>
                <Select value={form.share_for} onValueChange={(v) => setForm({ ...form, share_for: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral_person">Referral Person</SelectItem>
                    <SelectItem value="referral_doctor">Referral Doctor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Share Type</Label>
                <Select value={form.share_type} onValueChange={(v) => setForm({ ...form, share_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.share_type === 'percentage' ? 'Default Percentage' : 'Default Amount (Rs)'}</Label>
                <Input type="number" value={form.share_value} onChange={(e) => setForm({ ...form, share_value: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Calculation Basis</Label>
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
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* IN SOURCE */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">IN SOURCE Share</CardTitle>
                    <Checkbox checked={form.has_in_source} onCheckedChange={(v) => setForm({ ...form, has_in_source: !!v })} />
                  </div>
                  <CardDescription className="text-xs">Commission for internal referrals (within same organization)</CardDescription>
                </CardHeader>
                {form.has_in_source && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={form.in_source_share_type} onValueChange={(v) => setForm({ ...form, in_source_share_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed (Rs)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" value={form.in_source_share_value} onChange={(e) => setForm({ ...form, in_source_share_value: e.target.value })} />
                    </div>
                    <Select value={form.in_source_calculation_basis} onValueChange={(v) => setForm({ ...form, in_source_calculation_basis: v })}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BASIS_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                )}
              </Card>

              {/* OUT SOURCE */}
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">OUT SOURCE Share</CardTitle>
                    <Checkbox checked={form.has_out_source} onCheckedChange={(v) => setForm({ ...form, has_out_source: !!v })} />
                  </div>
                  <CardDescription className="text-xs">Commission for external referrals (from outside sources)</CardDescription>
                </CardHeader>
                {form.has_out_source && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={form.out_source_share_type} onValueChange={(v) => setForm({ ...form, out_source_share_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed (Rs)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" value={form.out_source_share_value} onChange={(e) => setForm({ ...form, out_source_share_value: e.target.value })} />
                    </div>
                    <Select value={form.out_source_calculation_basis} onValueChange={(v) => setForm({ ...form, out_source_calculation_basis: v })}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BASIS_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                )}
              </Card>
            </div>

            {!editingRule && (
              <>
                <div className="space-y-2">
                  <Label>Referral Sources</Label>
                  <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                    {referrals.map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-muted/50">
                        <Checkbox checked={form.referral_ids.includes(r.id)} onCheckedChange={() => toggleReferral(r.id)} />
                        <span className="text-sm">{r.name}{r.type ? ` · ${r.type}` : ''}</span>
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

      <Card>
        <CardHeader>
          <CardTitle>Configured Referral Rules ({rules.length})</CardTitle>
          <CardDescription>IN SOURCE = internal referral commission, OUT SOURCE = external referral commission</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No referral share rules configured yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Share For</TableHead>
                  <TableHead>Referral Source</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>IN Source</TableHead>
                  <TableHead>OUT Source</TableHead>
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
                    <TableCell><Badge variant="outline">{r.share_for === 'referral_person' ? 'Person' : 'Doctor'}</Badge></TableCell>
                    <TableCell>{r.referral_source?.name ?? 'All'}</TableCell>
                    <TableCell>{r.service?.name ?? r.service_category ?? 'All Services'}</TableCell>
                    <TableCell>
                      {r.in_source_share_type ? (
                        <Badge variant="secondary" className="text-xs">{r.in_source_share_type === 'percentage' ? `${r.in_source_share_value}%` : `Rs ${Number(r.in_source_share_value).toLocaleString()}`}</Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell>
                      {r.out_source_share_type ? (
                        <Badge variant="secondary" className="text-xs">{r.out_source_share_type === 'percentage' ? `${r.out_source_share_value}%` : `Rs ${Number(r.out_source_share_value).toLocaleString()}`}</Badge>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
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
