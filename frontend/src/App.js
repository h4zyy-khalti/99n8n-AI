import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import AuthCallback from "./AuthCallback";
import Dashboard from "./Dashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";
import AdminPage from "./AdminPage";
import WorkflowsPage from "./WorkflowsPage";
import ExecutionsPage from "./ExecutionsPage";
import Loading from "./loading";

import { useEffect, useState } from "react";
import { apiPath } from "./api";

function ProtectedRoute({ children }) {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    fetch(apiPath("/dashboard"), {
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 401) setAuth(false);
        else setAuth(true);
      })
      .catch(() => setAuth(false));
  }, []);

  if (auth === null) return <Loading />;
  if (!auth) return <Navigate to="/" replace />;
  return children;
}
//build trigger
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/workflows" element={<ProtectedRoute><WorkflowsPage /></ProtectedRoute>} />
        <Route path="/executions" element={<ProtectedRoute><ExecutionsPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
