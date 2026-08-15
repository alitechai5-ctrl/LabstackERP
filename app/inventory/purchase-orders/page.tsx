'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FormDialog } from '@/components/shared/form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/utils/errors';
import type { PurchaseOrder, Supplier, InventoryItem } from '@/lib/types';

type POItemRow = { item_id: string; quantity: number; unit_cost: number };

export default function PurchaseOrdersPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<POItemRow[]>([{ item_id: '', quantity: 1, unit_cost: 0 }]);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [poRes, sRes, iRes] = await Promise.all([
      supabase.from('purchase_orders').select('*, supplier:suppliers(name)').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
    ]);
    if (poRes.error) toast.error(getFriendlyErrorMessage(poRes.error));
    setOrders((poRes.data as any) || []);
    setSuppliers((sRes.data as Supplier[]) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = orders.filter((o) => o.po_number.toLowerCase().includes(search.toLowerCase()));

  const total = rows.reduce((sum, r) => sum + (r.quantity * r.unit_cost), 0);

  const handleSubmit = async () => {
    if (!supplierId) { toast.error('Select a supplier'); return; }
    if (rows.length === 0 || rows.some((r) => !r.item_id)) { toast.error('Add at least one item'); return; }
    setSubmitting(true);
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const { data: po, error } = await supabase.from('purchase_orders').insert({
      company_id: companyId,
      po_number: poNumber,
      po_date: poDate,
      supplier_id: supplierId,
      total_amount: total,
      notes: notes || null,
      status: 'draft',
    }).select().single();
    if (error) { toast.error(getFriendlyErrorMessage(error)); setSubmitting(false); return; }
    const itemInserts = rows.map((r) => ({ po_id: po.id, item_id: r.item_id, quantity: r.quantity, unit_cost: r.unit_cost }));
    const { error: itemError } = await supabase.from('purchase_order_items').insert(itemInserts);
    if (itemError) toast.error(getFriendlyErrorMessage(itemError));
    else { toast.success('Purchase order created'); setDialogOpen(false); resetForm(); loadData(); }
    setSubmitting(false);
  };

  const resetForm = () => {
    setPoDate(new Date().toISOString().slice(0, 10));
    setSupplierId('');
    setNotes('');
    setRows([{ item_id: '', quantity: 1, unit_cost: 0 }]);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('purchase_orders').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else { toast.success('PO deleted'); setDeleteTarget(null); loadData(); }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case 'received': return 'default';
      case 'partial': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    { key: 'po_number', label: 'PO Number', render: (o) => <span className="font-mono text-sm">{o.po_number}</span> },
    { key: 'po_date', label: 'Date', render: (o) => new Date(o.po_date).toLocaleDateString() },
    { key: 'supplier', label: 'Supplier', render: (o) => (o as any).supplier?.name ?? '-' },
    { key: 'status', label: 'Status', render: (o) => <Badge variant={statusVariant(o.status)}>{o.status}</Badge> },
    { key: 'total_amount', label: 'Total', render: (o) => `Rs ${o.total_amount.toLocaleString()}` },
    { key: 'actions', label: 'Actions', render: (o) => (
      <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(o); setDeleteOpen(true); }}>Delete</Button>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Purchase Orders</h1><p className="text-muted-foreground">Create and manage purchase orders</p></div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search PO number..."
        onSearchChange={setSearch}
        onAdd={() => { resetForm(); setDialogOpen(true); }}
        addLabel="New PO"
        emptyMessage="No purchase orders yet."
      />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Purchase Order" description="Create a purchase order for a supplier" onSubmit={handleSubmit} submitting={submitting} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PO Date</Label>
              <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <Select value={row.item_id} onValueChange={(v) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, item_id: v, unit_cost: items.find((it) => it.id === v)?.purchase_price ?? r.unit_cost } : r))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" placeholder="Qty" value={row.quantity} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, quantity: parseFloat(e.target.value) || 0 } : r))} className="h-9" />
                </div>
                <div className="col-span-3">
                  <Input type="number" placeholder="Unit Cost" value={row.unit_cost} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, unit_cost: parseFloat(e.target.value) || 0 } : r))} className="h-9" />
                </div>
                <div className="col-span-1 text-right text-sm font-medium">{(row.quantity * row.unit_cost).toLocaleString()}</div>
                <div className="col-span-1">
                  {rows.length > 1 && <Button size="sm" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, { item_id: '', quantity: 1, unit_cost: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add Item</Button>
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

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete PO" description={`Delete ${deleteTarget?.po_number}?`} onConfirm={handleDelete} confirmLabel="Delete" destructive submitting={deleting} />
    </div>
  );
}
