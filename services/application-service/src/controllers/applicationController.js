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
    const { job_id, member_id, recruiter_id, cover_letter } = req.body;
    const uploadedFile = req.file;

    if (!job_id || !member_id) {
      return res.status(400).json({
        message: "job_id and member_id are required",
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        message: "Resume PDF is required",
      });
    }

    const closed = await isJobClosed(job_id);
    if (closed) {
      return res.status(400).json({
        message: "Cannot apply to a closed job",
      });
    }

    const duplicate = await applicationModel.findDuplicate(job_id, member_id);

    if (duplicate) {
      return res.status(409).json({
        message: "Duplicate application not allowed",
      });
    }

    const application = {
      application_id: uuidv4(),
      job_id,
      member_id,
      recruiter_id,
      resume_text: null,
      resume_file_name: uploadedFile.originalname,
      resume_file_path: `uploads/resumes/${uploadedFile.filename}`,
      cover_letter,
      status: "submitted",
      recruiter_note: null,
    };

    await applicationModel.createApplication(application);

    return res.status(201).json({
      message: "Application submitted successfully",
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

    const allowedStatuses = ["submitted", "reviewed", "accepted", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Allowed values: submitted, reviewed, accepted, rejected",
      });
    }

    const existingApplication = await applicationModel.findById(application_id);

    if (!existingApplication) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    await applicationModel.updateStatus(application_id, status);
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

module.exports = {
  submitApplication,
  getApplication,
  getApplicationsByMember,
  getApplicationsByJob,
  updateApplicationStatus,
  addRecruiterNote,
};