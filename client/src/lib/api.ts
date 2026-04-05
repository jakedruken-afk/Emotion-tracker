type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
};

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}) {
  const response = await fetch(url, {
    method: options.method ?? (options.data ? "POST" : "GET"),
    credentials: "include",
    headers: options.data ? { "Content-Type": "application/json" } : undefined,
    body: options.data ? JSON.stringify(options.data) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    if (isJson) {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message ?? `Request failed with status ${response.status}`);
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
