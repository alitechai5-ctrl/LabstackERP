'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormDialog } from '@/components/shared/form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/utils/errors';
import type { InventoryIssue, Department, InventoryItem } from '@/lib/types';

type IssueRow = { item_id: string; quantity: number };

export default function InventoryIssuesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [issues, setIssues] = useState<InventoryIssue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<IssueRow[]>([{ item_id: '', quantity: 1 }]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [iRes, dRes, itRes] = await Promise.all([
      supabase.from('inventory_issues').select('*, department:departments(name)').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('departments').select('*').eq('is_active', true).order('name'),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
    ]);
    if (iRes.error) toast.error(getFriendlyErrorMessage(iRes.error));
    setIssues((iRes.data as any) || []);
    setDepartments((dRes.data as Department[]) || []);
    setItems((itRes.data as InventoryItem[]) || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = issues.filter((i) => i.issue_number.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async () => {
    if (rows.length === 0 || rows.some((r) => !r.item_id)) { toast.error('Add at least one item'); return; }
    // Validate stock availability
    for (const r of rows) {
      const item = items.find((it) => it.id === r.item_id);
      if (!item || item.current_stock < r.quantity) {
        toast.error(`Insufficient stock for ${item?.name ?? 'item'}`);
        return;
      }
    }
    setSubmitting(true);
    const issueNumber = `ISS-${Date.now().toString().slice(-6)}`;
    const { data: issue, error } = await supabase.from('inventory_issues').insert({
      company_id: companyId,
      issue_number: issueNumber,
      issue_date: issueDate,
      department_id: departmentId || null,
      issued_to: issuedTo || null,
      notes: notes || null,
      status: 'issued',
    }).select().single();
    if (error) { toast.error(getFriendlyErrorMessage(error)); setSubmitting(false); return; }

    const itemInserts = rows.map((r) => ({ issue_id: issue.id, item_id: r.item_id, quantity: r.quantity }));
    const { error: itemError } = await supabase.from('inventory_issue_items').insert(itemInserts);
    if (itemError) { toast.error(getFriendlyErrorMessage(itemError)); setSubmitting(false); return; }

    // Deduct stock
    for (const r of rows) {
      const item = items.find((it) => it.id === r.item_id);
      if (item) {
        await supabase.from('inventory_items').update({ current_stock: item.current_stock - r.quantity }).eq('id', r.item_id);
      }
    }

    toast.success('Items issued and stock updated');
    setDialogOpen(false);
    resetForm();
    loadData();
    setSubmitting(false);
  };

  const resetForm = () => {
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDepartmentId('');
    setIssuedTo('');
    setNotes('');
    setRows([{ item_id: '', quantity: 1 }]);
  };

  const columns: Column<InventoryIssue>[] = [
    { key: 'issue_number', label: 'Issue #', render: (i) => <span className="font-mono text-sm">{i.issue_number}</span> },
    { key: 'issue_date', label: 'Date', render: (i) => new Date(i.issue_date).toLocaleDateString() },
    { key: 'department', label: 'Department', render: (i) => (i as any).department?.name ?? '-' },
    { key: 'issued_to', label: 'Issued To', render: (i) => i.issued_to ?? '-' },
    { key: 'status', label: 'Status', render: (i) => <Badge variant={i.status === 'issued' ? 'default' : 'secondary'}>{i.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Issues</h1><p className="text-muted-foreground">Issue inventory items to departments</p></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search issue number..."
        onSearchChange={setSearch}
        onAdd={() => { resetForm(); setDialogOpen(true); }}
        addLabel="New Issue"
        emptyMessage="No issues yet."
      />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Issue" description="Issue inventory items to a department or person" onSubmit={handleSubmit} submitting={submitting} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Issued To</Label>
            <Input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Person name (optional)" />
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7">
                  <Select value={row.item_id} onValueChange={(v) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, item_id: v } : r))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name} (Stock: {it.current_stock})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r))} className="h-9" />
                </div>
                <div className="col-span-2">
                  {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, { item_id: '', quantity: 1 }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add Item</Button>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
