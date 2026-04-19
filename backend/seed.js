const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Delete old database for a clean fresh start
const dbPath = path.resolve(__dirname, 'database.sqlite');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });

async function seed() {
  const hash = await bcrypt.hash('password123', 10);

  db.serialize(() => {
    db.run('PRAGMA foreign_keys = OFF');

    // ─── Tables ──────────────────────────────────────────────────────────────
    db.run(`CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, dean_name TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, college_id INTEGER, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER, name TEXT NOT NULL,
      degree_type TEXT DEFAULT 'Bachelor', total_credits_required INTEGER DEFAULT 120,
      core_credits_required INTEGER DEFAULT 40, elective_credits_required INTEGER DEFAULT 40,
      gened_credits_required INTEGER DEFAULT 30, lab_credits_required INTEGER DEFAULT 10
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER, course_name TEXT NOT NULL,
      course_code TEXT UNIQUE NOT NULL, credits INTEGER NOT NULL, category TEXT DEFAULT 'Elective',
      description TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS course_prerequisites (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL,
      prerequisite_course_id INTEGER NOT NULL, UNIQUE(course_id, prerequisite_course_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT DEFAULT 'student', program_id INTEGER, department_id INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, semester TEXT NOT NULL,
      year INTEGER NOT NULL, instructor_id INTEGER, max_seats INTEGER NOT NULL DEFAULT 30,
      schedule_time TEXT, room TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, section_id INTEGER NOT NULL,
      status TEXT DEFAULT 'enrolled', enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, section_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, section_id INTEGER NOT NULL,
      position INTEGER NOT NULL, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reserved_until DATETIME, UNIQUE(user_id, section_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS special_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, section_id INTEGER NOT NULL,
      reason TEXT NOT NULL, status TEXT DEFAULT 'pending', faculty_id INTEGER, faculty_note TEXT,
      reviewed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL,
      message TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ─── Seed: Colleges ──────────────────────────────────────────────────────
    db.run(`INSERT INTO colleges (id, name, dean_name) VALUES (1, 'College of Engineering & Technology', 'Dr. Robert Anderson')`);
    db.run(`INSERT INTO colleges (id, name, dean_name) VALUES (2, 'College of Arts & Sciences', 'Dr. Maria Chen')`);
    db.run(`INSERT INTO colleges (id, name, dean_name) VALUES (3, 'College of Business', 'Dr. James Wilson')`);

    // ─── Seed: Departments ───────────────────────────────────────────────────
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (1, 1, 'Computer Science', 'CS')`);
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (2, 1, 'Electrical Engineering', 'EE')`);
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (3, 2, 'Mathematics', 'MATH')`);
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (4, 2, 'Physics', 'PHYS')`);
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (5, 2, 'English Literature', 'LIT')`);
    db.run(`INSERT INTO departments (id, college_id, name, code) VALUES (6, 3, 'Business Administration', 'BUS')`);

    // ─── Seed: Programs ──────────────────────────────────────────────────────
    db.run(`INSERT INTO programs (id, department_id, name, degree_type, total_credits_required, core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required) VALUES (1, 1, 'B.Sc. Computer Science', 'Bachelor', 120, 44, 36, 30, 10)`);
    db.run(`INSERT INTO programs (id, department_id, name, degree_type, total_credits_required, core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required) VALUES (2, 2, 'B.Sc. Electrical Engineering', 'Bachelor', 130, 50, 40, 30, 10)`);
    db.run(`INSERT INTO programs (id, department_id, name, degree_type, total_credits_required, core_credits_required, elective_credits_required, gened_credits_required, lab_credits_required) VALUES (3, 3, 'B.Sc. Mathematics', 'Bachelor', 120, 42, 38, 30, 10)`);

    // ─── Seed: Courses ───────────────────────────────────────────────────────
    const courses = [
      // CS Core
      [1, 1, 'Introduction to Programming', 'CS101', 4, 'Core', 'Fundamentals of programming using Python.'],
      [2, 1, 'Data Structures & Algorithms', 'CS201', 4, 'Core', 'Arrays, linked lists, trees, graphs, sorting, and searching.'],
      [3, 1, 'Object-Oriented Programming', 'CS202', 4, 'Core', 'OOP concepts using Java/C++.'],
      [4, 1, 'Database Systems', 'CS301', 4, 'Core', 'Relational databases, SQL, normalization.'],
      [5, 1, 'Operating Systems', 'CS302', 4, 'Core', 'Process management, memory, file systems.'],
      [6, 1, 'Computer Networks', 'CS303', 4, 'Core', 'TCP/IP, routing, network security.'],
      [7, 1, 'Software Engineering', 'CS401', 4, 'Core', 'Software lifecycle, agile, testing.'],
      [8, 1, 'Artificial Intelligence', 'CS402', 4, 'Core', 'Search, reasoning, machine learning basics.'],
      // CS Electives
      [9, 1, 'Machine Learning', 'CS450', 4, 'Elective', 'Supervised and unsupervised learning.'],
      [10, 1, 'Cloud Computing', 'CS460', 3, 'Elective', 'AWS/GCP fundamentals, virtualization.'],
      [11, 1, 'Cybersecurity Fundamentals', 'CS470', 3, 'Elective', 'Cryptography, network security.'],
      [12, 1, 'Web Development', 'CS480', 3, 'Elective', 'Full-stack web development.'],
      // Labs
      [13, 1, 'Programming Lab', 'CS101L', 2, 'Lab', 'Hands-on programming exercises.'],
      [14, 1, 'Data Structures Lab', 'CS201L', 2, 'Lab', 'Implement data structures.'],
      [15, 1, 'Database Lab', 'CS301L', 2, 'Lab', 'SQL and database design lab.'],
      // Math / Physics (General Ed & core for some)
      [16, 3, 'Calculus I', 'MATH101', 4, 'General Ed', 'Limits, derivatives, integrals.'],
      [17, 3, 'Calculus II', 'MATH102', 4, 'General Ed', 'Multivariable calculus.'],
      [18, 3, 'Linear Algebra', 'MATH201', 4, 'General Ed', 'Vectors, matrices, eigenvalues.'],
      [19, 3, 'Discrete Mathematics', 'MATH210', 4, 'General Ed', 'Logic, sets, combinatorics, graph theory.'],
      [20, 3, 'Probability & Statistics', 'MATH301', 4, 'General Ed', 'Random variables, distributions, hypothesis testing.'],
      [21, 4, 'Physics I', 'PHYS101', 4, 'General Ed', 'Mechanics and thermodynamics.'],
      [22, 4, 'Physics II', 'PHYS102', 4, 'General Ed', 'Electromagnetism and optics.'],
      [23, 5, 'Technical Communication', 'LIT101', 3, 'General Ed', 'Writing for engineers and scientists.'],
      [24, 5, 'World Literature', 'LIT201', 3, 'General Ed', 'Survey of global literary traditions.'],
      // EE
      [25, 2, 'Circuit Analysis', 'EE101', 4, 'Core', 'DC and AC circuits, Kirchhoff laws.'],
      [26, 2, 'Digital Logic Design', 'EE201', 4, 'Core', 'Boolean algebra, flip-flops, FSMs.'],
      [27, 2, 'Signals & Systems', 'EE301', 4, 'Core', 'Fourier, Laplace, Z-transforms.'],
      // Business
      [28, 6, 'Intro to Business', 'BUS101', 3, 'Elective', 'Business fundamentals.'],
      [29, 6, 'Entrepreneurship', 'BUS301', 3, 'Elective', 'Startup ecosystem, lean methodology.'],
    ];

    const stmtCourse = db.prepare(
      `INSERT INTO courses (id, department_id, course_name, course_code, credits, category, description) VALUES (?,?,?,?,?,?,?)`
    );
    for (const c of courses) stmtCourse.run(c);
    stmtCourse.finalize();

    // ─── Seed: Prerequisites ─────────────────────────────────────────────────
    const prereqs = [
      [2, 1],   // DS&A requires Intro to Programming
      [3, 1],   // OOP requires Intro to Programming
      [4, 2],   // DB requires DS&A
      [5, 2],   // OS requires DS&A
      [6, 2],   // Networks requires DS&A
      [7, 3],   // SE requires OOP
      [7, 4],   // SE also requires DB
      [8, 2],   // AI requires DS&A
      [9, 8],   // ML requires AI
      [9, 20],  // ML also requires Prob & Stats
      [11, 6],  // Cybersecurity requires Networks
      [14, 2],  // DS Lab requires DS&A
      [15, 4],  // DB Lab requires DB
      [17, 16], // Calc II requires Calc I
      [22, 21], // Phys II requires Phys I
      [27, 25], // Signals requires Circuits
    ];
    const stmtPrereq = db.prepare(`INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES (?,?)`);
    for (const p of prereqs) stmtPrereq.run(p);
    stmtPrereq.finalize();

    // ─── Seed: Users ─────────────────────────────────────────────────────────
    // Admin
    db.run(`INSERT INTO users (id, name, email, password, role) VALUES (1, 'System Admin', 'admin@university.edu', '${hash}', 'admin')`);
    // Faculty (department_id set)
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (2, 'Dr. Alan Turing', 'turing@university.edu', '${hash}', 'faculty', 1)`);
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (3, 'Prof. Grace Hopper', 'hopper@university.edu', '${hash}', 'faculty', 1)`);
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (4, 'Dr. Nikola Tesla', 'tesla@university.edu', '${hash}', 'faculty', 2)`);
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (5, 'Dr. Emmy Noether', 'noether@university.edu', '${hash}', 'faculty', 3)`);
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (6, 'Dr. Richard Feynman', 'feynman@university.edu', '${hash}', 'faculty', 4)`);
    db.run(`INSERT INTO users (id, name, email, password, role, department_id) VALUES (7, 'Prof. Shakespeare', 'shakespeare@university.edu', '${hash}', 'faculty', 5)`);
    // Students (program_id set)
    db.run(`INSERT INTO users (id, name, email, password, role, program_id) VALUES (8, 'Alice Johnson', 'alice@student.edu', '${hash}', 'student', 1)`);
    db.run(`INSERT INTO users (id, name, email, password, role, program_id) VALUES (9, 'Bob Smith', 'bob@student.edu', '${hash}', 'student', 1)`);
    db.run(`INSERT INTO users (id, name, email, password, role, program_id) VALUES (10, 'Charlie Davis', 'charlie@student.edu', '${hash}', 'student', 2)`);
    db.run(`INSERT INTO users (id, name, email, password, role, program_id) VALUES (11, 'Diana Martinez', 'diana@student.edu', '${hash}', 'student', 3)`);

    // ─── Seed: Sections (Fall 2026) ──────────────────────────────────────────
    const sections = [
      // course_id, semester, year, instructor_id, max_seats, schedule_time, room
      [1, 'Fall', 2026, 2, 35, 'Mon 09-11', 'ENG-101'],
      [1, 'Fall', 2026, 3, 35, 'Wed 09-11', 'ENG-102'],
      [2, 'Fall', 2026, 2, 30, 'Tue 10-12', 'ENG-201'],
      [3, 'Fall', 2026, 3, 30, 'Thu 10-12', 'ENG-202'],
      [4, 'Fall', 2026, 2, 25, 'Mon 14-16', 'ENG-301'],
      [5, 'Fall', 2026, 3, 25, 'Wed 14-16', 'ENG-302'],
      [6, 'Fall', 2026, 2, 25, 'Fri 10-12', 'ENG-303'],
      [7, 'Fall', 2026, 3, 20, 'Tue 14-16', 'ENG-401'],
      [8, 'Fall', 2026, 2, 20, 'Thu 14-16', 'ENG-402'],
      [9, 'Fall', 2026, 2, 2, 'Mon 10-12', 'AI-LAB'],     // only 2 seats (to test waitlist!)
      [10, 'Fall', 2026, 3, 30, 'Fri 14-16', 'CS-LAB'],
      [11, 'Fall', 2026, 2, 25, 'Wed 10-12', 'SEC-201'],
      [12, 'Fall', 2026, 3, 30, 'Mon 16-18', 'WEB-101'],
      [13, 'Fall', 2026, 3, 20, 'Wed 16-18', 'CS-LAB'],
      [14, 'Fall', 2026, 2, 20, 'Tue 16-18', 'CS-LAB'],
      [15, 'Fall', 2026, 3, 20, 'Thu 16-18', 'DB-LAB'],
      [16, 'Fall', 2026, 5, 40, 'Mon 09-11', 'MATH-101'],
      [17, 'Fall', 2026, 5, 40, 'Wed 09-11', 'MATH-102'],
      [18, 'Fall', 2026, 5, 30, 'Tue 13-15', 'MATH-201'],
      [19, 'Fall', 2026, 5, 30, 'Thu 09-11', 'MATH-202'],
      [20, 'Fall', 2026, 5, 35, 'Fri 09-11', 'MATH-301'],
      [21, 'Fall', 2026, 6, 40, 'Mon 13-15', 'PHYS-101'],
      [22, 'Fall', 2026, 6, 35, 'Wed 13-15', 'PHYS-102'],
      [23, 'Fall', 2026, 7, 40, 'Tue 09-11', 'LIT-101'],
      [24, 'Fall', 2026, 7, 30, 'Thu 13-15', 'LIT-201'],
      [25, 'Fall', 2026, 4, 30, 'Mon 10-12', 'EE-101'],
      [26, 'Fall', 2026, 4, 25, 'Wed 10-12', 'EE-201'],
      [27, 'Fall', 2026, 4, 25, 'Fri 10-12', 'EE-301'],
      [28, 'Fall', 2026, null, 30, 'Thu 15-17', 'BUS-101'],
      [29, 'Fall', 2026, null, 25, 'Fri 13-15', 'BUS-301'],
    ];

    const stmtSection = db.prepare(
      'INSERT INTO sections (course_id, semester, year, instructor_id, max_seats, schedule_time, room) VALUES (?,?,?,?,?,?,?)'
    );
    for (const s of sections) stmtSection.run(s);
    stmtSection.finalize();

    // ─── Seed: Some enrollments for Alice (student id=8) ─────────────────────
    // She has completed: CS101(section 1), MATH101(section 17), PHYS101(section 22), LIT101(section 24)
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (8, 1, 'enrolled')`);   // CS101
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (8, 17, 'enrolled')`);  // MATH101
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (8, 22, 'enrolled')`);  // PHYS101
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (8, 24, 'enrolled')`);  // LIT101

    // ─── Seed: Fill ML section to test waitlist ──────────────────────────────
    // Section 10 = ML (CS450), max_seats=2
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (9, 10, 'enrolled')`);   // Bob in ML
    db.run(`INSERT INTO enrollments (user_id, section_id, status) VALUES (10, 10, 'enrolled')`);  // Charlie in ML

    // ─── Seed: A pending special request ─────────────────────────────────────
    db.run(`INSERT INTO special_requests (student_id, section_id, reason) VALUES (8, 3, 'I have completed equivalent coursework via a summer bootcamp and my advisor approved the equivalency.')`);

    // ─── Welcome notifications ───────────────────────────────────────────────
    db.run(`INSERT INTO notifications (user_id, type, message) VALUES (8, 'welcome', 'Welcome to Fall 2026 registration, Alice! Browse courses and start building your schedule.')`);
    db.run(`INSERT INTO notifications (user_id, type, message) VALUES (9, 'welcome', 'Welcome to Fall 2026 registration, Bob!')`);

    console.log('✅ Database seeded successfully with university data!');
    console.log('');
    console.log('Test Accounts (all passwords: password123):');
    console.log('  Admin:   admin@university.edu');
    console.log('  Faculty: turing@university.edu, hopper@university.edu, tesla@university.edu');
    console.log('  Student: alice@student.edu, bob@student.edu, charlie@student.edu');
  });
}

seed();
