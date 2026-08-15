'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, UserCog, Search, Power } from 'lucide-react';
import { toast } from 'sonner';
import type { AppUser, Role, Branch } from '@/lib/types';

export default function SettingsUsersPage() {
  const supabase = getSupabaseClient();
  const { appUser: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role_id: '', branch_id: '', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [uRes, rRes, bRes] = await Promise.all([
      supabase.from('app_users').select('*, role:roles(*), branch:branches(*)').order('full_name'),
      supabase.from('roles').select('*').order('display_name'),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    if (uRes.error) toast.error(uRes.error.message);
    setUsers((uRes.data as AppUser[]) || []);
    setRoles((rRes.data as Role[]) || []);
    setBranches((bRes.data as Branch[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.role_id || !form.password) {
      toast.error('Fill all required fields including password'); return;
    }
    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
    });
    if (authError) {
      toast.error('Failed to create auth user: ' + authError.message);
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('app_users').insert({
      auth_user_id: authData.user.id,
      company_id: currentUser?.company_id,
      branch_id: form.branch_id || null,
      role_id: form.role_id,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      is_active: true,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    toast.success('User created successfully');
    setForm({ full_name: '', email: '', phone: '', role_id: '', branch_id: '', password: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const toggleActive = async (user: AppUser) => {
    setToggling(user.id);
    const { error } = await supabase.from('app_users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) { toast.error(error.message); setToggling(null); return; }
    toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
    setToggling(null);
    load();
  };

  const filtered = users.filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage system users and their access</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No users found</TableCell></TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role?.display_name ?? u.role?.name ?? '-'}</Badge></TableCell>
                    <TableCell className="text-sm">{u.branch?.name ?? 'All'}</TableCell>
                    <TableCell><Badge variant={u.is_active ? 'default' : 'destructive'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                    <TableCell>
                      {u.id !== currentUser?.id && (
                        <Button size="sm" variant="outline" onClick={() => toggleActive(u)} disabled={toggling === u.id}>
                          {toggling === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
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
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
