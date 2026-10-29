"""Elexon ingestion with CSV cache. WIND actuals (FUELHH) and WINDFOR forecasts."""
import os
from datetime import datetime, timedelta, timezone
import pandas as pd
import requests

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CACHE = os.environ.get("CACHE_DIR", "cache")
UTC = timezone.utc


def _stream(dataset, params, start, end, kfrom, kto, fmt, step=6):
    rows, s = [], start
    while s < end:
        e = min(s + timedelta(days=step), end)
        q = {**params, kfrom: s.strftime(fmt), kto: e.strftime(fmt), "format": "json"}
        r = requests.get(f"{BASE}/{dataset}/stream", params=q, timeout=60)
        r.raise_for_status()
        rows += r.json()
        s = e + timedelta(days=1) if fmt == "%Y-%m-%d" else e
    return pd.DataFrame(rows)


def load(year=2026, month=1):
    os.makedirs(CACHE, exist_ok=True)
    fa, ff = f"{CACHE}/actuals.csv", f"{CACHE}/forecasts.csv"
    if not (os.path.exists(fa) and os.path.exists(ff)):
        first = datetime(year, month, 1, tzinfo=UTC)
        last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        a = _stream("FUELHH", {"fuelType": "WIND"}, first, last,
                    "settlementDateFrom", "settlementDateTo", "%Y-%m-%d")
        # forecasts for January targets are published from D-1 (or earlier)
        f = _stream("WINDFOR", {}, first - timedelta(days=3), last + timedelta(days=1),
                    "publishDateTimeFrom", "publishDateTimeTo", "%Y-%m-%dT%H:%MZ")
        a[["startTime", "generation"]].to_csv(fa, index=False)
        f[["startTime", "publishTime", "generation"]].to_csv(ff, index=False)
    act = pd.read_csv(fa)
    fc = pd.read_csv(ff)
    for d, cols in ((act, ["startTime"]), (fc, ["startTime", "publishTime"])):
        for c in cols:
            d[c] = pd.to_datetime(d[c], utc=True)
    return act.drop_duplicates("startTime"), fc
