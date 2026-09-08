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
import StudentPortal from './pages/StudentPortal.jsx';
import Programmes from './pages/Programmes.jsx';
import AcademicYears from './pages/AcademicYears.jsx';
import { useAuth } from './AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const STAFF_ROLES = ['Administrator', 'Lecturer', 'Accountant'];

// Student accounts land on their own profile instead of the staff dashboard.
function Home() {
  const { user } = useAuth();
  if (user?.role === 'Student') return <Navigate to="/me" replace />;
  return (
    <ProtectedRoute roles={STAFF_ROLES}>
      <Layout><Dashboard /></Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/me"
        element={
          <ProtectedRoute roles={['Student']}>
            <Layout><StudentPortal /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute roles={STAFF_ROLES}>
            <Layout><Students /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students/:id"
        element={
          <ProtectedRoute roles={STAFF_ROLES}>
            <Layout><StudentDetail /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={STAFF_ROLES}>
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
      <Route
        path="/programmes"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout><Programmes /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academic-years"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout><AcademicYears /></Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
