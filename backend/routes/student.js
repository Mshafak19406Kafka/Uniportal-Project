const express = require('express');
const { allAsync, getAsync, runAsync } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ─── Helper: Parse schedule time "Mon 10-12" ───────────────────────────────
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  try {
    const [day, hours] = timeStr.split(' ');
    const [start, end] = hours.split('-');
    return { day, start: parseInt(start), end: parseInt(end) };
  } catch { return null; }
};

const hasTimeConflict = (t1str, t2str) => {
  const t1 = parseTime(t1str), t2 = parseTime(t2str);
  if (!t1 || !t2) return false;
  return t1.day === t2.day && t1.start < t2.end && t1.end > t2.start;
};

// ─── Helper: Notify next person on waitlist when a seat opens ──────────────
async function notifyNextWaitlist(sectionId) {
  const next = await getAsync(
    `SELECT w.*, c.course_name, s.semester, s.year
     FROM waitlist w
     JOIN sections s ON w.section_id = s.id
     JOIN courses c ON s.course_id = c.id
     WHERE w.section_id = ? AND w.reserved_until IS NULL
     ORDER BY w.position ASC LIMIT 1`,
    [sectionId]
  );
  if (!next) return;

  const reservedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await runAsync('UPDATE waitlist SET reserved_until=? WHERE id=?', [reservedUntil, next.id]);
  await runAsync(
    'INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
    [next.user_id, 'waitlist_seat_reserved',
      `A seat has opened in ${next.course_name} (${next.semester} ${next.year})! ` +
      `Your reservation expires in 24 hours. Confirm your enrollment now.`]
  );
}

// ─── Helper: Expire stale waitlist reservations ────────────────────────────
async function expireReservations() {
  const expired = await allAsync(
    `SELECT w.*, c.course_name FROM waitlist w
     JOIN sections s ON w.section_id = s.id
     JOIN courses c ON s.course_id = c.id
     WHERE w.reserved_until IS NOT NULL AND w.reserved_until < datetime('now')`
  );
  for (const entry of expired) {
    await runAsync('DELETE FROM waitlist WHERE id=?', [entry.id]);
    await runAsync(
      'INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
      [entry.user_id, 'waitlist_expired',
        `Your reserved seat for ${entry.course_name} has expired. You have been removed from the waitlist.`]
    );
    // Re-offer seat to next in queue
    await notifyNextWaitlist(entry.section_id);
  }
}

