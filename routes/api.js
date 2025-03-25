const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const quizRoutes = require('./quizRoutes');
const questionRoutes = require('./questionRoutes');
const studentQuizRoutes = require('./studentQuizRoutes');

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'API is working correctly' });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/quizzes', quizRoutes);
router.use('/questions', questionRoutes);
router.use('/student', studentQuizRoutes);

module.exports = router;