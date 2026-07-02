"""
flow_graph.py — SwingBy code-flow visualizer.

Scans the mobile app + backend and emits:
  docs/FLOW_GRAPH.md   — Mermaid graph + broken-links report (human)
  docs/flow-graph.json — same data, machine-readable

Run:
  "C:/Python314/python.exe" tools/flow_graph.py

What it detects
  * Every registered screen in every navigator
  * Every navigation.navigate/push/replace/reset('X') call and where it fires
  * Every backend @router.get/post/put/patch/delete route + prefix
  * Every mobile api.get/post/put/patch/delete/fetch call

What it flags
  * Broken nav edges  — navigate('X') where X is not a registered screen
  * Orphan screens    — registered but nothing navigates to them
  * Broken API calls  — mobile hits an endpoint the backend doesn't expose
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
MOBILE_NAV_DIR = ROOT / "mobile" / "src" / "navigation"
MOBILE_SCREENS_DIR = ROOT / "mobile" / "src" / "screens"
MOBILE_COMPONENTS_DIR = ROOT / "mobile" / "src" / "components"
BACKEND_API_DIR = ROOT / "backend" / "app" / "api"
BACKEND_MAIN = ROOT / "backend" / "app" / "main.py"
OUT_MD = ROOT / "docs" / "FLOW_GRAPH.md"
OUT_JSON = ROOT / "docs" / "flow-graph.json"

# ---------- navigators ----------

STACK_SCREEN_RE = re.compile(
    r'<(Stack|Tab)\.Screen\s+name=["\']([^"\']+)["\']\s+component=\{(\w+)\}'
)
IMPORT_RE = re.compile(
    r'^\s*import\s+(\w+)\s+from\s+["\']([^"\']+)["\']', re.MULTILINE
)


def parse_navigators() -> dict:
    """Return {nav_name: [{route, component, file}]} and reverse maps."""
    navs = {}
    for js in sorted(MOBILE_NAV_DIR.glob("*.js")):
        text = js.read_text(encoding="utf-8", errors="replace")
        imports = {name: path for name, path in IMPORT_RE.findall(text)}
        screens = []
        for kind, route, comp in STACK_SCREEN_RE.findall(text):
            src_rel = imports.get(comp)
            src_file = None
            if src_rel:
                cand = (js.parent / src_rel).resolve()
                for suffix in (".js", ".jsx", ".tsx", ".ts", "/index.js"):
                    p = Path(str(cand) + suffix)
                    if p.exists():
                        src_file = p
                        break
            screens.append({
                "route": route,
                "component": comp,
                "kind": kind,  # 'Stack' or 'Tab'
                "file": str(src_file.relative_to(ROOT)) if src_file else None,
            })
        navs[js.stem] = screens
    return navs


# ---------- screen edges ----------

NAV_CALL_RE = re.compile(
    r'navigation\.(navigate|push|replace|reset)\(\s*["\']([^"\']+)["\']'
)
# Also catch object-form routing tables like { screen: 'BookingDetails', ... }
# used by NotificationsCenter and other dispatchers.
NAV_OBJECT_RE = re.compile(r"screen:\s*['\"]([^'\"]+)['\"]")


def scan_edges() -> list:
    """Every navigation call in mobile/src/screens + components."""
    edges = []
    for root in (MOBILE_SCREENS_DIR, MOBILE_COMPONENTS_DIR):
        for js in root.rglob("*.js"):
            text = js.read_text(encoding="utf-8", errors="replace")
            src = str(js.relative_to(ROOT))
            for line_num, line in enumerate(text.splitlines(), start=1):
                for method, target in NAV_CALL_RE.findall(line):
                    edges.append({
                        "from_file": src,
                        "from_screen": js.stem,
                        "to_route": target,
                        "method": method,
                        "line": line_num,
                    })
                for target in NAV_OBJECT_RE.findall(line):
                    edges.append({
                        "from_file": src,
                        "from_screen": js.stem,
                        "to_route": target,
                        "method": "dispatch",
                        "line": line_num,
                    })
    return edges


# ---------- backend routes ----------

INCLUDE_ROUTER_RE = re.compile(
    r'include_router\(\s*(\w+)\s*,\s*prefix=["\']([^"\']*)["\']'
)
IMPORT_ROUTER_RE = re.compile(
    r'from\s+app\.api\.(\w+)\s+import\s+router\s+as\s+(\w+)'
)
ROUTE_DECL_RE = re.compile(
    r'@router\.(get|post|put|patch|delete)\(\s*["\']([^"\']*)["\']'
)


def parse_backend_routes() -> list:
    main_text = BACKEND_MAIN.read_text(encoding="utf-8", errors="replace")
    router_var_to_module = dict(
        (var, mod) for mod, var in IMPORT_ROUTER_RE.findall(main_text)
    )
    var_to_prefix = defaultdict(list)  # same var may be included multiple times
    for var, prefix in INCLUDE_ROUTER_RE.findall(main_text):
        var_to_prefix[var].append(prefix)

    routes = []
    for py in sorted(BACKEND_API_DIR.glob("*.py")):
        if py.stem == "__init__":
            continue
        text = py.read_text(encoding="utf-8", errors="replace")
        # find any router variable(s) that map back to this module
        matching_vars = [
            v for v, mod in router_var_to_module.items() if mod == py.stem
        ]
        prefixes = []
        for v in matching_vars:
            prefixes.extend(var_to_prefix.get(v, []))
        if not prefixes:
            prefixes = [""]  # not registered
        for line_num, line in enumerate(text.splitlines(), start=1):
            for method, path in ROUTE_DECL_RE.findall(line):
                for pref in prefixes:
                    full = (pref + path) or "/"
                    routes.append({
                        "method": method.upper(),
                        "path": full,
                        "file": str(py.relative_to(ROOT)),
                        "line": line_num,
                    })
    return routes


# ---------- mobile API calls ----------

# api.get(`/bookings/${x}`), api.post('/foo', ...), api.get("/bar")
API_CALL_RE = re.compile(
    r'api\.(get|post|put|patch|delete)\(\s*[`\'"]([^`\'"]+)[`\'"]'
)


def scan_api_calls() -> list:
    calls = []
    for root in (MOBILE_SCREENS_DIR, MOBILE_COMPONENTS_DIR,
                 ROOT / "mobile" / "src" / "services",
                 ROOT / "mobile" / "src" / "context"):
        if not root.exists():
            continue
        for js in root.rglob("*.js"):
            text = js.read_text(encoding="utf-8", errors="replace")
            for line_num, line in enumerate(text.splitlines(), start=1):
                for method, path in API_CALL_RE.findall(line):
                    calls.append({
                        "from_file": str(js.relative_to(ROOT)),
                        "method": method.upper(),
                        "path": path,
                        "line": line_num,
                    })
    return calls


# ---------- normalization for API path matching ----------

def normalize_path(p: str) -> str:
    """Collapse path params so backend `{id}` and mobile `${id}` match.

    Order matters: strip `${x}` before `{x}` or the leading `$` leaks through.
    Also strip trailing `?query` fragments and trailing `${qs}` interpolations
    (mobile code often appends a template-var query string at the end).
    """
    p = p.split("?", 1)[0]
    # Strip a trailing `${x}` ONLY when it's glued to a literal segment
    # (no `/` before it) — that pattern is a query string appended in code,
    # e.g. `/photos${q}` where q = "?since=...". A trailing `/${id}` is a
    # legitimate path param and must NOT be stripped.
    p = re.sub(r"(?<=[^/])\$\{[^}]+\}$", "", p)
    p = re.sub(r"\$\{[^}]+\}", "*", p)          # mobile ${x}
    p = re.sub(r"\{[^}]+\}", "*", p)             # backend {name}
    p = re.sub(r"/[0-9a-fA-F-]{16,}", "/*", p)   # bare UUIDs
    return p.rstrip("/") or "/"


# ---------- diff ----------

def diff(navs, edges, routes, api_calls):
    all_routes = set()
    route_to_file = {}
    for nav_name, screens in navs.items():
        for s in screens:
            all_routes.add(s["route"])
            route_to_file[s["route"]] = s["file"] or nav_name

    # nav edges: unresolved targets
    broken_edges = [
        e for e in edges if e["to_route"] not in all_routes
    ]

    # Per-navigator orphan detection.
    # A screen X registered in navigator N is orphaned WITHIN N if:
    #   * X is not the Stack root of N
    #   * X is not a Tab.Screen of N (tabbar-reachable)
    #   * X's component doesn't end in "Tabs" (tabnav wrapper)
    #   * No edge whose source ALSO lives in N has target X
    #
    # Reason for per-nav: a screen may be reached from ClientNavigator
    # but still unreachable to a Business user, and vice-versa. The
    # global "any incoming edge" test misses that.
    #
    # We need each screen's home file to attribute edges to navigators.
    file_to_navs = defaultdict(set)  # file path -> {nav names it appears in}
    for nav_name, screens in navs.items():
        for s in screens:
            if s["file"]:
                file_to_navs[s["file"]].add(nav_name)

    # Build per-navigator reachability sets.
    per_nav_orphans = {}
    global_reachable = {e["to_route"] for e in edges}
    for nav_name, screens in navs.items():
        nav_route_set = {s["route"] for s in screens}
        # Screens whose file is registered in this nav — those are the
        # only screens whose navigation.navigate calls count as "in-nav"
        # edges. A shared screen (e.g. MyJobsScreen used by both) fires
        # edges that count for both navs.
        edges_in_nav = [
            e for e in edges
            if nav_name in file_to_navs.get(e["from_file"], set())
            and e["to_route"] in nav_route_set
        ]
        reachable_in_nav = {e["to_route"] for e in edges_in_nav}

        auto_reachable = set()
        stack_only = [s for s in screens if s["kind"] == "Stack"]
        if stack_only:
            auto_reachable.add(stack_only[0]["route"])
        for s in screens:
            if s["kind"] == "Tab":
                auto_reachable.add(s["route"])
            if s["component"].endswith("Tabs"):
                auto_reachable.add(s["route"])

        nav_orphans = sorted(
            r for r in nav_route_set
            if r not in reachable_in_nav and r not in auto_reachable
        )
        per_nav_orphans[nav_name] = nav_orphans

    # Global orphans (backward-compat): unreachable from EVERY navigator.
    auto_reachable_global = set()
    for nav_name, screens in navs.items():
        stack_only = [s for s in screens if s["kind"] == "Stack"]
        if stack_only:
            auto_reachable_global.add(stack_only[0]["route"])
        for s in screens:
            if s["kind"] == "Tab":
                auto_reachable_global.add(s["route"])
            if s["component"].endswith("Tabs"):
                auto_reachable_global.add(s["route"])
    orphans = sorted(
        r for r in all_routes
        if r not in global_reachable and r not in auto_reachable_global
    )

    # backend routes
    backend_set = set()
    for r in routes:
        backend_set.add((r["method"], normalize_path(r["path"])))

    broken_api = []
    for c in api_calls:
        key = (c["method"], normalize_path(c["path"]))
        if key not in backend_set:
            broken_api.append(c)

    return broken_edges, orphans, broken_api, per_nav_orphans


# ---------- output ----------

def build_mermaid(navs, edges, per_nav_orphans=None) -> str:
    """Group screens by navigator subgraphs; draw edges by route name.

    Also builds a filename-stem → route map so edges emit as route→route
    (readable) instead of ComponentName→route (mermaid ghost nodes).

    Colors orphans in red so they visually pop.
    """
    stem_to_route = {}
    for nav_name, screens in navs.items():
        for s in screens:
            if s["file"]:
                stem = Path(s["file"]).stem
                stem_to_route.setdefault(stem, s["route"])

    orphan_set = set()
    if per_nav_orphans:
        for lst in per_nav_orphans.values():
            orphan_set.update(lst)

    lines = ["```mermaid", "flowchart LR"]
    lines.append("  classDef orphan fill:#3a0f0f,stroke:#ff5c5c,color:#ffb3b3;")
    for nav_name, screens in navs.items():
        safe_nav = nav_name.replace(" ", "_")
        lines.append(f"  subgraph {safe_nav}")
        for s in screens:
            rid = safe_id(s["route"])
            lines.append(f'    {rid}["{s["route"]}"]')
        lines.append("  end")

    seen = set()
    for e in edges:
        target_route = e["to_route"]
        src_route = stem_to_route.get(e["from_screen"], e["from_screen"])
        src = safe_id(src_route)
        rid = safe_id(target_route)
        key = (src, rid)
        if key in seen or src == rid:
            continue
        seen.add(key)
        lines.append(f"  {src} --> {rid}")

    for route in sorted(orphan_set):
        lines.append(f"  class {safe_id(route)} orphan;")

    lines.append("```")
    return "\n".join(lines)


def safe_id(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", name)


def build_report(navs, edges, routes, api_calls,
                 broken_edges, orphans, broken_api,
                 per_nav_orphans) -> str:
    md = []
    md.append("# SwingBy — Code Flow Graph\n")
    md.append("_Generated by `tools/flow_graph.py`. Regenerate any time._\n")

    md.append("## Navigation graph\n")
    md.append("Orphans (unreachable in their navigator) are highlighted in red.\n")
    md.append(build_mermaid(navs, edges, per_nav_orphans))
    md.append("\n")

    md.append("## Broken navigation edges\n")
    md.append("Screens that call `navigation.navigate('X')` where **X is not registered** in any navigator.\n")
    if not broken_edges:
        md.append("*None.* Every navigation target resolves.\n")
    else:
        md.append("| From file:line | Call | Target |")
        md.append("|---|---|---|")
        for e in broken_edges:
            md.append(f"| `{e['from_file']}:{e['line']}` | `.{e['method']}` | **`{e['to_route']}`** |")
        md.append("")

    md.append("## Orphan screens (global)\n")
    md.append("Registered screens with **no incoming navigation from anywhere** (excluding navigator roots).\n")
    if not orphans:
        md.append("*None.* Every screen is reachable somewhere.\n")
    else:
        for r in orphans:
            md.append(f"- `{r}`")
        md.append("")

    md.append("## Orphan screens (per-navigator)\n")
    md.append("Screens that ARE registered in a navigator but **cannot be reached by that user role's flow**. A screen may be reachable from ClientNavigator yet still be unreachable to a Business user, and vice-versa.\n")
    any_per = False
    for nav_name, nav_orphans in per_nav_orphans.items():
        if not nav_orphans:
            continue
        any_per = True
        md.append(f"### `{nav_name}`\n")
        for r in nav_orphans:
            md.append(f"- `{r}`")
        md.append("")
    if not any_per:
        md.append("*None.* Every screen is reachable from within its own navigator.\n")

    md.append("## Broken API calls\n")
    md.append("Mobile calls to endpoints **not exposed by the backend** (path params normalized).\n")
    if not broken_api:
        md.append("*None.* Every API call resolves.\n")
    else:
        md.append("| From file:line | Method | Path (raw) | Normalized |")
        md.append("|---|---|---|---|")
        for c in broken_api:
            md.append(
                f"| `{c['from_file']}:{c['line']}` | {c['method']} "
                f"| `{c['path']}` | `{normalize_path(c['path'])}` |"
            )
        md.append("")

    md.append("## Inventory\n")
    total_routes = sum(len(s) for s in navs.values())
    md.append(f"- Navigators: **{len(navs)}**  ")
    md.append(f"- Registered screens: **{total_routes}**  ")
    md.append(f"- Navigation edges: **{len(edges)}**  ")
    md.append(f"- Backend routes: **{len(routes)}**  ")
    md.append(f"- Mobile API calls: **{len(api_calls)}**  ")
    md.append("")

    return "\n".join(md)


def main() -> None:
    navs = parse_navigators()
    edges = scan_edges()
    routes = parse_backend_routes()
    api_calls = scan_api_calls()
    broken_edges, orphans, broken_api, per_nav_orphans = diff(
        navs, edges, routes, api_calls
    )

    OUT_MD.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(
        build_report(navs, edges, routes, api_calls,
                     broken_edges, orphans, broken_api,
                     per_nav_orphans),
        encoding="utf-8",
    )
    OUT_JSON.write_text(json.dumps({
        "navigators": navs,
        "edges": edges,
        "backend_routes": routes,
        "api_calls": api_calls,
        "broken_edges": broken_edges,
        "orphans": orphans,
        "per_nav_orphans": per_nav_orphans,
        "broken_api": broken_api,
    }, indent=2), encoding="utf-8")

    per_nav_total = sum(len(v) for v in per_nav_orphans.values())
    print(f"[flow_graph] wrote {OUT_MD.relative_to(ROOT)}")
    print(f"[flow_graph] wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"[flow_graph] broken edges: {len(broken_edges)}  "
          f"global orphans: {len(orphans)}  "
          f"per-nav orphans: {per_nav_total}  "
          f"broken api: {len(broken_api)}")


if __name__ == "__main__":
    main()
