import type { ScanReport } from "./scanCommand.js";

/** Escape untrusted strings (root name, kinds, languages) for safe HTML embedding. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColorVar(report: ScanReport): string {
  const score = report.governance_score;
  if (score === null) return "var(--sr-muted)";
  if (score >= 75) return "var(--sr-good)";
  if (score >= 40) return "var(--sr-warn)";
  return "var(--sr-bad)";
}

const STYLES = `
:root {
  --sr-bg: #f6f7f9; --sr-card: #ffffff; --sr-ink: #14181f; --sr-muted: #6b7480;
  --sr-line: #e4e7ec; --sr-good: #1f9d55; --sr-warn: #d98c00; --sr-bad: #d1493b;
  --sr-accent: #3b5bdb;
}
@media (prefers-color-scheme: dark) {
  :root {
    --sr-bg: #0f1216; --sr-card: #171b21; --sr-ink: #e8ebef; --sr-muted: #9aa4b0;
    --sr-line: #262c34; --sr-good: #3ecf7c; --sr-warn: #e6a52b; --sr-bad: #f0655a;
    --sr-accent: #7d97ff;
  }
}
:root[data-theme="light"] {
  --sr-bg: #f6f7f9; --sr-card: #ffffff; --sr-ink: #14181f; --sr-muted: #6b7480;
  --sr-line: #e4e7ec; --sr-good: #1f9d55; --sr-warn: #d98c00; --sr-bad: #d1493b; --sr-accent: #3b5bdb;
}
:root[data-theme="dark"] {
  --sr-bg: #0f1216; --sr-card: #171b21; --sr-ink: #e8ebef; --sr-muted: #9aa4b0;
  --sr-line: #262c34; --sr-good: #3ecf7c; --sr-warn: #e6a52b; --sr-bad: #f0655a; --sr-accent: #7d97ff;
}
.sr-wrap { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--sr-ink); max-width: 720px; margin: 0 auto; padding: 24px 16px; box-sizing: border-box; }
.sr-card { background: var(--sr-card); border: 1px solid var(--sr-line); border-radius: 16px;
  padding: 28px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.sr-brand { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--sr-muted);
  display: flex; align-items: center; gap: 8px; }
.sr-brand b { color: var(--sr-accent); font-weight: 700; }
.sr-repo { font-size: 20px; font-weight: 700; margin: 4px 0 20px; word-break: break-word; }
.sr-hero { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.sr-gauge { flex: 0 0 auto; }
.sr-headline { flex: 1 1 240px; min-width: 220px; }
.sr-scary { font-size: 26px; line-height: 1.25; font-weight: 800; margin: 0 0 8px; }
.sr-scary .n { color: var(--sr-bad); }
.sr-sub { color: var(--sr-muted); font-size: 15px; margin: 0; }
.sr-grade { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border-radius: 8px; font-weight: 800; color: #fff; font-size: 16px; }
.sr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 24px; }
.sr-stat { border: 1px solid var(--sr-line); border-radius: 12px; padding: 12px 14px; }
.sr-stat .k { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--sr-muted); }
.sr-stat .v { font-size: 20px; font-weight: 700; margin-top: 2px; }
.sr-bar { height: 10px; border-radius: 6px; background: var(--sr-line); overflow: hidden; margin-top: 16px; }
.sr-bar > i { display: block; height: 100%; border-radius: 6px; }
.sr-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.sr-chip { font-size: 13px; background: var(--sr-bg); border: 1px solid var(--sr-line); border-radius: 999px;
  padding: 4px 12px; color: var(--sr-ink); }
.sr-chip.theater { border-color: var(--sr-bad); color: var(--sr-bad); }
.sr-cta { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--sr-line); font-size: 14px; color: var(--sr-muted); }
.sr-cta code { background: var(--sr-bg); border: 1px solid var(--sr-line); border-radius: 6px; padding: 1px 6px;
  font-size: 13px; color: var(--sr-ink); }
.sr-foot { text-align: center; color: var(--sr-muted); font-size: 12px; margin-top: 16px; }
`;

/** Render the score ring as a self-contained SVG (no external assets). */
function gaugeSvg(report: ScanReport, color: string): string {
  const score = report.governance_score;
  const pct = score ?? 0;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const label = score === null ? "n/a" : String(score);
  const sub = score === null ? "" : "/100";
  return `<svg class="sr-gauge" width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Governance score ${label}${sub}">
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--sr-line)" stroke-width="12"/>
  <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
    stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 70 70)"/>
  <text x="70" y="68" text-anchor="middle" font-size="34" font-weight="800" fill="var(--sr-ink)"
    font-family="-apple-system, Segoe UI, Roboto, sans-serif">${esc(label)}</text>
  <text x="70" y="90" text-anchor="middle" font-size="13" fill="var(--sr-muted)"
    font-family="-apple-system, Segoe UI, Roboto, sans-serif">${sub ? "GOVERNANCE" : "NO CODE"}</text>
</svg>`;
}

