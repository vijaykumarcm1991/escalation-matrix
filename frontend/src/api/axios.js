import axios from "axios";

const api = axios.create({
  baseURL: "http://172.19.4.235:7000",  // replace with your actual server IP
});

export default api;
