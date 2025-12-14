const DEFAULT_PORT = 4000;

const inferredBase = `${window.location.protocol}//${window.location.hostname}:${DEFAULT_PORT}`;

export const API_BASE = process.env.REACT_APP_API_URL || inferredBase;

export function apiPath(path) {
  if (!path.startsWith("/")) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export function wsPath(path) {
  const u = new URL(API_BASE);
  const proto = u.protocol === "https:" ? "wss" : "ws";
  const base = `${proto}://${u.host}`;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}


