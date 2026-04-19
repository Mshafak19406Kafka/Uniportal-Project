import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';

import Sidebar from './components/Sidebar';
import NotificationsPanel from './components/NotificationsPanel';
import { ToastProvider, useToast } from './components/Toast';
import { Bell, Menu } from 'lucide-react';

// ─── Main App Layout Wrapper ─────────────────────────────────────────────
function DashboardLayout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Derive active view from path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeView = pathParts[1] || 'dashboard';

   const handleNavigate = (view) => {
    navigate(`/${user.role}/${view}`);
    setSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  const getPageTitle = () => {
    const titles = {
      'dashboard': 'Dashboard', 'colleges': 'Colleges', 'departments': 'Departments', 'programs': 'Programs',
      'courses': 'Courses', 'sections': 'Sections', 'users': 'Users',
      'my-sections': 'My Sections', 'manage-courses': 'Manage Courses', 'special-requests': 'Special Requests',
      'browse': 'Browse Courses', 'my-courses': 'My Schedule', 'waitlist': 'Waitlists',
      'degree-audit': 'Degree Audit', 'my-requests': 'My Requests'
    };
    return titles[activeView] || 'Dashboard';
  };

   return (
    <div className={`app-layout fade-in ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <Sidebar 
        user={user} 
        activeView={activeView} 
        onNavigate={handleNavigate} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h2>{getPageTitle()}</h2>
          </div>
          <div className="topbar-actions">
            {user.role === 'student' && (
              <button className="notif-bell" onClick={() => setShowNotifs(true)}>
                <span><Bell size={20} /></span>
              </button>
            )}
            <div className="sidebar-avatar" style={{ marginLeft: 8 }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
          </div>
        </header>
        
        <Routes>
          {user.role === 'admin' && (
            <>
              <Route path="dashboard" element={<AdminDashboard activeView="dashboard" />} />
              <Route path="colleges" element={<AdminDashboard activeView="colleges" />} />
              <Route path="departments" element={<AdminDashboard activeView="departments" />} />
              <Route path="programs" element={<AdminDashboard activeView="programs" />} />
              <Route path="courses" element={<AdminDashboard activeView="courses" />} />
              <Route path="sections" element={<AdminDashboard activeView="sections" />} />
              <Route path="users" element={<AdminDashboard activeView="users" />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </>
          )}
          {user.role === 'faculty' && (
            <>
              <Route path="my-sections" element={<FacultyDashboard activeView="my-sections" />} />
              <Route path="manage-courses" element={<FacultyDashboard activeView="manage-courses" />} />
              <Route path="special-requests" element={<FacultyDashboard activeView="special-requests" />} />
              <Route path="*" element={<Navigate to="my-sections" replace />} />
            </>
          )}
          {user.role === 'student' && (
            <>
              <Route path="browse" element={<StudentDashboard activeView="browse" />} />
              <Route path="my-courses" element={<StudentDashboard activeView="my-courses" />} />
              <Route path="waitlist" element={<StudentDashboard activeView="waitlist" />} />
              <Route path="degree-audit" element={<StudentDashboard activeView="degree-audit" />} />
              <Route path="my-requests" element={<StudentDashboard activeView="my-requests" />} />
              <Route path="*" element={<Navigate to="browse" replace />} />
            </>
          )}
        </Routes>
      </main>

      {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          setUser(JSON.parse(savedUser));
        } else {
          handleLogout();
        }
      } catch (e) { handleLogout(); }
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return null;

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={user ? <Navigate to={`/${user.role}`} replace /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/login" 
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={`/${user.role}`} replace />} 
          />
          <Route 
            path="/signup" 
            element={!user ? <Signup /> : <Navigate to={`/${user.role}`} replace />} 
          />
          
          {/* Protected Routes nested under role */}
          <Route
            path="/admin/*"
            element={user?.role === 'admin' ? <DashboardLayout user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />}
          />
          <Route
            path="/faculty/*"
            element={user?.role === 'faculty' ? <DashboardLayout user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />}
          />
          <Route
            path="/student/*"
            element={user?.role === 'student' ? <DashboardLayout user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />}
          />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
