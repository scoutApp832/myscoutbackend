const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Scout Dashboard
router.get('/scout/dashboard/stats', authorize('scout', 'unit_leader'), dashboardController.getScoutStats);
router.get('/scout/dashboard/recent-activities', authorize('scout', 'unit_leader'), dashboardController.getScoutRecentActivities);
router.get('/scout/dashboard/upcoming-events', authorize('scout', 'unit_leader'), dashboardController.getScoutUpcomingEvents);

// District Dashboard
router.get('/district/dashboard/stats', authorize('district_commissioner'), dashboardController.getDistrictStats);
router.get('/district/dashboard/recent-activities', authorize('district_commissioner'), dashboardController.getDistrictRecentActivities);
router.get('/district/dashboard/upcoming-events', authorize('district_commissioner'), dashboardController.getDistrictUpcomingEvents);
router.get('/district/dashboard/announcements', authorize('district_commissioner'), dashboardController.getDistrictAnnouncements);
router.get('/district/dashboard/notifications', authorize('district_commissioner'), dashboardController.getDistrictNotifications);
router.get('/district/dashboard/chart-data', authorize('district_commissioner'), dashboardController.getDistrictChartData);
router.get('/district/dashboard/gender-distribution', authorize('district_commissioner'), dashboardController.getDistrictGenderData);

// National Dashboard
router.get('/national/dashboard/stats', authorize('national_commissioner'), dashboardController.getNationalStats);
router.get('/national/dashboard/recent-activities', authorize('national_commissioner'), dashboardController.getNationalRecentActivities);
router.get('/national/dashboard/upcoming-events', authorize('national_commissioner'), dashboardController.getNationalUpcomingEvents);
router.get('/national/dashboard/membership-by-district', authorize('national_commissioner'), dashboardController.getMembershipByDistrict);
router.get('/national/dashboard/gender-distribution', authorize('national_commissioner'), dashboardController.getNationalGenderData);
router.get('/national/dashboard/age-groups', authorize('national_commissioner'), dashboardController.getAgeGroups);
router.get('/national/dashboard/notifications', authorize('national_commissioner'), dashboardController.getNationalNotifications);

// Donor Dashboard
router.get('/donation/dashboard/stats', authorize('donor'), dashboardController.getDonorStats);
router.get('/donation/dashboard/recent-donations', authorize('donor'), dashboardController.getDonorRecentDonations);
router.get('/donation/dashboard/active-projects', authorize('donor'), dashboardController.getDonorActiveProjects);
router.get('/donation/dashboard/updates', authorize('donor'), dashboardController.getDonorUpdates);

module.exports = router;