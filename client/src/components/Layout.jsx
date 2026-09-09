import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Box, IconButton, Avatar, Menu, MenuItem, Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import GroupIcon from '@mui/icons-material/Group';
import PaymentsIcon from '@mui/icons-material/Payments';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BackupIcon from '@mui/icons-material/Backup';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import EventIcon from '@mui/icons-material/Event';
import { useAuth } from '../AuthContext.jsx';
import {
  STAFF_ROLES, STUDENT, PROGRAMME_WRITE_ROLES, INTAKE_WRITE_ROLES,
  DEPARTMENT_WRITE_ROLES, FINANCE_ROLES, SYSTEM_ADMIN_ROLES,
} from '../roles.js';

const DRAWER_WIDTH = 230;

const NAV_ITEMS = [
  { label: 'My Profile', path: '/me', icon: <PersonIcon />, roles: [STUDENT] },
  { label: 'Dashboard', path: '/', icon: <DashboardIcon />, roles: STAFF_ROLES },
  { label: 'Students', path: '/students', icon: <SchoolIcon />, roles: STAFF_ROLES },
  { label: 'Academic Staff', path: '/staff', icon: <GroupIcon />, roles: STAFF_ROLES },
  { label: 'Finance', path: '/finance', icon: <PaymentsIcon />, roles: FINANCE_ROLES },
  { label: 'Programmes', path: '/programmes', icon: <SchoolIcon />, roles: PROGRAMME_WRITE_ROLES },
  { label: 'Departments', path: '/departments', icon: <BusinessIcon />, roles: DEPARTMENT_WRITE_ROLES },
  { label: 'Intakes', path: '/intakes', icon: <EventIcon />, roles: INTAKE_WRITE_ROLES },
  { label: 'Academic Years', path: '/academic-years', icon: <HistoryIcon />, roles: SYSTEM_ADMIN_ROLES },
  { label: 'User Accounts', path: '/users', icon: <AdminPanelSettingsIcon />, roles: SYSTEM_ADMIN_ROLES },
  { label: 'Backups', path: '/backups', icon: <BackupIcon />, roles: SYSTEM_ADMIN_ROLES },
  { label: 'Audit Log', path: '/audit', icon: <HistoryIcon />, roles: SYSTEM_ADMIN_ROLES },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }} elevation={1}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700 }}>
            Tukuza SIS <Typography component="span" variant="body2" sx={{ opacity: 0.8 }}>— Fountain of Peace University College</Typography>
          </Typography>
          <Chip label={user?.role} size="small" color="secondary" sx={{ mr: 2, fontWeight: 600 }} />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {(user?.full_name || user?.username || '?').charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>{user?.full_name || user?.username}</MenuItem>
            <MenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
