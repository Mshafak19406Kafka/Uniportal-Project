import React from 'react';
import { 
  LayoutDashboard, School, Building2, GraduationCap, 
  BookOpen, ClipboardList, Users, FileText, 
  Search, CalendarHeart, Hourglass, TrendingUp, LogOut, X
} from 'lucide-react';

export default function Sidebar({ user, activeView, onNavigate, onLogout, isOpen, onClose }) {
  const role = user?.role;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  const nav = (view) => { onNavigate(view); };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">U</div>
        <div style={{ flex: 1 }}>
          <h1>UniPortal</h1>
          <p>Course Registration</p>
        </div>
        <button className="sidebar-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {role === 'admin' && (
          <>
            <div className="sidebar-section-label">Administration</div>
            <button className={`sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => nav('dashboard')}>
              <span className="icon"><LayoutDashboard size={18} /></span> Dashboard
            </button>
            <button className={`sidebar-link ${activeView === 'colleges' ? 'active' : ''}`} onClick={() => nav('colleges')}>
              <span className="icon"><School size={18} /></span> Colleges
            </button>
            <button className={`sidebar-link ${activeView === 'departments' ? 'active' : ''}`} onClick={() => nav('departments')}>
              <span className="icon"><Building2 size={18} /></span> Departments
            </button>
            <button className={`sidebar-link ${activeView === 'programs' ? 'active' : ''}`} onClick={() => nav('programs')}>
              <span className="icon"><GraduationCap size={18} /></span> Programs
            </button>
            <div className="sidebar-section-label">Academic</div>
            <button className={`sidebar-link ${activeView === 'courses' ? 'active' : ''}`} onClick={() => nav('courses')}>
              <span className="icon"><BookOpen size={18} /></span> Courses
            </button>
            <button className={`sidebar-link ${activeView === 'sections' ? 'active' : ''}`} onClick={() => nav('sections')}>
              <span className="icon"><ClipboardList size={18} /></span> Sections
            </button>
            <button className={`sidebar-link ${activeView === 'users' ? 'active' : ''}`} onClick={() => nav('users')}>
              <span className="icon"><Users size={18} /></span> Users
            </button>
          </>
        )}

        {role === 'faculty' && (
          <>
            <div className="sidebar-section-label">Faculty</div>
            <button className={`sidebar-link ${activeView === 'my-sections' ? 'active' : ''}`} onClick={() => nav('my-sections')}>
              <span className="icon"><ClipboardList size={18} /></span> My Sections
            </button>
            <button className={`sidebar-link ${activeView === 'manage-courses' ? 'active' : ''}`} onClick={() => nav('manage-courses')}>
              <span className="icon"><BookOpen size={18} /></span> Manage Courses
            </button>
            <button className={`sidebar-link ${activeView === 'special-requests' ? 'active' : ''}`} onClick={() => nav('special-requests')}>
              <span className="icon"><FileText size={18} /></span> Special Requests
            </button>
          </>
        )}

        {role === 'student' && (
          <>
            <div className="sidebar-section-label">Registration</div>
            <button className={`sidebar-link ${activeView === 'browse' ? 'active' : ''}`} onClick={() => nav('browse')}>
              <span className="icon"><Search size={18} /></span> Browse Courses
            </button>
            <button className={`sidebar-link ${activeView === 'my-courses' ? 'active' : ''}`} onClick={() => nav('my-courses')}>
              <span className="icon"><CalendarHeart size={18} /></span> My Schedule
            </button>
            <button className={`sidebar-link ${activeView === 'waitlist' ? 'active' : ''}`} onClick={() => nav('waitlist')}>
              <span className="icon"><Hourglass size={18} /></span> Waitlist
            </button>
            <div className="sidebar-section-label">Academic</div>
            <button className={`sidebar-link ${activeView === 'degree-audit' ? 'active' : ''}`} onClick={() => nav('degree-audit')}>
              <span className="icon"><TrendingUp size={18} /></span> Degree Audit
            </button>
            <button className={`sidebar-link ${activeView === 'my-requests' ? 'active' : ''}`} onClick={() => nav('my-requests')}>
              <span className="icon"><FileText size={18} /></span> My Requests
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{role}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 10, display: 'flex', gap: 6, justifyContent: 'center' }} onClick={onLogout}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
