from datetime import date
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from analytics import analyse
from data import load

app = FastAPI(title="Wind forecast analysis")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])
_cache = {}


def _data():
    if "d" not in _cache:
        _cache["d"] = load()
    return _cache["d"]


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/analysis")
def analysis(start: date = date(2026, 1, 1), end: date = date(2026, 1, 31),
             cutoff_hour: float = Query(9.0, ge=0, le=23.99)):
    act, fc = _data()
    return analyse(act, fc, str(start), str(end), cutoff_hour)