/**
 * The shareable report body: an inline `<style>` block plus the card markup, with no
 * doctype/head/body — safe to drop into an artifact host or wrap in a full document.
 * Everything is self-contained (inline styles, inline SVG); nothing is fetched.
 */
export function scanReportBody(report: ScanReport): string {
  const color = scoreColorVar(report);
  const scary =
    report.governed_entity_count === 0
      ? `<p class="sr-scary">No governable code found</p>`
      : report.ungoverned_pct > 0
        ? `<p class="sr-scary"><span class="n">${report.ungoverned_pct}%</span> of this code is governed by nothing</p>`
        : `<p class="sr-scary">Every governable entity maps to a spec</p>`;

  const topKinds = Object.entries(report.ungoverned_by_kind)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([kind, count]) => `<span class="sr-chip">${count} ungoverned ${esc(kind)}</span>`)
    .join("");

  const theaterChip =
    report.annotation_theater_count > 0
      ? `<span class="sr-chip theater">${report.annotation_theater_count} annotation theater</span>`
      : "";

  const grade =
    report.governance_score === null
      ? ""
      : `<span class="sr-grade" style="background:${color}">${esc(report.grade)}</span>`;

  return `<style>${STYLES}</style>
<div class="sr-wrap">
  <div class="sr-card">
    <div class="sr-brand"><b>SpecRegistry</b> · governance scan ${grade}</div>
    <div class="sr-repo">${esc(report.root)}</div>
    <div class="sr-hero">
      ${gaugeSvg(report, color)}
      <div class="sr-headline">
        ${scary}
        <p class="sr-sub">${report.linked_entity_count}/${report.governed_entity_count} governable entities link to a spec · drift ${esc(report.drift_severity)}</p>
      </div>
    </div>
    <div class="sr-bar"><i style="width:${report.coverage_pct}%;background:${color}"></i></div>
    <div class="sr-stats">
      <div class="sr-stat"><div class="k">Coverage</div><div class="v">${report.coverage_pct}%</div></div>
      <div class="sr-stat"><div class="k">Ungoverned</div><div class="v">${report.unlinked_entity_count}</div></div>
      <div class="sr-stat"><div class="k">Specs scanned</div><div class="v">${report.spec_count}</div></div>
      <div class="sr-stat"><div class="k">Drift</div><div class="v">${esc(report.drift_severity)}</div></div>
    </div>
    <div class="sr-chips">${topKinds}${theaterChip}</div>
    <div class="sr-cta">
      Read-only snapshot — nothing was uploaded. To enforce this in CI and produce signed,
      auditor-ready proof, govern the repo: <code>specreg init</code> → <code>specreg comply</code>.
    </div>
  </div>
  <div class="sr-foot">Languages: ${report.languages.map(esc).join(", ") || "none"} · generated by SpecRegistry</div>
</div>`;
}

/** Full standalone HTML document for `specreg scan --html <path>`. */
export function scanReportDocument(report: ScanReport): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SpecRegistry scan — ${esc(report.root)} (${report.governance_score ?? "n/a"}/100)</title>
<meta name="description" content="${report.ungoverned_pct}% of ${esc(report.root)} is governed by nothing — SpecRegistry governance scan.">
<style>html,body{margin:0;background:var(--sr-bg,#f6f7f9)}</style>
</head>
<body>
${scanReportBody(report)}
</body>
</html>
`;
}
