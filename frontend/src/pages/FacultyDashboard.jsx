import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import { ClipboardList, Clock, DoorOpen, Users, CheckCircle2, BookOpen } from 'lucide-react';

export default function FacultyDashboard({ activeView }) {
  const toast = useToast();
  const [sections, setSections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modalType, setModalType] = useState(null); // 'roster' | 'waitlist'
  const [activeSection, setActiveSection] = useState(null);
  const [modalData, setModalData] = useState([]);

  // Form states for Manage Courses
  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', description: '', credits: 3, department_id: '', new_department_name: '', category: 'Core' });
  const [sectionForm, setSectionForm] = useState({ course_id: '', semester: 'Fall', year: new Date().getFullYear(), max_seats: 30, schedule_time: '', room: '' });

  const fetchSections = useCallback(async () => {
    try { const { data } = await api.get('/faculty/my-sections'); setSections(data); } catch (e) {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try { const { data } = await api.get('/faculty/special-requests'); setRequests(data); } catch (e) {}
  }, []);

  const fetchDependencies = useCallback(async () => {
    try {
      const [deptRes, courseRes] = await Promise.all([
        api.get('/faculty/departments'),
        api.get('/faculty/courses')
      ]);
      setDepartments(deptRes.data);
      setCourses(courseRes.data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    setLoading(true);
    if (activeView === 'special-requests') fetchRequests().then(() => setLoading(false));
    else if (activeView === 'manage-courses') fetchDependencies().then(() => setLoading(false));
    else fetchSections().then(() => setLoading(false));
  }, [activeView, fetchSections, fetchRequests, fetchDependencies]);

  const viewRoster = async (section) => {
    try {
      const { data } = await api.get(`/faculty/my-sections/${section.id}/students`);
      setModalData(data);
      setActiveSection(section);
      setModalType('roster');
    } catch (e) { toast('Failed to load roster', 'error'); }
  };

  const viewWaitlist = async (section) => {
    try {
      const { data } = await api.get(`/faculty/my-sections/${section.id}/waitlist`);
      setModalData(data);
      setActiveSection(section);
      setModalType('waitlist');
    } catch (e) { toast('Failed to load waitlist', 'error'); }
  };

  const handleRequest = async (id, status) => {
    if (!confirm(`Are you sure you want to ${status} this request?`)) return;
    const note = prompt('Optional: Enter a note for the student');
    try {
      await api.put(`/faculty/special-requests/${id}`, { status, faculty_note: note });
      toast(`Request ${status}`, 'success');
      fetchRequests();
    } catch (e) { toast('Failed to update request', 'error'); }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await api.post('/faculty/courses', courseForm);
      toast('Course created successfully', 'success');
      setCourseForm({ course_code: '', course_name: '', description: '', credits: 3, department_id: '', new_department_name: '', category: 'Core' });
      fetchDependencies();
    } catch (e) { toast(e.response?.data?.error || 'Failed to create course', 'error'); }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    try {
      await api.post('/faculty/sections', sectionForm);
      toast('Section created and assigned to you!', 'success');
      setSectionForm({ course_id: '', semester: 'Fall', year: new Date().getFullYear(), max_seats: 30, schedule_time: '', room: '' });
    } catch (e) { toast(e.response?.data?.error || 'Failed to create section', 'error'); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="slide-up">
      {activeView === 'my-sections' && (
        <div className="course-grid">
          {sections.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}><div className="icon"><ClipboardList size={48} strokeWidth={1.5} /></div><p>No sections assigned</p></div>
          ) : sections.map(s => (
            <div key={s.id} className="course-card">
              <div className="course-card-top">
                <div>
                  <div className="course-card-code">{s.course_code} • {s.category}</div>
                  <div className="course-card-name">{s.course_name}</div>
                </div>
              </div>
              <div className="course-card-meta">
                <span><Clock size={14} className="mr-1" /> {s.schedule_time}</span>
                <span><DoorOpen size={14} className="mr-1" /> {s.room}</span>
                <span><Users size={14} className="mr-1" /> {s.semester} {s.year}</span>
              </div>
              <div className="seats-info">
                <div className="seats-bar">
                  <div className="seats-fill" style={{ width: `${(s.enrolled_count / s.max_seats) * 100}%`, background: 'var(--accent-primary)' }}></div>
                </div>
                <div className="seats-text">{s.enrolled_count}/{s.max_seats} Enrolled</div>
              </div>
              {s.waitlist_count > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)', marginBottom: 14 }}>{s.waitlist_count} students on waitlist</div>}
              
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => viewRoster(s)}>View Roster</button>
                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => viewWaitlist(s)}>Waitlist</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'manage-courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* Create Course Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Propose New Course</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Add a new course to the university catalog.</p>
            </div>
            <form onSubmit={handleCreateCourse} style={{ padding: 20 }}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Course Code</label>
                  <input className="form-input" required placeholder="e.g. CS500" value={courseForm.course_code} onChange={e => setCourseForm({...courseForm, course_code: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Credits</label>
                  <input type="number" required className="form-input" min="1" max="6" value={courseForm.credits} onChange={e => setCourseForm({...courseForm, credits: +e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Course Name</label>
                <input className="form-input" required placeholder="Advanced Topics" value={courseForm.course_name} onChange={e => setCourseForm({...courseForm, course_name: e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Department</label>
                  <select className="form-select" required value={courseForm.department_id} onChange={e => setCourseForm({...courseForm, department_id: e.target.value})}>
                    <option value="">Select Dept</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    <option value="custom">Custom Department</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-select" value={courseForm.category} onChange={e => setCourseForm({...courseForm, category: e.target.value})}>
                    <option value="Core">Core</option><option value="Elective">Elective</option>
                    <option value="General Ed">General Ed</option><option value="Lab">Lab</option>
                  </select>
                </div>
              </div>
              {courseForm.department_id === 'custom' && (
                <div className="form-group fade-in"><label className="form-label">Custom Department Name</label>
                  <input className="form-input" required placeholder="e.g. Artificial Intelligence Dept" value={courseForm.new_department_name} onChange={e => setCourseForm({...courseForm, new_department_name: e.target.value})} /></div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Create Course</button>
            </form>
          </div>

          {/* Create Section Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Open New Section</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Create a new section for an existing course (auto-assigned to you).</p>
            </div>
            <form onSubmit={handleCreateSection} style={{ padding: 20 }}>
              <div className="form-group"><label className="form-label">Course</label>
                <select className="form-select" required value={sectionForm.course_id} onChange={e => setSectionForm({...sectionForm, course_id: e.target.value})}>
                  <option value="">Select Existing Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Semester</label>
                  <select className="form-select" value={sectionForm.semester} onChange={e => setSectionForm({...sectionForm, semester: e.target.value})}>
                    <option value="Fall">Fall</option><option value="Spring">Spring</option><option value="Summer">Summer</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Year</label>
                  <input type="number" required className="form-input" value={sectionForm.year} onChange={e => setSectionForm({...sectionForm, year: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Schedule</label>
                  <input className="form-input" required placeholder="e.g. Mon/Wed 10am" value={sectionForm.schedule_time} onChange={e => setSectionForm({...sectionForm, schedule_time: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Room</label>
                  <input className="form-input" required placeholder="e.g. Rm 101" value={sectionForm.room} onChange={e => setSectionForm({...sectionForm, room: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Max Seats</label>
                <input type="number" required className="form-input" value={sectionForm.max_seats} onChange={e => setSectionForm({...sectionForm, max_seats: +e.target.value})} /></div>
              <button type="submit" className="btn btn-indigo" style={{ width: '100%' }}>Create Section</button>
            </form>
          </div>
        </div>
      )}

      {activeView === 'special-requests' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Student</th><th>Course</th><th>Semester</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {requests.length === 0 && <tr><td colSpan="6"><div className="empty-state"><div className="icon"><CheckCircle2 size={48} strokeWidth={1.5} /></div><p>No pending requests</p></div></td></tr>}
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.student_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.student_email}</div>
                    </td>
                    <td>{r.course_code} - {r.course_name}</td>
                    <td>{r.semester} {r.year}</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: '0.8rem' }}>{r.reason}</td>
                    <td>
                      <span className={`badge ${r.status === 'pending' ? 'badge-amber' : r.status === 'approved' ? 'badge-emerald' : 'badge-rose'}`}>{r.status}</span>
                    </td>
                    <td>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-xs" onClick={() => handleRequest(r.id, 'approved')}>Approve</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleRequest(r.id, 'denied')}>Deny</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalType && activeSection && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalType(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">
                {modalType === 'roster' ? 'Enrolled Students' : 'Waitlisted Students'} 
                : {activeSection.course_code} ({activeSection.semester} {activeSection.year})
              </h3>
              <button className="modal-close" onClick={() => setModalType(null)}>✕</button>
            </div>
            
            <div className="table-container">
              {modalType === 'roster' ? (
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Program</th></tr></thead>
                  <tbody>
                    {modalData.map(st => (
                      <tr key={st.id}>
                        <td style={{ fontWeight: 500 }}>{st.name}</td>
                        <td>{st.email}</td>
                        <td>{st.program_name || '—'}</td>
                      </tr>
                    ))}
                    {modalData.length === 0 && <tr><td colSpan="3"><div className="empty-state"><p>No students enrolled</p></div></td></tr>}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Position</th><th>Student Name</th><th>Joined At</th><th>Reserved Until</th></tr></thead>
                  <tbody>
                    {modalData.map(w => (
                      <tr key={w.id}>
                        <td><span className="badge badge-amber">#{w.position}</span></td>
                        <td style={{ fontWeight: 500 }}>{w.name}<br/><span style={{fontSize:'0.75rem',fontWeight:400,color:'var(--text-muted)'}}>{w.email}</span></td>
                        <td>{new Date(w.joined_at).toLocaleString()}</td>
                        <td>{w.reserved_until ? <span className="badge badge-emerald">{new Date(w.reserved_until).toLocaleString()}</span> : '—'}</td>
                      </tr>
                    ))}
                    {modalData.length === 0 && <tr><td colSpan="4"><div className="empty-state"><p>Waitlist is empty</p></div></td></tr>}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setModalType(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
