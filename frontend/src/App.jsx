import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AuditLogs from "./pages/AuditLogs";
import DashboardLayout from "./layout/DashboardLayout";
import ProtectedRoute from "./auth/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;