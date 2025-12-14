import { useEffect, useState } from "react";
import { apiPath } from "./api";
import { useNavigate } from "react-router-dom";
import { FaHome, FaTasks, FaClock, FaUserShield, FaSignOutAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function SidebarLayout({ children, onLogout }) {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { label: "Dashboard", icon: <FaHome />, path: "/dashboard", bgColor: "bg-blue-600" },
    { label: "Workflows", icon: <FaTasks />, path: "/workflows", bgColor: "bg-blue-600" },
    { label: "Executions", icon: <FaClock />, path: "/executions", bgColor: "bg-blue-600" },
  ];

  useEffect(() => {
    fetch(apiPath("/me"), { credentials: "include" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ role: "user" }));
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full flex flex-col bg-gray-100 shadow-lg transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Collapse Button */}
        <div className="flex justify-end p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded bg-white shadow hover:bg-gray-200 transition"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-4 flex flex-col gap-2 px-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 p-3 rounded-lg text-white font-medium hover:shadow-md transition ${
                item.bgColor
              }`}
              title={item.label}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}

          {me?.role === "superadmin" && (
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-3 p-3 rounded-lg text-white font-medium bg-gray-700 hover:shadow-md transition mt-2"
              title="Admin"
            >
              <FaUserShield className="text-lg" />
              {!collapsed && <span>Admin</span>}
            </button>
          )}
        </nav>

        {/* Logout */}
        <div className="mt-auto p-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full p-3 rounded-lg text-white font-medium bg-red-600 hover:shadow-md transition"
          >
            <FaSignOutAlt className="text-lg" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 p-6 transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"}`}>
        {children}
      </main>
    </div>
  );
}
