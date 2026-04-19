import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', program_id: '' });
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/programs').then(r => setPrograms(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/signup', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><GraduationCap size={32} /></div>
          <h2>Create Account</h2>
          <p>Join UniPortal today</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="John Doe" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required id="signup-name" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="you@university.edu" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} required id="signup-email" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                id="signup-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })} id="signup-role">
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
            {form.role === 'student' && (
              <div className="form-group">
                <label className="form-label">Program</label>
                <select className="form-select" value={form.program_id}
                  onChange={e => setForm({ ...form, program_id: e.target.value })} id="signup-program">
                  <option value="">Select Program</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading} id="signup-submit">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
