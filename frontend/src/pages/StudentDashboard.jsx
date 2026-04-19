import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import { BookOpen, Clock, User, Award, DoorOpen, Users } from 'lucide-react';

export default function StudentDashboard({ activeView }) {
  const toast = useToast();
  const [sections, setSections] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [requests, setRequests] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search/Filter for Browse
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterSem, setFilterSem] = useState('Fall');

  // Modal
  const [modal, setModal] = useState(null); // 'prereq_override'
  const [modalData, setModalData] = useState({});

  const fetchBrowse = useCallback(async () => {
    try {
      const { data } = await api.get('/student/sections', { params: { search, category: filterCat, semester: filterSem } });
      setSections(data);
    } catch (e) {}
  }, [search, filterCat, filterSem]);

  const fetchMyCourses = useCallback(async () => {
    try { const { data } = await api.get('/student/my-courses'); setMyCourses(data.courses); } catch (e) {}
  }, []);

  const fetchWaitlist = useCallback(async () => {
    try { const { data } = await api.get('/student/waitlist'); setWaitlist(data); } catch (e) {}
  }, []);

  const fetchAudit = useCallback(async () => {
    try { const { data } = await api.get('/student/degree-audit'); setAudit(data); } catch (e) {}
  }, []);

  const fetchRequests = useCallback(async () => {
    try { const { data } = await api.get('/student/special-requests'); setRequests(data); } catch (e) {}
  }, []);

  const [loadingView, setLoadingView] = useState(activeView);

  useEffect(() => {
    if (loadingView !== activeView) {
      setLoading(true);
      setLoadingView(activeView);
    }
    
    const m = {
      'browse': fetchBrowse,
      'my-courses': fetchMyCourses,
      'waitlist': fetchWaitlist,
      'degree-audit': fetchAudit,
      'my-requests': fetchRequests
    };
    if (m[activeView]) {
      m[activeView]().finally(() => setLoading(false));
    }
  }, [activeView, fetchBrowse, fetchMyCourses, fetchWaitlist, fetchAudit, fetchRequests, loadingView]);

  const handleEnroll = async (sectionId) => {
    try {
      const { data } = await api.post('/student/enroll', { sectionId });
      toast(data.message, 'success');
      if (activeView === 'browse') fetchBrowse();
    } catch (e) {
      const resp = e.response?.data;
      if (resp?.can_request_override) {
        setModal('prereq_override');
        setModalData({ sectionId, missing: resp.missing_prereqs, msg: resp.error });
      } else {
        toast(resp?.error || 'Enrollment failed', 'error');
      }
    }
  };

  const handleDrop = async (sectionId) => {
    if (!confirm('Are you sure you want to drop this course?')) return;
    try {
      await api.delete(`/student/drop/${sectionId}`);
      toast('Course dropped', 'success');
      fetchMyCourses();
    } catch (e) { toast(e.response?.data?.error || 'Drop failed', 'error'); }
  };

  const submitOverride = async () => {
    if (!modalData.reason) return toast('Please enter a reason', 'error');
    try {
      await api.post('/student/special-request', { sectionId: modalData.sectionId, reason: modalData.reason });
      toast('Override request submitted to faculty', 'success');
      setModal(null);
    } catch (e) { toast(e.response?.data?.error || 'Failed to submit request', 'error'); }
  };

  const handleConfirmReservation = async (waitlistId) => {
    try {
      await api.post(`/student/confirm-reservation/${waitlistId}`);
      toast('Reservation confirmed!', 'success');
      fetchWaitlist();
    } catch (e) { toast(e.response?.data?.error || 'Failed to confirm', 'error'); }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div className="slide-up">
      {activeView === 'browse' && (
        <>
          <div className="filter-bar">
            <div className="search-wrapper">
              <input className="search-input" placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={filterSem} onChange={e => setFilterSem(e.target.value)}>
              <option value="Fall">Fall</option><option value="Spring">Spring</option><option value="Summer">Summer</option>
            </select>
            <select className="filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option><option value="Core">Core</option><option value="Elective">Elective</option>
              <option value="General Ed">General Ed</option><option value="Lab">Lab</option>
            </select>
          </div>

          <div className="course-grid">
            {sections.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1' }}><p>No courses found</p></div>}
            {sections.map(s => {
              const full = s.enrolled_count >= s.max_seats;
              return (
                <div key={s.id} className="course-card">
                  <div className="course-card-top">
                    <div>
                      <div className="course-card-code">{s.course_code} • {s.category}</div>
                      <div className="course-card-name">{s.course_name}</div>
                    </div>
                  </div>
                  <div className="course-card-meta">
                    <span><Clock size={14} className="mr-1" /> {s.schedule_time}</span>
                    <span><User size={14} className="mr-1" /> {s.instructor_name}</span>
                    <span><Award size={14} className="mr-1" /> {s.credits} Credits</span>
                  </div>
                  <div className="course-card-desc" style={{ minHeight: 40 }}>{s.description || 'No description available'}</div>
                  
                  {s.prerequisites && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                      <strong>Prerequisites:</strong> {s.prerequisites}
                    </div>
                  )}

                  <div className="seats-info">
                    <div className="seats-bar">
                      <div className={`seats-fill ${full ? 'full' : ''}`} style={{ width: `${Math.min(100, (s.enrolled_count / s.max_seats) * 100)}%`, background: full ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}></div>
                    </div>
                    <div className="seats-text">{s.enrolled_count}/{s.max_seats} Seats</div>
                  </div>

                  <button className={`btn ${full ? 'btn-warning' : 'btn-primary'}`} style={{ width: '100%' }} onClick={() => handleEnroll(s.id)}>
                    {full ? 'Join Waitlist' : 'Enroll Now'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeView === 'my-courses' && (
        <div className="course-grid">
          {myCourses.length === 0 && <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="icon"><BookOpen size={48} strokeWidth={1.5} /></div><p>You are not enrolled in any courses</p></div>}
          {myCourses.map(c => (
            <div key={c.enrollment_id} className="course-card">
              <div className="course-card-top">
                <div>
                  <div className="course-card-code">{c.course_code} • {c.category}</div>
                  <div className="course-card-name">{c.course_name}</div>
                </div>
                <span className="badge badge-emerald">Enrolled</span>
              </div>
              <div className="course-card-meta">
                <span><Clock size={14} className="mr-1" /> {c.schedule_time}</span>
                <span><DoorOpen size={14} className="mr-1" /> {c.room}</span>
                <span><User size={14} className="mr-1" /> {c.instructor_name}</span>
                <span><Award size={14} className="mr-1" /> {c.credits} Credits</span>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', color: 'var(--accent-rose)' }} onClick={() => handleDrop(c.section_id)}>
                Drop Course
              </button>
            </div>
          ))}
        </div>
      )}

      {activeView === 'waitlist' && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">My Waitlists</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Course</th><th>Semester</th><th>credits</th><th>Position</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {waitlist.length === 0 && <tr><td colSpan="6"><div className="empty-state"><p>You are not on any waitlists</p></div></td></tr>}
                {waitlist.map(w => {
                  const hasReservation = w.reserved_until !== null;
                  const expired = hasReservation && new Date(w.reserved_until) < new Date();
                  return (
                    <tr key={w.id}>
                      <td><div style={{ fontWeight: 600 }}>{w.course_code}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.course_name}</div></td>
                      <td>{w.semester} {w.year}</td>
                      <td>{w.credits}</td>
                      <td>{w.position === 1 ? '1st' : w.position === 2 ? '2nd' : w.position === 3 ? '3rd' : `${w.position}th`}</td>
                      <td>
                        {hasReservation && !expired ? (
                          <span className="badge badge-emerald">Seat Reserved!</span>
                        ) : (
                          <span className="waitlist-chip">Waitlisted</span>
                        )}
                      </td>
                      <td>
                        {hasReservation && !expired && (
                          <button className="btn btn-success btn-xs" onClick={() => handleConfirmReservation(w.id)}>Confirm Enrollment</button>
                        )}
                        {hasReservation && !expired && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent-rose)', marginTop: 4 }}>
                            Expires: {new Date(w.reserved_until).toLocaleString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'my-requests' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead><tr><th>Course</th><th>Semester</th><th>Reason</th><th>Status</th><th>Faculty Note</th></tr></thead>
              <tbody>
                {requests.length === 0 && <tr><td colSpan="5"><div className="empty-state"><p>No special requests</p></div></td></tr>}
                {requests.map(r => (
                  <tr key={r.id}>
                    <td><div style={{ fontWeight: 600 }}>{r.course_code}</div></td>
                    <td>{r.semester} {r.year}</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: '0.8rem' }}>{r.reason}</td>
                    <td><span className={`badge ${r.status === 'pending' ? 'badge-amber' : r.status === 'approved' ? 'badge-emerald' : 'badge-rose'}`}>{r.status}</span></td>
                    <td style={{ maxWidth: 200, whiteSpace: 'normal', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.faculty_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'degree-audit' && audit && (
        <div className="card">
          {audit.enrolled ? (
            <>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Degree Audit</h3>
                  <div className="card-subtitle">{audit.program.name} ({audit.program.degree_type})</div>
                </div>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
                <div className="audit-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="ring-bg" />
                    <circle className="ring-fill" strokeDasharray="283" strokeDashoffset={283 - (283 * audit.overall_progress) / 100} />
                  </svg>
                  <div className="audit-percent" style={{ color: audit.overall_progress >= 100 ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>{audit.overall_progress}%</div>
                  <div className="audit-label">Complete</div>
                </div>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{audit.total_completed} / {audit.total_required} Credits Earned</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Keep up the good work! Review your required categories below.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
                {audit.audit.map(cat => {
                  const perc = Math.min(100, (cat.completed / cat.required) * 100);
                  const complete = perc >= 100;
                  return (
                    <div key={cat.key} style={{ padding: 16, background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontSize: '0.8rem', color: complete ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                          {cat.completed} / {cat.required}
                        </div>
                      </div>
                      <div className="progress-bar" style={{ marginBottom: 16 }}>
                        <div className={`progress-fill ${complete ? 'emerald' : 'amber'}`} style={{ width: `${perc}%` }}></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Remaining Options:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {complete ? <span className="badge badge-emerald">Requirement Satisfied</span> :
                         cat.remaining_courses.slice(0, 5).map(c => <span key={c.id} className="badge badge-slate">{c.course_code}</span>)}
                        {!complete && cat.remaining_courses.length > 5 && <span className="badge badge-slate">+{cat.remaining_courses.length - 5} more</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state"><p>{audit.message}</p></div>
          )}
        </div>
      )}

      {modal === 'prereq_override' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Prerequisite Override Request</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', color: 'var(--accent-rose)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.85rem' }}>
              {modalData.msg}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              You do not meet the prerequisites for this course. You can submit a Special Request to the instructor if you believe you have equivalent experience.
            </p>
            <div className="form-group">
              <label className="form-label">Reason for Override</label>
              <textarea className="form-input" placeholder="Explain why you should be allowed to take this course..." value={modalData.reason || ''} onChange={e => setModalData({ ...modalData, reason: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitOverride}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
