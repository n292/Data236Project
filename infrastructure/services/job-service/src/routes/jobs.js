'use strict'

const express = require('express')
const ctrl = require('../controllers/jobsController')
const { authenticate, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

// Recruiter-only: create, update, close, view their own jobs
router.post('/create',      ...requireRole('recruiter'), ctrl.create)
router.post('/update',      ...requireRole('recruiter'), ctrl.update)
router.post('/close',       ...requireRole('recruiter'), ctrl.close)
router.post('/byRecruiter', ...requireRole('recruiter'), ctrl.byRecruiter)

// Authenticated (any role): save/unsave a job, view saved jobs
router.post('/save',   authenticate, ctrl.save)
router.post('/unsave', authenticate, ctrl.unsave)
router.post('/saved',  authenticate, ctrl.savedByUser)

// Open: search, get, view (public job browsing)
router.post('/get',    ctrl.get)
router.post('/view',   ctrl.view)
router.post('/search', ctrl.search)

module.exports = router
