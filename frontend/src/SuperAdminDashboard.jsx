import { useEffect, useState } from "react";

export default function SuperAdminDashboard() {
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const wfRes = await fetch("http://localhost:4000/n8n/workflows", { credentials: "include" });
        const wfData = await wfRes.json();
        const exRes = await fetch("http://localhost:4000/n8n/executions", { credentials: "include" });
        const exData = await exRes.json();
        setWorkflows(wfData.data || wfData || []);
        setExecutions(exData.data || exData || []);
      } catch (err) {
        setError("Failed to fetch workflows or executions.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: 32 }}>
      <h2>n8n Workflows</h2>
      <ul>
        {workflows.length === 0 && <li>No workflows found.</li>}
        {workflows.map(wf => (
          <li key={wf.id || wf.workflowId}>
            <strong>{wf.name || wf.id}</strong> (ID: {wf.id || wf.workflowId})
          </li>
        ))}
      </ul>
      <h2 style={{ marginTop: 40 }}>n8n Executions</h2>
      <ul>
        {executions.length === 0 && <li>No executions found.</li>}
        {executions.map(ex => (
          <li key={ex.id || ex.executionId}>
            Workflow ID: {ex.workflowId || ex.workflow_id} | Status: {ex.status || ex.finished ? "Finished" : "Running"}
          </li>
        ))}
      </ul>
    </div>
  );
}
