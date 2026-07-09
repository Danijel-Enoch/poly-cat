import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  /** Rendered as the mobile card's headline (no label), instead of a
   * labeled key/value row. At most one column should set this. */
  primary?: boolean;
  /** Mobile-card row spans both grid columns instead of sharing a row —
   * for long content like action buttons. */
  fullWidth?: boolean;
}

/** Renders a real `<table>` at `md:` and up, and a stacked labeled-card list
 * below `md:` from the same column config — one column definition drives
 * both layouts, so a data table never horizontally scrolls on a phone. */
export function ResponsiveTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  emptyMessage = "Nothing here yet.",
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
}) {
  const primaryCol = columns.find((c) => c.primary);
  const restCols = columns.filter((c) => !c.primary);
  const isEmpty = !loading && (!rows || rows.length === 0);

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell className="text-muted-foreground py-6" colSpan={columns.length}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : isEmpty ? (
              <TableRow>
                <TableCell className="text-muted-foreground py-6" colSpan={columns.length}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows!.map((row) => (
                <TableRow key={getRowKey(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards, no horizontal scroll */}
      <div className="md:hidden flex flex-col gap-2">
        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading...</p>
        ) : isEmpty ? (
          <p className="py-6 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          rows!.map((row) => (
            <Card key={getRowKey(row)} className="py-3 gap-2">
              <CardContent className="px-3">
                {primaryCol && <div className="mb-2">{primaryCol.render(row)}</div>}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {restCols.map((col) => (
                    <div key={col.key} className={cn("flex flex-col gap-0.5", col.fullWidth && "col-span-2")}>
                      <dt className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{col.header}</dt>
                      <dd className="text-sm text-foreground">{col.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
