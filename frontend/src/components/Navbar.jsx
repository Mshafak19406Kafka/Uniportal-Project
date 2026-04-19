import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <h2><Link to="/" style={{textDecoration: 'none', color: 'inherit'}}>College Registration</Link></h2>
      <div className="nav-links">
        {user ? (
          <>
            <span>Welcome, {user.role === 'admin' ? 'Admin' : 'Student'}</span>
            <button onClick={handleLogoutClick} className="btn btn-danger" style={{padding: '0.5rem 1rem'}}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-primary" style={{padding: '0.5rem 1rem', textDecoration: 'none'}}>Login</Link>
            <Link to="/signup" className="btn" style={{padding: '0.5rem 1rem', textDecoration: 'none'}}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
