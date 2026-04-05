import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:8001";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/backend";
const DIRECT_BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL ||
  (typeof window === "undefined" ? DEFAULT_LOCAL_BACKEND : "/backend");
const MUTATION_COOLDOWN_MS = 10_000;
const mutationCooldowns = new Map<string, number>();

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const directApi = axios.create({
  baseURL: DIRECT_BACKEND_BASE,
});

function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getAuthToken() {
  let token = useAuthStore.getState().token;

  if (typeof window !== "undefined") {
    token = localStorage.getItem("access_token") || token;

    if (!token) {
      const persisted = localStorage.getItem("hyperlocal-auth");
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as {
            state?: { token?: string | null };
          };
          token = parsed.state?.token || token;
        } catch {
          // Ignore malformed persisted auth payloads and fall back to runtime state.
        }
      }
    }
  }

  return token || null;
}

function createCooldownError(message: string) {
  return Promise.reject({
    response: {
      status: 429,
      data: {
        detail: message,
      },
    },
  });
}

function buildCooldownKey(baseURL: string | undefined, url: string | undefined, method: string) {
  return `${method.toUpperCase()}:${baseURL || ""}:${url || ""}`;
}

function applyMutationCooldown(config: any) {
  const method = String(config.method || "get").toLowerCase();
  if (!["post", "put", "patch", "delete"].includes(method)) {
    return config;
  }

  const key = buildCooldownKey(config.baseURL, config.url, method);
  const now = Date.now();
  const previous = mutationCooldowns.get(key);

  if (previous && now - previous < MUTATION_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((MUTATION_COOLDOWN_MS - (now - previous)) / 1000);
    return createCooldownError(`Please wait ${secondsLeft}s before trying this action again.`);
  }

  mutationCooldowns.set(key, now);
  return config;
}

function attachInterceptors(instance: typeof api) {
  instance.interceptors.request.use((config) => {
    const cooldownResult = applyMutationCooldown(config);
    if (cooldownResult instanceof Promise) {
      return cooldownResult;
    }
    const headers = getAuthHeaders();
    if (headers.Authorization) {
      config.headers.Authorization = headers.Authorization;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => Promise.reject(err)
  );
}

attachInterceptors(api);
attachInterceptors(directApi);

export function getApiErrorMessage(error: any, fallback = "Something went wrong") {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string" && first.trim()) {
      return first;
    }
    if (first?.msg) {
      return String(first.msg);
    }
  }

  const message = error?.response?.data?.message || error?.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    preferred_language?: string;
  }) => api.post("/api/users/register", data),

  login: (email: string, password: string) =>
    api.post("/api/users/login", { email, password }),

  requestLoginOtp: (email: string) =>
    api.post("/api/users/login/request-otp", { email }),

  verifyLoginOtp: (email: string, otp: string) =>
    api.post("/api/users/login/verify-otp", { email, otp }),

  me: () => api.get("/api/users/me", { headers: getAuthHeaders() }),

  updateProfile: (data: Record<string, unknown>) =>
    api.put("/api/users/me", data, { headers: getAuthHeaders() }),
};

// ── Services ──────────────────────────────────────────────────────────────────

export const servicesApi = {
  getNearby: (params: Record<string, unknown>) =>
    api.get("/api/services/nearby", { params }),

  discover: (params?: Record<string, unknown>) =>
    api.get("/api/services/discover", { params }),

  getMine: () => api.get("/api/services/mine", { headers: getAuthHeaders() }),

  getById: (id: string) => api.get(`/api/services/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post("/api/services/", data, { headers: getAuthHeaders() }),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/services/${id}`, data, { headers: getAuthHeaders() }),

  updateLiveLocation: (data: { latitude: number; longitude: number }) =>
    api.put("/api/services/mine/live-location", data, { headers: getAuthHeaders() }),

  getCategories: () => api.get("/api/services/categories/all"),

  suggest: (q: string) => api.get("/api/services/search/suggest", { params: { q } }),
};

// ── Bookings ──────────────────────────────────────────────────────────────────

