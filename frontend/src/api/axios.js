import axios from "axios";

const api = axios.create({
  baseURL: "http://172.19.4.235:7000",  // replace with your actual server IP
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
