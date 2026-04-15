'use strict'

const express = require('express')
const ctrl = require('../controllers/jobsController')

const router = express.Router()

router.post('/create', ctrl.create)
router.post('/get', ctrl.get)
router.post('/update', ctrl.update)
router.post('/close', ctrl.close)
router.post('/view', ctrl.view)
router.post('/save', ctrl.save)
router.post('/search', ctrl.search)
router.post('/byRecruiter', ctrl.byRecruiter)

module.exports = router
