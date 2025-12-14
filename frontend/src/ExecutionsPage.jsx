import { useEffect, useMemo, useRef, useState } from "react";
import SidebarLayout from "./SidebarLayout";
import { apiPath, wsPath } from "./api";

export default function ExecutionsPage() {
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
    instances.forEach((i) => {
      map[i.prefix] = i.name || i.prefix;
    });
    return map;
  }, [instances]);

  useEffect(() => {
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        params.set("q", query);
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        const res = await fetch(apiPath(`/executions?${params.toString()}`), { credentials: "include" });
        const data = await res.json();
        setExecutions(Array.isArray(data) ? data : data.items || data.data || []);
      } catch {
        setExecutions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    fetch(apiPath("/instances"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setInstances(d))
      .catch(() => {});

    const ws = new WebSocket(wsPath("/ws/n8n"));
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "n8n_sync") fetchData();
      } catch {}
    };
    return () => wsRef.current?.close();
  }, [query, page, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      selectedInstance === "all"
        ? executions
        : executions.filter((ex) => {
            const exId = String(ex.id || ex.executionId || "");
            const pfx = exId.includes(":") ? exId.split(":")[0] : "env";
            return pfx === selectedInstance;
          });
    if (!q) return base;
    return base.filter((ex) => {
      const id = String(ex.id || ex.executionId || "").toLowerCase();
      const wfId = String(ex.workflowId || ex.workflow_id || "").toLowerCase();
      const status = String(ex.status || (ex.finished ? "finished" : "running"));
      return id.includes(q) || wfId.includes(q) || status.includes(q);
    });
  }, [executions, query, selectedInstance]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleLogout = async () => {
    await fetch("http://localhost:4000/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  const statusBadge = (status) => {
    const lower = status.toLowerCase();
    const colors =
      lower === "running"
        ? "bg-yellow-100 text-yellow-800"
        : lower === "finished"
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800";
    return <span className={`px-2 py-1 rounded-full text-sm font-semibold ${colors}`}>{status}</span>;
  };

  return (
    <SidebarLayout onLogout={handleLogout}>
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-800">Executions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedInstance}
            onChange={(e) => {
              setPage(1);
              setSelectedInstance(e.target.value);
            }}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">All Instances</option>
            {instances.map((i) => (
              <option key={i.prefix} value={i.prefix}>
                {i.name || i.prefix}
              </option>
            ))}
          </select>

          <input
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search executions..."
            className="border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
          />

          <span className="text-gray-600 font-medium">Total: {total}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-4">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                {["S.N", "Execution ID", "Workflow ID", "Instance", "Status"].map((col) => (
                  <th key={col} className="text-left px-4 py-2 border-b border-gray-200 text-gray-700 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((ex, idx) => {
                const finished = !!ex.finished;
                const status = ex.status || (finished ? "Finished" : "Running");
                const exId = ex.id || ex.executionId;
                const prefix = exId.includes(":") ? exId.split(":")[0] : "env";
                const instanceName = instanceMap[prefix] || prefix;
                return (
                  <tr key={ex.id || ex.executionId} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2 border-b border-gray-100">{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td className="px-4 py-2 border-b border-gray-100">{ex.id || ex.executionId}</td>
                    <td className="px-4 py-2 border-b border-gray-100">{ex.workflowId || ex.workflow_id}</td>
                    <td className="px-4 py-2 border-b border-gray-100">{instanceName}</td>
                    <td className="px-4 py-2 border-b border-gray-100">{statusBadge(status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && paged.length === 0 && (
          <div className="mt-4 text-gray-600">
            You currently do not have access to any executions. Please wait for the superadmin to grant workflow access.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
        <div className="flex items-center gap-2">
          <label className="text-gray-600 font-medium">Rows per page:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(parseInt(e.target.value, 10));
            }}
            className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(1)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            {"<<"}
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            {"<"}
          </button>
          <span className="text-gray-600 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            {">"}
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage(totalPages)}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            {">>"}
          </button>
        </div>
      </div>
    </SidebarLayout>
  );
}
