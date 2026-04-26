const pool = require("../config/db");

async function createApplication(application) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const query = `
      INSERT INTO applications
      (
        application_id,
        job_id,
        member_id,
        recruiter_id,
        resume_text,
        resume_file_name,
        resume_file_path,
        cover_letter,
        status,
        recruiter_note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      application.application_id,
      application.job_id,
      application.member_id,
      application.recruiter_id || null,
      application.resume_text || null,
      application.resume_file_name || null,
      application.resume_file_path || null,
      application.cover_letter || null,
      application.status || "submitted",
      application.recruiter_note || null,
    ];

    const [result] = await conn.execute(query, values);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

async function updateStatus(application_id, status) {
  const [result] = await pool.execute(
    "UPDATE applications SET status = ? WHERE application_id = ?",
    [status, application_id]
  );
  return result;
}

async function addNote(application_id, recruiter_note) {
  const [result] = await pool.execute(
    "UPDATE applications SET recruiter_note = ? WHERE application_id = ?",
    [recruiter_note, application_id]
  );
  return result;
}

module.exports = {
  createApplication,
  findDuplicate,
  findById,
  findByMember,
  findByJob,
  updateStatus,
  addNote,
};