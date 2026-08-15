'use client';

import { useState, useMemo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Download,
  Printer,
  Columns3,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  exportToCSV,
  exportAndPrint,
  formatCurrency,
  type ExportColumn,
} from '@/lib/utils/export';

export type ReportColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  exportValue?: (row: T) => string | number;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  visible?: boolean;
  isNumeric?: boolean;
};

type ReportTableProps<T> = {
  columns: ReportColumn<T>[];
  data: T[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  exportFilename?: string;
  showExport?: boolean;
  showPrint?: boolean;
  showColumnToggle?: boolean;
  showSearch?: boolean;
  totalsRow?: { [key: string]: string | number };
  groupBy?: { label: string; getGroupKey: (row: T) => string } | null;
  actions?: ReactNode;
  filterBar?: ReactNode;
};

export function ReportTable<T extends { id?: string }>({
  columns,
  data,
  loading = false,
  title,
  subtitle,
  search = '',
  searchPlaceholder = 'Search...',
  onSearchChange,
  onRowClick,
  emptyMessage = 'No records found',
  pageSize = 25,
  exportFilename = 'report',
  showExport = true,
  showPrint = true,
  showColumnToggle = true,
  showSearch = true,
  totalsRow,
  groupBy = null,
  actions,
  filterBar,
}: ReportTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.key) && c.visible !== false);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    const sorted = [...data].sort((a, b) => {
      const av = col.exportValue ? col.exportValue(a as T) : (a as any)[sortKey];
      const bv = col.exportValue ? col.exportValue(b as T) : (b as any)[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [data, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, totalPages - 1));
  const pagedData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleColumn = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportColumns: ExportColumn<T>[] = visibleColumns.map((c) => ({
    key: c.key,
    label: c.label,
    format: c.exportValue ? (row: T) => c.exportValue!(row) : (row: T) => (row as any)[c.key],
  }));

  const handleExportCSV = () => {
    const summary = totalsRow
      ? [{ label: 'Total', values: totalsRow as Record<string, string | number> }]
      : undefined;
    exportToCSV(exportFilename, exportColumns, sortedData, { summaryRows: summary });
  };

  const handlePrint = () => {
    const summary = totalsRow
      ? [{ label: 'Total', values: totalsRow as Record<string, string | number> }]
      : undefined;
    exportAndPrint(title || exportFilename, subtitle || '', exportColumns, sortedData, {
      summaryRows: summary,
    });
  };

  // Group data if groupBy is set
  const groupedData = useMemo(() => {
    if (!groupBy) return null;
    const groups = new Map<string, T[]>();
    for (const row of sortedData) {
      const key = groupBy.getGroupKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries());
  }, [sortedData, groupBy]);

  const alignClass = (col: ReportColumn<T>) =>
    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showSearch && onSearchChange && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-10"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {actions}
          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenCols.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {showExport && (
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={data.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          )}
          {showPrint && (
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={data.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          )}
        </div>
      </div>

      {filterBar}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 bg-card">
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`${alignClass(col)} whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer select-none' : ''}`}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {visibleColumns.map((col) => (
                        <TableCell key={col.key}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pagedData.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : groupedData ? (
                  groupedData.map(([groupKey, rows]) => (
                    <GroupBlock
                      key={groupKey}
                      groupKey={groupKey}
                      rows={rows}
                      columns={visibleColumns}
                      onRowClick={onRowClick}
                      alignClass={alignClass}
                    />
                  ))
                ) : (
                  pagedData.map((row, i) => (
                    <TableRow
                      key={row.id ?? i}
                      onClick={() => onRowClick?.(row)}
                      className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                    >
                      {visibleColumns.map((col) => (
                        <TableCell key={col.key} className={alignClass(col)}>
                          {col.render ? col.render(row) : (row as any)[col.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals Row */}
          {totalsRow && !loading && data.length > 0 && (
            <div className="overflow-x-auto border-t-2 border-primary/20">
              <Table>
                <TableBody>
                  <TableRow className="bg-primary/5 font-semibold">
                    {visibleColumns.map((col) => (
                      <TableCell key={col.key} className={alignClass(col)}>
                        {col.key in totalsRow ? (
                          col.isNumeric ? (
                            formatCurrency(Number(totalsRow[col.key]))
                          ) : (
                            String(totalsRow[col.key])
                          )
                        ) : col.key === visibleColumns[0]?.key ? (
                          'Grand Total'
                        ) : (
                          ''
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1}-
            {Math.min((currentPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupBlock<T>({
  groupKey,
  rows,
  columns,
  onRowClick,
  alignClass,
}: {
  groupKey: string;
  rows: T[];
  columns: ReportColumn<T>[];
  onRowClick?: (row: T) => void;
  alignClass: (col: ReportColumn<T>) => string;
}) {
  const numericCols = columns.filter((c) => c.isNumeric);
  const groupTotals: Record<string, number> = {};
  for (const c of numericCols) {
    groupTotals[c.key] = rows.reduce((sum, r) => sum + (Number((r as any)[c.key]) || 0), 0);
  }

  return (
    <>
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={columns.length} className="font-semibold text-sm py-2">
          {groupKey} ({rows.length} records)
        </TableCell>
      </TableRow>
      {rows.map((row, i) => (
        <TableRow
          key={(row as any).id ?? i}
          onClick={() => onRowClick?.(row)}
          className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
        >
          {columns.map((col) => (
            <TableCell key={col.key} className={alignClass(col)}>
              {col.render ? col.render(row) : (row as any)[col.key]}
            </TableCell>
          ))}
        </TableRow>
      ))}
      {numericCols.length > 0 && (
        <TableRow className="bg-muted/30 font-medium border-t">
          {columns.map((col) => (
            <TableCell key={col.key} className={alignClass(col)}>
              {col.isNumeric && col.key in groupTotals
                ? formatCurrency(groupTotals[col.key])
                : col.key === columns[0]?.key
                  ? `Subtotal (${rows.length})`
                  : ''}
            </TableCell>
          ))}
        </TableRow>
      )}
    </>
  );
}
