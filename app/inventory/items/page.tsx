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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/utils/errors';
import type { InventoryItem, Supplier, Manufacturer, Unit } from '@/lib/types';

type FormState = {
  item_code: string;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  description: string | null;
  item_type: 'medicine' | 'consumable' | 'reagent' | 'equipment' | 'supply';
  unit_id: string | null;
  manufacturer_id: string | null;
  supplier_id: string | null;
  purchase_price: number;
  sale_price: number;
  min_stock: number;
  max_stock: number;
  reorder_level: number;
  current_stock: number;
  is_prescription_required: boolean;
  is_active: boolean;
};

const emptyForm: FormState = {
  item_code: '',
  barcode: null,
  name: '',
  generic_name: null,
  description: null,
  item_type: 'medicine',
  unit_id: null,
  manufacturer_id: null,
  supplier_id: null,
  purchase_price: 0,
  sale_price: 0,
  min_stock: 0,
  max_stock: 0,
  reorder_level: 0,
  current_stock: 0,
  is_prescription_required: false,
  is_active: true,
};

export default function InventoryItemsPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [iRes, sRes, mRes, uRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('company_id', companyId).order('name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('manufacturers').select('*').eq('is_active', true).order('name'),
      supabase.from('units').select('*').eq('is_active', true).order('name'),
    ]);
    if (iRes.error) toast.error(getFriendlyErrorMessage(iRes.error));
    setItems((iRes.data as InventoryItem[]) || []);
    setSuppliers((sRes.data as Supplier[]) || []);
    setManufacturers((mRes.data as Manufacturer[]) || []);
    setUnits((uRes.data as Unit[]) || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q) || (i.generic_name ?? '').toLowerCase().includes(q);
  });

  const handleAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEdit = (i: InventoryItem) => {
    setEditing(i);
    setForm({
      item_code: i.item_code,
      barcode: i.barcode,
      name: i.name,
      generic_name: i.generic_name,
      description: i.description,
      item_type: i.item_type,
      unit_id: i.unit_id,
      manufacturer_id: i.manufacturer_id,
      supplier_id: i.supplier_id,
      purchase_price: i.purchase_price,
      sale_price: i.sale_price,
      min_stock: i.min_stock,
      max_stock: i.max_stock,
      reorder_level: i.reorder_level,
      current_stock: i.current_stock,
      is_prescription_required: i.is_prescription_required,
      is_active: i.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.item_code.trim() || !companyId) {
      toast.error('Item name and code are required');
      return;
    }
    setSubmitting(true);
    const payload = { ...form, company_id: companyId };
    if (editing) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', editing.id);
      if (error) toast.error(getFriendlyErrorMessage(error));
      else toast.success('Item updated successfully');
    } else {
      const { error } = await supabase.from('inventory_items').insert(payload);
      if (error) toast.error(getFriendlyErrorMessage(error));
      else toast.success('Item created successfully');
    }
    setSubmitting(false);
    setDialogOpen(false);
    loadData();
  };

  const handleToggleActive = async (i: InventoryItem) => {
    const { error } = await supabase.from('inventory_items').update({ is_active: !i.is_active }).eq('id', i.id);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else {
      toast.success(i.is_active ? 'Item deactivated' : 'Item activated');
      loadData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('inventory_items').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error(getFriendlyErrorMessage(error));
    else {
      toast.success('Item deleted');
      setDeleteTarget(null);
      loadData();
    }
  };

  const stockBadge = (i: InventoryItem) => {
    if (i.current_stock <= 0) return <Badge variant="destructive">Out of stock</Badge>;
    if (i.current_stock <= i.reorder_level) return <Badge variant="secondary">Low stock</Badge>;
    return <Badge variant="default">In stock</Badge>;
  };

  const columns: Column<InventoryItem>[] = [
    { key: 'item_code', label: 'Code', render: (i) => <span className="font-mono text-sm">{i.item_code}</span> },
    { key: 'name', label: 'Name', render: (i) => (
      <div>
        <p className="font-medium">{i.name}</p>
        <p className="text-sm text-muted-foreground">{i.generic_name ?? '-'}</p>
      </div>
    ) },
    { key: 'item_type', label: 'Type', render: (i) => <Badge variant="outline">{i.item_type}</Badge> },
    { key: 'current_stock', label: 'Stock', render: (i) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{i.current_stock}</span>
        {stockBadge(i)}
      </div>
    ) },
    { key: 'sale_price', label: 'Sale Price', render: (i) => `Rs ${i.sale_price.toLocaleString()}` },
    { key: 'reorder_level', label: 'Reorder', render: (i) => i.reorder_level },
    { key: 'is_active', label: 'Status', render: (i) => (
      <Badge variant={i.is_active ? 'default' : 'secondary'}>{i.is_active ? 'Active' : 'Inactive'}</Badge>
    ) },
    { key: 'actions', label: 'Actions', render: (i) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(i); }}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(i); }}>
          {i.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(i); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Items</h1>
        <p className="text-muted-foreground">Create and manage individual inventory items</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        search={search}
        searchPlaceholder="Search by name, code, or generic name..."
        onSearchChange={setSearch}
        onAdd={handleAdd}
        addLabel="Add Item"
        onRowClick={handleEdit}
        emptyMessage="No inventory items yet. Click 'Add Item' to create your first one."
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Item' : 'New Item'}
        description="Enter item details including pricing and stock levels"
        onSubmit={handleSubmit}
        submitting={submitting}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Code *</Label>
              <Input value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input value={form.barcode ?? ''} onChange={(e) => setForm({ ...form, barcode: e.target.value || null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Generic Name</Label>
              <Input value={form.generic_name ?? ''} onChange={(e) => setForm({ ...form, generic_name: e.target.value || null })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as FormState['item_type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medicine">Medicine</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="reagent">Reagent</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="supply">Supply</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form.unit_id ?? 'none'} onValueChange={(v) => setForm({ ...form, unit_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No unit</SelectItem>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Select value={form.manufacturer_id ?? 'none'} onValueChange={(v) => setForm({ ...form, manufacturer_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manufacturer</SelectItem>
                  {manufacturers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={form.supplier_id ?? 'none'} onValueChange={(v) => setForm({ ...form, supplier_id: v === 'none' ? null : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Sale Price</Label>
              <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Min Stock</Label>
              <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Max Stock</Label>
              <Input type="number" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_prescription_required} onCheckedChange={(c) => setForm({ ...form, is_prescription_required: c })} />
            <Label>Prescription Required</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <Label>Active</Label>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Item"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
