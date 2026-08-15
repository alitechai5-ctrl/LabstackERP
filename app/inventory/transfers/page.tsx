'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, ArrowLeftRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryTransfer, InventoryItem, Branch } from '@/lib/types';

type TransferWithRelations = InventoryTransfer & { item?: InventoryItem; from_branch?: Branch; to_branch?: Branch };

export default function InventoryTransfersPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [transfers, setTransfers] = useState<TransferWithRelations[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState<string | null>(null);
  const [form, setForm] = useState({
    from_branch_id: '',
    to_branch_id: '',
    item_id: '',
    quantity: '1',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, iRes, bRes] = await Promise.all([
      supabase.from('inventory_transfers').select('*, item:inventory_items(*), from_branch:branches!from_branch_id(*), to_branch:branches!to_branch_id(*)').order('transfer_date', { ascending: false }).limit(50),
      supabase.from('inventory_items').select('*').eq('is_active', true).order('name'),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    if (tRes.error) toast.error(tRes.error.message);
    setTransfers((tRes.data as any) || []);
    setItems((iRes.data as InventoryItem[]) || []);
    setBranches((bRes.data as Branch[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.from_branch_id || !form.to_branch_id || !form.item_id || !form.quantity) {
      toast.error('Fill all required fields'); return;
    }
    if (form.from_branch_id === form.to_branch_id) { toast.error('Source and destination must be different'); return; }
    setSaving(true);
    const num = `TR-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from('inventory_transfers').insert({
      company_id: appUser?.company_id,
      from_branch_id: form.from_branch_id,
      to_branch_id: form.to_branch_id,
      transfer_number: num,
      transfer_date: new Date().toISOString().slice(0, 10),
      item_id: form.item_id,
      quantity: parseFloat(form.quantity),
      status: 'in_transit',
      notes: form.notes || null,
      created_by: appUser?.id ?? null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(`Transfer ${num} created`);
    setForm({ from_branch_id: '', to_branch_id: '', item_id: '', quantity: '1', notes: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleReceive = async (t: TransferWithRelations) => {
    setReceiving(t.id);
    const { error } = await supabase.from('inventory_transfers').update({ status: 'received' }).eq('id', t.id);
    if (error) { toast.error(error.message); setReceiving(null); return; }
    const { error: sError } = await supabase.from('inventory_items').update({
      current_stock: (t.item?.current_stock || 0) + Number(t.quantity),
    }).eq('id', t.item_id);
    if (sError) toast.error('Transfer marked received but stock update failed: ' + sError.message);
    else toast.success('Transfer received and stock updated');
    setReceiving(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Transfers</h1>
          <p className="text-muted-foreground">Transfer stock between branches</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Transfer</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : transfers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No transfers yet</TableCell></TableRow>
              ) : (
                transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                    <TableCell className="text-sm">{new Date(t.transfer_date).toLocaleDateString()}</TableCell>
                    <TableCell>{t.item?.name ?? 'Unknown'}</TableCell>
                    <TableCell>{Number(t.quantity)}</TableCell>
                    <TableCell>{t.from_branch?.name ?? '-'}</TableCell>
                    <TableCell>{t.to_branch?.name ?? '-'}</TableCell>
                    <TableCell><Badge variant={t.status === 'received' ? 'default' : t.status === 'cancelled' ? 'destructive' : 'secondary'}>{t.status}</Badge></TableCell>
                    <TableCell>
                      {t.status === 'in_transit' && (
                        <Button size="sm" variant="outline" onClick={() => handleReceive(t)} disabled={receiving === t.id}>
                          {receiving === t.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                          Receive
                        </Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Branch *</Label>
                <Select value={form.from_branch_id} onValueChange={(v) => setForm({ ...form, from_branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Branch *</Label>
                <Select value={form.to_branch_id} onValueChange={(v) => setForm({ ...form, to_branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />}
              Create Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
