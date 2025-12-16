import { useEffect, useMemo, useState } from "react";
import SidebarLayout from "./SidebarLayout";
import Loading from "./loading";
import { apiPath } from "./api";

function Section({ title, children }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md mb-6 hover:shadow-lg transition-shadow duration-200">
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white shadow"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function Table({ columns, data, renderRow }) {
  return (
    <div className="overflow-x-auto rounded-lg shadow border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((item, idx) => renderRow(item, idx))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [access, setAccess] = useState([]);
  const [logs, setLogs] = useState([]);
  const [instances, setInstances] = useState([]);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [newInst, setNewInst] = useState({ identifier: "", name: "", base_url: "", api_key: "", active: true });
  const [newUserEmail, setNewUserEmail] = useState("");
  const [userError, setUserError] = useState("");
  const [instanceError, setInstanceError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");
  const [accessUpdating, setAccessUpdating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [u, w, a, l, inst, me] = await Promise.all([
          fetch(apiPath("/admin/users"), { credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch(apiPath("/workflows"), { credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch(apiPath("/admin/workflow-access"), { credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch(apiPath("/admin/action-logs"), { credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch(apiPath("/admin/instances"), { credentials: "include" }).then(r => r.json()).catch(() => []),
          fetch(apiPath("/me"), { credentials: "include" }).then(r => r.json()).catch(() => null)
        ]);
        setUsers(Array.isArray(u) ? u : []);
        setWorkflows(Array.isArray(w) ? w : []);
        setAccess(Array.isArray(a) ? a : []);
        setLogs(Array.isArray(l) ? l : []);
        setInstances(Array.isArray(inst) ? inst : []);
        setCurrentUser(me);
        if (!selectedUserId && Array.isArray(u) && u.length > 0) {
          setSelectedUserId(u[0].id);
        }
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const userIdToAccess = useMemo(() => {
    const map = {};
    access.forEach(a => {
      if (!map[a.user_id]) map[a.user_id] = new Set();
      map[a.user_id].add(String(a.workflow_id));
    });
    return map;
  }, [access]);

  const userIdToEmail = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u.email; });
    return map;
  }, [users]);

  const categories = useMemo(() => {
    const cat = new Set();
    workflows.forEach(w => {
      const wfId = String(w.id || "");
      cat.add(wfId.includes(":") ? wfId.split(":")[0] : "default");
    });
    return Array.from(cat);
  }, [workflows]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.email.toLowerCase().includes(q));
  }, [users, userSearch]);

  const selectedUserAccess = selectedUserId ? (userIdToAccess[selectedUserId] || new Set()) : new Set();

  const selectedUser = useMemo(
    () => users.find(u => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const isCurrentSuperadmin = currentUser?.role === "superadmin";
  const isSelectedSuperadmin = selectedUser?.role === "superadmin";
  const hideWorkflowPanel = isCurrentSuperadmin && isSelectedSuperadmin;
  const showWorkflowCount = !isCurrentSuperadmin;

  const filteredWorkflows = useMemo(() => {
    const q = workflowSearch.trim().toLowerCase();
    return workflows.filter(wf => {
      const wfId = String(wf.id || "");
      const wfName = String(wf.name || "");
      const category = wfId.includes(":") ? wfId.split(":")[0] : "default";
      const matchesCategory = categoryFilter === "all" || category === categoryFilter;
      const matchesText = !q || wfName.toLowerCase().includes(q) || wfId.toLowerCase().includes(q);
      const hasAccess = selectedUserAccess.has(wfId);
      const matchesAccess =
        accessFilter === "all" ||
        (accessFilter === "has" && hasAccess) ||
        (accessFilter === "missing" && !hasAccess);
      return matchesCategory && matchesText && matchesAccess;
    });
  }, [workflows, workflowSearch, categoryFilter, accessFilter, selectedUserAccess]);

  const groupedWorkflows = useMemo(() => {
    const grouped = {};
    filteredWorkflows.forEach(wf => {
      const wfId = String(wf.id || "");
      const category = wfId.includes(":") ? wfId.split(":")[0] : "default";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(wf);
    });
    return grouped;
  }, [filteredWorkflows]);

  const allFilteredHaveAccess = useMemo(() => {
    if (!selectedUserId || filteredWorkflows.length === 0) return false;
    return filteredWorkflows.every(wf => selectedUserAccess.has(String(wf.id || "")));
  }, [selectedUserId, filteredWorkflows, selectedUserAccess]);

  async function createUser() {
    if (!newUserEmail.trim()) {
      setUserError("Email is required");
      return;
    }
    if (!newUserEmail.trim().endsWith("@khalti.com")) {
      setUserError("Only @khalti.com email addresses are allowed");
      return;
    }
    setUserError("");
    try {
      const res = await fetch(apiPath("/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: newUserEmail.trim() })
      });
      if (res.ok) {
        const newUser = await res.json();
        setUsers([...users, newUser]);
        setNewUserEmail("");
      } else {
        const error = await res.json();
        setUserError(error.error || "Failed to create user");
      }
    } catch (e) {
      setUserError("Failed to create user");
    }
  }

  async function setRole(userId, role) {
    try {
      const res = await fetch(apiPath("/admin/users/role"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, role })
      });
      if (res.ok) {
        setUsers(users.map(u => (u.id === userId ? { ...u, role } : u)));
      } else {
        const error = await res.json();
        alert(error.error || "Failed to update role");
      }
    } catch (e) {
      alert("Failed to update role");
    }
  }

  async function grant(userId, workflowId) {
    await grantBulk(userId, [workflowId]);
  }

  async function revoke(userId, workflowId) {
    await revokeBulk(userId, [workflowId]);
  }

  async function grantBulk(userId, workflowIds) {
    if (!workflowIds.length) return;
    setAccessUpdating(true);
    try {
      const res = await fetch(apiPath("/admin/workflow-access/grant-bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, workflow_ids: workflowIds })
      });
      if (res.ok) {
        // Merge uniquely
        setAccess(prev => {
          const seen = new Set(prev.map(a => `${a.user_id}-${a.workflow_id}`));
          const additions = workflowIds
            .filter(id => !seen.has(`${userId}-${id}`))
            .map(id => ({ user_id: userId, workflow_id: id }));
          return [...prev, ...additions];
        });
      }
    } finally {
      setAccessUpdating(false);
    }
  }

  async function revokeBulk(userId, workflowIds) {
    if (!workflowIds.length) return;
    setAccessUpdating(true);
    try {
      const res = await fetch(apiPath("/admin/workflow-access/revoke-bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, workflow_ids: workflowIds })
      });
      if (res.ok) {
        setAccess(prev => prev.filter(a => !(a.user_id === userId && workflowIds.includes(String(a.workflow_id)))));
      }
    } finally {
      setAccessUpdating(false);
    }
  }

  async function createInstance() {
    setInstanceError("");
    if (!newInst.name.trim()) {
      setInstanceError("Name is required");
      return;
    }
    if (!newInst.base_url.trim()) {
      setInstanceError("Base URL is required");
      return;
    }
    if (!newInst.api_key.trim()) {
      setInstanceError("API Key is required");
      return;
    }
    try {
      const res = await fetch(apiPath("/admin/instances"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newInst)
      });
      if (res.ok) {
        const list = await fetch(apiPath("/admin/instances"), { credentials: "include" }).then(r => r.json()).catch(() => []);
        setInstances(Array.isArray(list) ? list : []);
        setNewInst({ identifier: "", name: "", base_url: "", api_key: "", active: true });
        setInstanceError("");
      } else {
        const error = await res.json();
        setInstanceError(error.error || "Failed to create instance");
      }
    } catch (e) {
      setInstanceError("Failed to create instance");
    }
  }

  async function toggleInstanceActive(id, active) {
    await fetch(apiPath(`/admin/instances/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active })
    });
    const list = await fetch(apiPath("/admin/instances"), { credentials: "include" }).then(r => r.json()).catch(() => []);
    setInstances(Array.isArray(list) ? list : []);
  }

  async function deleteInstance(id) {
  if (!window.confirm("Are you sure you want to delete this instance?")) return;
  await fetch(apiPath(`/admin/instances/${id}`), { method: "DELETE", credentials: "include" });
  setInstances(instances.filter(i => i.id !== id));
}

  const handleLogout = async () => {
    await fetch(apiPath("/auth/logout"), { method: "POST", credentials: "include" });
    window.location.href = "/";
  };

  if (loading) return <Loading />;

  return (
    <SidebarLayout onLogout={handleLogout}>
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>Users</TabButton>
        <TabButton active={activeTab === "access"} onClick={() => setActiveTab("access")}>User Access</TabButton>
        <TabButton active={activeTab === "logs"} onClick={() => setActiveTab("logs")}>User Logs</TabButton>
        <TabButton active={activeTab === "instances"} onClick={() => setActiveTab("instances")}>Instances</TabButton>
      </div>

      {activeTab === "users" && (
        <>
          <Section title="Add User">
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="Email (@khalti.com)"
                  value={newUserEmail}
                  onChange={e => {
                    setNewUserEmail(e.target.value);
                    setUserError("");
                  }}
                  className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none ${
                    userError ? "border-red-500" : ""
                  }`}
                />
                {userError && <p className="text-red-500 text-sm mt-1">{userError}</p>}
              </div>
              <button
                onClick={createUser}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition whitespace-nowrap"
              >
                Create User
              </button>
            </div>
          </Section>
          <Section title="Users">
            <Table
              columns={["UUID", "Email", "Role", "Actions"]}
              data={users}
              renderRow={u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{u.id}</td>
                  <td className="px-6 py-3">{u.email}</td>
                  <td className="px-6 py-3">{u.role}</td>
                  <td className="px-6 py-3 flex gap-2 items-center">
                    {u.role !== "superadmin" && (
                      <button onClick={() => setRole(u.id, "superadmin")} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition">
                        Superadmin
                      </button>
                    )}
                    {u.role !== "user" && currentUser && currentUser.id !== u.id && (
                      <button onClick={() => setRole(u.id, "user")} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition">
                        User
                      </button>
                    )}
                    {u.role === "superadmin" && currentUser && currentUser.id === u.id && (
                      <span className="text-sm text-gray-500 italic">Cannot downgrade yourself</span>
                    )}
                  </td>
                </tr>
              )}
            />
          </Section>
        </>
      )}

      {activeTab === "access" && (
        <Section title="User Access">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border rounded-md p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Users</h3>
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Filter users"
                  className="p-2 border rounded w-40"
                />
              </div>
              <div className="max-h-96 overflow-auto divide-y">
                {filteredUsers.map(u => {
                  const count = userIdToAccess[u.id]?.size || 0;
                  const active = u.id === selectedUserId;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between ${active ? "bg-blue-50 border-l-4 border-blue-500" : ""}`}
                    >
                      <div>
                        <div className="font-medium">{u.email}</div>
                        <div className="text-xs text-gray-500">Role: {u.role}</div>
                      </div>
                      {showWorkflowCount && (
                        <span className="text-xs text-gray-600">{count} workflows</span>
                      )}
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && <div className="text-sm text-gray-500 py-4 text-center">No users</div>}
              </div>
            </div>

            {!hideWorkflowPanel && (
            <div className="lg:col-span-2 bg-white border rounded-md p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 mb-4 items-center">
                <input
                  value={workflowSearch}
                  onChange={e => setWorkflowSearch(e.target.value)}
                  placeholder="Search workflows"
                  className="p-2 border rounded flex-1 min-w-[180px]"
                />
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="p-2 border rounded">
                  <option value="all">All categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select value={accessFilter} onChange={e => setAccessFilter(e.target.value)} className="p-2 border rounded">
                  <option value="all">All access</option>
                  <option value="has">Has access</option>
                  <option value="missing">No access</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    disabled={!selectedUserId || filteredWorkflows.length === 0 || accessUpdating}
                    checked={allFilteredHaveAccess}
                    onChange={e => {
                      if (!selectedUserId) return;
                      const ids = filteredWorkflows.map(w => w.id);
                      if (e.target.checked) {
                        grantBulk(selectedUserId, ids);
                      } else {
                        revokeBulk(selectedUserId, ids);
                      }
                    }}
                  />
                  Select All Workflows
                </label>
                {/* <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={!selectedUserId || filteredWorkflows.length === 0 || accessUpdating}
                    onClick={() => selectedUserId && grantBulk(selectedUserId, filteredWorkflows.map(w => w.id))}
                    className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Grant 
                  </button>
                  <button
                    disabled={!selectedUserId || filteredWorkflows.length === 0 || accessUpdating}
                    onClick={() => selectedUserId && revokeBulk(selectedUserId, filteredWorkflows.map(w => w.id))}
                    className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Revoke 
                  </button>
                </div> */}
              </div>

              {!selectedUserId && <div className="text-sm text-gray-500">Select a user to manage access.</div>}

              {selectedUserId && Object.keys(groupedWorkflows).length === 0 && (
                <div className="text-sm text-gray-500">No workflows match filters.</div>
              )}

              {selectedUserId && Object.entries(groupedWorkflows).map(([category, list]) => {
                const isOpen = !!expandedCategories[category];
                const label = category === "default" ? "Default" : category;
                return (
                  <div key={category} className="mb-4 border rounded">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories(prev => ({
                          ...prev,
                          [category]: !prev[category],
                        }))
                      }
                      className="w-full flex items-center justify-between bg-gray-50 px-3 py-2 font-semibold"
                    >
                      <span>{label}</span>
                      <span className="text-sm text-gray-600">{isOpen ? "▼" : "▶"}</span>
                    </button>
                    {isOpen && (
                      <div className="divide-y">
                        {list.map(wf => {
                          const wfId = String(wf.id || "");
                          const has = selectedUserAccess.has(wfId);
                          return (
                            <div key={wfId} className="px-3 py-2 flex items-center justify-between">
                              <div>
                                <div className="font-medium">{wf.name || wf.id}</div>
                                <div className="text-xs text-gray-500">{wfId}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs px-2 py-1 rounded ${has ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                  {has ? "Has access" : "No access"}
                                </span>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={has}
                                    disabled={accessUpdating}
                                    onChange={e => (e.target.checked ? grant(selectedUserId, wfId) : revoke(selectedUserId, wfId))}
                                    className="accent-blue-600"
                                  />
                                  {has ? "Revoke" : "Grant"}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </Section>
      )}

      {activeTab === "logs" && (
        <Section title="User Logs">
          <Table
            columns={["Timestamp", "User", "Action"]}
            data={logs}
            renderRow={l => (
              <tr key={l.timestamp + l.user_id} className="hover:bg-gray-50">
                <td className="px-6 py-3">{l.timestamp}</td>
                <td className="px-6 py-3">{userIdToEmail[l.user_id] || l.user_id}</td>
                <td className="px-6 py-3">{l.action}</td>
              </tr>
            )}
          />
        </Section>
      )}

      {activeTab === "instances" && (
        <>
          <Section title="Add Instance">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input
                  placeholder="Identifier (optional)"
                  value={newInst.identifier}
                  onChange={e => {
                    setNewInst({ ...newInst, identifier: e.target.value });
                    setInstanceError("");
                  }}
                  className="p-3 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                />
                <input
                  placeholder="Name *"
                  required
                  value={newInst.name}
                  onChange={e => {
                    setNewInst({ ...newInst, name: e.target.value });
                    setInstanceError("");
                  }}
                  className={`p-3 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none ${
                    instanceError && !newInst.name.trim() ? "border-red-500" : ""
                  }`}
                />
                <input
                  placeholder="Base URL *"
                  required
                  value={newInst.base_url}
                  onChange={e => {
                    setNewInst({ ...newInst, base_url: e.target.value });
                    setInstanceError("");
                  }}
                  className={`p-3 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none ${
                    instanceError && !newInst.base_url.trim() ? "border-red-500" : ""
                  }`}
                />
                <input
                  placeholder="API Key *"
                  required
                  value={newInst.api_key}
                  onChange={e => {
                    setNewInst({ ...newInst, api_key: e.target.value });
                    setInstanceError("");
                  }}
                  className={`p-3 border rounded-md focus:ring-2 focus:ring-blue-400 outline-none ${
                    instanceError && !newInst.api_key.trim() ? "border-red-500" : ""
                  }`}
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newInst.active}
                    onChange={e => setNewInst({ ...newInst, active: e.target.checked })}
                    className="accent-blue-600"
                  />
                  Active
                </label>
                <button
                  onClick={createInstance}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Create
                </button>
              </div>
              {instanceError && <p className="text-red-500 text-sm">{instanceError}</p>}
            </div>
          </Section>

          <Section title="Instances">
            <Table
              columns={["Name", "Identifier", "Base URL", "Active", "Actions"]}
              data={instances}
              renderRow={inst => (
                <tr key={inst.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{inst.name}</td>
                  <td className="px-6 py-3">{inst.identifier || "-"}</td>
                  <td className="px-6 py-3">{inst.base_url}</td>
                  <td className="px-6 py-3">
                    <input type="checkbox" checked={!!inst.active} onChange={e => toggleInstanceActive(inst.id, e.target.checked)} className="accent-blue-600" />
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <button onClick={() => deleteInstance(inst.id)} className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition">Delete</button>
                  </td>
                </tr>
              )}
            />
          </Section>
        </>
      )}
    </SidebarLayout>
  );
}
