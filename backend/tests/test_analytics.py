import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))
import pandas as pd
from analytics import decision_forecasts, metrics

def ts(s): return pd.Timestamp(s, tz="UTC")

def test_latest_before_cutoff_only():
    fc = pd.DataFrame({"startTime": [ts("2026-01-10 12:00")] * 3,
        "publishTime": [ts("2026-01-08 20:00"), ts("2026-01-09 08:00"), ts("2026-01-09 15:00")],
        "generation": [1, 2, 3]})
    out = decision_forecasts(fc, 9)   # cutoff 2026-01-09 09:00 UK (= UTC in Jan)
    assert out["forecast"].iloc[0] == 2  # 15:00 forecast must not leak

def test_metrics():
    m = metrics(pd.DataFrame({"forecast": [110., 90.], "actual": [100., 100.]}))
    assert m["mae"] == 10 and m["bias"] == 0
