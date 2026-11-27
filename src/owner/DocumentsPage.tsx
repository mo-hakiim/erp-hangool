import { useState } from "react";
import { FileText, History, Lock, Pencil } from "lucide-react";
import { useI18n } from "@/i18n";
import { formatDate, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoBadge, InfoGrid, Section, StatCard } from "@/components/blocks";
import { DataTable } from "@/components/DataTable";
import { documentsDemo as docs } from "@/demo/ownerDemo";

const size = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);
const soon = (iso: string) => !!iso && new Date(iso).getTime() - Date.now() < 60 * 86_400_000;

export function DocumentsPage() {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string | null>(docs[0]?.id ?? null);
  const doc = docs.find((x) => x.id === selected);

  return (
    <div>
      <PageHeader title={t.documents.title} subtitle={t.documents.subtitle} actions={<DemoBadge />} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.nav.documents} value={docs.length} icon={<FileText className="h-4 w-4" />} demo />
        <StatCard label={t.documents.versions} value={docs.reduce((s, d) => s + d.versions.length, 0)} />
        <StatCard label={t.documents.expiringSoon} value={docs.filter((d) => soon(d.expires)).length} tone="red" />
        <StatCard label={t.documents.size} value={size(docs.reduce((s, d) => s + d.size, 0))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DataTable rows={docs} rowKey={(r) => r.id} selectedKey={selected} onRowClick={(r) => setSelected(r.id)} searchPlaceholder={t.documents.searchPlaceholder} exportName="documents"
            filters={[{ key: "category", label: t.common.category, options: [...new Set(docs.map((d) => d.category))].map((c) => ({ value: c, label: c })) }]}
            columns={[
              { key: "title", label: t.common.name, primary: true, render: (r) => <><p className="font-medium text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.linkedTo}</p></>, value: (r) => `${r.title} ${r.linkedTo}` },
              { key: "category", label: t.common.category, render: (r) => <Badge>{r.category}</Badge>, value: (r) => r.category },
              { key: "version", label: t.documents.version, render: (r) => `v${r.version}` },
              { key: "updated", label: t.documents.updated, kind: "date" },
              { key: "expires", label: t.documents.expires, render: (r) => (r.expires ? <span className={soon(r.expires) ? "font-medium text-red-600" : ""}>{formatDate(r.expires, locale)}</span> : "—"), value: (r) => r.expires, hideOnMobile: true },
            ]} />
        </div>
        <div className="xl:col-span-2">
          {!doc ? <Card><EmptyState title={t.documents.selectDoc} /></Card> : (
            <div className="space-y-4">
              <Section title={doc.title} demo>
                <InfoGrid items={[
                  { label: t.common.category, value: doc.category },
                  { label: t.documents.linkedTo, value: doc.linkedTo },
                  { label: t.documents.uploadedBy, value: doc.uploadedBy },
                  { label: t.documents.updated, value: timeAgo(doc.updated, t) },
                  { label: t.documents.size, value: size(doc.size) },
                  { label: t.documents.expires, value: doc.expires ? formatDate(doc.expires, locale) : "—" },
                ]} />
              </Section>
              <Section title={t.documents.versions} actions={<History className="h-4 w-4 text-slate-400" />}>
                <ol className="space-y-3">
                  {doc.versions.map((v) => (
                    <li key={v.v} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">v{v.v}</span>
                      <div className="min-w-0 text-sm">
                        <p className="text-slate-900">{v.note || "—"}</p>
                        <p className="text-xs text-slate-500">{v.by} · {formatDate(v.date, locale)} · {size(v.size)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
              <Section title={t.documents.access} actions={<Lock className="h-4 w-4 text-slate-400" />}>
                <ul className="space-y-2 text-sm">
                  {doc.access.map((a) => (
                    <li key={a.who} className="flex items-center justify-between gap-2">
                      <span className="text-slate-800">{a.who}</span>
                      {a.canEdit ? <Badge tone="amber"><Pencil className="mr-1 h-3 w-3" />{t.documents.canEdit}</Badge> : <Badge>{t.common.view}</Badge>}
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
