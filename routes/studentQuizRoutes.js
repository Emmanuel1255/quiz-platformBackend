const express = require('express');
const router = express.Router();
const { protect, student } = require('../middlewares/authMiddleware');
const {
  getPublishedQuizzes,
  getQuizDetailsForStudent,
  startQuizAttempt,
  saveAnswer,
  submitQuizAttempt,
  registerTimeAway,
  getAttemptResults,
  getQuizAttemptById,
} = require('../controllers/studentQuizController');

// Protect all routes
router.use(protect);
router.use(student);

// Quiz routes
router.get('/quizzes', getPublishedQuizzes);
router.get('/quizzes/:id', getQuizDetailsForStudent);
router.post('/quizzes/:id/start', startQuizAttempt);

// Attempt routes
router.put('/attempts/:attemptId/answer', saveAnswer);
router.put('/attempts/:attemptId/submit', submitQuizAttempt);
router.put('/attempts/:attemptId/away', registerTimeAway);
router.get('/attempts/:attemptId/results', getAttemptResults);
router.get('/attempts/:id', getQuizAttemptById);

module.exports = router;