import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import Departments from './pages/Departments.jsx';
import Intakes from './pages/Intakes.jsx';
import Courses from './pages/Courses.jsx';
import GradeScales from './pages/GradeScales.jsx';
import { useAuth } from './AuthContext.jsx';
import {
  STAFF_ROLES, STUDENT, FINANCE_ROLES, PROGRAMME_WRITE_ROLES, INTAKE_WRITE_ROLES,
  DEPARTMENT_WRITE_ROLES, SYSTEM_ADMIN_ROLES, GRADE_SCALE_WRITE_ROLES,
} from './roles.js';

// Student accounts land on their own profile instead of the staff dashboard.
function Home() {
  const { user } = useAuth();
  if (user?.role === STUDENT) return <Navigate to="/me" replace />;
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
          <ProtectedRoute roles={[STUDENT]}>
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
          <ProtectedRoute roles={FINANCE_ROLES}>
            <Layout><Finance /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={SYSTEM_ADMIN_ROLES}>
            <Layout><Users /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/backups"
        element={
          <ProtectedRoute roles={SYSTEM_ADMIN_ROLES}>
            <Layout><Backups /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute roles={SYSTEM_ADMIN_ROLES}>
            <Layout><AuditLog /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/programmes"
        element={
          <ProtectedRoute roles={PROGRAMME_WRITE_ROLES}>
            <Layout><Programmes /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/departments"
        element={
          <ProtectedRoute roles={DEPARTMENT_WRITE_ROLES}>
            <Layout><Departments /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/intakes"
        element={
          <ProtectedRoute roles={INTAKE_WRITE_ROLES}>
            <Layout><Intakes /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses"
        element={
          <ProtectedRoute roles={STAFF_ROLES}>
            <Layout><Courses /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grade-scale"
        element={
          <ProtectedRoute roles={GRADE_SCALE_WRITE_ROLES}>
            <Layout><GradeScales /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/academic-years"
        element={
          <ProtectedRoute roles={SYSTEM_ADMIN_ROLES}>
            <Layout><AcademicYears /></Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
