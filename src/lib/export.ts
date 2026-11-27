// Export helpers: CSV opens in Excel; "PDF" opens a print-ready page (Save as PDF in the print dialog).

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function toCsv(head: string[], rows: string[][]) {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [head, ...rows].map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\r\n");
}

export function exportCsv(name: string, head: string[], rows: string[][]) {
  // BOM so Excel reads UTF-8 (Somali names, symbols) correctly.
  download(`${name}-${stamp()}.csv`, "﻿" + toCsv(head, rows), "text/csv;charset=utf-8");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function exportPdf(title: string, head: string[], rows: string[][], subtitle = "") {
  const w = window.open("", "_blank", "noopener=no,width=900,height=700");
  if (!w) return;
  const table = `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
  // Brand colors come from the theme variables in src/index.css.
  const css = getComputedStyle(document.documentElement);
  const c = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `rgb(${v.split(/\s+/).join(",")})` : fallback;
  };
  const ink = c("--n-900", "#222"), muted = c("--n-500", "#5a635d"), line = c("--n-200", "#dedace");
  const head2 = c("--n-100", "#f3efe4"), green = c("--primary", "#173d2a"), gold = c("--gold", "#d1a62b");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:"Nunito Sans",system-ui,Segoe UI,sans-serif;margin:24px;color:${ink}}
h1{font-family:Montserrat,system-ui,sans-serif;font-size:18px;margin:0;color:${green};border-top:4px solid ${gold};padding-top:10px}
p{color:${muted};font-size:12px;margin:4px 0 16px}table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid ${line};padding:5px 7px;text-align:left}th{background:${head2};color:${green}}</style></head>
<body><h1>${escapeHtml(title)}</h1><p>Hangool ERP · ${escapeHtml(subtitle || new Date().toLocaleString())}</p>${table}
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
