const { v4: uuidv4 } = require("uuid");
const applicationModel = require("../models/applicationModel");

async function submitApplication(req, res) {
  try {
    const { job_id, member_id, recruiter_id, resume_text, cover_letter } = req.body;

    if (!job_id || !member_id) {
      return res.status(400).json({
        message: "job_id and member_id are required"
      });
    }

    // TEMP: simulate closed job check
    const closedJobs = ["job999"];

    if (closedJobs.includes(job_id)) {
    return res.status(400).json({
        message: "Cannot apply to a closed job"
    });
    }
    const duplicate = await applicationModel.findDuplicate(job_id, member_id);

    if (duplicate) {
      return res.status(409).json({
        message: "Duplicate application not allowed"
      });
    }

    const application = {
      application_id: uuidv4(),
      job_id,
      member_id,
      recruiter_id,
      resume_text,
      cover_letter,
      status: "submitted",
      recruiter_note: null
    };

    await applicationModel.createApplication(application);

    return res.status(201).json({
      message: "Application submitted successfully",
      application
    });
  } catch (error) {
    console.error("submitApplication error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

async function getApplication(req, res) {
  try {
    const { application_id } = req.body;

    if (!application_id) {
      return res.status(400).json({
        message: "application_id is required"
      });
    }

    const application = await applicationModel.findById(application_id);

    if (!application) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("getApplication error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

async function getApplicationsByMember(req, res) {
  try {
    const { member_id } = req.body;

    if (!member_id) {
      return res.status(400).json({
        message: "member_id is required"
      });
    }

    const applications = await applicationModel.findByMember(member_id);

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getApplicationsByMember error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

async function getApplicationsByJob(req, res) {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({
        message: "job_id is required"
      });
    }

    const applications = await applicationModel.findByJob(job_id);

    return res.status(200).json(applications);
  } catch (error) {
    console.error("getApplicationsByJob error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const { application_id, status } = req.body;
    console.log("updateApplicationStatus called with:", application_id, status);

    if (!application_id || !status) {
      return res.status(400).json({
        message: "application_id and status are required"
      });
    }

    const allowedStatuses = ["submitted", "reviewed", "accepted", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Allowed values: submitted, reviewed, accepted, rejected"
      });
    }

    const existingApplication = await applicationModel.findById(application_id);

    if (!existingApplication) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    await applicationModel.updateStatus(application_id, status);

    return res.status(200).json({
      message: "Application status updated successfully"
    });
  } catch (error) {
    console.error("updateApplicationStatus error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

async function addRecruiterNote(req, res) {
  try {
    const { application_id, recruiter_note } = req.body;
    console.log("addRecruiterNote called with:", application_id, recruiter_note);

    if (!application_id || !recruiter_note) {
      return res.status(400).json({
        message: "application_id and recruiter_note are required"
      });
    }

    const existingApplication = await applicationModel.findById(application_id);

    if (!existingApplication) {
      return res.status(404).json({
        message: "Application not found"
      });
    }

    await applicationModel.addNote(application_id, recruiter_note);

    return res.status(200).json({
      message: "Recruiter note added successfully"
    });
  } catch (error) {
    console.error("addRecruiterNote error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

module.exports = {
  submitApplication,
  getApplication,
  getApplicationsByMember,
  getApplicationsByJob,
  updateApplicationStatus,
  addRecruiterNote
};