const express = require('express');
const router = express.Router();
const { protect, lecturer } = require('../middlewares/authMiddleware');
const {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  publishQuizResults,
  getQuizAttempts,
} = require('../controllers/quizController');
const { addQuestion } = require('../controllers/questionController');

// Protect all quiz routes
router.use(protect);

// Quiz routes
router.route('/')
  .post(lecturer, createQuiz)
  .get(lecturer, getQuizzes);

router.route('/:id')
  .get(lecturer, getQuizById)
  .put(lecturer, updateQuiz)
  .delete(lecturer, deleteQuiz);

// Question routes
router.route('/:quizId/questions')
  .post(lecturer, addQuestion);

router.put('/:quizId/publish-results', lecturer, publishQuizResults);
router.get('/:quizId/attempts', lecturer, getQuizAttempts);

module.exports = router;