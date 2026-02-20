import { useState, useContext } from "react";
import { AuthContext } from "../auth/AuthContext";
import {
  Container,
  TextField,
  Button,
  Paper,
  Typography,
  Box
} from "@mui/material";

export default function Login() {
  const { login } = useContext(AuthContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 10 }}>
        <Typography variant="h5" gutterBottom>
          Escalation Matrix Login
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            margin="normal"
            onChange={(e) => setUsername(e.target.value)}
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            margin="normal"
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            fullWidth
            variant="contained"
            sx={{ mt: 2 }}
            type="submit"
          >
            Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
