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
import { Loader2, Plus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { PharmacyPurchase, InventoryItem, Supplier } from '@/lib/types';

type PurchaseWithRelations = PharmacyPurchase & { item?: InventoryItem; supplier?: Supplier };

export default function PharmacyPurchasePage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    item_id: '',
    quantity: '1',
    unit_cost: '0',
    batch_number: '',
    expiry_date: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, iRes, sRes] = await Promise.all([
      supabase.from('pharmacy_purchases').select('*, item:inventory_items(*), supplier:suppliers(*)').order('purchase_date', { ascending: false }).limit(50),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    setPurchases((pRes.data as any) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setSuppliers((sRes.data as Supplier[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const totalCost = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_cost) || 0);

  const handleSave = async () => {
    if (!form.item_id || !form.quantity || !form.unit_cost) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    const num = `PUR-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from('pharmacy_purchases').insert({
      company_id: appUser?.company_id,
      branch_id: appUser?.branch_id,
      purchase_number: num,
      purchase_date: new Date().toISOString().slice(0, 10),
      supplier_id: form.supplier_id || null,
      item_id: form.item_id,
      quantity: parseFloat(form.quantity),
      unit_cost: parseFloat(form.unit_cost),
      total_cost: totalCost,
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date || null,
      payment_status: 'unpaid',
      notes: form.notes || null,
      created_by: appUser?.id ?? null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    const selectedItem = items.find((i) => i.id === form.item_id);
    if (selectedItem) {
      await supabase.from('inventory_items').update({
        current_stock: selectedItem.current_stock + parseFloat(form.quantity),
        purchase_price: parseFloat(form.unit_cost),
      }).eq('id', form.item_id);
    }

    toast.success(`Purchase ${num} recorded`);
    setForm({ supplier_id: '', item_id: '', quantity: '1', unit_cost: '0', batch_number: '', expiry_date: '', notes: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handlePay = async (id: string) => {
    const { error } = await supabase.from('pharmacy_purchases').update({ payment_status: 'paid' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment marked as paid');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pharmacy Purchases</h1>
          <p className="text-muted-foreground">Record medicine and supply purchases from suppliers</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Purchase</Button>
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
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : purchases.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No purchases yet</TableCell></TableRow>
              ) : (
                purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.purchase_number}</TableCell>
                    <TableCell className="text-sm">{new Date(p.purchase_date).toLocaleDateString()}</TableCell>
                    <TableCell>{p.item?.name ?? 'Unknown'}</TableCell>
                    <TableCell>{p.supplier?.name ?? '-'}</TableCell>
                    <TableCell>{Number(p.quantity)}</TableCell>
                    <TableCell>Rs {Number(p.unit_cost).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">Rs {Number(p.total_cost).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.payment_status === 'paid' ? 'default' : p.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                        {p.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.payment_status !== 'paid' && (
                        <Button size="sm" variant="outline" onClick={() => handlePay(p.id)}>Mark Paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost *</Label>
                <Input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batch Number</Label>
                <Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Total Cost</span>
              <span className="font-bold">Rs {totalCost.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              Record Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
