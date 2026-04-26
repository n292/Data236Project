const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const applicationController = require("../controllers/applicationController");

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
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/submit", upload.single("resume"), applicationController.submitApplication);
router.post("/get", applicationController.getApplication);
router.post("/byMember", applicationController.getApplicationsByMember);
router.post("/byJob", applicationController.getApplicationsByJob);
router.post("/updateStatus", applicationController.updateApplicationStatus);
router.post("/addNote", applicationController.addRecruiterNote);

module.exports = router;