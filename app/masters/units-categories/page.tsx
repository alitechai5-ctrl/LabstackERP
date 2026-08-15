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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Unit, Category } from '@/lib/types';

export default function UnitsCategoriesPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const companyId = appUser?.company_id;

  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [unitDialog, setUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', short_name: '', description: '', is_active: true });
  const [submittingUnit, setSubmittingUnit] = useState(false);

  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', parent_id: null as string | null, is_active: true });
  const [submittingCat, setSubmittingCat] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'unit' | 'category' } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('units').select('*').eq('company_id', companyId).order('name'),
      supabase.from('categories').select('*').eq('company_id', companyId).order('name'),
    ]);
    setUnits(u || []);
    setCategories(c || []);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUnits = units.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.short_name.toLowerCase().includes(search.toLowerCase()));
  const filteredCats = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleUnitSubmit = async () => {
    if (!unitForm.name.trim() || !unitForm.short_name.trim() || !companyId) {
      toast.error('Name and Short Name are required');
      return;
    }
    setSubmittingUnit(true);
    if (editingUnit) {
      const { error } = await supabase.from('units').update(unitForm).eq('id', editingUnit.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Unit updated');
    } else {
      const { error } = await supabase.from('units').insert({ ...unitForm, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Unit created');
    }
    setSubmittingUnit(false);
    setUnitDialog(false);
    loadData();
  };

  const handleCatSubmit = async () => {
    if (!catForm.name.trim() || !companyId) {
      toast.error('Name is required');
      return;
    }
    setSubmittingCat(true);
    if (editingCat) {
      const { error } = await supabase.from('categories').update(catForm).eq('id', editingCat.id);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Category updated');
    } else {
      const { error } = await supabase.from('categories').insert({ ...catForm, company_id: companyId });
      if (error) toast.error('Failed to create: ' + error.message);
      else toast.success('Category created');
    }
    setSubmittingCat(false);
    setCatDialog(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const table = deleteTarget.type === 'unit' ? 'units' : 'categories';
    const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (error) toast.error('Failed to delete: ' + error.message);
    else {
      toast.success(`${deleteTarget.type === 'unit' ? 'Unit' : 'Category'} deleted`);
      setDeleteTarget(null);
      loadData();
    }
  };

  const unitColumns: Column<Unit>[] = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'short_name', label: 'Short Name', render: (u) => <span className="font-mono">{u.short_name}</span> },
    { key: 'description', label: 'Description', render: (u) => u.description ?? '-' },
    { key: 'is_active', label: 'Status', render: (u) => <Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: 'Actions', render: (u) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingUnit(u); setUnitForm({ name: u.name, short_name: u.short_name, description: u.description ?? '', is_active: u.is_active }); setUnitDialog(true); }}>Edit</Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: u.id, name: u.name, type: 'unit' }); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  const catColumns: Column<Category>[] = [
    { key: 'name', label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'description', label: 'Description', render: (c) => c.description ?? '-' },
    { key: 'is_active', label: 'Status', render: (c) => <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: 'Actions', render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingCat(c); setCatForm({ name: c.name, description: c.description ?? '', parent_id: c.parent_id, is_active: c.is_active }); setCatDialog(true); }}>Edit</Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.id, name: c.name, type: 'category' }); setDeleteOpen(true); }}>Delete</Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Units & Categories</h1>
        <p className="text-muted-foreground">Manage measurement units and item categories</p>
      </div>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-4">
          <DataTable
            columns={unitColumns}
            data={filteredUnits}
            loading={loading}
            search={search}
            searchPlaceholder="Search units..."
            onSearchChange={setSearch}
            onAdd={() => { setEditingUnit(null); setUnitForm({ name: '', short_name: '', description: '', is_active: true }); setUnitDialog(true); }}
            addLabel="Add Unit"
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <DataTable
            columns={catColumns}
            data={filteredCats}
            loading={loading}
            search={search}
            searchPlaceholder="Search categories..."
            onSearchChange={setSearch}
            onAdd={() => { setEditingCat(null); setCatForm({ name: '', description: '', parent_id: null, is_active: true }); setCatDialog(true); }}
            addLabel="Add Category"
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={unitDialog}
        onOpenChange={setUnitDialog}
        title={editingUnit ? 'Edit Unit' : 'New Unit'}
        onSubmit={handleUnitSubmit}
        submitting={submittingUnit}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Short Name *</Label>
            <Input value={unitForm.short_name} onChange={(e) => setUnitForm({ ...unitForm, short_name: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={unitForm.is_active} onCheckedChange={(c) => setUnitForm({ ...unitForm, is_active: c })} />
            <Label>Active</Label>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={catDialog}
        onOpenChange={setCatDialog}
        title={editingCat ? 'Edit Category' : 'New Category'}
        onSubmit={handleCatSubmit}
        submitting={submittingCat}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parent Category</Label>
            <Select value={catForm.parent_id ?? 'none'} onValueChange={(v) => setCatForm({ ...catForm, parent_id: v === 'none' ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent</SelectItem>
                {categories.filter((c) => c.id !== editingCat?.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={catForm.is_active} onCheckedChange={(c) => setCatForm({ ...catForm, is_active: c })} />
            <Label>Active</Label>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${deleteTarget?.type === 'unit' ? 'Unit' : 'Category'}`}
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmLabel="Delete"
        destructive
        submitting={deleting}
      />
    </div>
  );
}
