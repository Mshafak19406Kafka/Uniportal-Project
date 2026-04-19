const express = require('express');
const { allAsync, getAsync, runAsync } = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// ===================== COLLEGES =====================
router.get('/colleges', verifyToken, async (req, res) => {
  try {
    const colleges = await allAsync('SELECT * FROM colleges ORDER BY name');
    res.json(colleges);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/colleges', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, dean_name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await runAsync('INSERT INTO colleges (name, dean_name) VALUES (?, ?)', [name, dean_name || null]);
    res.status(201).json({ id: r.id, name, dean_name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/colleges/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, dean_name } = req.body;
    await runAsync('UPDATE colleges SET name=?, dean_name=? WHERE id=?', [name, dean_name, req.params.id]);
    res.json({ message: 'College updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/colleges/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM colleges WHERE id=?', [req.params.id]);
    res.json({ message: 'College deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== DEPARTMENTS =====================
router.get('/departments', verifyToken, async (req, res) => {
  try {
    const depts = await allAsync(`
      SELECT d.*, c.name as college_name
      FROM departments d
      LEFT JOIN colleges c ON d.college_id = c.id
      ORDER BY d.name
    `);
    res.json(depts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/departments', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, code, college_id } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
    const r = await runAsync('INSERT INTO departments (name, code, college_id) VALUES (?, ?, ?)', [name, code, college_id || null]);
    res.status(201).json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/departments/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, code, college_id } = req.body;
    await runAsync('UPDATE departments SET name=?, code=?, college_id=? WHERE id=?', [name, code, college_id, req.params.id]);
    res.json({ message: 'Department updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/departments/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM departments WHERE id=?', [req.params.id]);
    res.json({ message: 'Department deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== PROGRAMS =====================
router.get('/programs', verifyToken, async (req, res) => {
  try {
    const programs = await allAsync(`
      SELECT p.*, d.name as department_name
      FROM programs p
      LEFT JOIN departments d ON p.department_id = d.id
      ORDER BY p.name
    `);
    res.json(programs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/programs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, degree_type, department_id, total_credits_required,
      core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await runAsync(
      `INSERT INTO programs (name, degree_type, department_id, total_credits_required,
       core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required)
       VALUES (?,?,?,?,?,?,?,?)`,
      [name, degree_type || 'Bachelor', department_id || null,
        total_credits_required || 120, core_credits_required || 40,
        elective_credits_required || 40, gened_credits_required || 30, lab_credits_required || 10]
    );
    res.status(201).json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/programs/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, degree_type, department_id, total_credits_required,
      core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required } = req.body;
    await runAsync(
      `UPDATE programs SET name=?, degree_type=?, department_id=?, total_credits_required=?,
       core_credits_required=?, elective_credits_required=?, gened_credits_required=?, lab_credits_required=? WHERE id=?`,
      [name, degree_type, department_id, total_credits_required,
        core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required, req.params.id]
    );
    res.json({ message: 'Program updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/programs/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ message: 'Program deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== COURSES =====================
router.get('/courses', verifyToken, async (req, res) => {
  try {
    const courses = await allAsync(`
      SELECT c.*, d.name as department_name,
        GROUP_CONCAT(cp.prerequisite_course_id) as prerequisite_ids
      FROM courses c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_prerequisites cp ON c.id = cp.course_id
      GROUP BY c.id
      ORDER BY c.course_code
    `);
    res.json(courses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/courses', verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_name, course_code, credits, category, department_id, description, prerequisite_ids } = req.body;
    if (!course_name || !course_code || !credits) return res.status(400).json({ error: 'Required fields missing' });
    const existing = await getAsync('SELECT id FROM courses WHERE course_code=?', [course_code]);
    if (existing) return res.status(400).json({ error: 'Course code already exists' });

    const r = await runAsync(
      'INSERT INTO courses (course_name, course_code, credits, category, department_id, description) VALUES (?,?,?,?,?,?)',
      [course_name, course_code, credits, category || 'Elective', department_id || null, description || null]
    );
    // Insert prerequisites
    if (prerequisite_ids && prerequisite_ids.length > 0) {
      for (const prereqId of prerequisite_ids) {
        await runAsync('INSERT OR IGNORE INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?,?)', [r.id, prereqId]);
      }
    }
    res.status(201).json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/courses/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_name, course_code, credits, category, department_id, description, prerequisite_ids } = req.body;
    await runAsync(
      'UPDATE courses SET course_name=?, course_code=?, credits=?, category=?, department_id=?, description=? WHERE id=?',
      [course_name, course_code, credits, category, department_id, description, req.params.id]
    );
    // Refresh prerequisites
    await runAsync('DELETE FROM course_prerequisites WHERE course_id=?', [req.params.id]);
    if (prerequisite_ids && prerequisite_ids.length > 0) {
      for (const prereqId of prerequisite_ids) {
        await runAsync('INSERT OR IGNORE INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?,?)', [req.params.id, prereqId]);
      }
    }
    res.json({ message: 'Course updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/courses/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM course_prerequisites WHERE course_id=?', [req.params.id]);
    await runAsync('DELETE FROM courses WHERE id=?', [req.params.id]);
    res.json({ message: 'Course deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== SECTIONS =====================
router.get('/sections', verifyToken, async (req, res) => {
  try {
    const sections = await allAsync(`
      SELECT s.*, c.course_name, c.course_code, c.credits, c.category,
             u.name as instructor_name,
             COUNT(e.id) as enrolled_count,
             (SELECT COUNT(*) FROM waitlist w WHERE w.section_id = s.id) as waitlist_count
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON s.instructor_id = u.id
      LEFT JOIN enrollments e ON s.id = e.section_id AND e.status = 'enrolled'
      GROUP BY s.id
      ORDER BY c.course_code
    `);
    res.json(sections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sections', verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_id, semester, year, instructor_id, max_seats, schedule_time, room } = req.body;
    if (!course_id || !semester || !year) return res.status(400).json({ error: 'Required fields missing' });
    const r = await runAsync(
      'INSERT INTO sections (course_id, semester, year, instructor_id, max_seats, schedule_time, room) VALUES (?,?,?,?,?,?,?)',
      [course_id, semester, year, instructor_id || null, max_seats || 30, schedule_time || null, room || null]
    );
    res.status(201).json({ id: r.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/sections/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_id, semester, year, instructor_id, max_seats, schedule_time, room } = req.body;
    await runAsync(
      'UPDATE sections SET course_id=?, semester=?, year=?, instructor_id=?, max_seats=?, schedule_time=?, room=? WHERE id=?',
      [course_id, semester, year, instructor_id, max_seats, schedule_time, room, req.params.id]
    );
    res.json({ message: 'Section updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sections/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM enrollments WHERE section_id=?', [req.params.id]);
    await runAsync('DELETE FROM waitlist WHERE section_id=?', [req.params.id]);
    await runAsync('DELETE FROM sections WHERE id=?', [req.params.id]);
    res.json({ message: 'Section deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== USERS (admin view) =====================
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await allAsync(`
      SELECT u.id, u.name, u.email, u.role, p.name as program_name
      FROM users u
      LEFT JOIN programs p ON u.program_id = p.id
      ORDER BY u.role, u.name
    `);
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== STATS =====================
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const [students, faculty, courses, sections, enrollments] = await Promise.all([
      getAsync("SELECT COUNT(*) as count FROM users WHERE role='student'"),
      getAsync("SELECT COUNT(*) as count FROM users WHERE role='faculty'"),
      getAsync("SELECT COUNT(*) as count FROM courses"),
      getAsync("SELECT COUNT(*) as count FROM sections"),
      getAsync("SELECT COUNT(*) as count FROM enrollments WHERE status='enrolled'"),
    ]);
    res.json({ students: students.count, faculty: faculty.count, courses: courses.count, sections: sections.count, enrollments: enrollments.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
