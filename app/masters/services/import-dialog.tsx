'use client';

import { useState, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileUp, Loader2, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@/lib/types';

type ParsedRow = {
  code: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  doctor_share: number;
  doctor_share_type: string;
  referral_share: number;
  referral_share_type: string;
  turnaround_time_hours: number;
  sample_type: string;
  container: string;
  method: string;
  normal_range: string;
  short_name: string;
  _mode: 'create' | 'update';
};

const HEADERS = [
  'code', 'name', 'category', 'price', 'cost',
  'doctor_share', 'referral_share', 'turnaround_time_hours',
  'sample_type', 'container', 'method', 'normal_range', 'short_name',
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { current.push(field); field = ''; }
      else if (char === '\n') { current.push(field); rows.push(current); current = []; field = ''; }
      else if (char !== '\r') { field += char; }
    }
  }
  if (field || current.length) { current.push(field); rows.push(current); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function mapRow(values: string[], headerIndex: Record<string, number>): ParsedRow | null {
  const get = (key: string, fallback = '') => {
    const idx = headerIndex[key];
    if (idx === undefined || idx < 0 || idx >= values.length) return fallback;
    return (values[idx] || '').trim();
  };
  const code = get('code');
  const name = get('name');
  if (!code || !name) return null;
  return {
    code: code.toUpperCase(),
    name,
    short_name: get('short_name'),
    category: get('category', 'lab').toLowerCase(),
    price: parseFloat(get('price', '0')) || 0,
    cost: parseFloat(get('cost', '0')) || 0,
    doctor_share: parseFloat(get('doctor_share', '0')) || 0,
    doctor_share_type: 'percentage',
    referral_share: parseFloat(get('referral_share', '0')) || 0,
    referral_share_type: 'percentage',
    turnaround_time_hours: parseInt(get('turnaround_time_hours', '24')) || 24,
    sample_type: get('sample_type'),
    container: get('container'),
    method: get('method'),
    normal_range: get('normal_range'),
    _mode: 'create',
  };
}

export function ImportRateListDialog({
  open,
  onOpenChange,
  existingServices,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingServices: Service[];
  onImported: () => void;
}) {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const existingCodes = new Set(existingServices.map((s) => s.code.toUpperCase()));

  const handleFile = async (file: File) => {
    setDone(false);
    setFileName(file.name);
    const text = await file.text();
    const csvRows = parseCSV(text);
    if (csvRows.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

    const headers = csvRows[0].map((h) => h.trim().toLowerCase());
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndex[h] = i; });

    if (headerIndex['code'] === undefined || headerIndex['name'] === undefined) {
      toast.error('CSV must have at least "code" and "name" columns');
      return;
    }

    const parsed: ParsedRow[] = [];
    for (let i = 1; i < csvRows.length; i++) {
      const mapped = mapRow(csvRows[i], headerIndex);
      if (mapped) {
        mapped._mode = existingCodes.has(mapped.code) ? 'update' : 'create';
        parsed.push(mapped);
      }
    }
    setRows(parsed);
    if (parsed.length === 0) toast.error('No valid rows found');
    else toast.info(`${parsed.length} rows parsed (${parsed.filter(r => r._mode === 'create').length} new, ${parsed.filter(r => r._mode === 'update').length} updates)`);
  };

  const handleImport = async () => {
    if (!appUser?.company_id || rows.length === 0) return;
    setImporting(true);
    let created = 0, updated = 0, errors = 0;

    for (const row of rows) {
      const payload = {
        company_id: appUser.company_id,
        code: row.code,
        name: row.name,
        short_name: row.short_name || null,
        category: row.category,
        price: row.price,
        cost: row.cost,
        doctor_share: row.doctor_share,
        doctor_share_type: row.doctor_share_type,
        referral_share: row.referral_share,
        referral_share_type: row.referral_share_type,
        turnaround_time_hours: row.turnaround_time_hours,
        sample_type: row.sample_type || null,
        container: row.container || null,
        method: row.method || null,
        normal_range: row.normal_range || null,
        is_active: true,
      };

      if (row._mode === 'update') {
        const { error } = await supabase.from('services').update(payload).eq('code', row.code).eq('company_id', appUser.company_id);
        if (error) errors++; else updated++;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) errors++; else created++;
      }
    }

    setImporting(false);
    setDone(true);
    toast.success(`Import complete: ${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''}`);
    onImported();
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'code', 'name', 'category', 'price', 'cost',
      'doctor_share', 'referral_share', 'turnaround_time_hours',
      'sample_type', 'container', 'method', 'normal_range', 'short_name',
    ];
    const exampleRows = [
      ['CBC', 'Complete Blood Count', 'lab', '500', '200', '10', '5', '24', 'Blood', 'EDTA Tube', 'Automated', '4.0-11.0 x10^3/µL', 'CBC'],
      ['LFT', 'Liver Function Test', 'lab', '1200', '500', '15', '8', '48', 'Blood', 'Plain Tube', 'Automated', '', 'LFT'],
    ];
    const lines = [headers.join(','), ...exampleRows.map(r => r.join(','))];
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate-list-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleClose = () => {
    setRows([]);
    setFileName('');
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Import Rate List</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              {fileName ? `Loaded: ${fileName}` : 'Upload a CSV file with your service rate list'}
            </p>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Choose CSV File
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Required columns: <code className="text-xs">code, name</code></p>
            <p className="text-muted-foreground">
              Optional: <code className="text-xs">category, price, cost, doctor_share, referral_share, turnaround_time_hours, sample_type, container, method, normal_range, short_name</code>
            </p>
            <p className="text-muted-foreground mt-1">
              Category values: <code className="text-xs">lab, radiology, opd, procedure, package</code> (default: lab)
            </p>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview ({rows.length} rows)</p>
                <div className="flex gap-2">
                  <Badge variant="default">{rows.filter(r => r._mode === 'create').length} new</Badge>
                  <Badge variant="secondary">{rows.filter(r => r._mode === 'update').length} updates</Badge>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Mode</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={row._mode === 'create' ? 'default' : 'secondary'}>
                            {row._mode === 'create' ? 'New' : 'Update'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.code}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell><Badge variant="outline">{row.category}</Badge></TableCell>
                        <TableCell className="text-right">{row.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.cost.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 100 && <p className="p-2 text-center text-xs text-muted-foreground">Showing first 100 of {rows.length} rows</p>}
              </div>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--chart-1))]/10 p-3 text-sm text-[hsl(var(--chart-1))]">
              <CheckCircle2 className="h-4 w-4" />
              Import completed successfully. Close this dialog to see the updated list.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={handleImport} disabled={importing || rows.length === 0 || done}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {importing ? 'Importing...' : `Import ${rows.length} Rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
