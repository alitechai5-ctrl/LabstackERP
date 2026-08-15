'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, RotateCcw, Search } from 'lucide-react';

export type FilterOption = { label: string; value: string };

export type FilterField = {
  key: string;
  label: string;
  type: 'date' | 'select' | 'text';
  options?: FilterOption[];
  placeholder?: string;
};

type ReportFilterBarProps = {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
  actions?: ReactNode;
  defaultCollapsed?: boolean;
};

export function ReportFilterBar({
  fields,
  values,
  onChange,
  onApply,
  onReset,
  loading = false,
  actions,
}: ReportFilterBarProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                {field.type === 'date' ? (
                  <Input
                    type="date"
                    value={values[field.key] || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="h-9"
                  />
                ) : field.type === 'select' ? (
                  <Select
                    value={values[field.key] || 'all'}
                    onValueChange={(v) => onChange(field.key, v === 'all' ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={field.placeholder || 'All'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {field.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={values[field.key] || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder || 'Search...'}
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button size="sm" onClick={onApply} disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
              <Button size="sm" variant="outline" onClick={onReset} disabled={loading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
            {actions}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function buildDateRangeFilter(
  dateFrom: string,
  dateTo: string,
  dateColumn = 'created_at',
): { gte?: string; lte?: string } {
  const filter: { gte?: string; lte?: string } = {};
  if (dateFrom) filter.gte = dateFrom;
  if (dateTo) filter.lte = dateTo + 'T23:59:59';
  return filter;
}
