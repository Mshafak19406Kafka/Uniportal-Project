const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run('PRAGMA foreign_keys = ON');
    initializeSchema();
  }
});

function initializeSchema() {
  db.serialize(() => {
    // --- University Hierarchy ---
    db.run(`CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dean_name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      FOREIGN KEY(college_id) REFERENCES colleges(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER,
      name TEXT NOT NULL,
      degree_type TEXT DEFAULT 'Bachelor',
      total_credits_required INTEGER DEFAULT 120,
      core_credits_required INTEGER DEFAULT 40,
      elective_credits_required INTEGER DEFAULT 40,
      gened_credits_required INTEGER DEFAULT 30,
      lab_credits_required INTEGER DEFAULT 10,
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`);

    // --- Courses ---
    db.run(`CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER,
      course_name TEXT NOT NULL,
      course_code TEXT UNIQUE NOT NULL,
      credits INTEGER NOT NULL,
      category TEXT DEFAULT 'Elective',
      description TEXT,
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS course_prerequisites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      prerequisite_course_id INTEGER NOT NULL,
      UNIQUE(course_id, prerequisite_course_id),
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(prerequisite_course_id) REFERENCES courses(id)
    )`);

    // --- Sections (a schedulable instance of a course) ---
    db.run(`CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      semester TEXT NOT NULL,
      year INTEGER NOT NULL,
      instructor_id INTEGER,
      max_seats INTEGER NOT NULL DEFAULT 30,
      schedule_time TEXT,
      room TEXT,
      FOREIGN KEY(course_id) REFERENCES courses(id),
      FOREIGN KEY(instructor_id) REFERENCES users(id)
    )`);

    // --- Users (extended with program_id and faculty_dept) ---
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      program_id INTEGER,
      department_id INTEGER,
      FOREIGN KEY(program_id) REFERENCES programs(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`);

    // --- Enrollments ---
    db.run(`CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      status TEXT DEFAULT 'enrolled',
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, section_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(section_id) REFERENCES sections(id)
    )`);

    // --- Waitlist ---
    db.run(`CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reserved_until DATETIME,
      UNIQUE(user_id, section_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(section_id) REFERENCES sections(id)
    )`);

    // --- Special Requests (prerequisite overrides, etc.) ---
    db.run(`CREATE TABLE IF NOT EXISTS special_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      section_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      faculty_id INTEGER,
      faculty_note TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES users(id),
      FOREIGN KEY(section_id) REFERENCES sections(id),
      FOREIGN KEY(faculty_id) REFERENCES users(id)
    )`);

    // --- Notifications ---
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
  });
}

// --- Promise Helpers ---
const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

module.exports = { db, runAsync, getAsync, allAsync };
