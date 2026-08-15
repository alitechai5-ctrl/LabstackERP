'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Download, Upload, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CorporateClient, Service, PanelRate } from '@/lib/types';

export default function PanelRatesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [corporates, setCorporates] = useState<CorporateClient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rates, setRates] = useState<PanelRate[]>([]);
  const [selectedCorporate, setSelectedCorporate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      supabase.from('corporate_clients').select('*').eq('is_active', true).order('name'),
      supabase.from('services').select('*').eq('is_active', true).order('name'),
    ]);
    setCorporates((cRes.data as CorporateClient[]) || []);
    setServices((sRes.data as Service[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const loadRates = useCallback(async () => {
    if (!selectedCorporate) { setRates([]); return; }
    const { data, error } = await supabase
      .from('panel_rates')
      .select('*, service:services(*)')
      .eq('corporate_client_id', selectedCorporate);
    if (error) toast.error(error.message);
    else {
      setRates((data as PanelRate[]) || []);
      const overrides: Record<string, string> = {};
      for (const r of (data as PanelRate[]) || []) {
        overrides[r.service_id] = String(r.panel_price);
      }
      setPriceOverrides(overrides);
    }
  }, [supabase, selectedCorporate]);

  useEffect(() => { loadRates(); }, [loadRates]);

  const handleSave = async () => {
    if (!selectedCorporate || !appUser?.company_id) return;
    setSaving(true);
    const upserts = services.map((s) => ({
      company_id: appUser.company_id,
      corporate_client_id: selectedCorporate,
      service_id: s.id,
      panel_price: parseFloat(priceOverrides[s.id] ?? '') || 0,
    })).filter((u) => u.panel_price > 0);

    const { error } = await supabase
      .from('panel_rates')
      .upsert(upserts, { onConflict: 'corporate_client_id,service_id' });
    if (error) toast.error(error.message);
    else {
      toast.success('Panel rates saved');
      loadRates();
    }
    setSaving(false);
  };

  const handleExport = () => {
    if (!selectedCorporate) return;
    const corporate = corporates.find((c) => c.id === selectedCorporate);
    const headers = ['code', 'name', 'category', 'standard_price', 'panel_price'];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    for (const s of services) {
      const panelPrice = priceOverrides[s.id] ?? '';
      lines.push([s.code, s.name, s.category, s.price, panelPrice].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panel-rates-${corporate?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Panel rates exported');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { toast.error('CSV is empty'); return; }
      const overrides: Record<string, string> = {};
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const code = cols[0];
        const panelPrice = cols[4];
        const service = services.find((s) => s.code === code);
        if (service && panelPrice) overrides[service.id] = panelPrice;
      }
      setPriceOverrides({ ...priceOverrides, ...overrides });
      toast.success(`Imported ${Object.keys(overrides).length} rates`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Rates</h1>
        <p className="text-muted-foreground">Manage negotiated test rates per corporate client / insurance panel</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 flex-1 min-w-[250px]">
              <Label>Select Corporate Client / Panel</Label>
              <Select value={selectedCorporate} onValueChange={setSelectedCorporate}>
                <SelectTrigger><SelectValue placeholder="Choose a corporate client..." /></SelectTrigger>
                <SelectContent>
                  {corporates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCorporate && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                <Button variant="outline" onClick={() => document.getElementById('panel-import')?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <input id="panel-import" type="file" accept=".csv" className="hidden" onChange={handleImport} />
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Rates
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCorporate && (
        <Card>
          <CardHeader>
            <CardTitle>Rate List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Standard Price</TableHead>
                    <TableHead className="text-right">Panel Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => {
                    const override = priceOverrides[s.id];
                    const hasOverride = override && parseFloat(override) > 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">{s.code}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
                        <TableCell className="text-right">Rs {Number(s.price).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={override ?? ''}
                            placeholder={String(s.price)}
                            onChange={(e) => setPriceOverrides({ ...priceOverrides, [s.id]: e.target.value })}
                            className="ml-auto h-8 w-28 text-right"
                          />
                          {hasOverride && parseFloat(override) !== Number(s.price) && (
                            <Badge variant="secondary" className="ml-2">Custom</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCorporate && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Building2 className="mb-3 h-10 w-10" />
          <p>Select a corporate client to manage their panel rates</p>
        </div>
      )}
    </div>
  );
}
