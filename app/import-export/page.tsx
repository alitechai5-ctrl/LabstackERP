'use client';

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type ExportTable = {
  name: string;
  label: string;
  columns: string[];
};

const TABLES: ExportTable[] = [
  { name: 'patients', label: 'Patients', columns: ['patient_code', 'full_name', 'gender', 'phone', 'email', 'address', 'city', 'cnic', 'blood_group', 'is_active'] },
  { name: 'doctors', label: 'Doctors', columns: ['doctor_code', 'full_name', 'specialization', 'qualification', 'pmc_license', 'phone', 'email', 'consultation_fee', 'is_active'] },
  { name: 'services', label: 'Services', columns: ['code', 'name', 'category', 'price', 'cost', 'is_active'] },
  { name: 'inventory_items', label: 'Inventory Items', columns: ['item_code', 'name', 'generic_name', 'item_type', 'purchase_price', 'sale_price', 'min_stock', 'reorder_level', 'current_stock', 'is_active'] },
  { name: 'referral_sources', label: 'Referral Sources', columns: ['name', 'type', 'phone', 'email', 'commission_type', 'commission_value', 'is_active'] },
  { name: 'corporate_clients', label: 'Corporate Clients', columns: ['name', 'contact_person', 'phone', 'email', 'discount_percentage', 'credit_limit', 'is_active'] },
  { name: 'insurance_companies', label: 'Insurance Companies', columns: ['name', 'contact_person', 'phone', 'email', 'discount_percentage', 'credit_limit', 'is_active'] },
  { name: 'suppliers', label: 'Suppliers', columns: ['name', 'contact_person', 'phone', 'email', 'payment_terms', 'is_active'] },
  { name: 'manufacturers', label: 'Manufacturers', columns: ['name', 'contact_person', 'phone', 'email', 'is_active'] },
];

function toCSV(rows: any[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
      return str;
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ImportExportPage() {
  const supabase = getSupabaseClient();
  const { appUser } = useAuth();
  const [selectedTable, setSelectedTable] = useState(TABLES[0].name);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null);

  const handleExport = useCallback(async () => {
    const table = TABLES.find((t) => t.name === selectedTable);
    if (!table) return;
    setExporting(true);
    const { data, error } = await supabase.from(selectedTable).select(table.columns.join(',')).limit(5000);
    if (error) { toast.error(error.message); setExporting(false); return; }
    const csv = toCSV((data || []) as any[], table.columns);
    downloadCSV(`${selectedTable}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${(data || []).length} records`);
    setExporting(false);
  }, [supabase, selectedTable]);

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const table = TABLES.find((t) => t.name === selectedTable);
    if (!table) return;
    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) { toast.error('File is empty or has no data rows'); setImporting(false); return; }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const rows: Record<string, any>[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of lines[i]) {
          if (char === '"') { inQuotes = !inQuotes; continue; }
          if (char === ',' && !inQuotes) { values.push(current); current = ''; continue; }
          current += char;
        }
        values.push(current);

        const row: Record<string, any> = {};
        headers.forEach((header, idx) => {
          let val: any = values[idx] ?? '';
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (val !== '' && !isNaN(Number(val)) && header.includes('fee')) val = Number(val);
          else if (val !== '' && !isNaN(Number(val)) && (header.includes('price') || header.includes('stock') || header.includes('level') || header.includes('limit') || header.includes('percentage'))) val = Number(val);
          row[header] = val;
        });
        row.company_id = appUser?.company_id;
        rows.push(row);
      }

      const { data, error } = await supabase.from(selectedTable).insert(rows).select('id');
      if (error) {
        errors.push(error.message);
        toast.error(`Import failed: ${error.message}`);
      } else {
        const inserted = (data || []).length;
        toast.success(`Imported ${inserted} records into ${table.label}`);
        setImportResult({ inserted, errors });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse file');
    }
    setImporting(false);
  }, [supabase, selectedTable, appUser]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground">Export master data to CSV or import records from a CSV file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Export Data</CardTitle>
          <CardDescription>Download master records as a CSV file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium">Select Data Type</label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => <SelectItem key={t.name} value={t.name}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import Data</CardTitle>
          <CardDescription>Upload a CSV file to import records into the selected table</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Importing into: <Badge variant="secondary">{TABLES.find((t) => t.name === selectedTable)?.label}</Badge>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              CSV headers must match column names. Use the Export function first to see the expected format.
            </p>
            <label>
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" disabled={importing} />
              <Button variant="outline" disabled={importing} asChild>
                <span>
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Choose CSV File
                </span>
              </Button>
            </label>
          </div>

          {importResult && (
            <div className="rounded-lg bg-[hsl(var(--chart-1))]/10 p-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-1))]" />
              <p className="text-sm text-[hsl(var(--chart-1))]">Successfully imported {importResult.inserted} records.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
