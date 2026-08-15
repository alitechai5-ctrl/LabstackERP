'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PharmacyReturn, InventoryItem, Supplier } from '@/lib/types';

type ReturnWithRelations = PharmacyReturn & { item?: InventoryItem; supplier?: Supplier };

const REASONS = ['expired', 'damaged', 'wrong_item', 'quality_issue', 'recall', 'other'];

export default function PharmacyReturnsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [returns, setReturns] = useState<ReturnWithRelations[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', item_id: '', quantity: '1', unit_cost: '0', reason: 'expired', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, iRes, sRes] = await Promise.all([
      supabase.from('pharmacy_returns').select('*, item:inventory_items(*), supplier:suppliers(*)').order('return_date', { ascending: false }).limit(50),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    ]);
    if (rRes.error) toast.error(rRes.error.message);
    setReturns((rRes.data as any) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setSuppliers((sRes.data as Supplier[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalAmount = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_cost) || 0);

  const handleSave = async () => {
    if (!form.item_id || !form.quantity) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    const num = `RET-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from('pharmacy_returns').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      return_number: num,
      return_date: new Date().toISOString().slice(0, 10),
      supplier_id: form.supplier_id || null,
      item_id: form.item_id,
      quantity: parseFloat(form.quantity),
      unit_cost: parseFloat(form.unit_cost) || 0,
      total_amount: totalAmount,
      reason: form.reason,
      notes: form.notes || null,
      created_by: appUser?.id ?? null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    const selectedItem = items.find((i) => i.id === form.item_id);
    if (selectedItem) {
      const newStock = Math.max(0, selectedItem.current_stock - parseFloat(form.quantity));
      await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', form.item_id);
    }

    toast.success(`Return ${num} recorded`);
    setForm({ supplier_id: '', item_id: '', quantity: '1', unit_cost: '0', reason: 'expired', notes: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pharmacy Returns</h1>
          <p className="text-muted-foreground">Record returns of purchased items to suppliers</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Return</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : returns.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No returns yet</TableCell></TableRow>
              ) : (
                returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.return_number}</TableCell>
                    <TableCell className="text-sm">{new Date(r.return_date).toLocaleDateString()}</TableCell>
                    <TableCell>{r.item?.name ?? 'Unknown'}</TableCell>
                    <TableCell>{r.supplier?.name ?? '-'}</TableCell>
                    <TableCell>{Number(r.quantity)}</TableCell>
                    <TableCell>Rs {Number(r.total_amount).toLocaleString()}</TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notes ?? '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Total Return Amount</span>
              <span className="font-bold">Rs {totalAmount.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Record Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
