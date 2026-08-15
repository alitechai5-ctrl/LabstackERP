'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { Role, Permission } from '@/lib/types';

type RolePermission = { role_id: string; permission_id: string };

export default function SettingsRolesPage() {
  const supabase = getSupabaseClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, pRes, rpRes] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('permissions').select('*').order('module, action'),
      supabase.from('role_permissions').select('role_id, permission_id'),
    ]);
    if (rRes.error) toast.error(rRes.error.message);
    setRoles((rRes.data as Role[]) || []);
    setPermissions((pRes.data as Permission[]) || []);
    const map: Record<string, Set<string>> = {};
    for (const rp of (rpRes.data as RolePermission[]) || []) {
      if (!map[rp.role_id]) map[rp.role_id] = new Set();
      map[rp.role_id].add(rp.permission_id);
    }
    setRolePerms(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const togglePermission = async (roleId: string, permId: string, checked: boolean) => {
    setUpdating(`${roleId}-${permId}`);
    if (checked) {
      const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permId });
      if (error) { toast.error(error.message); setUpdating(null); return; }
      setRolePerms((prev) => {
        const next = { ...prev };
        if (!next[roleId]) next[roleId] = new Set();
        next[roleId].add(permId);
        return next;
      });
    } else {
      const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permId);
      if (error) { toast.error(error.message); setUpdating(null); return; }
      setRolePerms((prev) => {
        const next = { ...prev };
        next[roleId]?.delete(permId);
        return next;
      });
    }
    setUpdating(null);
  };

  const modules = Array.from(new Set(permissions.map((p) => p.module))).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <p className="text-muted-foreground">Manage which roles can access which modules and actions</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    {role.is_system ? <Lock className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {role.display_name}
                      {role.is_system && <Badge variant="secondary">System</Badge>}
                    </CardTitle>
                    <CardDescription>{role.description ?? role.name}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modules.map((mod) => (
                    <div key={mod}>
                      <p className="text-sm font-medium mb-2 capitalize">{mod}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {permissions.filter((p) => p.module === mod).map((perm) => {
                          const isChecked = rolePerms[role.id]?.has(perm.id) ?? false;
                          const isSuperAdmin = role.name === 'super_admin';
                          return (
                            <label key={perm.id} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50 cursor-pointer">
                              <Checkbox
                                checked={isSuperAdmin || isChecked}
                                disabled={isSuperAdmin || updating === `${role.id}-${perm.id}`}
                                onCheckedChange={(v) => togglePermission(role.id, perm.id, v === true)}
                              />
                              <span className="text-sm capitalize">{perm.action}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
