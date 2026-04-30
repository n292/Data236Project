const { publishApplicationSubmitted, publishStatusUpdated } = require("../kafka/producer");
const { v4: uuidv4 } = require("uuid");
const applicationModel = require("../models/applicationModel");

const fetch = require("node-fetch");

async function isJobClosed(job_id) {
  try {
    const res = await fetch(`${process.env.JOB_SERVICE_URL}/jobs/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id }),
    });
    const data = await res.json();
    return data?.status === "closed";
  } catch {
    return false; // if Job Service is down, don't block the applicant
  }
}

async function submitApplication(req, res) {
  try {
    let { job_id, member_id, resume_ref, cover_letter, metadata, is_draft } = req.body;
    const uploadedFile = req.file;

    // Handle FormData strings
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch (e) { metadata = {}; }
    }
    const isDraft = is_draft === 'true' || is_draft === true;

    console.log(`[DEBUG] submitApplication: job_id=${job_id}, member_id=${member_id}, is_draft=${isDraft}`);
    console.log(`[DEBUG] content-type: ${req.headers['content-type']}`);
    console.log(`[DEBUG] req.file:`, uploadedFile ? `${uploadedFile.filename} (${uploadedFile.size} bytes)` : 'UNDEFINED - no file received');
    console.log(`[DEBUG] resume_ref from body: ${resume_ref}`);

    if (!job_id || !member_id) {
      return res.status(400).json({
        message: "job_id and member_id are required",
      });
    }

    const closed = await isJobClosed(job_id);
    if (closed) {
      return res.status(400).json({
        message: "Cannot apply to a closed job",
      });
    }

    const duplicate = await applicationModel.findDuplicate(job_id, member_id);

    // If it's not a draft, and we have a submitted duplicate, block it.
    if (!isDraft && duplicate && duplicate.status !== 'draft') {
      return res.status(409).json({
        message: "Duplicate application not allowed",
      });
    }

    const application = {
      application_id: duplicate ? duplicate.application_id : uuidv4(),
      job_id,
      member_id,
      recruiter_id: req.body.recruiter_id || null,
      resume_url: uploadedFile
        ? `uploads/resumes/${uploadedFile.filename}`  // actual uploaded file always wins
        : (resume_ref || null),
      cover_letter,
      metadata: metadata || {},
      status: isDraft ? "draft" : "submitted",
    };

    console.log(`[DEBUG] application.resume_url being saved: ${application.resume_url}`);

    await applicationModel.upsertApplication(application);

    // Only produce Kafka event if it's a FINAL SUBMISSION
    if (!isDraft) {
      try {
        await publishApplicationSubmitted(application);
      } catch (kafkaErr) {
        console.error("Kafka publish failed (application persisted):", kafkaErr.message);
      }
    }

    return res.status(201).json({
      message: isDraft ? "Application saved as draft" : "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("submitApplication error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getApplication(req, res) {
  try {
    const { application_id } = req.body;

    if (!application_id) {
      return res.status(400).json({
        message: "application_id is required",
      });
    }

    const application = await applicationModel.findById(application_id);

    if (!application) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("getApplication error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getApplicationsByMember(req, res) {
  try {
    const { member_id } = req.body;

    if (!member_id) {
      return res.status(400).json({
        message: "member_id is required",
      });
    }

    const applications = await applicationModel.findByMember(member_id);

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getApplicationsByMember error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getApplicationsByJob(req, res) {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({
        message: "job_id is required",
      });
    }

    const applications = await applicationModel.findByJob(job_id);

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getApplicationsByJob error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const { application_id, status } = req.body;

    if (!application_id || !status) {
      return res.status(400).json({
        message: "application_id and status are required",
      });
    }

    const allowedStatuses = ["draft", "submitted", "reviewing", "rejected", "interview", "offer"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Allowed values: draft, submitted, reviewing, rejected, interview, offer",
      });
    }

    const existingApplication = await applicationModel.findById(application_id);

    if (!existingApplication) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    await applicationModel.updateStatus(application_id, status);
    await publishStatusUpdated(application_id, status, "recruiter");
    const updatedApplication = await applicationModel.findById(application_id);

    return res.status(200).json({
      message: "Application status updated successfully",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("updateApplicationStatus error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function addRecruiterNote(req, res) {
  try {
    const { application_id, recruiter_note } = req.body;

    if (!application_id || !recruiter_note) {
      return res.status(400).json({
        message: "application_id and recruiter_note are required",
      });
    }

    const existingApplication = await applicationModel.findById(application_id);

    if (!existingApplication) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    await applicationModel.addNote(application_id, recruiter_note);
    const updatedApplication = await applicationModel.findById(application_id);

    return res.status(200).json({
      message: "Recruiter note added successfully",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("addRecruiterNote error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

async function getDraft(req, res) {
  try {
    const { job_id, member_id } = req.params;
    if (!job_id || !member_id) {
      return res.status(400).json({ message: "job_id and member_id are required" });
    }
    const draft = await applicationModel.findDuplicate(job_id, member_id);
    if (!draft || draft.status !== 'draft') {
      return res.status(404).json({ message: "No draft found" });
    }
    return res.status(200).json(draft);
  } catch (error) {
    console.error("getDraft error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  submitApplication,
  getApplication,
  getApplicationsByMember,
  getApplicationsByJob,
  updateApplicationStatus,
  addRecruiterNote,
  getDraft,
};