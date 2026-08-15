'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { FinancialYear } from '@/lib/types';

export default function FinancialYearsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('financial_years').select('*').order('start_date', { ascending: false });
    setYears((data as FinancialYear[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) { toast.error('Fill all fields'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('financial_years').insert({
      company_id: appUser?.company_id,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success('Financial year created');
    setForm({ name: '', start_date: '', end_date: '' });
    setShowForm(false);
    setSubmitting(false);
    load();
  };

  const handleClose = async (id: string) => {
    const { error } = await supabase.from('financial_years').update({ is_closed: true, closed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Financial year closed');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Years</h1>
          <p className="text-muted-foreground">Manage accounting periods</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="mr-2 h-4 w-4" /> New Financial Year</Button>
      </div>

      {showForm && (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Create Financial Year</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FY 2026" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>End Date *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Financial Years ({years.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : years.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No financial years configured</p>
          ) : (
            <div className="space-y-2">
              {years.map(y => (
                <div key={y.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><Calendar className="h-4 w-4 text-primary" /></div>
                    <div>
                      <p className="font-medium text-sm">{y.name}</p>
                      <p className="text-xs text-muted-foreground">{y.start_date} to {y.end_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={y.is_closed ? 'secondary' : 'default'}>{y.is_closed ? 'Closed' : 'Active'}</Badge>
                    {!y.is_closed && <Button size="sm" variant="outline" onClick={() => handleClose(y.id)}>Close</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
