const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { protect, checkRole } = require('../middleware/auth');

// All routes require authentication - using 'protect'
router.use(protect);

// National Commissioner only
router.get('/members', checkRole('national_commissioner', 'admin'), memberController.getAllMembers);
router.post('/members', checkRole('national_commissioner', 'admin'), memberController.createMember);
router.get('/members/:id', checkRole('national_commissioner', 'admin', 'district_commissioner'), memberController.getMemberById);
router.put('/members/:id', checkRole('national_commissioner', 'admin', 'district_commissioner'), memberController.updateMember);
router.delete('/members/:id', checkRole('national_commissioner', 'admin'), memberController.deleteMember);
router.put('/members/:id/status', checkRole('national_commissioner', 'admin'), memberController.toggleMemberStatus);
router.post('/members/:id/approve-fee', checkRole('national_commissioner', 'admin', 'district_commissioner'), memberController.approveFee);
router.post('/members/:id/generate-sin', checkRole('national_commissioner', 'admin'), memberController.generateSIN);

// District Commissioner only
router.get('/district/members', checkRole('district_commissioner'), memberController.getDistrictMembers);

module.exports = router;