const pool = require("../config/db");

async function createApplication(application) {
  const query = `
    INSERT INTO applications
    (application_id, job_id, member_id, recruiter_id, resume_text, cover_letter, status, recruiter_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    application.application_id,
    application.job_id,
    application.member_id,
    application.recruiter_id || null,
    application.resume_text || null,
    application.cover_letter || null,
    application.status || "submitted",
    application.recruiter_note || null
  ];

  const [result] = await pool.execute(query, values);
  return result;
}

async function findDuplicate(job_id, member_id) {
  const [rows] = await pool.execute(
    "SELECT * FROM applications WHERE job_id = ? AND member_id = ?",
    [job_id, member_id]
  );
  return rows[0];
}

async function findById(application_id) {
  const [rows] = await pool.execute(
    "SELECT * FROM applications WHERE application_id = ?",
    [application_id]
  );
  return rows[0];
}

async function findByMember(member_id) {
  const [rows] = await pool.execute(
    "SELECT * FROM applications WHERE member_id = ? ORDER BY created_at DESC",
    [member_id]
  );
  return rows;
}

async function findByJob(job_id) {
  const [rows] = await pool.execute(
    "SELECT * FROM applications WHERE job_id = ? ORDER BY created_at DESC",
    [job_id]
  );
  return rows;
}

module.exports = {
  createApplication,
  findDuplicate,
  findById,
  findByMember,
  findByJob
};