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

module.exports = {
  submitApplication
};