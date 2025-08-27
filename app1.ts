import React, { useEffect, useMemo, useRef, useState } from "react";
// FAANG Pipeline Simulator - Single-file React component
// - TailwindCSS for styling (no import needed in the file)
// - Uses recharts for charts and lucide-react for icons (assume available)
// - Default export a React component that you can drop into a CRA/Next/Turbo app

import { Play, Pause, Trash, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

// Utility helpers
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// Simulation domain models (in-memory)
const defaultServices = [
  { id: "payments", name: "Payments", complexity: 4 },
  { id: "auth", name: "Auth", complexity: 3 },
  { id: "notify", name: "Notifications", complexity: 2 },
];

// Initial config
const initialConfig = {
  teamSize: 8,
  sprintDays: 10,
  ticketsPerService: 6,
  aiLevel: "med", // low/med/high
  strictDesign: true,
  canary: true,
  autoRollback: true,
  multiService: true,
};

// Map ai level to numeric
const aiLevelValue = (lvl) => ({ low: 0.35, med: 0.65, high: 0.92 })[lvl] || 0.65;

// Simulation logic in-browser — orchestrated by the component
export default function FaangPipelineSimulator() {
  const [config, setConfig] = useState(initialConfig);
  const [services, setServices] = useState(defaultServices);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [metrics, setMetrics] = useState({ deployments: 0, failures: 0, leadTimes: [], mttrs: [] });
  const [progress, setProgress] = useState(0);
  const [seed] = useState(() => Math.floor(Math.random()*1e6));
  const runRef = useRef(null);

  useEffect(() => {
    // reset when config changes
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.multiService]);

  function pushLog(text) {
    setLogs((s) => [{ ts: new Date().toLocaleTimeString(), text }, ...s].slice(0, 300));
  }

  function addTimeline(event) {
    setTimeline((t) => [...t, { ts: new Date().toISOString(), label: event }]);
  }

  function resetAll() {
    setLogs([]);
    setTimeline([]);
    setMetrics({ deployments: 0, failures: 0, leadTimes: [], mttrs: [] });
    setProgress(0);
    setRunning(false);
    if (runRef.current) { clearInterval(runRef.current); runRef.current = null; }
  }

  // Build a complex pipeline simulation as async generator-like sequence
  async function startSimulation() {
    setRunning(true);
    pushLog(`Simulation started (seed=${seed})`);
    addTimeline("Simulation started");

    // Build per-service backlog and design doc phase
    const ai = aiLevelValue(config.aiLevel);
    const servicesToSim = config.multiService ? services : [services[0]];

    // Design docs (parallelizable but with review times)
    for (const s of servicesToSim) {
      pushLog(`Drafting design doc for ${s.name}`);
      addTimeline(`Design drafted: ${s.name}`);
      await sleep(600);
      // review
      const strictness = config.strictDesign ? 0.85 : 0.45;
      pushLog(`Design review for ${s.name} by seniors (strictness=${strictness})`);
      await sleep(700 + Math.floor(800 * (1 - strictness)));
      // possible revision
      if (Math.random() > strictness) {
        pushLog(`Seniors requested revisions for ${s.name}. Iterating.`);
        await sleep(800);
        addTimeline(`Design revised: ${s.name}`);
      }
      pushLog(`Design approved: ${s.name}`);
      addTimeline(`Design approved: ${s.name}`);
    }

    // Sprint planning across services
    pushLog(`Sprint planning: ${servicesToSim.length} services, ${config.ticketsPerService} tickets/service`);
    addTimeline('Sprint planned');
    await sleep(700);

    // Create tickets per service and simulate development
    const allPRs = [];
    let prCounter = 0;
    for (const s of servicesToSim) {
      pushLog(`Starting dev for service ${s.name}`);
      addTimeline(`Dev start: ${s.name}`);
      for (let i = 0; i < config.ticketsPerService; i++) {
        const ticketId = `${s.id.toUpperCase()}-ST-${i+1}`;
        const complexity = s.complexity + rand(0, 2);
        pushLog(`Ticket ${ticketId}: complexity ${complexity}`);
        await sleep(200 + complexity * 80);

        // AI writes tests first (TDD)
        const testCov = Math.min(0.98, 0.45 + 0.07*complexity + 0.25*ai + (Math.random()*0.06-0.03));
        pushLog(`AI generated tests for ${ticketId} (coverage=${(testCov*100).toFixed(1)}%)`);
        await sleep(150);

        // Implement feature (AI accelerates)
        const baseDev = complexity * (config.teamSize/6) * 60; // minutes
        const aiBoost = (1 - ai) * 0.6; // lower ai -> slower
        await sleep(200 + Math.floor(200 * aiBoost));
        pushLog(`Dev completed ${ticketId}; opening PR`);

        // Create PR
        const pr = {
          id: uid('pr'), service: s.name, ticket: ticketId, coverage: testCov, lintOk: null, sastOk: null, unitOk: null, integOk: null, merged: false, commitTs: Date.now(), reviewComments: 0,
        };
        prCounter++;
        allPRs.push(pr);
        addTimeline(`PR opened: ${pr.id}`);

        // CI pipeline simulation
        await runCIPipeline(pr, ai);
        setProgress(((prCounter) / (servicesToSim.length * config.ticketsPerService)) * 40);

        // Code review and approvals
        await simulateCodeReview(pr, strictness, ai);
        setProgress(40 + ((prCounter) / (servicesToSim.length * config.ticketsPerService)) * 30);

        // If merged, mark for release
        if (pr.merged) {
          pushLog(`PR ${pr.id} merged for ${pr.ticket}`);
        } else {
          pushLog(`PR ${pr.id} blocked; AI auto-fix attempt`);
          // AI auto-fix attempt
          const autoFix = Math.random() < ai * 0.75;
          if (autoFix) {
            pushLog(`AI auto-fix succeeded for ${pr.id}; rerunning CI`);
            await sleep(300);
            await runCIPipeline(pr, ai);
            await simulateCodeReview(pr, strictness, ai);
            if (pr.merged) pushLog(`PR ${pr.id} merged after AI fix`);
            setProgress(60 + ((prCounter) / (servicesToSim.length * config.ticketsPerService)) * 20);
          } else {
            pushLog(`Manual intervention required for ${pr.id}`);
          }
        }
      }
    }

    // Batch to staging
    const mergedPRs = allPRs.filter((p) => p.merged);
    pushLog(`Preparing staging batch (${mergedPRs.length} PRs)`);
    addTimeline('Staging batching');
    await sleep(600);

    setMetrics((m) => ({ ...m, deployments: m.deployments + 1 }));
    const stagingResult = simulateRuntime(mergedPRs, ai, /*environment*/ 'staging');
    pushLog(`Staging results: p95=${stagingResult.p95}ms err=${(stagingResult.err*100).toFixed(2)}%`);
    addTimeline('Staging result');

    // Canary + rollout
    if (config.canary) {
      pushLog('Starting canary deployment');
      addTimeline('Canary start');
      await sleep(400);
      const canary = simulateRuntime(mergedPRs, ai, 'prod-canary');
      pushLog(`Canary: p95=${canary.p95}ms err=${(canary.err*100).toFixed(2)}%`);

      if (canary.p95 > 300 || canary.err > 0.03) {
        pushLog('Canary SLO breach detected');
        addTimeline('Canary failed');
        if (config.autoRollback) {
          pushLog('Auto-rollback triggered');
          setMetrics((m) => ({ ...m, failures: m.failures + 1, mttrs: [...m.mttrs, config.fastOncall ? 15 : 120] }));
          addTimeline('Rollback');
          setRunning(false);
          return finishSimulation();
        } else {
          pushLog('Manual rollback required (auto-rollback disabled)');
          setMetrics((m) => ({ ...m, failures: m.failures + 1 }));
        }
      } else {
        pushLog('Canary healthy — proceeding to gradual rollout');
        addTimeline('Canary pass');
        // progressive rollout
        for (const pct of [25, 50, 100]) {
          pushLog(`Rolling out to ${pct}%`);
          await sleep(200);
          const r = simulateRuntime(mergedPRs, ai, `prod-${pct}`);
          pushLog(`Rollout ${pct}%: p95=${r.p95}ms err=${(r.err*100).toFixed(2)}%`);
        }
        setMetrics((m) => ({ ...m, deployments: m.deployments + 1 }));
        addTimeline('Prod rollout complete');
      }
    } else {
      pushLog('Skipping canary per config — performing full prod rollout');
      const full = simulateRuntime(mergedPRs, ai, 'prod');
      pushLog(`Prod: p95=${full.p95}ms err=${(full.err*100).toFixed(2)}%`);
      setMetrics((m) => ({ ...m, deployments: m.deployments + 1 }));
    }

    finishSimulation();
  }

  function finishSimulation() {
    pushLog('Simulation finished');
    addTimeline('Simulation finished');
    setRunning(false);
    setProgress(100);
  }

  // CI pipeline: lint -> SAST -> unit -> integration -> coverage
  async function runCIPipeline(pr, ai) {
    pushLog(`CI: linting ${pr.id}`);
    await sleep(200);
    pr.lintOk = Math.random() > (0.12 * (1 - ai*0.9));
    pushLog(`Lint ${pr.id}: ${pr.lintOk ? 'OK' : 'FAIL'}`);

    pushLog(`CI: SAST ${pr.id}`);
    await sleep(300);
    pr.sastOk = Math.random() > (0.08 * (1 - ai*0.8));
    pushLog(`SAST ${pr.id}: ${pr.sastOk ? 'OK' : 'VULN'}`);

    pushLog(`CI: unit tests ${pr.id}`);
    await sleep(300);
    pr.unitOk = Math.random() > (0.18 * (1 - pr.coverage));
    pushLog(`Unit ${pr.id}: ${pr.unitOk ? 'PASS' : 'FAIL'}`);

    pushLog(`CI: integration ${pr.id}`);
    await sleep(400);
    pr.integOk = Math.random() > (0.12 * (1 - pr.coverage));
    pushLog(`Integration ${pr.id}: ${pr.integOk ? 'PASS' : 'FAIL'}`);

    // coverage gate
    pushLog(`Coverage ${pr.id}: ${(pr.coverage*100).toFixed(1)}%`);
    return pr;
  }

  async function simulateCodeReview(pr, strictness, ai) {
    pushLog(`Code review for ${pr.id} (strictness=${strictness})`);
    await sleep(300);
    // reviewers may request changes
    const reviewFinds = Math.random() < (0.18 * (1 - strictness));
    if (reviewFinds) {
      pr.reviewComments = rand(1, 4);
      pushLog(`Reviewer requested ${pr.reviewComments} changes for ${pr.id}`);
      await sleep(200 * pr.reviewComments);
      // some chance PR unblocks after changes
      const postFix = Math.random() < (0.6 * ai);
      if (postFix) {
        pr.merged = true;
      } else {
        pr.merged = false;
      }
    } else {
      // approvals
      pr.merged = pr.lintOk && pr.sastOk && pr.unitOk && pr.integOk && pr.coverage >= 0.75;
    }
    return pr;
  }

  // simulate runtime characteristics for a batch of PRs
  function simulateRuntime(prs, ai, env) {
    // larger deployments/higher complexity -> more variance
    const baseLatency = 160 + prs.length * 2;
    const p95 = Math.round(Math.max(80, baseLatency + (Math.random() * 180 - 40) * (1 - ai)));
    const err = Math.min(0.2, 0.005 + prs.length * 0.002 + (Math.random() * 0.03) * (1 - ai));
    return { p95, err };
  }

  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  // UI controls
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">FAANG Pipeline Simulator — Webapp</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => { resetAll(); }}>{/* tailwind btn assumed */}<RefreshCw size={16}/> Reset</button>
          <button className={`btn ${running ? 'btn-warning' : 'btn-primary'}`} onClick={() => { if (!running) startSimulation(); else { setRunning(false); pushLog('Simulation paused by user'); } }}>{running ? <Pause size={16}/> : <Play size={16}/>} {running ? 'Pause' : 'Start'}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-white shadow rounded p-4">
          <h3 className="font-semibold mb-2">Configuration</h3>
          <div className="space-y-2 text-sm">
            <label>Team size
              <input type="number" className="w-full mt-1 input" value={config.teamSize} onChange={(e)=>setConfig({...config, teamSize: Number(e.target.value)})} />
            </label>
            <label>Sprint days
              <input type="number" className="w-full mt-1 input" value={config.sprintDays} onChange={(e)=>setConfig({...config, sprintDays: Number(e.target.value)})} />
            </label>
            <label>Tickets per service
              <input type="number" className="w-full mt-1 input" value={config.ticketsPerService} onChange={(e)=>setConfig({...config, ticketsPerService: Number(e.target.value)})} />
            </label>
            <label>AI level
              <select className="w-full mt-1 input" value={config.aiLevel} onChange={(e)=>setConfig({...config, aiLevel: e.target.value})}>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.strictDesign} onChange={(e)=>setConfig({...config, strictDesign: e.target.checked})} /> Strict design review</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.canary} onChange={(e)=>setConfig({...config, canary: e.target.checked})} /> Canary deploy</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.autoRollback} onChange={(e)=>setConfig({...config, autoRollback: e.target.checked})} /> Auto-rollback</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={config.multiService} onChange={(e)=>setConfig({...config, multiService: e.target.checked})} /> Multi-service mode</label>
          </div>
        </div>

        <div className="col-span-2 bg-white shadow rounded p-4">
          <h3 className="font-semibold mb-2">Live Logs & Timeline</h3>
          <div className="flex gap-4">
            <div className="flex-1 h-64 overflow-auto border p-2">
              {logs.map((l, idx) => (
                <div key={idx} className="text-xs py-1 border-b last:border-b-0">
                  <span className="text-gray-400">[{l.ts}]</span> <span>{l.text}</span>
                </div>
              ))}
            </div>
            <div className="w-96 h-64 border p-2 overflow-auto">
              <div className="text-xs font-medium mb-2">Timeline</div>
              {timeline.slice().reverse().map((t,i)=> (
                <div key={i} className="text-xs py-1">• {new Date(t.ts).toLocaleTimeString()} — {t.label}</div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="col-span-1 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Deployments</div>
              <div className="text-2xl font-bold">{metrics.deployments}</div>
            </div>
            <div className="col-span-1 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Failures</div>
              <div className="text-2xl font-bold">{metrics.failures}</div>
            </div>
            <div className="col-span-1 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-500">Progress</div>
              <div className="text-2xl font-bold">{Math.round(progress)}%</div>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded p-4">
        <h3 className="font-semibold mb-2">Charts</h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={computeChartData(timeline)}>
              <XAxis dataKey="label" hide/>
              <YAxis />
              <Tooltip/>
              <Line type="monotone" dataKey="events" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 text-right text-sm text-gray-500">Seed: {seed} — Sim runs in-browser; no network access.</div>
    </div>
  );
}

// Small helper to compute fake chart data from timeline
function computeChartData(timeline) {
  if (!timeline || timeline.length === 0) return [{ label: 'start', events: 0 }];
  const data = timeline.map((t, idx) => ({ label: new Date(t.ts).toLocaleTimeString(), events: (idx % 5) + 1 }));
  return data.slice(-40);
}
