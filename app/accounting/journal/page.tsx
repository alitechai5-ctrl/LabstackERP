'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Trash2, Save, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { JournalEntry, JournalLine, ChartOfAccount } from '@/lib/types';

type EntryWithLines = JournalEntry & { lines?: JournalLine[] };

export default function AccountingJournalPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [entries, setEntries] = useState<EntryWithLines[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<{ account_id: string; debit: string; credit: string }[]>([
    { account_id: '', debit: '', credit: '' },
    { account_id: '', debit: '', credit: '' },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, aRes] = await Promise.all([
      supabase.from('journal_entries').select('*, lines:journal_lines(*)').order('entry_date', { ascending: false }).limit(50),
      supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('code'),
    ]);
    if (eRes.error) toast.error(eRes.error.message);
    setEntries((eRes.data as any) || []);
    setAccounts((aRes.data as ChartOfAccount[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  const addLine = () => setLines([...lines, { account_id: '', debit: '', credit: '' }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<{ account_id: string; debit: string; credit: string }>) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  };

  const handleSave = async () => {
    if (!description) { toast.error('Enter a description'); return; }
    if (!isBalanced) { toast.error('Debits and credits must balance'); return; }
    if (lines.some(l => !l.account_id)) { toast.error('Select an account for each line'); return; }

    setSubmitting(true);
    const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
    const { data: entryData, error: entryError } = await supabase.from('journal_entries').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      entry_number: entryNumber,
      entry_date: entryDate,
      description,
      status: 'posted',
      total_debit: totalDebit,
      total_credit: totalCredit,
      created_by: appUser?.id,
    }).select().single();
    if (entryError) { toast.error(entryError.message); setSubmitting(false); return; }

    const lineInserts = lines.map(l => ({
      journal_entry_id: (entryData as any).id,
      account_id: l.account_id,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
    }));
    const { error: lineError } = await supabase.from('journal_lines').insert(lineInserts);
    if (lineError) { toast.error(lineError.message); setSubmitting(false); return; }

    toast.success('Journal entry posted successfully');
    setDescription('');
    setLines([{ account_id: '', debit: '', credit: '' }, { account_id: '', debit: '', credit: '' }]);
    setShowForm(false);
    setSubmitting(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Create and manage double-entry journal entries</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries ({entries.length})</CardTitle>
          <CardDescription>Latest journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No journal entries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><BookOpen className="h-4 w-4 text-primary" /></div>
                    <div>
                      <p className="font-medium text-sm">{e.entry_number}</p>
                      <p className="text-xs text-muted-foreground">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.entry_date).toLocaleDateString()} · {e.lines?.length || 0} lines</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-xs text-muted-foreground">Dr: Rs {Number(e.total_debit).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Cr: Rs {Number(e.total_credit).toLocaleString()}</p>
                    </div>
                    <Badge variant={e.status === 'posted' ? 'default' : 'secondary'}>{e.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Entry description" />
              </div>
            </div>

            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-2 text-left font-medium">Account</th>
                    <th className="p-2 text-right font-medium w-32">Debit</th>
                    <th className="p-2 text-right font-medium w-32">Credit</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">
                        <Select value={line.account_id} onValueChange={(v) => updateLine(idx, { account_id: v })}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2"><Input type="number" value={line.debit} onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })} className="text-right" /></td>
                      <td className="p-2"><Input type="number" value={line.credit} onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })} className="text-right" /></td>
                      <td className="p-2 text-center">
                        {lines.length > 2 && <Button size="sm" variant="ghost" onClick={() => removeLine(idx)}><Trash2 className="h-3 w-3" /></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="p-2"><Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-3 w-3" /> Add Line</Button></td>
                    <td className="p-2 text-right">Rs {totalDebit.toLocaleString()}</td>
                    <td className="p-2 text-right">Rs {totalCredit.toLocaleString()}</td>
                    <td></td>
                  </tr>
                  <tr className={isBalanced ? 'text-[hsl(var(--chart-1))]' : 'text-destructive'}>
                    <td className="p-2" colSpan={3}>
                      {isBalanced ? 'Entry is balanced' : `Difference: Rs ${Math.abs(totalDebit - totalCredit).toLocaleString()}`}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !isBalanced}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Post Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
