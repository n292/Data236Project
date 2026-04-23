const express = require("express");
const router = express.Router();
const applicationController = require("../controllers/applicationController");

router.post("/submit", applicationController.submitApplication);
router.post("/get", applicationController.getApplication);
router.post("/byMember", applicationController.getApplicationsByMember);
router.post("/byJob", applicationController.getApplicationsByJob);

module.exports = router;