const express = require('express');
const { getAsync, allAsync, runAsync } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Helper to check time conflict
// schedule_time format: "Mon 10-12"
const checkTimeConflict = (time1, time2) => {
  if (!time1 || !time2) return false;
  
  const parseTime = (timeStr) => {
    try {
      const [day, hours] = timeStr.split(' ');
      const [start, end] = hours.split('-');
      return { day, start: parseInt(start), end: parseInt(end) };
    } catch (e) {
      return null;
    }
  };

  const t1 = parseTime(time1);
  const t2 = parseTime(time2);

  if (!t1 || !t2) return false;

  if (t1.day === t2.day) {
    // Check overlap: Start1 < End2 && End1 > Start2
    if (t1.start < t2.end && t1.end > t2.start) {
      return true;
    }
  }
  return false;
};

// Enroll in a course
router.post('/', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    // 1. Check if course exists and get details
    const course = await getAsync('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // 2. Check duplicate enrollment
    const existingEnrollment = await getAsync(
      'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // 3. Check seats
    const enrolledCountRow = await getAsync(
      'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
      [courseId]
    );
    if (enrolledCountRow.count >= course.max_seats) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // 4. Get student's current enrollments to check credits and time conflicts
    const currentEnrollments = await allAsync(`
      SELECT c.* 
      FROM courses c 
      JOIN enrollments e ON c.id = e.course_id 
      WHERE e.user_id = ?
    `, [userId]);

    let totalCredits = course.credits;
    for (const enrolledCourse of currentEnrollments) {
      totalCredits += enrolledCourse.credits;
      if (checkTimeConflict(course.schedule_time, enrolledCourse.schedule_time)) {
        return res.status(400).json({ 
          error: `Time conflict with ${enrolledCourse.course_name} (${enrolledCourse.schedule_time})` 
        });
      }
    }

    if (totalCredits > 20) {
      return res.status(400).json({ error: 'Cannot exceed max 20 credits' });
    }

    // 5. Enroll
    await runAsync(
      'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)',
      [userId, courseId]
    );

    res.status(201).json({ message: 'Successfully enrolled' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Drop a course
router.delete('/:courseId', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    await runAsync(
      'DELETE FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({ message: 'Course dropped successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my courses
router.get('/my-courses', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const courses = await allAsync(`
      SELECT c.* 
      FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE e.user_id = ?
    `, [userId]);

    const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);

    res.json({ courses, totalCredits });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
