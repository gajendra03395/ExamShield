import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("examshield_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = String(err.config?.url || "");
    const isPublicAuthRequest = requestUrl.startsWith("/auth/login") || requestUrl.startsWith("/auth/register/") || requestUrl.startsWith("/auth/bootstrap-admin");
    if (err.response?.status === 401 && !isPublicAuthRequest) {
      localStorage.removeItem("examshield_token");
      localStorage.removeItem("examshield_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
