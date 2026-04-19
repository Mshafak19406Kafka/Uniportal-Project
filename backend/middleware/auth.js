const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_university_sis_2024';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded; // { id, role }
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
};

const isFaculty = (req, res, next) => {
  if (req.user && req.user.role === 'faculty') return next();
  res.status(403).json({ error: 'Faculty access required' });
};

const isFacultyOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'admin')) return next();
  res.status(403).json({ error: 'Faculty or Admin access required' });
};

const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'student') return next();
  res.status(403).json({ error: 'Student access required' });
};

module.exports = { verifyToken, isAdmin, isFaculty, isFacultyOrAdmin, isStudent, JWT_SECRET };
