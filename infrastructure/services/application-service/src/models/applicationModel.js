const pool = require("../config/db");

async function upsertApplication(application) {
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
        resume_url,
        cover_letter,
        metadata,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        resume_url = VALUES(resume_url),
        cover_letter = VALUES(cover_letter),
        metadata = VALUES(metadata),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
      application.application_id,
      application.job_id,
      application.member_id,
      application.recruiter_id || null,
      application.resume_url || null,
      application.cover_letter || null,
      application.metadata ? JSON.stringify(application.metadata) : null,
      application.status || "submitted",
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

async function createApplicationConn(conn, application) {
  const query = `
    INSERT INTO applications
    (application_id, job_id, member_id, recruiter_id, resume_url, cover_letter, metadata, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      resume_url = VALUES(resume_url),
      cover_letter = VALUES(cover_letter),
      metadata = VALUES(metadata),
      status = VALUES(status),
      updated_at = CURRENT_TIMESTAMP
  `;
  const values = [
    application.application_id,
    application.job_id,
    application.member_id,
    application.recruiter_id || null,
    application.resume_url || null,
    application.cover_letter || null,
    application.metadata ? JSON.stringify(application.metadata) : null,
    application.status || "submitted",
  ];
  const [result] = await conn.execute(query, values);
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
  upsertApplication,
  createApplicationConn,
  findDuplicate,
  findById,
  findByMember,
  findByJob,
  updateStatus,
  addNote,
};