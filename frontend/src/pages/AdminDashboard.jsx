import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import { Users, GraduationCap, BookOpen, ClipboardList, CheckCircle2, Inbox } from 'lucide-react';

export default function AdminDashboard({ activeView }) {
  const toast = useToast();
  const [stats, setStats] = useState({});
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [formData, setFormData] = useState({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, d, p, co, se, u] = await Promise.all([
        api.get('/admin/stats'), api.get('/admin/colleges'), api.get('/admin/departments'),
        api.get('/admin/programs'), api.get('/admin/courses'), api.get('/admin/sections'),
        api.get('/admin/users'),
      ]);
      setStats(s.data); setColleges(c.data); setDepartments(d.data);
      setPrograms(p.data); setCourses(co.data); setSections(se.data); setUsers(u.data);
    } catch (e) { toast('Failed to load data', 'error'); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── CRUD Helpers ───────────────────────────────────────────────────────
  const openCreate = (type) => { setFormData({}); setModal({ type, mode: 'create' }); };
  const openEdit = (type, item) => { setFormData({ ...item }); setModal({ type, mode: 'edit' }); };

  const handleSave = async () => {
    try {
      const { type, mode } = modal;
      const endpoint = `/admin/${type}`;
      if (mode === 'create') {
        await api.post(endpoint, formData);
        toast(`Created successfully`, 'success');
      } else {
        await api.put(`${endpoint}/${formData.id}`, formData);
        toast(`Updated successfully`, 'success');
      }
      setModal(null);
      fetchAll();
    } catch (e) { toast(e.response?.data?.error || 'Operation failed', 'error'); }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/admin/${type}/${id}`);
      toast('Deleted', 'success');
      fetchAll();
    } catch (e) { toast(e.response?.data?.error || 'Delete failed', 'error'); }
  };

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  // ─── Views ─────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="slide-up">
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon indigo"><Users size={24} /></div><div className="stat-value">{stats.students}</div><div className="stat-label">Students</div></div>
        <div className="stat-card"><div className="stat-icon cyan"><GraduationCap size={24} /></div><div className="stat-value">{stats.faculty}</div><div className="stat-label">Faculty</div></div>
        <div className="stat-card"><div className="stat-icon emerald"><BookOpen size={24} /></div><div className="stat-value">{stats.courses}</div><div className="stat-label">Courses</div></div>
        <div className="stat-card"><div className="stat-icon amber"><ClipboardList size={24} /></div><div className="stat-value">{stats.sections}</div><div className="stat-label">Sections</div></div>
        <div className="stat-card"><div className="stat-icon rose"><CheckCircle2 size={24} /></div><div className="stat-value">{stats.enrollments}</div><div className="stat-label">Enrollments</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3 className="card-title">Recent Users</h3></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Program</th></tr></thead>
            <tbody>
              {users.slice(0, 8).map(u => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'rose' : u.role === 'faculty' ? 'cyan' : 'indigo'}`}>{u.role}</span></td>
                  <td>{u.program_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCRUDTable = (type, items, columns) => (
    <div className="slide-up">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => openCreate(type)} id={`create-${type}`}>+ Add New</button>
      </div>
      <div className="card">
        <div className="table-container">
          <table>
            <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={columns.length + 1}><div className="empty-state"><div className="icon"><Inbox size={48} strokeWidth={1.5} /></div><p>No records yet</p></div></td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  {columns.map(c => (
                    <td key={c.key}>
                      {c.badge ? <span className={`badge ${c.badge(item)}`}>{item[c.key]}</span> :
                       c.key === 'name' || c.key === 'course_name' ? <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item[c.key]}</span> :
                       item[c.key] ?? '—'}
                    </td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(type, item)}>Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(type, item.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const getCurrentView = () => {
    switch (activeView) {
      case 'dashboard': return renderDashboard();
      case 'colleges': return renderCRUDTable('colleges', colleges, [
        { key: 'name', label: 'College Name' },
        { key: 'dean_name', label: 'Dean' },
      ]);
      case 'departments': return renderCRUDTable('departments', departments, [
        { key: 'name', label: 'Department' },
        { key: 'code', label: 'Code' },
        { key: 'college_name', label: 'College' },
      ]);
      case 'programs': return renderCRUDTable('programs', programs, [
        { key: 'name', label: 'Program Name' },
        { key: 'degree_type', label: 'Degree' },
        { key: 'total_credits_required', label: 'Credits Req.' },
        { key: 'department_name', label: 'Department' },
      ]);
      case 'courses': return renderCRUDTable('courses', courses, [
        { key: 'course_code', label: 'Code' },
        { key: 'course_name', label: 'Course Name' },
        { key: 'credits', label: 'Credits' },
        { key: 'category', label: 'Category', badge: (item) => {
          const m = { 'Core': 'badge-indigo', 'Elective': 'badge-cyan', 'General Ed': 'badge-amber', 'Lab': 'badge-emerald' };
          return m[item.category] || 'badge-slate';
        }},
        { key: 'department_name', label: 'Department' },
      ]);
      case 'sections': return renderCRUDTable('sections', sections, [
        { key: 'course_code', label: 'Course' },
        { key: 'semester', label: 'Semester' },
        { key: 'year', label: 'Year' },
        { key: 'instructor_name', label: 'Instructor' },
        { key: 'schedule_time', label: 'Schedule' },
        { key: 'room', label: 'Room' },
        { key: 'enrolled_count', label: 'Enrolled' },
      ]);
      case 'users': return (
        <div className="slide-up">
          <div className="card">
            <div className="table-container">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Program</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${u.role === 'admin' ? 'rose' : u.role === 'faculty' ? 'cyan' : 'indigo'}`}>{u.role}</span></td>
                      <td>{u.program_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
      default: return renderDashboard();
    }
  };

  // ─── Modal Forms ───────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modal) return null;
    const { type, mode } = modal;
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
        <div className="modal">
          <div className="modal-header">
            <h3 className="modal-title">{mode === 'create' ? 'Create' : 'Edit'} {type.slice(0, -1).replace(/^./, c => c.toUpperCase())}</h3>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
          </div>

          {type === 'colleges' && (
            <>
              <div className="form-group"><label className="form-label">Name</label>
                <input className="form-input" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Dean</label>
                <input className="form-input" value={formData.dean_name || ''} onChange={e => set('dean_name', e.target.value)} /></div>
            </>
          )}

          {type === 'departments' && (
            <>
              <div className="form-group"><label className="form-label">Name</label>
                <input className="form-input" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Code</label>
                <input className="form-input" value={formData.code || ''} onChange={e => set('code', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">College</label>
                <select className="form-select" value={formData.college_id || ''} onChange={e => set('college_id', e.target.value)}>
                  <option value="">Select College</option>
                  {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </>
          )}

          {type === 'programs' && (
            <>
              <div className="form-group"><label className="form-label">Name</label>
                <input className="form-input" value={formData.name || ''} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Degree Type</label>
                  <select className="form-select" value={formData.degree_type || 'Bachelor'} onChange={e => set('degree_type', e.target.value)}>
                    <option value="Bachelor">Bachelor</option><option value="Master">Master</option><option value="Doctorate">Doctorate</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Department</label>
                  <select className="form-select" value={formData.department_id || ''} onChange={e => set('department_id', e.target.value)}>
                    <option value="">Select</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Total Credits Req.</label>
                  <input type="number" className="form-input" value={formData.total_credits_required || 120} onChange={e => set('total_credits_required', +e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Core Credits</label>
                  <input type="number" className="form-input" value={formData.core_credits_required || 40} onChange={e => set('core_credits_required', +e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Elective Credits</label>
                  <input type="number" className="form-input" value={formData.elective_credits_required || 40} onChange={e => set('elective_credits_required', +e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Gen Ed Credits</label>
                  <input type="number" className="form-input" value={formData.gened_credits_required || 30} onChange={e => set('gened_credits_required', +e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Lab Credits</label>
                <input type="number" className="form-input" value={formData.lab_credits_required || 10} onChange={e => set('lab_credits_required', +e.target.value)} /></div>
            </>
          )}

          {type === 'courses' && (
            <>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Course Code</label>
                  <input className="form-input" value={formData.course_code || ''} onChange={e => set('course_code', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Credits</label>
                  <input type="number" className="form-input" value={formData.credits || 4} onChange={e => set('credits', +e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Course Name</label>
                <input className="form-input" value={formData.course_name || ''} onChange={e => set('course_name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Description</label>
                <textarea className="form-input" value={formData.description || ''} onChange={e => set('description', e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-select" value={formData.category || 'Elective'} onChange={e => set('category', e.target.value)}>
                    <option value="Core">Core</option><option value="Elective">Elective</option>
                    <option value="General Ed">General Ed</option><option value="Lab">Lab</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Department</label>
                  <select className="form-select" value={formData.department_id || ''} onChange={e => set('department_id', e.target.value)}>
                    <option value="">Select</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></div>
              </div>
            </>
          )}

          {type === 'sections' && (
            <>
              <div className="form-group"><label className="form-label">Course</label>
                <select className="form-select" value={formData.course_id || ''} onChange={e => set('course_id', +e.target.value)}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name}</option>)}
                </select></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Semester</label>
                  <select className="form-select" value={formData.semester || 'Fall'} onChange={e => set('semester', e.target.value)}>
                    <option value="Fall">Fall</option><option value="Spring">Spring</option><option value="Summer">Summer</option>
                  </select></div>
                <div className="form-group"><label className="form-label">Year</label>
                  <input type="number" className="form-input" value={formData.year || 2026} onChange={e => set('year', +e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Instructor</label>
                  <select className="form-select" value={formData.instructor_id || ''} onChange={e => set('instructor_id', +e.target.value || null)}>
                    <option value="">Select</option>
                    {users.filter(u => u.role === 'faculty').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Max Seats</label>
                  <input type="number" className="form-input" value={formData.max_seats || 30} onChange={e => set('max_seats', +e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Schedule (e.g. Mon 10-12)</label>
                  <input className="form-input" value={formData.schedule_time || ''} onChange={e => set('schedule_time', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Room</label>
                  <input className="form-input" value={formData.room || ''} onChange={e => set('room', e.target.value)} /></div>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} id="modal-save">
              {mode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {getCurrentView()}
      {renderModal()}
    </>
  );
}
