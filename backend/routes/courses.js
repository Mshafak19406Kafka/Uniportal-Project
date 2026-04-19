const express = require('express');
const { allAsync, getAsync, runAsync } = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all courses with current enrollment count
router.get('/', async (req, res) => {
  try {
    const courses = await allAsync(`
      SELECT c.*, COUNT(e.id) as enrolled_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
    `);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Add a new course
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { course_name, course_code, credits, max_seats, instructor, schedule_time } = req.body;
    
    if (!course_name || !course_code || !credits || !max_seats) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }

    const existingCourse = await getAsync('SELECT * FROM courses WHERE course_code = ?', [course_code]);
    if (existingCourse) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const result = await runAsync(
      'INSERT INTO courses (course_name, course_code, credits, max_seats, instructor, schedule_time) VALUES (?, ?, ?, ?, ?, ?)',
      [course_name, course_code, credits, max_seats, instructor, schedule_time]
    );

    res.status(201).json({ message: 'Course created successfully', id: result.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Edit a course
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { course_name, course_code, credits, max_seats, instructor, schedule_time } = req.body;

    await runAsync(
      'UPDATE courses SET course_name = ?, course_code = ?, credits = ?, max_seats = ?, instructor = ?, schedule_time = ? WHERE id = ?',
      [course_name, course_code, credits, max_seats, instructor, schedule_time, id]
    );

    res.json({ message: 'Course updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Delete a course
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await runAsync('DELETE FROM enrollments WHERE course_id = ?', [id]);
    await runAsync('DELETE FROM courses WHERE id = ?', [id]);
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get students in a course
router.get('/:id/students', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const students = await allAsync(`
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN enrollments e ON u.id = e.user_id
      WHERE e.course_id = ?
    `, [id]);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
