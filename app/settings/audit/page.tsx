'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLog } from '@/lib/types';

export default function SettingsAuditPage() {
  const supabase = getSupabaseClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (search) {
      query = query.or(`table_name.ilike.%${search}%,action.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) { toast.error(error.message); setLoading(false); return; }
    setLogs((data as AuditLog[]) || []);
    setLoading(false);
  }, [supabase, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">View system audit trail of all data changes</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by table or action..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="inline h-4 w-4 animate-spin" /></TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <ScrollText className="inline h-5 w-5 mr-2 mb-1" />
                  No audit logs found
                </TableCell></TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-sm">{log.table_name}</TableCell>
                    <TableCell><Badge variant={log.action === 'INSERT' ? 'default' : log.action === 'UPDATE' ? 'secondary' : 'destructive'}>{log.action}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{log.record_id ? log.record_id.slice(0, 8) : '-'}</TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                      {log.new_values ? JSON.stringify(log.new_values).slice(0, 120) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
