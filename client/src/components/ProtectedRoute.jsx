import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Box } from '@mui/material';

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You are signed in as {user.role} and do not have access to this page.
        </Alert>
      </Box>
    );
  }
  return children;
}
