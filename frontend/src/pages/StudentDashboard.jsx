import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import { BookOpen } from 'lucide-react';

// Custom SVG Icons
const ClockIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

const UserIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const AwardIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="7"/>
    <polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88"/>
  </svg>
);

const DoorOpenIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>
    <path d="M13 3v18"/>
    <path d="M9 10h2"/>
  </svg>
);

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
  const [modal, setModal] = useState(null); // 'prereq_override', 'reviews', 'payment'
  const [modalData, setModalData] = useState({});

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 });
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  // Payment
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [selectedUPIApp, setSelectedUPIApp] = useState(null);
  const [cardDetails, setCardDetails] = useState({ cardNumber: '', cardHolder: '', expiryDate: '', cvv: '' });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

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

  const fetchReviews = useCallback(async (courseId) => {
    try {
      const { data } = await api.get(`/student/reviews/${courseId}`);
      setReviews(data.reviews);
      setReviewStats(data.stats);
      setUserHasReviewed(data.userHasReviewed);
      if (data.userReview) {
        setNewReview({ rating: data.userReview.rating, comment: data.userReview.comment });
      } else {
        setNewReview({ rating: 5, comment: '' });
      }
    } catch (e) {}
  }, []);

  const submitReview = async (courseId) => {
    try {
      await api.post('/student/reviews', { courseId, rating: newReview.rating, comment: newReview.comment });
      toast('Review submitted successfully!', 'success');
      fetchReviews(courseId);
    } catch (e) {
      toast(e.response?.data?.error || 'Failed to submit review', 'error');
    }
  };

  const openReviewsModal = (courseId, courseName) => {
    setModal('reviews');
    setModalData({ courseId, courseName });
    fetchReviews(courseId);
  };

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
  }, [activeView, fetchBrowse, fetchMyCourses, fetchWaitlist, fetchAudit, fetchRequests, loadingView, fetchReviews]);

  const handleEnroll = async (sectionId) => {
    // Open payment modal instead of directly enrolling
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Calculate amount (₹2000 per credit)
    const amountPerCredit = 2000;
    const totalAmount = section.credits * amountPerCredit;
    
    setModal('payment');
    setModalData({ 
      sectionId, 
      courseName: section.course_name, 
      courseCode: section.course_code,
      credits: section.credits,
      amount: totalAmount,
      instructor: section.instructor_name
    });
    
    // Fetch payment methods
    try {
      const { data } = await api.get('/student/payment-methods');
      setPaymentMethods(data.methods);
    } catch (e) {}
  };

  const processPayment = async () => {
    if (!selectedPaymentMethod) {
      toast('Please select a payment method', 'error');
      return;
    }
    
    if (selectedPaymentMethod === 'UPI' && !selectedUPIApp) {
      toast('Please select a UPI app', 'error');
      return;
    }
    
    if ((selectedPaymentMethod === 'Credit Card' || selectedPaymentMethod === 'Debit Card') && 
        (!cardDetails.cardNumber || !cardDetails.cardHolder || !cardDetails.expiryDate || !cardDetails.cvv)) {
      toast('Please fill in all card details', 'error');
      return;
    }

    setProcessingPayment(true);
    
    try {
      const { data } = await api.post('/student/process-payment', {
        sectionId: modalData.sectionId,
        paymentMethod: selectedPaymentMethod,
        upiApp: selectedUPIApp,
        cardDetails
      });
      
      // Show success animation
      setProcessingPayment(false);
      setPaymentSuccess(true);
      setShowConfetti(true);
      
      // Hide confetti after 2 seconds
      setTimeout(() => setShowConfetti(false), 2000);
      
      // Close modal and reset after animation
      setTimeout(() => {
        setPaymentSuccess(false);
        setModal(null);
        setSelectedPaymentMethod(null);
        setSelectedUPIApp(null);
        setCardDetails({ cardNumber: '', cardHolder: '', expiryDate: '', cvv: '' });
        if (activeView === 'browse') fetchBrowse();
        if (activeView === 'my-courses') fetchMyCourses();
      }, 2500);
      
    } catch (e) {
      toast(e.response?.data?.error || 'Payment failed', 'error');
      setProcessingPayment(false);
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
                      {s.college_name && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {s.college_name} • {s.department_name} ({s.department_code})
                        </div>
                      )}
                    </div>
                    {s.avg_rating > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-amber)' }}>
                          {'★'.repeat(Math.round(s.avg_rating))}{'☆'.repeat(5 - Math.round(s.avg_rating))}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({s.review_count})</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="course-card-meta">
                    <span><ClockIcon size={14} className="mr-1" /> {s.schedule_time}</span>
                    <span><UserIcon size={14} className="mr-1" /> {s.instructor_name}</span>
                    <span><AwardIcon size={14} className="mr-1" /> {s.credits} Credits</span>
                  </div>
                  <div className="course-card-desc" style={{ minHeight: 40 }}>{s.description || 'No description available'}</div>
                  
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      style={{ flex: 1, fontSize: '0.75rem' }}
                      onClick={() => openReviewsModal(s.course_id, s.course_name)}
                    >
                      {s.avg_rating > 0 ? `${s.avg_rating}★ (${s.review_count} reviews)` : 'No reviews yet'} - View/Add
                    </button>
                  </div>
                  
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
                  {c.college_name && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {c.college_name} • {c.department_name} ({c.department_code})
                    </div>
                  )}
                </div>
                <span className="badge badge-emerald">Enrolled</span>
              </div>
              <div className="course-card-meta">
                <span><ClockIcon size={14} className="mr-1" /> {c.schedule_time}</span>
                <span><DoorOpenIcon size={14} className="mr-1" /> {c.room}</span>
                <span><UserIcon size={14} className="mr-1" /> {c.instructor_name}</span>
                <span><AwardIcon size={14} className="mr-1" /> {c.credits} Credits</span>
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

      {modal === 'reviews' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Reviews: {modalData.courseName}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            
            {/* Stats */}
            <div style={{ padding: '16px 20px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
                {reviewStats.average > 0 ? reviewStats.average : '-'}
              </div>
              <div>
                <div style={{ fontSize: '1rem', color: 'var(--accent-amber)' }}>
                  {reviewStats.average > 0 && ('★'.repeat(Math.round(reviewStats.average)) + '☆'.repeat(5 - Math.round(reviewStats.average)))}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {reviewStats.count} {reviewStats.count === 1 ? 'review' : 'reviews'}
                </div>
              </div>
            </div>

            {/* Add Review Form */}
            {activeView === 'my-courses' && !userHasReviewed && (
              <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Write a Review</h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 6, color: 'var(--text-secondary)' }}>Rating</label>
                  <div style={{ display: 'flex', gap: 4, fontSize: '1.5rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setNewReview({ ...newReview, rating: star })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: star <= newReview.rating ? 'var(--accent-amber)' : 'var(--text-muted)' }}
                      >
                        {star <= newReview.rating ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: 6, color: 'var(--text-secondary)' }}>Comment (optional)</label>
                  <textarea
                    className="form-input"
                    placeholder="Share your experience with this course..."
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                    style={{ minHeight: 80 }}
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => submitReview(modalData.courseId)}>
                  Submit Review
                </button>
              </div>
            )}

            {userHasReviewed && activeView === 'my-courses' && (
              <div style={{ padding: 12, background: 'rgba(16,185,129,0.1)', borderBottom: '1px solid var(--border-color)' }}>
                <span className="badge badge-emerald">You have reviewed this course</span>
              </div>
            )}

            {/* Reviews List */}
            <div style={{ maxHeight: 300, overflow: 'auto', padding: '0 20px' }}>
              {reviews.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <p>No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.student_name}</div>
                      <div style={{ color: 'var(--accent-amber)', fontSize: '0.9rem' }}>
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </div>
                    </div>
                    {r.comment && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        "{r.comment}"
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'payment' && (
        <div className="modal-overlay" onClick={(e) => !paymentSuccess && e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            {!paymentSuccess ? (
              <>
            <div className="modal-header">
              <h3 className="modal-title">Complete Payment</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            
            {/* Payment Summary */}
            <div style={{ padding: '16px 20px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Course</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{modalData.courseCode} - {modalData.courseName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Instructor</div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{modalData.instructor}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Credits</div>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>{modalData.credits} Credits</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 600 }}>Total Amount</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{modalData.amount}</span>
              </div>
            </div>

            {/* Payment Methods */}
            <div style={{ padding: '16px 20px', maxHeight: 400, overflow: 'auto' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem' }}>Select Payment Method</h4>
              
              {paymentMethods.map((method) => (
                <div key={method.id} style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      setSelectedPaymentMethod(method.id);
                      setSelectedUPIApp(null);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      border: selectedPaymentMethod === method.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      background: selectedPaymentMethod === method.id ? 'rgba(99,102,241,0.05)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <img src={method.icon} alt={method.name} style={{ width: 32, height: 32 }} />
                    <span style={{ fontWeight: 500 }}>{method.name}</span>
                    {selectedPaymentMethod === method.id && <span style={{ marginLeft: 'auto', color: 'var(--accent-primary)' }}>✓</span>}
                  </button>
                  
                  {/* UPI Apps */}
                  {selectedPaymentMethod === 'UPI' && method.id === 'UPI' && (
                    <div style={{ marginTop: 12, paddingLeft: 12 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Select UPI App:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {method.apps.map((app) => (
                          <button
                            key={app.id}
                            onClick={() => setSelectedUPIApp(app.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: 10,
                              border: selectedUPIApp === app.id ? '2px solid ' + app.color : '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              background: selectedUPIApp === app.id ? app.color + '10' : 'var(--bg-elevated)',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: selectedUPIApp === app.id ? app.color : 'inherit'
                            }}
                          >
                            <img src={app.icon} alt={app.name} style={{ width: 20, height: 20 }} />
                            {app.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Card Form */}
                  {(selectedPaymentMethod === 'Credit Card' || selectedPaymentMethod === 'Debit Card') && 
                   (method.id === 'Credit Card' || method.id === 'Debit Card') && (
                    <div style={{ marginTop: 12, paddingLeft: 12 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Enter Card Details:</div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <input
                          type="text"
                          placeholder="Card Number"
                          value={cardDetails.cardNumber}
                          onChange={(e) => setCardDetails({...cardDetails, cardNumber: e.target.value})}
                          className="form-input"
                          maxLength={16}
                        />
                        <input
                          type="text"
                          placeholder="Card Holder Name"
                          value={cardDetails.cardHolder}
                          onChange={(e) => setCardDetails({...cardDetails, cardHolder: e.target.value})}
                          className="form-input"
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={cardDetails.expiryDate}
                            onChange={(e) => setCardDetails({...cardDetails, expiryDate: e.target.value})}
                            className="form-input"
                            maxLength={5}
                          />
                          <input
                            type="password"
                            placeholder="CVV"
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                            className="form-input"
                            maxLength={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={processingPayment}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={processPayment}
                disabled={processingPayment || !selectedPaymentMethod}
              >
                {processingPayment ? 'Processing...' : `Pay ₹${modalData.amount}`}
              </button>
            </div>
              </>
            ) : (
              /* Payment Success Animation */
              <div style={{ padding: 60, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                {/* Confetti Burst */}
                {showConfetti && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {[...Array(24)].map((_, i) => {
                      const angle = (i / 24) * Math.PI * 2;
                      const distance = 80 + Math.random() * 60;
                      const tx = Math.cos(angle) * distance;
                      const ty = Math.sin(angle) * distance;
                      const colors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];
                      const shapes = ['50%', '0', '2px'];
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: 6 + Math.random() * 4,
                            height: 6 + Math.random() * 4,
                            borderRadius: shapes[i % 3],
                            background: colors[i % 4],
                            animation: `confetti${i} 1.2s ease-out forwards`,
                            animationDelay: `${i * 25}ms`,
                            transform: 'translate(-50%, -50%) scale(0)'
                          }}
                        >
                          <style>{`
                            @keyframes confetti${i} {
                              0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 1; }
                              20% { transform: translate(-50%, -50%) scale(1) rotate(${i * 20}deg); opacity: 1; }
                              100% { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.5) rotate(${i * 40}deg); opacity: 0; }
                            }
                          `}</style>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Success Circle with Checkmark */}
                <div 
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    animation: 'successPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                    boxShadow: '0 20px 40px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <svg 
                    width="50" 
                    height="50" 
                    viewBox="0 0 50 50" 
                    fill="none"
                    style={{ animation: 'checkmarkDraw 0.4s ease-out 0.3s forwards', strokeDasharray: 60, strokeDashoffset: 60 }}
                  >
                    <path 
                      d="M15 25 L22 32 L35 18" 
                      stroke="white" 
                      strokeWidth="4" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                
                {/* Success Text */}
                <h3 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#10B981',
                  animation: 'slideUpFade 0.5s ease-out 0.4s forwards',
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}>
                  Payment Successful!
                </h3>
                
                <p style={{ 
                  margin: '0 0 4px 0',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  animation: 'slideUpFade 0.5s ease-out 0.5s forwards',
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}>
                  ₹{modalData.amount}
                </p>
                
                <p style={{ 
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  animation: 'slideUpFade 0.5s ease-out 0.6s forwards',
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}>
                  Paid to {modalData.instructor}
                </p>
                
                {/* Keyframe styles for success animation */}
                <style>{`
                  @keyframes successPop {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.15); }
                    100% { transform: scale(1); opacity: 1; }
                  }
                  @keyframes checkmarkDraw {
                    to { stroke-dashoffset: 0; }
                  }
                  @keyframes slideUpFade {
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
