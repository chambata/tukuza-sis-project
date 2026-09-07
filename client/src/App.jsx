import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Staff from './pages/Staff.jsx';
import Finance from './pages/Finance.jsx';
import Users from './pages/Users.jsx';
import Backups from './pages/Backups.jsx';
import AuditLog from './pages/AuditLog.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <Layout><Students /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/:id"
        element={
          <ProtectedRoute>
            <Layout><StudentDetail /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <Layout><Staff /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute roles={['Administrator', 'Accountant']}>
            <Layout><Finance /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout><Users /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/backups"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout><Backups /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout><AuditLog /></Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
