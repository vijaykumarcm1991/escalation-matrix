import { useState } from "react";
import api from "./api/axios";

function App() {
  const [azureId, setAzureId] = useState("");
  const [message, setMessage] = useState("");

  const login = async () => {
    try {
      const response = await api.post(`/auth/login?azure_id=${azureId}`);
      setMessage("Login Success");
      console.log(response.data);
    } catch (error) {
      setMessage("Login Failed");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Escalation Matrix</h2>

      <input
        type="text"
        placeholder="Enter Azure ID"
        value={azureId}
        onChange={(e) => setAzureId(e.target.value)}
      />

      <button onClick={login}>Login</button>

      <p>{message}</p>
    </div>
  );
}

export default App;
