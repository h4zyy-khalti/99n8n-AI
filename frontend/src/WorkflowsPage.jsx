import { useEffect, useMemo, useRef, useState } from "react";
import SidebarLayout from "./SidebarLayout";
import { apiPath } from "./api";

// Helper to count executions per workflow
function getExecutionCounts(executions) {
  const counts = {};
  executions.forEach(ex => {
    const wfId = ex.workflowId || ex.workflow_id;
    if (!wfId) return;
    counts[wfId] = (counts[wfId] || 0) + 1;
  });
  return counts;
}


export default function WorkflowsPage() {

  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState("all");
  const instanceMap = useMemo(() => {
    const map = {};
    instances.forEach(i => { map[i.prefix] = i.name || i.prefix; });
    return map;
  }, [instances]);
  const availableInstanceOptions = useMemo(() => {
    const prefixes = new Set();
    workflows.forEach(w => {
      const wfId = String(w.id || w.workflowId || "");
      const pfx = wfId.includes(":") ? wfId.split(":")[0] : "env";
      if (pfx) prefixes.add(pfx);
    });
    return Array.from(prefixes).map(pfx => ({ prefix: pfx, name: instanceMap[pfx] || pfx }));
  }, [workflows, instanceMap]);


  useEffect(() => {
    async function fetchData() {
      try {
        const wfParams = new URLSearchParams();
        wfParams.set("q", query);
        wfParams.set("page", String(page));
        wfParams.set("page_size", String(pageSize));
        const wfRes = await fetch(apiPath(`/workflows?${wfParams.toString()}`), { credentials: "include" });
        const wfData = await wfRes.json();
        const wfItems = Array.isArray(wfData) ? wfData : (wfData.items || wfData.data || []);
        setWorkflows(wfItems);

        const exParams = new URLSearchParams();
        exParams.set("q", "");
        exParams.set("page", "1");
        exParams.set("page_size", "1");
        const exRes = await fetch(apiPath(`/executions?${exParams.toString()}`), { credentials: "include" });
        const exData = await exRes.json();
        setExecutions(Array.isArray(exData) ? exData : (exData.items || exData.data || []));
      } catch (err) {
        setWorkflows([]);
        setExecutions([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // load instances for instance-name mapping
    fetch(apiPath("/instances"), { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setInstances(d); })
      .catch(() => {});

    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProto}://${window.location.hostname}:4000/ws/n8n`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "n8n_sync") {
          // Refresh lists upon sync notification
          fetchData();
        }
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {};
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [query, page, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = selectedInstance === "all" ? workflows : workflows.filter(w => {
      const wfId = String(w.id || w.workflowId || "");
      const pfx = wfId.includes(":") ? wfId.split(":")[0] : "env";
      return pfx === selectedInstance;
    });
    if (!q) return base;
    return base.filter(w => {
      const name = String(w.name || "").toLowerCase();
      const id = String(w.id || w.workflowId || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [workflows, query, selectedInstance]);

  // When using server pagination, we use local filtered to support client-side quick search as a fallback
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleLogout = async () => {
    await fetch(apiPath("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  const executionCounts = getExecutionCounts(executions);

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #eaeaea", padding: 12, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <h2 style={{ margin: 0 }}>Workflows</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ color: "#666" }}>Instance:</label>
          <select value={selectedInstance} onChange={(e) => { setPage(1); setSelectedInstance(e.target.value); }}>
            <option value="all">All</option>
            {availableInstanceOptions.map(i => (
              <option key={i.prefix} value={i.prefix}>{i.name}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => { setPage(1); setQuery(e.target.value); }}
            placeholder="Search workflows..."
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4, width: 260 }}
          />
          <span style={{ color: "#666" }}>Total: {total}</span>
        </div>
      </div>
      <div style={{ height: 12 }} />
      {loading ? <p>Loading...</p> : (
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", border: "1px solid #eaeaea", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f7f7f7" }}>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>S.No</th>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>Workflow Name</th>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>Workflow ID</th>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>Instance</th>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>Active</th>
              <th style={{ borderBottom: "1px solid #eaeaea", padding: 10, textAlign: "left" }}>Execution Count</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((wf, idx) => {
              const wfId = wf.id || wf.workflowId;
              const isActive = !!wf.active;
              const prefix = (String(wfId || "").includes(":")) ? String(wfId).split(":")[0] : "env";
              const instanceName = instanceMap[prefix] || prefix;
              return (
                <tr key={wfId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: 10 }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td style={{ padding: 10 }}>{wf.name || wf.id}</td>
                  <td style={{ padding: 10 }}>{wfId}</td>
                  <td style={{ padding: 10 }}>{instanceName}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: isActive ? "#e6f4ea" : "#fdecea",
                      color: isActive ? "#1e7e34" : "#b71c1c",
                      border: `1px solid ${isActive ? "#a5d6a7" : "#ef9a9a"}`,
                      fontSize: 12,
                    }}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: 10 }}>{executionCounts[wfId] || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!loading && paged.length === 0 && (
        <div style={{ marginTop: 16, color: "#555" }}>
          You currently do not have access to any workflows. Please wait for the superadmin to grant access.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div>
          <label style={{ marginRight: 8, color: "#666" }}>Rows per page:</label>
          <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(parseInt(e.target.value, 10)); }}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button disabled={currentPage === 1} onClick={() => setPage(1)} style={{ padding: "6px 10px" }}>{"<<"}</button>
          <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: "6px 10px" }}>{"<"}</button>
          <span style={{ color: "#666" }}>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: "6px 10px" }}>{">"}</button>
          <button disabled={currentPage === totalPages} onClick={() => setPage(totalPages)} style={{ padding: "6px 10px" }}>{">>"}</button>
        </div>
      </div>
    </SidebarLayout>
  );
}
