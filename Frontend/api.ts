import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

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

  me: () => api.get("/api/users/me"),

  updateProfile: (data: Record<string, unknown>) =>
    api.put("/api/users/me", data),
};

// ── Services ──────────────────────────────────────────────────────────────────

export const servicesApi = {
  getNearby: (params: Record<string, unknown>) =>
    api.get("/api/services/nearby", { params }),

  getById: (id: string) => api.get(`/api/services/${id}`),

  create: (data: Record<string, unknown>) => api.post("/api/services/", data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/services/${id}`, data),

  getCategories: () => api.get("/api/services/categories/all"),

  suggest: (q: string) => api.get("/api/services/search/suggest", { params: { q } }),
};

// ── Bookings ──────────────────────────────────────────────────────────────────

export const bookingsApi = {
  create: (data: Record<string, unknown>) => api.post("/api/bookings/", data),

  getMy: (params?: Record<string, unknown>) =>
    api.get("/api/bookings/my", { params }),

  getById: (id: string) => api.get(`/api/bookings/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/api/bookings/${id}`, data),

  cancel: (id: string) => api.delete(`/api/bookings/${id}`),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export const reviewsApi = {
  create: (data: Record<string, unknown>) => api.post("/api/reviews/", data),

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