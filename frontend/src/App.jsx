import React, { useEffect, useState } from "react";
import { ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const n0 = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-GB"));
const gw = (v) => (Math.abs(v) / 1000).toFixed(1);
const COL = { fc: "#d9480f", ac: "#1b2733", rule: "#c5ced6", mute: "#5a6975" };
const tip = { contentStyle: { background: "#f7f8f9", border: "1px solid #c5ced6", borderRadius: 2, fontSize: 12 } };

export default function App() {
  const [q, setQ] = useState({ start: "2026-01-01", end: "2026-01-31", cutoff_hour: 9 });
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
  const ok = m && m.n > 0;

  // only forecasts published before the target time could ever have been used
  const horizon = ok ? d.by_horizon.filter((h) => h.lead_h >= 0)
    .map((h) => ({ ...h, label: `${h.lead_h}–${h.lead_h + 6}h` })) : [];
  const series = ok ? d.series.map((s) => ({ ...s, t: s.t.slice(5, 16).replace("T", " ") })) : [];
  const worst = ok && d.by_hour.length ? d.by_hour.reduce((a, b) => (b.mae > a.mae ? b : a)) : null;
  const best = ok && d.by_hour.length ? d.by_hour.reduce((a, b) => (b.mae < a.mae ? b : a)) : null;
  const near = horizon[0], far = horizon[horizon.length - 1];
  const hh = (h) => String(h).padStart(2, "0") + ":00";

  const rows = ok && [
    ["Average over-forecast", "Mean of forecast minus actual", `${m.bias > 0 ? "+" : ""}${n0(m.bias)} MW`],
    ["Typical miss", "Average size of the error", `${n0(m.mae)} MW`],
    ["Miss in 1 half-hour of 10", "Errors bigger than this are the worst 10%", `${n0(m.p90_abs)} MW`],
    ["Miss in 1 half-hour of 20", "Worst 5%", `${n0(m.p95_abs)} MW`],
    ["Big-miss weighted error", "RMSE: punishes large misses harder", `${n0(m.rmse)} MW`],
    ["Miss as share of output", "MAPE, half-hours above 100 MW", `${n0(m.mape)}%`],
  ];

  return (
    <main>
      <div className="top">
        <h1>Day-ahead wind forecast review · GB, January 2026 deliveries</h1>
        <div className="controls">
          <label>Delivery from<input type="date" value={q.start} min="2026-01-01" max="2026-01-31" onChange={set("start")} /></label>
          <label>Delivery to<input type="date" value={q.end} min="2026-01-01" max="2026-01-31" onChange={set("end")} /></label>
          <label>Decision made at (UK hour, day before)
            <input type="number" min="0" max="23" step="0.5" value={q.cutoff_hour} onChange={set("cutoff_hour")} /></label>
        </div>
      </div>

      {err && <p className="err">Could not load data ({err}). Is the backend running?</p>}
      {!d && !err && <p>Loading Elexon data. The first load can take a minute.</p>}
      {m && m.n === 0 && <p>No data for this range.</p>}

      {ok && (<>
        <p className="headline">
          {m.bias > 0
            ? <>At the decision cutoff, the forecast ran <em>{gw(m.bias)} GW above</em> what the wind delivered.</>
            : <>At the decision cutoff, the forecast ran <em>{gw(m.bias)} GW below</em> what the wind delivered.</>}
        </p>
        <p className="lede">
          {m.bias > 0 ? "Wind was over-estimated, so the thermal and market volume you needed was under-estimated. " : "Wind was under-estimated, so you may have bought more than you needed. "}
          Each half-hour uses the last forecast published before {hh(Math.floor(q.cutoff_hour))} the day before delivery, the only one a buyer could have seen.
          Typical miss: {n0(m.mae)} MW. Over {n0(m.n)} half-hours.
        </p>

        <div className="grid">
          <section className="panel">
            <h2>What you saw at decision time vs what happened</h2>
            <p className="take">The shaded band is the middle 80% of past errors laid around the forecast. Plan a buffer of about its width.</p>
            <div className="key">
              <span><i style={{ background: COL.fc }} />Forecast</span>
              <span><i style={{ background: COL.ac }} />Actual wind</span>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={series}>
                <CartesianGrid stroke={COL.rule} strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey="t" minTickGap={70} fontSize={11} stroke={COL.mute} />
                <YAxis fontSize={11} stroke={COL.mute} width={52} domain={[0, "auto"]}
                  tickFormatter={(v) => `${v / 1000} GW`} />
                <Tooltip {...tip}
                  formatter={(v, name) => name === "Likely range"
                    ? [`${n0(v[0])} to ${n0(v[1])} MW`, name] : [`${n0(v)} MW`, name]} />
                <Area dataKey="band" name="Likely range" stroke="none" fill="rgba(217,72,15,.16)" isAnimationActive={false} />
                <Line dataKey="forecast" name="Forecast" stroke={COL.fc} dot={false} strokeWidth={2} isAnimationActive={false} />
                <Line dataKey="actual" name="Actual" stroke={COL.ac} dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <h2>How far off</h2>
            <p className="take">Forecast minus actual, in megawatts.</p>
            <table><tbody>
              {rows.map(([a, b, c]) => (
                <tr key={a}><td>{a}<small>{b}</small></td><td>{c}</td></tr>))}
            </tbody></table>
          </section>
        </div>

        <div className="pair">
          <section className="panel">
            <h2>Which hours to distrust</h2>
            <p className="take">
              {worst && `Errors peak around ${hh(worst.hour)} (${n0(worst.mae)} MW) and are smallest around ${hh(best.hour)} (${n0(best.mae)} MW).`}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.by_hour}>
                <CartesianGrid stroke={COL.rule} vertical={false} />
                <XAxis dataKey="hour" fontSize={11} stroke={COL.mute} interval={2} />
                <YAxis fontSize={11} stroke={COL.mute} width={52} tickFormatter={(v) => `${v / 1000} GW`} />
                <Tooltip {...tip} labelFormatter={hh} formatter={(v) => [`${n0(v)} MW`, "Average miss"]} cursor={{ fill: "rgba(27,39,51,.06)" }} />
                <Bar dataKey="mae" fill={COL.fc} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="panel">
            <h2>Newer forecasts are better</h2>
            <p className="take">
              {near && far && `Forecasts published ${near.label} before the target miss by ${n0(near.mae)} MW; those published ${far.label} ahead miss by ${n0(far.mae)} MW.`}
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={horizon}>
                <CartesianGrid stroke={COL.rule} vertical={false} />
                <XAxis dataKey="label" fontSize={11} stroke={COL.mute} interval={1} />
                <YAxis fontSize={11} stroke={COL.mute} width={52} tickFormatter={(v) => `${v / 1000} GW`} />
                <Tooltip {...tip} formatter={(v) => [`${n0(v)} MW`, "Average miss"]} cursor={{ fill: "rgba(27,39,51,.06)" }} />
                <Bar dataKey="mae" fill={COL.ac} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </>)}
    </main>
  );
}
