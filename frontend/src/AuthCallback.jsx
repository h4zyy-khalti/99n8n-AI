import { useEffect, useState } from "react";
import Loading from "./loading";

export default function AuthCallback() {
  const [status, setStatus] = useState({ loading: true, error: "" });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const error = q.get("error");
    const success = q.get("success");

    if (error) {
      setStatus({ 
        loading: false, 
        error: error === "missing_code" 
          ? "Missing authorization code. Please try logging in again." 
          : error === "authentication_failed"
          ? "Authentication failed. Please try again."
          : decodeURIComponent(error)
      });
      return;
    }

    if (success) {
      // Cookie was set by backend redirect, redirect to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
      return;
    }

    // If no error or success, check if we have a cookie (backend might have set it)
    // Wait a moment for cookie to be set, then redirect
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  }, []);

  // Render
  if (status.loading) return <Loading />;
  if (status.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Authentication Error</h2>
          <p className="text-gray-700 mb-4">{status.error}</p>
          <a 
            href="/" 
            className="text-blue-600 hover:underline"
          >
            Return to login
          </a>
        </div>
      </div>
    );
  }
  return <Loading />;
}
