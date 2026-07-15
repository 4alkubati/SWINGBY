#!/usr/bin/env python3
"""Render docs/flow-graph.json as a self-contained HTML page (SwingBy Flow Atlas).

Usage: python3 tools/flow_artifact.py [output.html]
Run tools/flow_graph.py first to refresh the JSON, then this to refresh the page.
The page is published as a Claude Artifact (mermaid renders natively there) —
it carries no <html>/<head>/<body> wrapper on purpose.
"""
import html
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "flow-graph.html"

data = json.loads((ROOT / "docs" / "flow-graph.json").read_text())
navs = {k: v for k, v in data["navigators"].items() if v}  # drop empty (transitions)


def mid(name: str) -> str:
    return re.sub(r"\W", "_", name)


# component -> routes it is registered under, per navigator
comp_routes = {nav: defaultdict(list) for nav in navs}
route_set = {nav: {e["route"] for e in entries} for nav, entries in navs.items()}
for nav, entries in navs.items():
    for e in entries:
        comp_routes[nav][e["component"]].append(e["route"])

# dedupe edges by (from_screen, to_route), keep provenance
edge_prov = defaultdict(list)
for e in data["edges"]:
    edge_prov[(e["from_screen"], e["to_route"])].append(f'{e["from_file"]}:{e["line"]}')

per_nav_orphans = data.get("per_nav_orphans", {})


def nav_mermaid(nav: str) -> tuple[str, int]:
    """Diagram for one navigator: edges whose source component and target route
    are both registered in it. Node ids are prefixed so shared screens
    (Chat, Settings, ...) stay separate per navigator."""
    p = mid(nav)[:3] + "_"
    orphans = set(per_nav_orphans.get(nav, []))
    lines = ["flowchart LR", "  classDef orphan fill:#3a0f0f,stroke:#ff5c5c,color:#ffb3b3;",
             "  classDef tab stroke-width:2.5px;"]
    for e in navs[nav]:
        node = f'  {p}{mid(e["route"])}["{e["route"]}"]'
        if e["route"] in orphans:
            node += ":::orphan"
        elif e["kind"] == "Tab":
            node += ":::tab"
        lines.append(node)
    n_edges = 0
    seen = set()
    for (frm, to), _ in edge_prov.items():
        for src_route in comp_routes[nav].get(frm, []):
            if to in route_set[nav] and (src_route, to) not in seen and src_route != to:
                seen.add((src_route, to))
                lines.append(f"  {p}{mid(src_route)} --> {p}{mid(to)}")
                n_edges += 1
    return "\n".join(lines), n_edges


def full_mermaid() -> str:
    """Global merged view (same shape as FLOW_GRAPH.md): shared screens merge."""
    lines = ["flowchart LR", "  classDef orphan fill:#3a0f0f,stroke:#ff5c5c,color:#ffb3b3;"]
    for nav, entries in navs.items():
        lines.append(f"  subgraph {nav}")
        for e in entries:
            lines.append(f'    {mid(e["route"])}["{e["route"]}"]')
        lines.append("  end")
    seen = set()
    route_comp = {}
    for nav, entries in navs.items():
        for e in entries:
            route_comp.setdefault(e["component"], e["route"])
    for (frm, to), _ in edge_prov.items():
        src = route_comp.get(frm, frm.replace("Screen", ""))
        if (src, to) not in seen and src != to:
            seen.add((src, to))
            lines.append(f"  {mid(src)} --> {mid(to)}")
    return "\n".join(lines)


def pill(label: str, n: int) -> str:
    cls = "ok" if n == 0 else "bad"
    word = "clean" if n == 0 else str(n)
    return f'<span class="pill {cls}"><b>{word}</b>{html.escape(label)}</span>'


NAV_LABEL = {"AuthNavigator": "Auth", "BusinessNavigator": "Business", "ClientNavigator": "Client"}
inputs, labels, panels = [], [], []
order = ["ClientNavigator", "BusinessNavigator", "AuthNavigator"]
for i, nav in enumerate([n for n in order if n in navs] + [n for n in navs if n not in order]):
    dia, n_edges = nav_mermaid(nav)
    label = NAV_LABEL.get(nav, nav)
    checked = " checked" if i == 0 else ""
    inputs.append(f'<input type="radio" name="tab" id="t{i}"{checked} aria-label="{label} navigator">')
    labels.append(f'<label for="t{i}">{label}<span>{len(navs[nav])} · {n_edges}</span></label>')
    panels.append(f'<section class="panel" id="p{i}"><div class="scroll">'
                  f'<pre class="mermaid">{html.escape(dia)}</pre></div></section>')
