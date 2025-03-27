// In server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { protect, lecturer } = require('../middlewares/authMiddleware');
const { getStudents } = require('../controllers/userController');

// Routes for lecturers to manage students
router.get('/students', protect, lecturer, getStudents);

module.exports = router;