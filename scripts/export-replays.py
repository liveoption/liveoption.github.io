#!/usr/bin/env python3
"""Export a small, public-safe replay of the site's five archived cases.

Run on the machine holding the archives. Explicit input paths are required;
no model calls, broker writes, new backtests or synthetic observations occur.
Only allowlisted fields are exported. Original response text is not translated.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
CASE_IDS = {"earnings-meta-q1": "Q1_FY2025", "earnings-nvda-q4": "Q4_FY2025", "overlay-qqq-hedge": "hedge", "odte-2025-01-15": "2025-01-15", "odte-2025-04-09": "2025-04-09"}
SECRET = re.compile(r"sk-[A-Za-z0-9_-]{32,}|BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY")


def read_lines(root, name):
    for file in (root / f"{name}.jsonl.gz", root / f"{name}.jsonl"):
        if file.exists():
            with (gzip.open(file, "rt") if file.suffix == ".gz" else file.open()) as handle:
                return [json.loads(line) for line in handle if line.strip()]
    return []


def parse(raw):
    if not isinstance(raw, str):
        return raw
    match = re.fullmatch(r"\s*```(?:json)?\s*\n(.*?)\n```\s*", raw, re.S)
    try:
        return json.loads(match.group(1) if match else raw)
    except ValueError:
        return raw


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def dump(file, value):
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    if SECRET.search(text):
        raise ValueError(f"Potential credential in export: {file.name}")
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(text, encoding="utf-8")


def locate(args, scenario, build, model):
    task = {"Earnings": "earnings", "0DTE": "intraday", "Overlay": "overlay"}[scenario["task"]]
    case = CASE_IDS[scenario["id"]]
    suffix = Path(task) / model / scenario["ticker"] / case
    if build == "release":
        path = args.archive / suffix
    else:
        branch = args.gateway / model
        if task == "earnings":
            path = branch / "core" / "earnings" / model / "earnings" / scenario["ticker"] / case
        elif task == "intraday":
            path = branch / "intraday" / "intraday" / model / "intraday" / scenario["ticker"] / case
        else:
            hits = sorted(branch.glob(f"**/overlay/{scenario['ticker']}/{case}"))
            path = hits[0] if hits else None
        if path and path.exists():
            path = next(iter(sorted((p for p in path.iterdir() if p.is_dir()), reverse=True)), None)
    return path if path and path.exists() else None


def clean_order(value):
    return {key: value[key] for key in ("contract", "symbol", "side", "action", "qty", "quantity", "price", "fees", "order_type", "limit_price", "fill_ts", "trade_id", "order_id", "rationale") if key in value}


def replay(root, scenario, group, model):
    portfolios = read_lines(root, "portfolio")
    points = [{"time": row["event_ts"], "day": row["current_date"], "equity": row["portfolio"]["equity"], "cash": row["portfolio"].get("cash")}
              for row in portfolios if math.isfinite(row.get("portfolio", {}).get("equity", float("nan"))) and row["portfolio"]["equity"] > 0]
    if not points:
        return None
    points.sort(key=lambda row: row["time"])
    trades = read_lines(root, "trades")
    finished = [event for event in read_lines(root, "events") if event.get("kind") == "run.finished"]
    completion = finished[-1].get("payload", {}) if finished else {}
    trades_by_step = {row["step_id"]: row for row in trades}
    fills = [{**clean_order(fill), "day": row["current_date"], "time": fill.get("fill_ts") or row["event_ts"]} for row in trades for fill in row.get("fills", [])]
    steps = defaultdict(list)
    for file in sorted((root / "llm_calls").glob("*.json")):
        call = json.loads(file.read_text())
        if call.get("simulation_time") and call.get("user_prompt"):
            steps[call["step_id"]].append(call)
    decisions = []
    for step, calls in sorted(steps.items()):
        first = calls[0]
        parsed = parse(first.get("response", ""))
        plan = parsed if isinstance(parsed, dict) else {}
        prediction = plan.get("prediction") or {}
        orders = trades_by_step.get(step, {})
        decisions.append({
            "seq": len(decisions), "step": step, "day": first["trading_day"], "time": first["simulation_time"],
            "intent": prediction.get("direction") or plan.get("intent"), "confidence": prediction.get("confidence", plan.get("confidence")),
            "reasoning": prediction.get("thesis") or plan.get("reasoning") or "",
            "targets": plan.get("target_instruments") or [],
            "orders": [clean_order(item) for item in orders.get("intents", [])],
            "checks": [{key: item[key] for key in ("action", "reason", "adjusted_qty") if key in item} for item in orders.get("risk_decisions", [])],
            "calls": [{"ordinal": i + 1, "raw": call.get("response"), "prompt_sha256": digest(call.get("system_prompt", "") + call["user_prompt"])} for i, call in enumerate(calls)],
        })
    day_map = {point["day"]: point for point in points}
    baseline = points[0]
    previous = peak = baseline["equity"]
    daily = []
    for day, point in sorted(day_map.items()):
        peak = max(peak, point["equity"])
        daily.append({"day": day, "equity": point["equity"], "pnl": point["equity"] - previous,
                      "return": point["equity"] / baseline["equity"] - 1, "drawdown": point["equity"] / peak - 1,
                      "decisions": sum(row["day"] == day for row in decisions), "fills": sum(row["day"] == day for row in fills)})
        previous = point["equity"]
    return {"version": 1, "scenario": scenario["id"], "build": group["build"], "model": model,
            "source": "archived_run_logs", "baseline": baseline, "currency": "USD", "time_zone": "America/New_York",
            "opening_prompt_matches_group": bool(steps) and digest(next(iter(steps.values()))[0].get("system_prompt", "") + next(iter(steps.values()))[0]["user_prompt"]).startswith(group.get("promptSha", "missing")),
            "completion": {"recorded_finish": bool(finished), "exit_code": completion.get("exit_code")},
            "equity": points, "daily": daily, "decisions": decisions, "fills": fills,
            "summary": {"return": points[-1]["equity"] / baseline["equity"] - 1,
                        "net_pnl": points[-1]["equity"] - baseline["equity"], "fees": sum(float(fill.get("fees") or 0) for fill in fills),
                        "max_daily_drawdown": -min(row["drawdown"] for row in daily), "fill_count": len(fills), "decision_count": len(decisions)}}


def market(args, scenario, start, end):
    intraday = scenario["task"] == "0DTE"
    endpoint = "/stock" if intraday else "/stock/daily"
    if intraday:
        start = (datetime.fromisoformat(start).replace(tzinfo=ET)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        end = (datetime.fromisoformat(end).replace(tzinfo=ET) + timedelta(days=1)).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    params = {"tickers": scenario["ticker"], "start": start, "end": end, "limit": 10000}
    with urlopen(args.hub.rstrip("/") + "/svc/upq" + endpoint + "?" + urlencode(params), timeout=60) as response:
        data = json.load(response)
    if not isinstance(data, list) or not data:
        raise ValueError("Market data unavailable; do not substitute synthetic prices")
    bars = []
    for row in data:
        if intraday:
            stamp = int(row["window_start"])
            ts = datetime.fromtimestamp(stamp / (1e9 if stamp > 10**16 else 1000), timezone.utc)
            local = ts.astimezone(ET)
            if not (570 <= local.hour * 60 + local.minute < 960):
                continue
            time = ts.isoformat()
        else:
            time = str(row["date"])[:10]
        bars.append({"time": time, **{key: row.get(key, 0) for key in ("open", "high", "low", "close", "volume")}})
    return {"source": "qfinzero.upq", "resolution": "1m" if intraday else "1d", "ticker": scenario["ticker"], "time_zone": "America/New_York", "bars": sorted(bars, key=lambda row: row["time"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ("archive", "gateway", "scenarios", "out"):
        parser.add_argument("--" + option, required=True, type=Path)
    parser.add_argument("--hub", default="http://127.0.0.1:19777")
    args = parser.parse_args()
    manifest = []
    for entry in json.loads((args.scenarios / "index.json").read_text()):
        scenario = json.loads((args.scenarios / (entry["id"] + ".json")).read_text())
        dates = []
        for group in scenario["groups"]:
            for answer in group["answers"]:
                root = locate(args, scenario, group["build"], answer["model"])
                data = replay(root, scenario, group, answer["model"]) if root else None
                if data is None:
                    raise ValueError(f"Missing recorded replay: {entry['id']} {group['build']} {answer['model']}")
                target = Path(entry["id"]) / group["build"] / (answer["model"] + ".json")
                dump(args.out / "replays" / target, data)
                dates += [data["daily"][0]["day"], data["daily"][-1]["day"]]
                manifest.append({"scenario": entry["id"], "build": group["build"], "model": answer["model"], "path": target.as_posix(), "decisions": len(data["decisions"]), "days": len(data["daily"]), "fills": len(data["fills"])})
        dump(args.out / "market" / (entry["id"] + ".json"), market(args, scenario, min(dates), max(dates)))
    dump(args.out / "replays" / "index.json", manifest)
    print(json.dumps({"runs": len(manifest), "decisions": sum(item["decisions"] for item in manifest), "daily_snapshots": sum(item["days"] for item in manifest)}))


if __name__ == "__main__":
    main()