// Run expiry check every 5 minutes
setInterval(expireReservations, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/student/sections — browse available sections with filters
router.get('/sections', verifyToken, async (req, res) => {
  try {
    const { search, category, semester } = req.query;
    let sql = `
      SELECT s.*, c.course_name, c.course_code, c.credits, c.category, c.description,
             c.id as course_id,
             u.name as instructor_name,
             d.name as department_name, d.code as department_code,
             col.name as college_name,
             COUNT(e.id) as enrolled_count,
             (SELECT COUNT(*) FROM waitlist w WHERE w.section_id = s.id) as waitlist_count,
             (SELECT GROUP_CONCAT(pc.course_code) 
              FROM course_prerequisites cp
              JOIN courses pc ON cp.prerequisite_course_id = pc.id
              WHERE cp.course_id = c.id) as prerequisites,
             (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE course_id = c.id) as avg_rating,
             (SELECT COUNT(*) FROM reviews WHERE course_id = c.id) as review_count
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON s.instructor_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN colleges col ON d.college_id = col.id
      LEFT JOIN enrollments e ON s.id = e.section_id AND e.status = 'enrolled'
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      sql += ` AND (c.course_name LIKE ? OR c.course_code LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { sql += ` AND c.category = ?`; params.push(category); }
    if (semester) { sql += ` AND s.semester = ?`; params.push(semester); }
    sql += ` GROUP BY s.id ORDER BY c.course_code`;

    const sections = await allAsync(sql, params);
    res.json(sections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/student/my-courses
router.get('/my-courses', verifyToken, async (req, res) => {
  try {
    const courses = await allAsync(`
      SELECT e.id as enrollment_id, e.status, e.enrolled_at,
             s.id as section_id, s.semester, s.year, s.schedule_time, s.room,
             c.course_name, c.course_code, c.credits, c.category,
             u.name as instructor_name,
             d.name as department_name, d.code as department_code,
             col.name as college_name
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON s.instructor_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN colleges col ON d.college_id = col.id
      WHERE e.user_id = ? AND e.status = 'enrolled'
      ORDER BY c.course_code
    `, [req.user.id]);

    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    res.json({ courses, totalCredits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/student/waitlist
router.get('/waitlist', verifyToken, async (req, res) => {
  try {
    const entries = await allAsync(`
      SELECT w.*, s.semester, s.year, s.schedule_time,
             c.course_name, c.course_code, c.credits,
             u.name as instructor_name
      FROM waitlist w
      JOIN sections s ON w.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON s.instructor_id = u.id
      WHERE w.user_id = ?
      ORDER BY w.position
    `, [req.user.id]);
    res.json(entries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/student/enroll — Enroll or join waitlist (core logic)
router.post('/enroll', verifyToken, async (req, res) => {
  try {
    const { sectionId } = req.body;
    const userId = req.user.id;

    const section = await getAsync(`
      SELECT s.*, c.course_name, c.course_code, c.credits, c.category, c.id as course_id
      FROM sections s JOIN courses c ON s.course_id = c.id WHERE s.id = ?
    `, [sectionId]);
    if (!section) return res.status(404).json({ error: 'Section not found' });

    // Check already enrolled
    const existing = await getAsync(
      'SELECT * FROM enrollments WHERE user_id=? AND section_id=?', [userId, sectionId]
    );
    if (existing) return res.status(400).json({ error: 'Already enrolled in this section' });

    // Check already on waitlist
    const onWaitlist = await getAsync(
      'SELECT * FROM waitlist WHERE user_id=? AND section_id=?', [userId, sectionId]
    );
    if (onWaitlist) return res.status(400).json({ error: 'Already on the waitlist for this section' });

    // ── Prerequisite Check ──
    const prereqs = await allAsync(
      `SELECT c.course_code, c.course_name, cp.prerequisite_course_id
       FROM course_prerequisites cp
       JOIN courses c ON cp.prerequisite_course_id = c.id
       WHERE cp.course_id = ?`,
      [section.course_id]
    );

    if (prereqs.length > 0) {
      // Check completed (enrolled) courses
      const completedPrereqs = await allAsync(`
        SELECT DISTINCT c.id FROM enrollments e
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        WHERE e.user_id = ? AND e.status = 'enrolled'
      `, [userId]);
      const completedIds = completedPrereqs.map(r => r.id);

      const missingPrereqs = prereqs.filter(p => !completedIds.includes(p.prerequisite_course_id));

      if (missingPrereqs.length > 0) {
        // Check if student has an APPROVED special request for this section
        const approvedOverride = await getAsync(
          `SELECT * FROM special_requests WHERE student_id=? AND section_id=? AND status='approved'`,
          [userId, sectionId]
        );
        if (!approvedOverride) {
          return res.status(400).json({
            error: `Missing prerequisites: ${missingPrereqs.map(p => p.course_code).join(', ')}`,
            missing_prereqs: missingPrereqs,
            can_request_override: true,
          });
        }
      }
    }

    // ── Time Conflict Check ──
    const currentEnrollments = await allAsync(`
      SELECT s.schedule_time, c.course_name
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.user_id = ? AND e.status = 'enrolled'
    `, [userId]);

    for (const enrolled of currentEnrollments) {
      if (hasTimeConflict(section.schedule_time, enrolled.schedule_time)) {
        return res.status(400).json({
          error: `Time conflict with ${enrolled.course_name} (${enrolled.schedule_time})`
        });
      }
    }

    // ── Credit Limit Check ──
    const creditRow = await getAsync(`
      SELECT COALESCE(SUM(c.credits), 0) as total
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.user_id = ? AND e.status = 'enrolled'
    `, [userId]);
    if ((creditRow.total + section.credits) > 20) {
      return res.status(400).json({ error: `Credit limit exceeded. Currently at ${creditRow.total}/20 credits.` });
    }

    // ── Seat Availability ──
    const enrolledCount = await getAsync(
      `SELECT COUNT(*) as count FROM enrollments WHERE section_id=? AND status='enrolled'`, [sectionId]
    );

    if (enrolledCount.count < section.max_seats) {
      // ENROLL
      await runAsync(
        'INSERT INTO enrollments (user_id, section_id, status) VALUES (?,?,?)',
        [userId, sectionId, 'enrolled']
      );
      await runAsync(
        'INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
        [userId, 'enrolled', `You have been enrolled in ${section.course_name} (${section.semester} ${section.year}).`]
      );
      return res.status(201).json({ status: 'enrolled', message: `Successfully enrolled in ${section.course_name}` });
    } else {
      // JOIN WAITLIST
      const positionRow = await getAsync(
        'SELECT COALESCE(MAX(position), 0) as max_pos FROM waitlist WHERE section_id=?', [sectionId]
      );
      const position = positionRow.max_pos + 1;
      await runAsync(
        'INSERT INTO waitlist (user_id, section_id, position) VALUES (?,?,?)',
        [userId, sectionId, position]
      );
      await runAsync(
        'INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
        [userId, 'waitlisted', `${section.course_name} is full. You are #${position} on the waitlist.`]
      );
      return res.status(201).json({
        status: 'waitlisted',
        message: `${section.course_name} is full. You are #${position} on the waitlist.`,
        position
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/student/confirm-reservation/:waitlistId — confirm a reserved seat
router.post('/confirm-reservation/:waitlistId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const entry = await getAsync(
      `SELECT w.*, c.course_name, s.semester, s.year, s.max_seats, s.schedule_time, c.credits
       FROM waitlist w
       JOIN sections s ON w.section_id = s.id
       JOIN courses c ON s.course_id = c.id
       WHERE w.id = ? AND w.user_id = ?`,
      [req.params.waitlistId, userId]
    );

    if (!entry) return res.status(404).json({ error: 'Reservation not found' });
    if (!entry.reserved_until) return res.status(400).json({ error: 'No active reservation for this entry' });
    if (new Date(entry.reserved_until) < new Date()) {
      return res.status(400).json({ error: 'Reservation has expired' });
    }

    // Double-check a seat is still free
    const count = await getAsync(
      `SELECT COUNT(*) as count FROM enrollments WHERE section_id=? AND status='enrolled'`,
      [entry.section_id]
    );
    if (count.count >= entry.max_seats) {
      await runAsync('UPDATE waitlist SET reserved_until=NULL WHERE id=?', [entry.id]);
      await notifyNextWaitlist(entry.section_id);
      return res.status(409).json({ error: 'Seat is no longer available' });
    }

    await runAsync('INSERT INTO enrollments (user_id, section_id, status) VALUES (?,?,?)',
      [userId, entry.section_id, 'enrolled']);
    await runAsync('DELETE FROM waitlist WHERE id=?', [entry.id]);

    // Shift remaining waitlist positions
    await runAsync(
      'UPDATE waitlist SET position = position - 1 WHERE section_id=? AND position > ?',
      [entry.section_id, entry.position]
    );

    await runAsync('INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
      [userId, 'enrolled', `You have confirmed enrollment in ${entry.course_name} (${entry.semester} ${entry.year}).`]);

    res.json({ message: 'Enrollment confirmed!' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/student/drop/:sectionId
router.delete('/drop/:sectionId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sectionId } = req.params;

    const enrollment = await getAsync(
      'SELECT * FROM enrollments WHERE user_id=? AND section_id=? AND status=?',
      [userId, sectionId, 'enrolled']
    );
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    await runAsync(
      'UPDATE enrollments SET status=? WHERE user_id=? AND section_id=?',
      ['dropped', userId, sectionId]
    );

    // Trigger waitlist promotion
    await notifyNextWaitlist(parseInt(sectionId));

    const section = await getAsync(
      'SELECT c.course_name FROM sections s JOIN courses c ON s.course_id=c.id WHERE s.id=?', [sectionId]
    );
    await runAsync('INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
      [userId, 'dropped', `You have dropped ${section?.course_name || 'the course'}.`]);

    res.json({ message: 'Course dropped successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/student/special-request — prerequisite override request
router.post('/special-request', verifyToken, async (req, res) => {
  try {
    const { sectionId, reason } = req.body;
    const userId = req.user.id;

    if (!sectionId || !reason) return res.status(400).json({ error: 'Section ID and reason required' });

    const existing = await getAsync(
      `SELECT * FROM special_requests WHERE student_id=? AND section_id=? AND status='pending'`,
      [userId, sectionId]
    );
    if (existing) return res.status(400).json({ error: 'A pending request already exists for this section' });

    await runAsync(
      'INSERT INTO special_requests (student_id, section_id, reason) VALUES (?,?,?)',
      [userId, sectionId, reason]
    );

    // Notify the faculty instructor
    const section = await getAsync(
      `SELECT s.instructor_id, c.course_name, s.semester, s.year
       FROM sections s JOIN courses c ON s.course_id=c.id WHERE s.id=?`,
      [sectionId]
    );
    if (section?.instructor_id) {
      const user = await getAsync('SELECT name FROM users WHERE id=?', [userId]);
      await runAsync('INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
        [section.instructor_id, 'special_request',
          `New special request from ${user.name} for ${section.course_name} (${section.semester} ${section.year}). Please review.`]);
    }

    res.status(201).json({ message: 'Special request submitted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/student/degree-audit
router.get('/degree-audit', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getAsync('SELECT * FROM users WHERE id=?', [userId]);
    if (!user?.program_id) {
      return res.json({ enrolled: false, message: 'No program assigned to your account' });
    }

    const program = await getAsync('SELECT * FROM programs WHERE id=?', [user.program_id]);
    if (!program) return res.json({ enrolled: false, message: 'Program not found' });

    // Enrolled credits grouped by category
    const completedByCat = await allAsync(`
      SELECT c.category, SUM(c.credits) as credits, COUNT(*) as count
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.user_id = ? AND e.status = 'enrolled'
      GROUP BY c.category
    `, [userId]);

    const catMap = {};
    for (const row of completedByCat) { catMap[row.category] = { credits: row.credits, count: row.count }; }

    const totalCompleted = completedByCat.reduce((s, r) => s + r.credits, 0);

    // All enrolled course IDs (to show remaining)
    const enrolledCourseIds = await allAsync(`
      SELECT DISTINCT c.id FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE e.user_id = ? AND e.status = 'enrolled'
    `, [userId]);
    const enrolledIds = enrolledCourseIds.map(r => r.id);

    // Remaining courses per category
    const allCourses = await allAsync('SELECT * FROM courses ORDER BY category, course_code');
    const remaining = allCourses.filter(c => !enrolledIds.includes(c.id));

    const categories = [
      { key: 'Core', label: 'Core Requirements', required: program.core_credits_required },
      { key: 'Elective', label: 'Electives', required: program.elective_credits_required },
      { key: 'General Ed', label: 'General Education', required: program.gened_credits_required },
      { key: 'Lab', label: 'Laboratory', required: program.lab_credits_required },
    ];

    const audit = categories.map(cat => ({
      ...cat,
      completed: catMap[cat.key]?.credits || 0,
      count_completed: catMap[cat.key]?.count || 0,
      remaining_courses: remaining.filter(c => c.category === cat.key),
    }));

    res.json({
      enrolled: true,
      program,
      total_completed: totalCompleted,
      total_required: program.total_credits_required,
      overall_progress: Math.min(100, Math.round((totalCompleted / program.total_credits_required) * 100)),
      audit,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/student/notifications
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const notifications = await allAsync(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unreadCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/student/notifications/:id/read
router.put('/notifications/:id/read', verifyToken, async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await runAsync('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    } else {
      await runAsync('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    }
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/student/special-requests — student's own requests
router.get('/special-requests', verifyToken, async (req, res) => {
  try {
    const requests = await allAsync(`
      SELECT sr.*, c.course_name, c.course_code, s.semester, s.year, u.name as faculty_name
      FROM special_requests sr
      JOIN sections s ON sr.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON sr.faculty_id = u.id
      WHERE sr.student_id = ?
      ORDER BY sr.created_at DESC
    `, [req.user.id]);
    res.json(requests);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REVIEWS API ─────────────────────────────────────────────────────────────

// GET /api/student/reviews/:courseId - Get reviews for a course with stats
router.get('/reviews/:courseId', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    // Get all reviews for the course
    const reviews = await allAsync(`
      SELECT r.*, u.name as student_name
      FROM reviews r
      JOIN users u ON r.student_id = u.id
      WHERE r.course_id = ?
      ORDER BY r.created_at DESC
    `, [courseId]);

    // Get average rating and count
    const stats = await getAsync(`
      SELECT COUNT(*) as count, ROUND(AVG(rating), 1) as average
      FROM reviews
      WHERE course_id = ?
    `, [courseId]);

    // Check if current user has already reviewed
    const userReview = await getAsync(`
      SELECT * FROM reviews
      WHERE course_id = ? AND student_id = ?
    `, [courseId, req.user.id]);

    res.json({
      reviews,
      stats: {
        count: stats?.count || 0,
        average: stats?.average || 0
      },
      userHasReviewed: !!userReview,
      userReview: userReview || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/student/reviews - Add a review
router.post('/reviews', verifyToken, async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;
    const studentId = req.user.id;

    if (!courseId || !rating) {
      return res.status(400).json({ error: 'Course ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if already reviewed
    const existing = await getAsync(
      'SELECT * FROM reviews WHERE course_id = ? AND student_id = ?',
      [courseId, studentId]
    );
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this course' });
    }

    // Check if student is enrolled in this course
    const enrolled = await getAsync(`
      SELECT e.* FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      WHERE e.user_id = ? AND s.course_id = ? AND e.status = 'enrolled'
    `, [studentId, courseId]);

    if (!enrolled) {
      return res.status(400).json({ error: 'You must be enrolled in this course to leave a review' });
    }

    const result = await runAsync(
      'INSERT INTO reviews (course_id, student_id, rating, comment) VALUES (?, ?, ?, ?)',
      [courseId, studentId, rating, comment || '']
    );

    res.status(201).json({
      id: result.id,
      course_id: courseId,
      rating,
      comment,
      message: 'Review submitted successfully'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/student/reviews/:id - Update own review
router.put('/reviews/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const studentId = req.user.id;

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify ownership
    const review = await getAsync(
      'SELECT * FROM reviews WHERE id = ? AND student_id = ?',
      [id, studentId]
    );
    if (!review) {
      return res.status(404).json({ error: 'Review not found or not authorized' });
    }

    await runAsync(
      'UPDATE reviews SET rating = ?, comment = ? WHERE id = ?',
      [rating || review.rating, comment !== undefined ? comment : review.comment, id]
    );

    res.json({ message: 'Review updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/student/reviews/:id - Delete own review
router.delete('/reviews/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    const result = await runAsync(
      'DELETE FROM reviews WHERE id = ? AND student_id = ?',
      [id, studentId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Review not found or not authorized' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ─── PAYMENTS API ───────────────────────────────────────────────────────────

// POST /api/student/process-payment - Process payment for course enrollment
router.post('/process-payment', verifyToken, async (req, res) => {
  try {
    const { sectionId, paymentMethod, upiApp, cardDetails } = req.body;
    const studentId = req.user.id;

    if (!sectionId || !paymentMethod) {
      return res.status(400).json({ error: 'Section ID and payment method are required' });
    }

    // Valid payment methods
    const validMethods = ['UPI', 'Credit Card', 'Debit Card'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Valid UPI apps
    if (paymentMethod === 'UPI' && upiApp) {
      const validUPIApps = ['Paytm', 'PhonePe', 'Google Pay', 'Slice', 'Cred'];
      if (!validUPIApps.includes(upiApp)) {
        return res.status(400).json({ error: 'Invalid UPI app' });
      }
    }

    // Get section details with course and faculty info
    const section = await getAsync(`
      SELECT s.*, c.course_name, c.course_code, c.credits, c.id as course_id,
             u.id as faculty_id, u.name as faculty_name
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON s.instructor_id = u.id
      WHERE s.id = ?
    `, [sectionId]);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Check if already enrolled
    const existing = await getAsync(
      'SELECT * FROM enrollments WHERE user_id = ? AND section_id = ? AND status = ?',
      [studentId, sectionId, 'enrolled']
    );
    if (existing) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Calculate amount based on credits (₹2000 per credit)
    const amountPerCredit = 2000;
    const totalAmount = section.credits * amountPerCredit;

    // Simulate payment processing
    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // In a real app, you would integrate with actual payment gateway here
    // For demo, we simulate successful payment after 1 second delay
    
    // Create enrollment first (status: pending_payment)
    const enrollmentResult = await runAsync(
      'INSERT INTO enrollments (user_id, section_id, status) VALUES (?, ?, ?)',
      [studentId, sectionId, 'enrolled']
    );

    // Create payment record
    const paymentResult = await runAsync(
      `INSERT INTO payments (enrollment_id, student_id, faculty_id, amount, payment_method, upi_app, status, transaction_id, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [enrollmentResult.id, studentId, section.faculty_id || null, totalAmount, paymentMethod, upiApp || null, 'completed', transactionId]
    );

    // Send notification to faculty
    if (section.faculty_id) {
      await runAsync(
        'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
        [section.faculty_id, 'payment_received', 
         `Payment of ₹${totalAmount} received from student for ${section.course_code} - ${section.course_name}`]
      );
    }

    // Send notification to student
    await runAsync(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [studentId, 'payment_success', 
       `Successfully paid ₹${totalAmount} for ${section.course_code} via ${paymentMethod}${upiApp ? ` (${upiApp})` : ''}. Transaction ID: ${transactionId}`]
    );

    res.status(201).json({
      success: true,
      message: `Payment successful! Enrolled in ${section.course_name}`,
      transactionId,
      amount: totalAmount,
      paymentMethod,
      upiApp,
      enrollmentId: enrollmentResult.id,
      paymentId: paymentResult.id
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/student/payments - Get student's payment history
router.get('/payments', verifyToken, async (req, res) => {
  try {
    const payments = await allAsync(`
      SELECT p.*, c.course_name, c.course_code, s.semester, s.year,
             u.name as faculty_name
      FROM payments p
      JOIN enrollments e ON p.enrollment_id = e.id
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN users u ON p.faculty_id = u.id
      WHERE p.student_id = ?
      ORDER BY p.paid_at DESC
    `, [req.user.id]);

    res.json(payments);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/student/payment-methods - Get available payment methods
router.get('/payment-methods', verifyToken, async (req, res) => {
  // Use actual logo files from public/icons folder
  res.json({
    methods: [
      {
        id: 'UPI',
        name: 'UPI',
        icon: '/icons/upi.svg',
        apps: [
          { id: 'Paytm', name: 'Paytm', icon: '/icons/Paytm%20Logo.png', color: '#00BAF2' },
          { id: 'PhonePe', name: 'PhonePe', icon: '/icons/Phonepay%20logo.png', color: '#7236F4' },
          { id: 'Google Pay', name: 'Google Pay', icon: '/icons/Gpay%20logo.png', color: '#4285F4' },
          { id: 'Slice', name: 'Slice', icon: '/icons/slice%20logo.png', color: '#FF6B6B' },
          { id: 'Cred', name: 'Cred', icon: '/icons/CRED-Fintech-Logo-thumb.png', color: '#000000' }
        ]
      },
      {
        id: 'Credit Card',
        name: 'Credit Card',
        icon: '/icons/Credit%20card%20logo.png',
        fields: ['cardNumber', 'cardHolder', 'expiryDate', 'cvv']
      },
      {
        id: 'Debit Card',
        name: 'Debit Card',
        icon: '/icons/debit%20card%20logo.png',
        fields: ['cardNumber', 'cardHolder', 'expiryDate', 'cvv']
      }
    ]
  });
});

module.exports = router;
