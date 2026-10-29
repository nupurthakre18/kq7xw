"""Pure functions: decision-time forecast selection and error metrics."""
import numpy as np
import pandas as pd

TZ = "Europe/London"


def decision_forecasts(fc: pd.DataFrame, cutoff_hour: float = 9.0) -> pd.DataFrame:
    """For each target startTime on day D, keep the latest forecast with
    publishTime <= (D-1 at cutoff_hour, UK local time)."""
    fc = fc.copy()
    day = fc["startTime"].dt.tz_convert(TZ).dt.tz_localize(None).dt.normalize()
    cut = (day - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff_hour)).dt.tz_localize(
        TZ, ambiguous=True, nonexistent="shift_forward").dt.tz_convert("UTC")
    fc = fc[fc["publishTime"] <= cut]
    return (fc.sort_values("publishTime").groupby("startTime", as_index=False).last()
            .rename(columns={"generation": "forecast"}))


def metrics(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"n": 0}
    e = df["forecast"] - df["actual"]
    ae = e.abs()
    nz = df["actual"] > 100  # avoid MAPE blow-up near zero output
    return {
        "n": int(len(df)),
        "mae": float(ae.mean()), "rmse": float(np.sqrt((e ** 2).mean())),
        "bias": float(e.mean()),
        "mape": float((ae[nz] / df.loc[nz, "actual"]).mean() * 100) if nz.any() else None,
        "p50_abs": float(ae.quantile(.5)), "p90_abs": float(ae.quantile(.9)),
        "p95_abs": float(ae.quantile(.95)),
        "err_p10": float(e.quantile(.1)), "err_p90": float(e.quantile(.9)),
        "mean_actual": float(df["actual"].mean()),
    }


def _group(df, key, name):
    g = df.assign(err=df["forecast"] - df["actual"]).groupby(key)["err"]
    out = pd.DataFrame({"mae": g.apply(lambda x: x.abs().mean()),
                        "bias": g.mean(), "n": g.size()}).reset_index()
    return out.rename(columns={key: name}).to_dict("records")


def analyse(act, fc, start, end, cutoff_hour=9.0) -> dict:
    """start/end: inclusive UK delivery dates (YYYY-MM-DD)."""
    a = act.rename(columns={"generation": "actual"})
    local = lambda d: d["startTime"].dt.tz_convert(TZ).dt.strftime("%Y-%m-%d")
    dec = decision_forecasts(fc, cutoff_hour).merge(a, on="startTime")
    dec = dec[(local(dec) >= start) & (local(dec) <= end)].sort_values("startTime")
    m = metrics(dec)
    lo, hi = m.get("err_p10", 0), m.get("err_p90", 0)
    dec["hour"] = dec["startTime"].dt.tz_convert(TZ).dt.hour
    series = [{"t": r.startTime.isoformat(), "forecast": r.forecast, "actual": r.actual,
               "published": r.publishTime.isoformat(),
               "band": [r.forecast - hi, r.forecast - lo]} for r in dec.itertuples()]
    allf = fc.merge(a, on="startTime").rename(columns={"generation": "forecast"})
    allf = allf[(local(allf) >= start) & (local(allf) <= end)].copy()
    allf["lead_bucket"] = (((allf["startTime"] - allf["publishTime"])
                            .dt.total_seconds() / 3600) // 6 * 6).astype(int)
    return {"cutoff_hour": cutoff_hour, "metrics": m, "series": series,
            "by_hour": _group(dec, "hour", "hour"),
            "by_horizon": _group(allf, "lead_bucket", "lead_h"),
            "latest_forecast_publish": None if fc.empty else fc["publishTime"].max().isoformat()}
