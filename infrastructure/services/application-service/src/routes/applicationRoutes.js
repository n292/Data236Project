const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const applicationController = require("../controllers/applicationController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads", "resumes"));
  },
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/\s+/g, "_");
    const uniqueName = `${Date.now()}-${safeOriginalName}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Member-only: submit application, view own applications
router.post("/submit", ...requireRole("member"), upload.single("resume"), applicationController.submitApplication);
router.post("/byMember", ...requireRole("member"), applicationController.getApplicationsByMember);

// Recruiter-only: review applications, update status, add notes
router.post("/byJob",         ...requireRole("recruiter"), applicationController.getApplicationsByJob);
router.post("/updateStatus",  ...requireRole("recruiter"), applicationController.updateApplicationStatus);
router.post("/addNote",       ...requireRole("recruiter"), applicationController.addRecruiterNote);

// Open: get single application (used internally)
router.post("/get", applicationController.getApplication);
router.get("/draft/:job_id/:member_id", applicationController.getDraft);

module.exports = router;