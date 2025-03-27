const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const quizRoutes = require('./quizRoutes');
const questionRoutes = require('./questionRoutes');
const studentQuizRoutes = require('./studentQuizRoutes');
const userRoutes = require('./userRoutes');


// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'API is working correctly' });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/quizzes', quizRoutes);
router.use('/questions', questionRoutes);
router.use('/student', studentQuizRoutes);
router.use('/users', userRoutes);

module.exports = router;