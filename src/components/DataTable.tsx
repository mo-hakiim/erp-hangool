import { useMemo, useState, type ReactNode } from "react";
import { Download, FileText, Search, SearchX } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { cn, formatDate } from "@/lib/format";
import { useCompany } from "@/features/settings/CompanySettings";
import { Button, EmptyState, Input } from "./ui";
import { ProgressBar, Select, StatusBadge, statusLabel } from "./blocks";
import { exportCsv, exportPdf } from "@/lib/export";

export type ColumnKind = "text" | "money" | "date" | "datetime" | "status" | "number" | "percent" | "progress";
export type Column<T> = {
  key: string;
  label: string;
  kind?: ColumnKind;
  render?: (row: T) => ReactNode;
  /** Plain value for search / export (defaults to row[key]). */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  hideOnMobile?: boolean;
  primary?: boolean; // shown as the card title on phones
};
export type Filter<T> = { key: string; label: string; options: Array<{ value: string; label: string }>; match?: (row: T, value: string) => boolean };

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  filters?: Filter<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  rowKey: (row: T) => string;
  exportName?: string;
  emptyTitle?: string;
  emptyBody?: string;
  toolbar?: ReactNode;
  compact?: boolean;
};

export function DataTable<T>({
  rows, columns, filters = [], searchable = true, searchPlaceholder, pageSize = 10, onRowClick, selectedKey, rowKey,
  exportName, emptyTitle, emptyBody, toolbar, compact,
}: Props<T>) {
  const { t, locale } = useI18n();
  const { money } = useCompany();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const raw = (row: T, c: Column<T>) => (c.value ? c.value(row) : (row as Record<string, unknown>)[c.key] as string | number | null | undefined);

  const display = (row: T, c: Column<T>): ReactNode => {
    if (c.render) return c.render(row);
    const v = raw(row, c);
    switch (c.kind) {
      case "money": return money(v == null ? null : Number(v));
      case "date": return formatDate(v as string, locale);
      case "datetime": return v ? new Date(v as string).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "—";
      case "status": return <StatusBadge value={v as string} />;
      case "number": return v == null ? "—" : Number(v).toLocaleString(locale);
      case "percent": return v == null ? "—" : `${Math.round(Number(v))}%`;
      case "progress": return <ProgressBar value={Number(v ?? 0)} />;
      default: return v == null || v === "" ? "—" : String(v);
    }
  };

  const plain = (row: T, c: Column<T>) => {
    const v = raw(row, c);
    if (v == null) return "";
    if (c.kind === "status") return statusLabel(t, String(v));
    if (c.kind === "date") return formatDate(String(v), locale);
    return String(v);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      for (const f of filters) {
        const v = active[f.key];
        if (!v) continue;
        if (f.match ? !f.match(row, v) : String((row as Record<string, unknown>)[f.key]) !== v) return false;
      }
      if (!needle) return true;
      return columns.some((c) => plain(row, c).toLowerCase().includes(needle));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, active, filters, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const anyFilter = q || Object.values(active).some(Boolean);
  const primary = columns.find((c) => c.primary) ?? columns[0]!;

  const doExport = (kind: "csv" | "pdf") => {
    const head = columns.map((c) => c.label);
    const body = filtered.map((r) => columns.map((c) => (c.kind === "money" ? String(raw(r, c) ?? "") : plain(r, c))));
    if (kind === "csv") exportCsv(exportName ?? "export", head, body);
    else exportPdf(exportName ?? "export", head, body);
  };

  return (
    <div className="min-w-0">
      {(searchable || filters.length > 0 || exportName || toolbar) && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {searchable && (
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder ?? t.common.search} className="pl-9" aria-label={t.common.search} />
            </div>
          )}
          {filters.map((f) => (
            <Select key={f.key} value={active[f.key] ?? ""} onChange={(e) => { setActive((a) => ({ ...a, [f.key]: e.target.value })); setPage(0); }} className="sm:w-48" aria-label={f.label}>
              <option value="">{f.label}: {t.common.all}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))}
          {anyFilter && (
            <button onClick={() => { setQ(""); setActive({}); }} className="text-sm font-medium text-brand-700 hover:underline">{t.common.clearFilters}</button>
          )}
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            {toolbar}
            {exportName && (
              <>
                <Button size="sm" variant="secondary" onClick={() => doExport("csv")}><Download className="h-4 w-4" /> {t.common.exportExcel}</Button>
                <Button size="sm" variant="secondary" onClick={() => doExport("pdf")}><FileText className="h-4 w-4" /> {t.common.exportPdf}</Button>
              </>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white">
          <EmptyState icon={<SearchX className="h-10 w-10" />} title={anyFilter ? t.common.noResults : emptyTitle ?? t.common.noResults} body={anyFilter ? t.common.noResultsBody : emptyBody} />
        </div>
      ) : (
        <>
          {/* table on tablet / desktop */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
                      (c.align === "right" || c.kind === "money" || c.kind === "number") && "text-right")}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slice.map((row) => {
                  const k = rowKey(row);
                  return (
                    <tr key={k} onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(onRowClick && "cursor-pointer hover:bg-slate-50", selectedKey === k && "bg-amber-50")}>
                      {columns.map((c) => (
                        <td key={c.key} className={cn(compact ? "py-2" : "py-2.5", "px-3 align-middle text-slate-700",
                          (c.align === "right" || c.kind === "money" || c.kind === "number") && "whitespace-nowrap text-right tabular-nums",
                          c.primary && "font-medium text-slate-900")}>
                          {display(row, c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* cards on phones */}
          <ul className="space-y-2 md:hidden">
            {slice.map((row) => {
              const k = rowKey(row);
              return (
                <li key={k}>
                  <div role={onRowClick ? "button" : undefined} tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row); } : undefined}
                    className={cn("rounded-xl border border-slate-200 bg-white p-3", selectedKey === k && "border-brand-300 bg-amber-50")}>
                    <div className="mb-2 font-medium text-slate-900">{display(row, primary)}</div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                      {columns.filter((c) => c !== primary && !c.hideOnMobile).map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</dt>
                          <dd className="truncate text-slate-800">{display(row, c)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-600">
              <span>{fmt(t.common.rowsShown, { from: current * pageSize + 1, to: Math.min(filtered.length, (current + 1) * pageSize), total: filtered.length })}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>{t.common.prev}</Button>
                <Button size="sm" variant="secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t.common.next}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