export const bookingsApi = {
  create: (data: Record<string, unknown>) =>
    directApi.post("/api/bookings/", data, {
      headers: {
        "Content-Type": "application/json",
      },
    }),

  getMy: (params?: Record<string, unknown>) =>
    api.get("/api/bookings/my", { params, headers: getAuthHeaders() }),

  getById: (id: string) => api.get(`/api/bookings/${id}`, { headers: getAuthHeaders() }),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/bookings/${id}`, data, { headers: getAuthHeaders() }),

  getProviderMy: (params?: Record<string, unknown>) =>
    api.get("/api/bookings/provider/my", { params, headers: getAuthHeaders() }),

  getProviderStats: () => api.get("/api/bookings/provider/stats", { headers: getAuthHeaders() }),

  updateProvider: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/bookings/provider/${id}`, data, { headers: getAuthHeaders() }),

  completeProvider: (id: string, otp: string) =>
    api.post(`/api/bookings/provider/${id}/complete`, { otp }, { headers: getAuthHeaders() }),

  getAll: (params?: Record<string, unknown>) =>
    api.get("/api/bookings/admin/all", { params, headers: getAuthHeaders() }),

  updateAdmin: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/bookings/admin/${id}`, data, { headers: getAuthHeaders() }),

  cancel: (id: string) => api.delete(`/api/bookings/${id}`, { headers: getAuthHeaders() }),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export const reviewsApi = {
  create: (data: Record<string, unknown>) =>
    api.post("/api/reviews/", data, { headers: getAuthHeaders() }),

  getForProvider: (providerId: string, params?: Record<string, unknown>) =>
    api.get(`/api/reviews/provider/${providerId}`, { params }),

  getStats: (providerId: string) =>
    api.get(`/api/reviews/provider/${providerId}/stats`),
};

// ── AI Chat ───────────────────────────────────────────────────────────────────

export const chatApi = {
  sendMessage: (data: {
    message: string;
    session_token?: string;
    latitude?: number;
    longitude?: number;
    language?: string;
  }) => api.post("/api/ai/chat", data),
};

export const adminApi = {
  getOverview: () => api.get("/api/admin/overview", { headers: getAuthHeaders() }),
  getUsers: (params?: Record<string, unknown>) =>
    api.get("/api/admin/users", { params, headers: getAuthHeaders() }),
  getProviders: (params?: Record<string, unknown>) =>
    api.get("/api/admin/providers", { params, headers: getAuthHeaders() }),
  getReviews: (params?: Record<string, unknown>) =>
    api.get("/api/admin/reviews", { params, headers: getAuthHeaders() }),
  getMediaAssets: (params?: Record<string, unknown>) =>
    api.get("/api/admin/media-assets", { params, headers: getAuthHeaders() }),
  getAuditLogs: (params?: Record<string, unknown>) =>
    api.get("/api/admin/audit-logs", { params, headers: getAuthHeaders() }),
  updateProvider: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/admin/providers/${id}`, data, { headers: getAuthHeaders() }),
  updateReview: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/admin/reviews/${id}`, data, { headers: getAuthHeaders() }),
  updateMediaAsset: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/admin/media-assets/${id}`, data, { headers: getAuthHeaders() }),
};

export const paymentsApi = {
  createForBooking: (bookingId: string, method: "cod" | "online" | "manual_upi" = "online") =>
    api.post(`/api/payments/bookings/${bookingId}/create`, { method }, { headers: getAuthHeaders() }),
  confirm: (
    paymentId: string,
    data?: { gateway_payment_id?: string; gateway_signature?: string }
  ) => api.post(`/api/payments/${paymentId}/confirm`, data, { headers: getAuthHeaders() }),
  getInvoice: (paymentId: string) =>
    api.get(`/api/payments/${paymentId}/invoice`, { headers: getAuthHeaders() }),
  getMy: () => api.get("/api/payments/my", { headers: getAuthHeaders() }),
};

export const notificationsApi = {
  getMy: () => api.get("/api/notifications/my", { headers: getAuthHeaders() }),
  markRead: (id: string) =>
    api.put(`/api/notifications/${id}/read`, undefined, { headers: getAuthHeaders() }),
  markAllRead: () =>
    api.put("/api/notifications/read-all", undefined, { headers: getAuthHeaders() }),
};

export const supportApi = {
  getMy: () => api.get("/api/support/my", { headers: getAuthHeaders() }),
  createTicket: (data: { booking_id: string; title: string; message: string }) =>
    api.post("/api/support/tickets", data, { headers: getAuthHeaders() }),
  getAllAdmin: () => api.get("/api/support/admin/all", { headers: getAuthHeaders() }),
  updateAdmin: (id: string, data: { status?: string; admin_notes?: string }) =>
    api.put(`/api/support/admin/${id}`, data, { headers: getAuthHeaders() }),
};

export const uploadsApi = {
  upload: (formData: FormData) =>
    api.post(`/api/uploads${getAuthToken() ? `?access_token=${encodeURIComponent(getAuthToken()!)}` : ""}`, formData, {
      headers: {
        "Content-Type": undefined as unknown as string,
        ...getAuthHeaders(),
      },
    }),
  getMy: () =>
    api.get(`/api/uploads/my${getAuthToken() ? `?access_token=${encodeURIComponent(getAuthToken()!)}` : ""}`, {
      headers: {
        ...getAuthHeaders(),
      },
    }),
  delete: (assetId: string) =>
    api.delete(`/api/uploads/${assetId}${getAuthToken() ? `?access_token=${encodeURIComponent(getAuthToken()!)}` : ""}`, {
      headers: {
        ...getAuthHeaders(),
      },
    }),
};