i += 1
inputs.append(f'<input type="radio" name="tab" id="t{i}" aria-label="Full map">')
labels.append(f'<label for="t{i}">Full map<span>merged</span></label>')
panels.append(f'<section class="panel" id="p{i}"><p class="note">All navigators at once — '
              f'screens registered in more than one navigator (Chat, Settings, Messages…) '
              f'merge into a single node here; use the per-navigator tabs for the exact '
              f'per-role picture.</p><div class="scroll">'
              f'<pre class="mermaid">{html.escape(full_mermaid())}</pre></div></section>')

rows = []
for (frm, to), provs in sorted(edge_prov.items()):
    where = "<br>".join(f'<code>{html.escape(p)}</code>' for p in sorted(set(provs)))
    rows.append(f'<tr><td>{html.escape(frm)}</td><td class="arrow">→</td>'
                f'<td>{html.escape(to)}</td><td>{where}</td></tr>')

css_show = ",".join(f'#t{j}:checked ~ .panels #p{j}' for j in range(i + 1))
css_lab = ",".join(f'#t{j}:checked ~ .tabbar label[for=t{j}]' for j in range(i + 1))
css_focus = ",".join(f'#t{j}:focus-visible ~ .tabbar label[for=t{j}]' for j in range(i + 1))

page = f"""<title>SwingBy Flow Atlas</title>
<style>
:root {{
  --bg:#07080a; --surface:#0F1115; --surface2:#161A21; --border:#1F232B;
  --text:#F4F6FA; --text2:#8B92A0; --accent:#8878F9; --accent-bg:#2A2247;
  --ok:#2EBD85; --ok-bg:rgba(46,189,133,.12); --bad:#FF5C5C; --bad-bg:rgba(255,92,92,.12);
}}
@media (prefers-color-scheme: light) {{ :root {{
  --bg:#F6F6FA; --surface:#FFFFFF; --surface2:#EFEFF6; --border:#E2E2EE;
  --text:#17181D; --text2:#5A5F6E; --accent:#5646D4; --accent-bg:#E9E6FB;
  --ok:#1B8A61; --ok-bg:rgba(27,138,97,.10); --bad:#CC3A3A; --bad-bg:rgba(204,58,58,.08);
}} }}
:root[data-theme="dark"] {{
  --bg:#07080a; --surface:#0F1115; --surface2:#161A21; --border:#1F232B;
  --text:#F4F6FA; --text2:#8B92A0; --accent:#8878F9; --accent-bg:#2A2247;
  --ok:#2EBD85; --ok-bg:rgba(46,189,133,.12); --bad:#FF5C5C; --bad-bg:rgba(255,92,92,.12);
}}
:root[data-theme="light"] {{
  --bg:#F6F6FA; --surface:#FFFFFF; --surface2:#EFEFF6; --border:#E2E2EE;
  --text:#17181D; --text2:#5A5F6E; --accent:#5646D4; --accent-bg:#E9E6FB;
  --ok:#1B8A61; --ok-bg:rgba(27,138,97,.10); --bad:#CC3A3A; --bad-bg:rgba(204,58,58,.08);
}}
body {{ background:var(--bg); color:var(--text); font:15px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif;
  max-width:1100px; margin:0 auto; padding:32px 20px 80px; }}
code,.mono {{ font-family:ui-monospace,'SF Mono','Cascadia Code',Menlo,monospace; }}
header h1 {{ font-size:26px; font-weight:750; letter-spacing:-.02em; margin:0; text-wrap:balance; }}
header .sub {{ color:var(--text2); margin:6px 0 0; }}
header .regen {{ display:inline-block; margin-top:10px; background:var(--surface); border:1px solid var(--border);
  border-radius:8px; padding:4px 10px; font-size:12.5px; color:var(--text2);
  font-family:ui-monospace,Menlo,monospace; }}
.stats {{ display:flex; flex-wrap:wrap; gap:10px; margin:22px 0 6px; }}
.stat {{ background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:10px 16px; min-width:96px; }}
.stat b {{ display:block; font-size:22px; font-weight:700; font-variant-numeric:tabular-nums;
  font-family:ui-monospace,Menlo,monospace; color:var(--accent); }}
.stat span {{ font-size:11.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--text2); }}
.pills {{ display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 28px; }}
.pill {{ border-radius:999px; padding:4px 13px; font-size:12.5px; display:inline-flex; gap:6px; align-items:center; }}
.pill b {{ font-weight:700; }}
.pill.ok {{ background:var(--ok-bg); color:var(--ok); }}
.pill.bad {{ background:var(--bad-bg); color:var(--bad); }}
.tabs {{ margin-top:8px; }}
.tabs > input {{ position:absolute; opacity:0; pointer-events:none; }}
.tabbar {{ display:flex; flex-wrap:wrap; gap:6px; border-bottom:1px solid var(--border); padding-bottom:10px; }}
.tabbar label {{ cursor:pointer; border:1px solid var(--border); background:var(--surface);
  border-radius:999px; padding:6px 15px; font-size:14px; font-weight:600; color:var(--text2); }}
.tabbar label span {{ margin-left:8px; font-size:11.5px; font-weight:500; color:var(--text2);
  font-family:ui-monospace,Menlo,monospace; }}
{css_lab} {{ background:var(--accent-bg); border-color:var(--accent); color:var(--text); }}
{css_focus} {{ outline:2px solid var(--accent); outline-offset:2px; }}
.panel {{ display:none; padding-top:18px; }}
{css_show} {{ display:block; }}
.scroll {{ overflow-x:auto; background:var(--surface); border:1px solid var(--border);
  border-radius:14px; padding:14px; }}
.note {{ color:var(--text2); font-size:13.5px; margin:0 0 12px; max-width:65ch; }}
h2 {{ font-size:17px; font-weight:700; letter-spacing:-.01em; margin:44px 0 4px; }}
h2 + p {{ color:var(--text2); font-size:13.5px; margin:0 0 14px; max-width:65ch; }}
input.filter {{ width:100%; max-width:360px; box-sizing:border-box; background:var(--surface);
  border:1px solid var(--border); border-radius:10px; padding:8px 12px; color:var(--text);
  font:13.5px ui-monospace,Menlo,monospace; margin-bottom:12px; }}
input.filter:focus-visible {{ outline:2px solid var(--accent); outline-offset:1px; border-color:var(--accent); }}
.tablewrap {{ overflow-x:auto; border:1px solid var(--border); border-radius:14px; }}
table {{ border-collapse:collapse; width:100%; font-size:13.5px; }}
th {{ text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.07em;
  color:var(--text2); padding:10px 14px; background:var(--surface2); }}
td {{ padding:8px 14px; border-top:1px solid var(--border); vertical-align:top;
  font-family:ui-monospace,Menlo,monospace; }}
td.arrow {{ color:var(--accent); }}
td code {{ font-size:12px; color:var(--text2); }}
.mermaid {{ margin:0; }}
</style>

<header>
  <h1>SwingBy Flow Atlas</h1>
  <p class="sub">Every screen-to-screen navigation edge in the mobile app, straight from the code.</p>
  <span class="regen">python3 tools/flow_graph.py && python3 tools/flow_artifact.py</span>
</header>

<div class="stats">
  <div class="stat"><b>{sum(len(v) for v in navs.values())}</b><span>registered screens</span></div>
  <div class="stat"><b>{len(edge_prov)}</b><span>unique nav edges</span></div>
  <div class="stat"><b>{len(data["backend_routes"])}</b><span>backend routes</span></div>
  <div class="stat"><b>{len(data["api_calls"])}</b><span>mobile api calls</span></div>
</div>
<div class="pills">
  {pill(" broken nav edges", len(data["broken_edges"]))}
  {pill(" orphan screens", len(data["orphans"]) + sum(len(v) for v in per_nav_orphans.values()))}
  {pill(" broken api calls", len(data["broken_api"]))}
</div>

<div class="tabs">
  {"".join(inputs)}
  <div class="tabbar">{"".join(labels)}</div>
  <div class="panels">{"".join(panels)}</div>
</div>

<h2>Edge index</h2>
<p>Deduplicated screen → route edges with the exact <code>file:line</code> of each
<code>navigation.navigate()</code> call. Type to filter.</p>
<input class="filter" id="q" type="search" placeholder="filter: screen, route, or file…" aria-label="Filter edges">
<div class="tablewrap"><table id="edges">
<thead><tr><th>From screen</th><th></th><th>To route</th><th>Where in code</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div>

<script>
(() => {{
  const q = document.getElementById('q');
  const rows = [...document.querySelectorAll('#edges tbody tr')];
  q.addEventListener('input', () => {{
    const s = q.value.toLowerCase();
    rows.forEach(r => r.style.display = r.textContent.toLowerCase().includes(s) ? '' : 'none');
  }});
}})();
</script>
"""

OUT.write_text(page)
print(f"wrote {OUT} ({len(page)} bytes, {len(edge_prov)} edges, {len(navs)} navigators)")
