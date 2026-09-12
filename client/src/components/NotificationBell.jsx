import React, { useEffect, useState, useCallback } from 'react';
import { IconButton, Badge, Menu, MenuItem, Typography, Box, Divider, Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import api from '../api';

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(() => {
    api.get('/notifications').then((res) => {
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // light polling, once a minute
    return () => clearInterval(interval);
  }, [load]);

  async function open(e) {
    setAnchorEl(e.currentTarget);
  }

  async function markRead(n) {
    if (!n.is_read) {
      await api.put(`/notifications/${n.id}/read`);
      load();
    }
  }

  async function markAllRead() {
    await api.put('/notifications/read-all');
    load();
  }

  return (
    <>
      <IconButton onClick={open} sx={{ color: 'white', mr: 1 }}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 360, maxHeight: 420 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography fontWeight={600}>Notifications</Typography>
          {unreadCount > 0 && <Button size="small" onClick={markAllRead}>Mark all read</Button>}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>
          </MenuItem>
        ) : (
          notifications.map((n) => (
            <MenuItem key={n.id} onClick={() => markRead(n)} sx={{ whiteSpace: 'normal', bgcolor: n.is_read ? 'transparent' : 'action.hover' }}>
              <Box>
                <Typography variant="body2">{n.message}</Typography>
                <Typography variant="caption" color="text.secondary">{new Date(n.created_at).toLocaleString()}</Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
