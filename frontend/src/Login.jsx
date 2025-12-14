"use client";

import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";

import { apiPath } from "./api";

export default function Login() {
  const handleGoogleLogin = () => {
    window.location.href = apiPath("/auth/login");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-sm bg-white shadow-lg rounded-2xl p-8 border border-gray-100"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Welcome Back 👋</h2>
          <p className="text-gray-500 mt-2 mb-8">
            Sign in with your Google account to continue.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl shadow-sm transition duration-200"
        >
          <FcGoogle size={22} />
          Continue with Google
        </button>

        <p className="text-xs text-gray-400 mt-6 text-center">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-blue-500 hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-blue-500 hover:underline">
            Privacy Policy
          </a>.
        </p>
      </motion.div>
    </div>
  );
}
