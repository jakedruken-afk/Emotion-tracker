import { Capacitor } from "@capacitor/core";
import type { AuthSession, SessionMode } from "@shared/contracts";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
};

const clientSessionModeKey = "lamb_session_mode";
const clientSessionTokenKey = "lamb_session_token";
const cloudflareApiBaseUrl = "https://lamb-web.pages.dev";
const apiRequestTimeoutMs = 10_000;

function isNativeRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const isCapacitorLocalHost =
    window.location.hostname === "localhost" && window.location.protocol === "https:";

  return (
    Capacitor.isNativePlatform() ||
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    isCapacitorLocalHost
  );
}

function getConfiguredApiBaseUrl() {
  const configuredValue = String(import.meta.env.VITE_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (configuredValue.length > 0) {
    return configuredValue;
  }

  if (!isNativeRuntime()) {
    return "";
  }

  const platform = Capacitor.getPlatform();

  if (platform === "android") {
    return "http://10.0.2.2:3001";
  }

  return cloudflareApiBaseUrl;
}

const apiBaseUrl = getConfiguredApiBaseUrl();

function resolveApiUrl(url: string) {
  if (/^https?:\/\//i.test(url) || apiBaseUrl.length === 0) {
    return url;
  }

  return `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function readStoredSessionMode(): SessionMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(clientSessionModeKey);
  return value === "header" || value === "cookie" ? value : null;
}

export function getPreferredSessionMode(): SessionMode {
  if (typeof window === "undefined") {
    return "cookie";
  }

  if (isNativeRuntime()) {
    return "header";
  }

  const storedMode = readStoredSessionMode();
  if (storedMode) {
    return storedMode;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("sessionMode") === "header") {
    return "header";
  }

  const isStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return isStandalone ? "header" : "cookie";
}

export function getStoredSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(clientSessionTokenKey);
}

export function persistAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(clientSessionModeKey, session.sessionMode);

  if (session.sessionMode === "header" && session.sessionToken) {
    window.localStorage.setItem(clientSessionTokenKey, session.sessionToken);
    return;
  }

  window.localStorage.removeItem(clientSessionTokenKey);
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(clientSessionTokenKey);
  window.localStorage.removeItem(clientSessionModeKey);
}

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}) {
  const sessionToken = getStoredSessionToken();
  const headers: Record<string, string> = {};
  const resolvedUrl = resolveApiUrl(url);

  if (options.data) {
    headers["Content-Type"] = "application/json";
  }

  if (sessionToken) {
    headers["x-lamb-session"] = sessionToken;
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), apiRequestTimeoutMs);

  let response: Response;

  try {
    response = await fetch(resolvedUrl, {
      method: options.method ?? (options.data ? "POST" : "GET"),
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: options.data ? JSON.stringify(options.data) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The L.A.M.B. API did not respond. Please try again.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const isHtml = contentType.includes("text/html");

  if (url.startsWith("/api") && isHtml) {
    await response.text();

    if (isNativeRuntime()) {
      throw new Error(
        "The mobile app is not connected to the API yet. Rebuild with VITE_API_BASE_URL, or use the Android emulator fallback host.",
      );
    }

    throw new Error("Expected a JSON API response but received HTML instead.");
  }

  if (!response.ok) {
    if (isJson) {
      const payload = (await response.json()) as { error?: string; message?: string };
      throw new Error(payload.message ?? payload.error ?? `Request failed with status ${response.status}`);
    }

    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function isNetworkError(error: unknown) {
  if (error instanceof TypeError) {
    return true;
  }

  const message = getErrorMessage(error);
  return /Failed to fetch|NetworkError|network request failed|load failed/i.test(message);
}
