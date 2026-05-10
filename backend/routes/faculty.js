const express = require('express');
const { allAsync, getAsync, runAsync } = require('../db');
const { verifyToken, isFaculty, isFacultyOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/faculty/my-sections — faculty's assigned sections
router.get('/my-sections', verifyToken, isFaculty, async (req, res) => {
  try {
    const sections = await allAsync(`
      SELECT s.*, c.course_name, c.course_code, c.credits, c.category, c.description,
             COUNT(e.id) as enrolled_count,
             (SELECT COUNT(*) FROM waitlist w WHERE w.section_id = s.id) as waitlist_count
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      LEFT JOIN enrollments e ON s.id = e.section_id AND e.status = 'enrolled'
      WHERE s.instructor_id = ?
      GROUP BY s.id
      ORDER BY c.course_code
    `, [req.user.id]);
    res.json(sections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/faculty/my-sections/:id/students — roster
router.get('/my-sections/:id/students', verifyToken, isFaculty, async (req, res) => {
  try {
    const section = await getAsync('SELECT * FROM sections WHERE id=? AND instructor_id=?', [req.params.id, req.user.id]);
    if (!section) return res.status(403).json({ error: 'Not your section' });

    const students = await allAsync(`
      SELECT u.id, u.name, u.email, e.enrolled_at, p.name as program_name
      FROM users u
      JOIN enrollments e ON u.id = e.user_id
      LEFT JOIN programs p ON u.program_id = p.id
      WHERE e.section_id = ? AND e.status = 'enrolled'
      ORDER BY u.name
    `, [req.params.id]);
    res.json(students);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/faculty/special-requests — pending requests for faculty's sections
router.get('/special-requests', verifyToken, isFaculty, async (req, res) => {
  try {
    const requests = await allAsync(`
      SELECT sr.*, u.name as student_name, u.email as student_email,
             c.course_name, c.course_code, s.semester, s.year, s.schedule_time
      FROM special_requests sr
      JOIN users u ON sr.student_id = u.id
      JOIN sections s ON sr.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE s.instructor_id = ?
      ORDER BY sr.created_at DESC
    `, [req.user.id]);
    res.json(requests);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/faculty/special-requests/:id — approve or deny
router.put('/special-requests/:id', verifyToken, isFaculty, async (req, res) => {
  try {
    const { status, faculty_note } = req.body;
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or denied' });
    }

    const request = await getAsync(`
      SELECT sr.*, s.instructor_id
      FROM special_requests sr
      JOIN sections s ON sr.section_id = s.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.instructor_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await runAsync(
      'UPDATE special_requests SET status=?, faculty_id=?, faculty_note=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?',
      [status, req.user.id, faculty_note || null, req.params.id]
    );

    // Notify student
    const section = await getAsync(`
      SELECT c.course_name, s.semester, s.year FROM sections s JOIN courses c ON s.course_id=c.id WHERE s.id=?
    `, [request.section_id]);

    const msg = status === 'approved'
      ? `Your special request for ${section.course_name} (${section.semester} ${section.year}) was APPROVED. You may now register.`
      : `Your special request for ${section.course_name} (${section.semester} ${section.year}) was DENIED. Reason: ${faculty_note || 'No reason given.'}`;

    await runAsync(
      'INSERT INTO notifications (user_id, type, message) VALUES (?,?,?)',
      [request.student_id, status === 'approved' ? 'request_approved' : 'request_denied', msg]
    );

    res.json({ message: `Request ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// GET /api/faculty/departments — to select department when creating a course
router.get('/departments', verifyToken, isFaculty, async (req, res) => {
  try {
    const departments = await allAsync('SELECT id, name FROM departments ORDER BY name');
    res.json(departments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/faculty/courses — to select course when creating a section
router.get('/courses', verifyToken, isFaculty, async (req, res) => {
  try {
    const courses = await allAsync('SELECT id, course_code, course_name FROM courses ORDER BY course_code');
    res.json(courses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/faculty/courses — allow faculty to propose/create a course

router.post('/courses', verifyToken, isFaculty, async (req, res) => {
  try {
    let { course_code, course_name, description, credits, department_id, new_department_name, category } = req.body;
    
    if (department_id === 'custom' && new_department_name) {
      const college = await getAsync('SELECT id FROM colleges LIMIT 1');
      if (!college) return res.status(400).json({ error: 'System error: no colleges exist.' });
      
      const newDeptCode = new_department_name.substring(0, 4).toUpperCase();
      const result = await runAsync(
        'INSERT INTO departments (name, code, college_id) VALUES (?,?,?)',
        [new_department_name, newDeptCode, college.id]
      );
      department_id = result.lastID;
    }

    await runAsync(
      'INSERT INTO courses (course_code, course_name, description, credits, department_id, category) VALUES (?,?,?,?,?,?)',
      [course_code, course_name, description, credits, department_id, category]
    );
    res.json({ message: 'Course created successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/faculty/sections — faculty creates a section explicitly for themselves
router.post('/sections', verifyToken, isFaculty, async (req, res) => {
  try {
    const { course_id, semester, year, max_seats, schedule_time, room } = req.body;
    await runAsync(
      'INSERT INTO sections (course_id, instructor_id, semester, year, max_seats, schedule_time, room) VALUES (?,?,?,?,?,?,?)',
      [course_id, req.user.id, semester, year, max_seats, schedule_time, room]
    );
    res.json({ message: 'Section added successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/faculty/my-sections/:id/waitlist — monitor waitlist exactly
router.get('/my-sections/:id/waitlist', verifyToken, isFaculty, async (req, res) => {
  try {
    const section = await getAsync('SELECT * FROM sections WHERE id=? AND instructor_id=?', [req.params.id, req.user.id]);
    if (!section) return res.status(403).json({ error: 'Not your section' });

    const waitlisted = await allAsync(`
      SELECT w.id, w.position, w.joined_at, w.reserved_until, u.name, u.email, p.name as program_name
      FROM waitlist w
      JOIN users u ON w.student_id = u.id
      LEFT JOIN programs p ON u.program_id = p.id
      WHERE w.section_id = ?
      ORDER BY w.position ASC
    `, [req.params.id]);
    res.json(waitlisted);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── VIDEO MANAGEMENT ──────────────────────────────────────────────────────

// POST /api/faculty/upload-video — upload video to course (Faculty/Admin)
router.post('/upload-video', verifyToken, isFacultyOrAdmin, async (req, res) => {
  try {
    const { courseId, title, videoData, contentType } = req.body;
    const uploadedBy = req.user.id;

    console.log('Video upload request:', { courseId, title, contentType, hasVideoData: !!videoData });

    if (!courseId || !videoData || !contentType) {
      return res.status(400).json({ error: 'Course ID, video data, and content type are required' });
    }

    // Validate content type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid video format. Only MP4, WebM allowed.' });
    }

    // Check file size (100MB max, base64 increases size by ~33%)
    const base64Data = videoData.replace(/^data:.*;base64,/, '');
    const fileSize = Buffer.byteLength(base64Data, 'base64');
    console.log('Video file size:', (fileSize / (1024 * 1024)).toFixed(2), 'MB');
    
    if (fileSize > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'Video file too large. Max 100MB.' });
    }

    // Faculty can only upload to their courses, admin can upload to any
    if (req.user.role === 'faculty') {
      const course = await getAsync(`
        SELECT s.id FROM sections s
        WHERE s.course_id = ? AND s.instructor_id = ?
        LIMIT 1
      `, [courseId, uploadedBy]);
      if (!course) {
        return res.status(403).json({ error: 'You can only upload videos to courses you teach' });
      }
    }

    // Delete existing video if any
    await runAsync('DELETE FROM course_videos WHERE course_id = ?', [courseId]);

    // Insert new video
    console.log('Inserting video into database...');
    const result = await runAsync(
      'INSERT INTO course_videos (course_id, uploaded_by, title, video_data, content_type, file_size) VALUES (?, ?, ?, ?, ?, ?)',
      [courseId, uploadedBy, title || 'Course Video', Buffer.from(base64Data, 'base64'), contentType, fileSize]
    );

    console.log('Video uploaded successfully, ID:', result.id);
    res.json({ message: 'Video uploaded successfully', videoId: result.id });
  } catch (e) {
    console.error('Video upload error:', e);
    res.status(500).json({ error: e.message || 'Failed to upload video' });
  }
});

// GET /api/faculty/course-video/:courseId — check if course has video
router.get('/course-video/:courseId', verifyToken, isFacultyOrAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const video = await getAsync(
      'SELECT id, title, content_type, file_size, created_at FROM course_videos WHERE course_id = ?',
      [courseId]
    );
    
    res.json({ hasVideo: !!video, video: video || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/faculty/delete-video/:courseId — delete course video
router.delete('/delete-video/:courseId', verifyToken, isFacultyOrAdmin, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Faculty can only delete their own videos, admin can delete any
    if (req.user.role === 'faculty') {
      const video = await getAsync(
        'SELECT v.* FROM course_videos v WHERE v.course_id = ? AND v.uploaded_by = ?',
        [courseId, userId]
      );
      if (!video) {
        return res.status(403).json({ error: 'You can only delete videos you uploaded' });
      }
    }

    const result = await runAsync('DELETE FROM course_videos WHERE course_id = ?', [courseId]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    res.json({ message: 'Video deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

