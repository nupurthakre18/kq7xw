import React, { useEffect, useState } from "react";
import { ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const f0 = (v) => (v == null ? "–" : Math.round(v).toLocaleString());

export default function App() {
  const [q, setQ] = useState({ start: "2026-01-01", end: "2026-01-07", cutoff_hour: 9 });
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setErr(null);
    fetch(`${API}/api/analysis?` + new URLSearchParams(q))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setD).catch((e) => setErr(String(e)));
  }, [q]);

  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const m = d?.metrics;
  const series = d?.series.map((s) => ({ ...s, t: s.t.slice(5, 16).replace("T", " ") }));

  return (
    <main>
      <h1>Day-ahead wind planner</h1>
      <p className="sub">What the wind forecast said when you had to buy, and how far off it has been.
        Forecasts shown are the latest published before the cutoff on the day before delivery.</p>
      <div className="controls">
        <label>From<input type="date" value={q.start} min="2026-01-01" max="2026-01-31" onChange={set("start")} /></label>
        <label>To<input type="date" value={q.end} min="2026-01-01" max="2026-01-31" onChange={set("end")} /></label>
        <label>Decision cutoff (UK hour, day before)
          <input type="number" min="0" max="23" step="0.5" value={q.cutoff_hour} onChange={set("cutoff_hour")} /></label>
      </div>
      {err && <p className="err">Could not load data: {err}. Check the backend is running.</p>}
      {!d && !err && <p>Loading…</p>}
      {m && m.n > 0 && (<>
        <div className="cards">
          {[["MAE (MW)", m.mae], ["RMSE (MW)", m.rmse], ["Bias (MW)", m.bias],
            ["MAPE (%)", m.mape], ["P90 abs error (MW)", m.p90_abs], ["P95 abs error (MW)", m.p95_abs]]
            .map(([l, v]) => <div className="card" key={l}><b>{f0(v)}</b><span>{l}</span></div>)}
        </div>
        <section>
          <h2>Forecast at decision time vs actual</h2>
          <p className="note">Shaded band: P10–P90 of historical error applied to the forecast. Positive bias means the forecast over-predicts wind, so thermal need is under-stated.</p>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={series}>
              <CartesianGrid strokeOpacity={0.2} /><XAxis dataKey="t" minTickGap={60} fontSize={11} />
              <YAxis fontSize={11} unit=" MW" width={70} /><Tooltip /><Legend />
              <Area dataKey="band" name="P10–P90 band" stroke="none" fill="var(--band)" />
              <Line dataKey="forecast" name="Forecast" stroke="var(--fc)" dot={false} strokeWidth={2} />
              <Line dataKey="actual" name="Actual" stroke="var(--ac)" dot={false} strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
        <section>
          <h2>Error by hour of day</h2><p className="note">Mean absolute error of the decision-time forecast.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.by_hour}><XAxis dataKey="hour" fontSize={11} /><YAxis fontSize={11} width={60} />
              <Tooltip /><Bar dataKey="mae" name="MAE (MW)" fill="var(--fc)" /></BarChart>
          </ResponsiveContainer>
        </section>
        <section>
          <h2>Error by forecast lead time</h2><p className="note">All published forecasts, bucketed by hours between publication and target time.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.by_horizon}><XAxis dataKey="lead_h" unit="h" fontSize={11} /><YAxis fontSize={11} width={60} />
              <Tooltip /><Bar dataKey="mae" name="MAE (MW)" fill="var(--fc)" /></BarChart>
          </ResponsiveContainer>
        </section>
      </>)}
      {m && m.n === 0 && <p>No data for this range.</p>}
    </main>
  );
}
