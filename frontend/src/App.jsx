import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import { Spin } from 'antd';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import RepoManagement from './pages/admin/RepoManagement';
import CommitFetch from './pages/admin/CommitFetch';
import AccountManagement from './pages/user/AccountManagement';
import CommitsTable from './pages/user/CommitsTable';
import MemoManagement from './pages/user/MemoManagement';
import ReservationsTable from './pages/user/ReservationsTable';
import ReservationCron from './pages/user/ReservationCron';
import SuccessfulTasks from './pages/SuccessfulTasks';
import Statistics from './pages/Statistics';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global API Loading Overlay */}
        <div
          id="global-loader"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'none',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            flexDirection: 'column',
            gap: 16
          }}
        >
          <Spin size="large" style={{ color: '#16a34a' }} />
          <div style={{ color: 'rgb(148, 163, 184)', fontSize: 14, marginTop: 8 }}>
            Loading...
          </div>
        </div>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Admin routes */}
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/repos" element={<RepoManagement />} />
            <Route path="admin/commits/fetch" element={<CommitFetch />} />
            
            {/* User routes */}
            <Route path="accounts" element={<AccountManagement />} />
            <Route path="commits" element={<CommitsTable />} />
            <Route path="memo" element={<MemoManagement />} />
            <Route path="reservations" element={<ReservationsTable />} />
            <Route path="reservation-cron" element={<ReservationCron />} />
            
            {/* Common routes */}
            <Route path="successful-tasks" element={<SuccessfulTasks />} />
            <Route path="statistics" element={<Statistics />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
