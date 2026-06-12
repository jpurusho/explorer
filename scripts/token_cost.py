#!/usr/bin/env python3
"""
Sum the token usage for the Explorer project across all Claude Code sessions
(main + subagents) and print a per-session and total breakdown.

Usage:
    python3 scripts/token_cost.py [--by-day] [--rates path]

Reads transcripts from:
    ~/.claude/projects/-Users-jpurshot-experimental-explorer/

Each .jsonl file is one session (or one subagent run). Lines that are model
turns carry a `message.usage` block — those are what we sum.

Pricing notes:
- Anthropic prices are per million tokens and vary by model. The model name
  for each turn is in `message.model`. Cache reads are cheaper than fresh
  input; cache writes are more expensive than fresh input.
- We default to Opus 4-class pricing (the heaviest tier this project hits).
  Override with --rates to feed a JSON file mapping model substring → rates.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path.home() / ".claude" / "projects" / "-Users-jpurshot-experimental-explorer"

# $ per million tokens. Numbers below are *approximate* public pricing for the
# Claude 4 family at the time the script was written; check Anthropic's
# pricing page for current values.
DEFAULT_RATES = {
    # match by substring on `message.model`
    "opus": {
        "input": 15.0,
        "output": 75.0,
        "cache_write_5m": 18.75,   # ~1.25x input
        "cache_write_1h": 30.0,    # ~2.0x input
        "cache_read": 1.50,        # ~10% of input
    },
    "sonnet": {
        "input": 3.0,
        "output": 15.0,
        "cache_write_5m": 3.75,
        "cache_write_1h": 6.0,
        "cache_read": 0.30,
    },
    "haiku": {
        "input": 1.0,
        "output": 5.0,
        "cache_write_5m": 1.25,
        "cache_write_1h": 2.0,
        "cache_read": 0.10,
    },
    # Fallback if model field is missing or unrecognized.
    "default": {
        "input": 15.0,
        "output": 75.0,
        "cache_write_5m": 18.75,
        "cache_write_1h": 30.0,
        "cache_read": 1.50,
    },
}


def rate_for(model: str | None, rates: dict) -> dict:
    if not model:
        return rates["default"]
    m = model.lower()
    for key in ("opus", "sonnet", "haiku"):
        if key in m and key in rates:
            return rates[key]
    return rates["default"]


def iter_jsonl(path: Path):
    with path.open("r", errors="replace") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                # Truncated or partial line — skip silently.
                continue


def collect_usages(jsonl_path: Path):
    """Yield (timestamp, model, usage_dict) tuples from a transcript file."""
    for entry in iter_jsonl(jsonl_path):
        msg = entry.get("message")
        if not isinstance(msg, dict):
            continue
        usage = msg.get("usage")
        if not isinstance(usage, dict):
            continue
        ts = entry.get("timestamp") or entry.get("createdAt")
        model = msg.get("model")
        yield ts, model, usage


def sum_session(jsonl_path: Path):
    """Returns a dict of summed token counts and a per-model breakdown."""
    totals = defaultdict(int)
    by_model = defaultdict(lambda: defaultdict(int))
    by_day = defaultdict(lambda: defaultdict(int))
    turns = 0

    for ts, model, u in collect_usages(jsonl_path):
        turns += 1
        cache = u.get("cache_creation") or {}
        fields = {
            "input": int(u.get("input_tokens") or 0),
            "output": int(u.get("output_tokens") or 0),
            "cache_read": int(u.get("cache_read_input_tokens") or 0),
            "cache_write_5m": int(cache.get("ephemeral_5m_input_tokens") or 0),
            "cache_write_1h": int(cache.get("ephemeral_1h_input_tokens") or 0),
        }
        # Older shapes may have only `cache_creation_input_tokens` without the
        # 5m/1h split — fold that into 5m.
        if not fields["cache_write_5m"] and not fields["cache_write_1h"]:
            legacy_write = int(u.get("cache_creation_input_tokens") or 0)
            fields["cache_write_5m"] = legacy_write

        for k, v in fields.items():
            totals[k] += v
            by_model[model or "?"][k] += v
            if ts:
                day = ts[:10]
                by_day[day][k] += v

    return {
        "turns": turns,
        "totals": dict(totals),
        "by_model": {m: dict(d) for m, d in by_model.items()},
        "by_day": {d: dict(v) for d, v in by_day.items()},
    }


def cost_of(totals: dict, rates: dict) -> float:
    """totals is a dict of token_kind → tokens; rates is the per-model rate dict."""
    cost = 0.0
    for k, n in totals.items():
        per_million = rates.get(k, 0.0)
        cost += (n / 1_000_000.0) * per_million
    return cost


def fmt_tokens(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.2f}M"
    if n >= 1_000:
        return f"{n/1_000:.1f}k"
    return str(n)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--by-day", action="store_true", help="Show per-day breakdown")
    ap.add_argument("--rates", help="Path to JSON file overriding pricing rates")
    ap.add_argument("--project-dir", default=str(PROJECT_DIR), help="Override project dir")
    args = ap.parse_args(argv)

    rates = DEFAULT_RATES
    if args.rates:
        with open(args.rates) as f:
            rates = json.load(f)

    project_dir = Path(args.project_dir)
    if not project_dir.exists():
        print(f"No transcripts at {project_dir}", file=sys.stderr)
        return 1

    # Find all .jsonl files: top-level (main sessions) + subagent dirs.
    main_files = sorted(project_dir.glob("*.jsonl"))
    sub_files = sorted(project_dir.glob("*/subagents/agent-*.jsonl"))

    grand_totals = defaultdict(int)
    grand_by_model = defaultdict(lambda: defaultdict(int))
    grand_by_day = defaultdict(lambda: defaultdict(int))
    grand_turns = 0
    sessions_summary = []

    for path in main_files + sub_files:
        s = sum_session(path)
        if s["turns"] == 0:
            continue
        kind = "main" if path in main_files else "subagent"
        # Compute weighted-cost for this file using its own model breakdown.
        file_cost = sum(cost_of(d, rate_for(model, rates)) for model, d in s["by_model"].items())
        sessions_summary.append((kind, path.name, s, file_cost))
        for k, v in s["totals"].items():
            grand_totals[k] += v
        for m, d in s["by_model"].items():
            for k, v in d.items():
                grand_by_model[m][k] += v
        for day, d in s["by_day"].items():
            for k, v in d.items():
                grand_by_day[day][k] += v
        grand_turns += s["turns"]

    # ---- Output ----
    print("=" * 72)
    print(f"Explorer project — token cost summary  ({len(sessions_summary)} files)")
    print("=" * 72)
    print()

    print(f"{'Kind':<10} {'File':<48} {'Turns':>6} {'$':>9}")
    print("-" * 76)
    total_cost = 0.0
    for kind, name, s, c in sessions_summary:
        total_cost += c
        short = name if len(name) <= 47 else name[:44] + "..."
        print(f"{kind:<10} {short:<48} {s['turns']:>6} {c:>9.2f}")
    print("-" * 76)
    print(f"{'TOTAL':<10} {'':<48} {grand_turns:>6} {total_cost:>9.2f}")
    print()

    print("Token totals (across all sessions, all models):")
    for k in ("input", "output", "cache_read", "cache_write_5m", "cache_write_1h"):
        print(f"  {k:<18} {grand_totals[k]:>15,}  ({fmt_tokens(grand_totals[k])})")
    grand_in = grand_totals["input"] + grand_totals["cache_read"] + grand_totals["cache_write_5m"] + grand_totals["cache_write_1h"]
    print(f"  {'TOTAL INPUT':<18} {grand_in:>15,}  ({fmt_tokens(grand_in)})")
    print(f"  {'TOTAL OUTPUT':<18} {grand_totals['output']:>15,}  ({fmt_tokens(grand_totals['output'])})")
    print()

    print("By model:")
    for m, d in sorted(grand_by_model.items(), key=lambda x: -sum(x[1].values())):
        m_in = d.get("input", 0) + d.get("cache_read", 0) + d.get("cache_write_5m", 0) + d.get("cache_write_1h", 0)
        m_out = d.get("output", 0)
        m_cost = cost_of(d, rate_for(m, rates))
        print(f"  {m:<40} in={fmt_tokens(m_in):>8}  out={fmt_tokens(m_out):>8}  ${m_cost:>8.2f}")
    print()

    if args.by_day:
        print("By day:")
        for day in sorted(grand_by_day):
            d = grand_by_day[day]
            day_in = d.get("input", 0) + d.get("cache_read", 0) + d.get("cache_write_5m", 0) + d.get("cache_write_1h", 0)
            print(f"  {day}  in={fmt_tokens(day_in):>8}  out={fmt_tokens(d.get('output', 0)):>8}")
        print()

    print(f"Estimated total cost:  ${total_cost:.2f}")
    print()
    print("Note: cost estimate uses approximate public pricing for the Claude")
    print("4 family (Opus / Sonnet / Haiku). Cache reads ~10% of input; cache")
    print("writes ~25% above input. If you're on a flat-rate Claude Code plan")
    print("(Pro/Max), the dollar figure is an API-equivalent estimate, not a")
    print("real charge. Override with --rates RATES.json to plug in current")
    print("pricing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
