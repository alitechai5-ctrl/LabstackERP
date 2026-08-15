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
import type { GoodsReceiptNote, PurchaseOrder, Supplier, InventoryItem } from '@/lib/types';

type GRNRow = { item_id: string; quantity: number; unit_cost: number; batch_number: string; expiry_date: string };

export default function GoodsReceiptPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [poId, setPoId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<GRNRow[]>([{ item_id: '', quantity: 1, unit_cost: 0, batch_number: '', expiry_date: '' }]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [grnRes, poRes, sRes, iRes] = await Promise.all([
      supabase.from('goods_receipt_notes').select('*, supplier:suppliers(name), purchase_order:purchase_orders(po_number)').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('purchase_orders').select('*, supplier:suppliers(name), items:purchase_order_items(*, item:inventory_items(name))').in('status', ['draft', 'sent', 'partial']).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
    ]);
    if (grnRes.error) toast.error(getFriendlyErrorMessage(grnRes.error));
    setGrns((grnRes.data as any) || []);
    setPos((poRes.data as any) || []);
    setSuppliers((sRes.data as Supplier[]) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = grns.filter((g) => g.grn_number.toLowerCase().includes(search.toLowerCase()));
  const total = rows.reduce((sum, r) => sum + (r.quantity * r.unit_cost), 0);

  const handlePoChange = (v: string) => {
    setPoId(v);
    const po = pos.find((p) => p.id === v);
    if (po) {
      setSupplierId(po.supplier_id ?? '');
      const poItems = (po as any).items ?? [];
      if (poItems.length > 0) {
        setRows(poItems.map((it: any) => ({
          item_id: it.item_id,
          quantity: it.quantity - (it.received_qty ?? 0),
          unit_cost: it.unit_cost,
          batch_number: '',
          expiry_date: '',
        })));
      }
    }
  };

  const handleSubmit = async () => {
    if (!supplierId) { toast.error('Select a supplier'); return; }
    if (rows.length === 0 || rows.some((r) => !r.item_id)) { toast.error('Add at least one item'); return; }
    setSubmitting(true);
    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const { data: grn, error } = await supabase.from('goods_receipt_notes').insert({
      company_id: companyId,
      grn_number: grnNumber,
      grn_date: grnDate,
      po_id: poId || null,
      supplier_id: supplierId,
      total_amount: total,
      notes: notes || null,
      status: 'received',
    }).select().single();
    if (error) { toast.error(getFriendlyErrorMessage(error)); setSubmitting(false); return; }

    const itemInserts = rows.map((r) => ({
      grn_id: grn.id,
      item_id: r.item_id,
      quantity: r.quantity,
      unit_cost: r.unit_cost,
      batch_number: r.batch_number || null,
      expiry_date: r.expiry_date || null,
    }));
    const { error: itemError } = await supabase.from('goods_receipt_items').insert(itemInserts);
    if (itemError) { toast.error(getFriendlyErrorMessage(itemError)); setSubmitting(false); return; }

    // Update inventory stock
    for (const r of rows) {
      const item = items.find((it) => it.id === r.item_id);
      if (item) {
        await supabase.from('inventory_items').update({ current_stock: item.current_stock + r.quantity }).eq('id', r.item_id);
      }
    }

    // Update PO received amounts and status
    if (poId) {
      const po = pos.find((p) => p.id === poId);
      if (po) {
        const newReceived = po.received_amount + total;
        const newStatus = newReceived >= po.total_amount ? 'received' : 'partial';
        await supabase.from('purchase_orders').update({ received_amount: newReceived, status: newStatus }).eq('id', poId);
        // Update PO item received quantities
        for (const r of rows) {
          const poItem = (po as any).items?.find((it: any) => it.item_id === r.item_id);
          if (poItem) {
            await supabase.from('purchase_order_items').update({ received_qty: poItem.received_qty + r.quantity }).eq('id', poItem.id);
          }
        }
      }
    }

    toast.success('Goods received and stock updated');
    setDialogOpen(false);
    resetForm();
    loadData();
    setSubmitting(false);
  };

  const resetForm = () => {
    setGrnDate(new Date().toISOString().slice(0, 10));
    setPoId('');
    setSupplierId('');
    setNotes('');
    setRows([{ item_id: '', quantity: 1, unit_cost: 0, batch_number: '', expiry_date: '' }]);
  };

  const columns: Column<GoodsReceiptNote>[] = [
    { key: 'grn_number', label: 'GRN Number', render: (g) => <span className="font-mono text-sm">{g.grn_number}</span> },
    { key: 'grn_date', label: 'Date', render: (g) => new Date(g.grn_date).toLocaleDateString() },
    { key: 'supplier', label: 'Supplier', render: (g) => (g as any).supplier?.name ?? '-' },
    { key: 'purchase_order', label: 'PO', render: (g) => (g as any).purchase_order?.po_number ?? '-' },
    { key: 'status', label: 'Status', render: (g) => <Badge variant={g.status === 'received' ? 'default' : 'destructive'}>{g.status}</Badge> },
    { key: 'total_amount', label: 'Total', render: (g) => `Rs ${g.total_amount.toLocaleString()}` },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Goods Receipt</h1><p className="text-muted-foreground">Receive stock against purchase orders</p></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search GRN number..."
        onSearchChange={setSearch}
        onAdd={() => { resetForm(); setDialogOpen(true); }}
        addLabel="New GRN"
        emptyMessage="No goods receipts yet."
      />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Goods Receipt" description="Receive stock into inventory" onSubmit={handleSubmit} submitting={submitting} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GRN Date</Label>
              <Input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>From PO (optional)</Label>
              <Select value={poId} onValueChange={handlePoChange}>
                <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>{pos.map((p) => <SelectItem key={p.id} value={p.id}>{p.po_number} ({(p as any).supplier?.name})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <Select value={row.item_id} onValueChange={(v) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, item_id: v, unit_cost: items.find((it) => it.id === v)?.purchase_price ?? r.unit_cost } : r))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r))} className="h-9" />
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Cost" value={row.unit_cost} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, unit_cost: parseFloat(e.target.value) || 0 } : r))} className="h-9" />
                </div>
                <div className="col-span-2">
                  <Input placeholder="Batch" value={row.batch_number} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, batch_number: e.target.value } : r))} className="h-9" />
                </div>
                <div className="col-span-2">
                  <Input type="date" placeholder="Expiry" value={row.expiry_date} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, expiry_date: e.target.value } : r))} className="h-9" />
                </div>
                <div className="col-span-1">
                  {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, { item_id: '', quantity: 1, unit_cost: 0, batch_number: '', expiry_date: '' }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add Item</Button>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-lg font-bold">Rs {total.toLocaleString()}</span>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
