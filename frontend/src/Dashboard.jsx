import { useEffect, useState } from "react";
import SidebarLayout from "./SidebarLayout";
import { apiPath } from "./api";
import { FaPlay, FaTasks, FaSpinner, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import Loading from "./loading";
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    fetch(apiPath("/log-action"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "Visited dashboard" }),
    }).catch((err) => console.warn("Failed to log action", err));
  }, []);

  useEffect(() => {
    async function fetchAll() {
      try {
        const dashRes = await fetch(apiPath("/dashboard"), { credentials: "include" });
        const dashData = await dashRes.json();
        setData(dashData);

        const wfRes = await fetch(apiPath("/workflows"), { credentials: "include" });
        const wfData = await wfRes.json();
        setWorkflows(Array.isArray(wfData) ? wfData : wfData.data || []);

        const exRes = await fetch(apiPath("/executions"), { credentials: "include" });
        const exData = await exRes.json();
        setExecutions(Array.isArray(exData) ? exData : exData.data || []);
      } catch (err) {
        setData({ message: "Failed to load dashboard." });
        setWorkflows([]);
        setExecutions([]);
        console.warn("Failed to fetch dashboard, workflows, or executions", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const handleLogout = async () => {
    await fetch(apiPath("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  if (loading || !data)
    return (
      <Loading />
    );

  const activeWorkflows = workflows.filter((w) => !!w.active).length;
  const runningExecutions = executions.filter((e) => !(e.finished ?? true)).length;
  const successExecutions = executions.filter((e) => {
    const s = String(e.status || "").toLowerCase();
    if (s) return s === "success" || s === "succeeded" || s === "ok" || s === "completed";
    return e.finished === true;
  }).length;
  const failedExecutions = executions.filter((e) => {
    const s = String(e.status || "").toLowerCase();
    return s === "error" || s === "failed" || s === "failure" || s === "cancelled";
  }).length;

  const stats = [
    {
      title: "Total Workflows",
      value: workflows.length,
      icon: <FaTasks className="text-blue-500 w-6 h-6" />,
      color: "bg-blue-50",
    },
    {
      title: "Active Workflows",
      value: activeWorkflows,
      icon: <FaCheckCircle className="text-green-500 w-6 h-6" />,
      color: "bg-green-50",
    },
    {
      title: "Total Executions",
      value: executions.length,
      icon: <FaPlay className="text-purple-500 w-6 h-6" />,
      color: "bg-purple-50",
    },
    {
      title: "Running Executions",
      value: runningExecutions,
      icon: <FaSpinner className="text-yellow-500 w-6 h-6 animate-spin" />,
      color: "bg-yellow-50",
    },
    {
      title: "Successful Executions",
      value: successExecutions,
      icon: <FaCheckCircle className="text-emerald-600 w-6 h-6" />,
      color: "bg-emerald-50",
    },
    {
      title: "Failed Executions",
      value: failedExecutions,
      icon: <FaTimesCircle className="text-rose-600 w-6 h-6" />,
      color: "bg-rose-50",
    },
  ];

  const topStats = stats.slice(0, 4);
  const bottomStats = stats.slice(4);

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{data.message}</h1>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          {topStats.map((stat) => (
            <div
              key={stat.title}
              className={`flex items-center p-6 rounded-2xl shadow hover:shadow-lg transition ${stat.color}`}
            >
              <div className="p-4 rounded-full bg-white mr-4 flex items-center justify-center">
                {stat.icon}
              </div>
              <div>
                <div className="text-gray-500 font-medium">{stat.title}</div>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {bottomStats.length > 0 && (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 mt-6">
            {bottomStats.map((stat) => (
              <div
                key={stat.title}
                className={`flex items-center p-6 rounded-2xl shadow hover:shadow-lg transition ${stat.color}`}
              >
                <div className="p-4 rounded-full bg-white mr-4 flex items-center justify-center">
                  {stat.icon}
                </div>
                <div>
                  <div className="text-gray-500 font-medium">{stat.title}</div>
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
