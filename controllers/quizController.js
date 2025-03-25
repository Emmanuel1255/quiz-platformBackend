const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');

// @desc    Create a new quiz
// @route   POST /api/quizzes
// @access  Private/Lecturer
const createQuiz = async (req, res) => {
  try {
    const { title, description, duration, isPublished } = req.body;

    const quiz = await Quiz.create({
      title,
      description,
      duration: duration || 60,
      isPublished: isPublished || false,
      creator: req.user._id,
      questions: [],
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all quizzes for a lecturer
// @route   GET /api/quizzes
// @access  Private/Lecturer
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ creator: req.user._id })
      .sort({ createdAt: -1 })
      .select('-questions');

    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get a single quiz by ID with questions
// @route   GET /api/quizzes/:id
// @access  Private/Lecturer
const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('questions')
      .populate('creator', 'name email');

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a quiz
// @route   PUT /api/quizzes/:id
// @access  Private/Lecturer
const updateQuiz = async (req, res) => {
  try {
    const { title, description, duration, isPublished } = req.body;

    let quiz = await Quiz.findById(req.params.id);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update quiz
    quiz.title = title || quiz.title;
    quiz.description = description || quiz.description;
    quiz.duration = duration || quiz.duration;
    
    // Only update isPublished if it's provided
    if (isPublished !== undefined) {
      quiz.isPublished = isPublished;
    }

    await quiz.save();

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a quiz
// @route   DELETE /api/quizzes/:id
// @access  Private/Lecturer
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete all questions associated with this quiz
    await Question.deleteMany({ quizId: quiz._id });

    // Delete the quiz
    await quiz.remove();

    res.json({ message: 'Quiz removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Publish quiz results
// @route   PUT /api/quizzes/:quizId/publish-results
// @access  Private/Lecturer
const publishQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find all completed attempts for this quiz and publish their scores
    await QuizAttempt.updateMany(
      { quiz: quiz._id, isCompleted: true },
      { isScorePublished: true }
    );

    res.json({ message: 'Quiz results published successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};
// @desc    Get all quiz attempts for a specific quiz
// @route   GET /api/quizzes/:quizId/attempts
// @access  Private/Lecturer
const getQuizAttempts = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find all attempts for this quiz
    const attempts = await QuizAttempt.find({ quiz: quiz._id, isCompleted: true })
      .populate('student', 'name email registrationNumber')
      .sort({ endTime: -1 });

    res.json(attempts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  publishQuizResults,
  getQuizAttempts,
};