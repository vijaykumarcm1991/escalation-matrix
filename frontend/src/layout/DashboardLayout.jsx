import { useContext } from "react";
import { AuthContext } from "../auth/AuthContext";
import { Outlet, Link } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Button,
  Box
} from "@mui/material";

const drawerWidth = 240;

export default function DashboardLayout() {
  const { user, logout } = useContext(AuthContext);

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: 1300 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Escalation Matrix
          </Typography>
          <Typography sx={{ mr: 2 }}>
            {user?.username}
          </Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, mt: 8 }
        }}
      >
        <List>
          <ListItem button component={Link} to="/escalations">
            <ListItemText primary="Escalations" />
          </ListItem>

          {user?.role === "admin" && (
            <>
              <ListItem button component={Link} to="/create">
                <ListItemText primary="Create Escalation" />
              </ListItem>

              <ListItem button component={Link} to="/audit-logs">
                <ListItemText primary="Audit Logs" />
              </ListItem>
            </>
          )}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
