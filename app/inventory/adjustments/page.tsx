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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryAdjustment, InventoryItem } from '@/lib/types';

type AdjWithItem = InventoryAdjustment & { item?: InventoryItem };

const REASONS = ['damage', 'expiry', 'loss', 'theft', 'correction', 'initial_stock', 'other'];

export default function InventoryAdjustmentsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [adjustments, setAdjustments] = useState<AdjWithItem[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ item_id: '', quantity_change: '', reason: 'correction', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, iRes] = await Promise.all([
      supabase.from('inventory_adjustments').select('*, item:inventory_items(*)').order('adjustment_date', { ascending: false }).limit(50),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
    ]);
    if (aRes.error) toast.error(aRes.error.message);
    setAdjustments((aRes.data as any) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.item_id || !form.quantity_change) { toast.error('Select an item and enter quantity'); return; }
    setSaving(true);
    const qtyChange = parseFloat(form.quantity_change);
    const num = `ADJ-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from('inventory_adjustments').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      adjustment_number: num,
      adjustment_date: new Date().toISOString().slice(0, 10),
      item_id: form.item_id,
      quantity_change: qtyChange,
      reason: form.reason,
      notes: form.notes || null,
      created_by: appUser?.id ?? null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    const selectedItem = items.find((i) => i.id === form.item_id);
    if (selectedItem) {
      const newStock = Math.max(0, selectedItem.current_stock + qtyChange);
      await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', form.item_id);
    }

    toast.success(`Adjustment ${num} created`);
    setForm({ item_id: '', quantity_change: '', reason: 'correction', notes: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Adjustments</h1>
          <p className="text-muted-foreground">Adjust stock quantities for damage, expiry, loss, or corrections</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Adjustment</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : adjustments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No adjustments yet</TableCell></TableRow>
              ) : (
                adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.adjustment_number}</TableCell>
                    <TableCell className="text-sm">{new Date(a.adjustment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{a.item?.name ?? 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={a.quantity_change >= 0 ? 'default' : 'destructive'}>
                        {a.quantity_change >= 0 ? '+' : ''}{Number(a.quantity_change)}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{a.reason}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.notes ?? '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Stock Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity Change *</Label>
              <Input type="number" value={form.quantity_change} onChange={(e) => setForm({ ...form, quantity_change: e.target.value })} placeholder="Use negative for decrease" />
              <p className="text-xs text-muted-foreground">Use negative numbers to reduce stock (e.g. -5 for damage/loss)</p>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
              Create Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
