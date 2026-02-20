import { useEffect, useState } from "react";
import api from "../api/axios";
import {
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Box,
  Alert,
  Chip
} from "@mui/material";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get("/audit-logs");
        setLogs(response.data);
      } catch (err) {
        setError("Failed to fetch audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading)
    return (
      <Box sx={{ textAlign: "center", mt: 5 }}>
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Audit Logs
      </Typography>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Performed By</TableCell>
            <TableCell>Details</TableCell>
            <TableCell>Timestamp</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{log.id}</TableCell>
              <TableCell>
                <Chip
                  label={log.action}
                  color={
                    log.action.includes("CREATE")
                      ? "success"
                      : log.action.includes("UPDATE")
                      ? "warning"
                      : "default"
                  }
                />
              </TableCell>
              <TableCell>{log.performed_by}</TableCell>
              <TableCell>{log.details}</TableCell>
              <TableCell>
                {new Date(log.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}