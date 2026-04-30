const pool = require("../src/config/db");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");

const JOB_IDS = ["job-001", "job-002", "job-003", "job-004", "job-005"];
const RECRUITER_IDS = ["rec-001", "rec-002", "rec-003"];
const STATUSES = ["submitted", "reviewed", "accepted", "rejected"];

const CSV_PATH = path.join(__dirname, "Resume", "Resume.csv");
const MAX_ROWS = 100;

async function seed() {
  console.log("Reading Resume.csv...");

  if (!fs.existsSync(CSV_PATH)) {
    console.error("ERROR: Resume.csv not found at", CSV_PATH);
    process.exit(1);
  }

  const records = [];
  const parser = fs
    .createReadStream(CSV_PATH)
    .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

  for await (const row of parser) {
    if (records.length >= MAX_ROWS) break;
    records.push(row);
  }

  console.log(`Found ${records.length} rows.`);
  console.log("Columns found:", Object.keys(records[0]));

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    const application_id = uuidv4();
    const job_id         = JOB_IDS[i % JOB_IDS.length];
    const member_id      = `mem-${String(i + 1).padStart(3, "0")}`;
    const recruiter_id   = RECRUITER_IDS[i % RECRUITER_IDS.length];
    const status         = STATUSES[i % STATUSES.length];

    const resume_text = row["Resume_str"] || row["resume_str"] || row["Resume"] || row["resume"] || row["Text"] || "";
    const category    = row["Category"] || row["category"] || "";

    try {
      await pool.execute(
        `INSERT IGNORE INTO applications
          (application_id, job_id, member_id, recruiter_id, resume_text,
           resume_file_name, resume_file_path, cover_letter, status, recruiter_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          application_id,
          job_id,
          member_id,
          recruiter_id,
          resume_text.toString().substring(0, 5000),
          null,
          null,
          `I am applying for ${job_id}. My background is in ${category || "software engineering"}.`,
          status,
          null,
        ]
      );
      console.log(`✓ [${i + 1}/${records.length}] ${member_id} → ${job_id} (${status}) [${category}]`);
      success++;
    } catch (e) {
      console.error(`✗ Failed row ${i + 1}:`, e.message);
      skipped++;
    }
  }

  console.log(`\nDone! ${success} seeded, ${skipped} skipped.`);
  process.exit(0);
}

seed();