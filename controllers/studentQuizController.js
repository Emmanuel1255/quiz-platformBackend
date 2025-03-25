const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');

// @desc    Get all published quizzes
// @route   GET /api/student/quizzes
// @access  Private/Student
const getPublishedQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ isPublished: true })
      .select('-questions')
      .populate('creator', 'name');

    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get quiz details for a student
// @route   GET /api/student/quizzes/:id
// @access  Private/Student
const getQuizDetailsForStudent = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({
      _id: req.params.id,
      isPublished: true,
    })
      .select('-questions.options.isCorrect')
      .populate('creator', 'name');

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found or not published' });
    }

    // Check if student has attempted this quiz before
    const attempts = await QuizAttempt.find({
      quiz: quiz._id,
      student: req.user._id,
    }).select('startTime endTime isCompleted score maxScore');

    res.json({
      quiz,
      attempts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get quiz attempt by ID
// @route   GET /api/student/attempts/:id
// @access  Private/Student
const getQuizAttemptById = async (req, res) => {
    try {
      const attempt = await QuizAttempt.findOne({
        _id: req.params.id,
        student: req.user._id,
      }).populate({
        path: 'quiz',
        populate: {
          path: 'questions',
          select: '-options.isCorrect', // Don't send correct answers to client
        },
      });
  
      if (!attempt) {
        return res.status(404).json({ message: 'Quiz attempt not found' });
      }
  
      res.json(attempt);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error' });
    }
  };

  const getAttemptResults = async (req, res) => {
    try {
      const attempt = await QuizAttempt.findOne({
        _id: req.params.attemptId,
        student: req.user._id,
        isCompleted: true,
      })
        .populate('quiz', 'title description duration')
        .populate({
          path: 'answers.questionId',
          model: 'Question',
          select: 'questionText questionType options points',
        });
  
      if (!attempt) {
        return res.status(404).json({ message: 'Completed quiz attempt not found' });
      }
  
      // Add the isScorePublished field to the response
      const result = {
        ...attempt.toObject(),
        isScorePublished: attempt.isScorePublished
      };
  
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error' });
    }
  };

// @desc    Start a new quiz attempt
// @route   POST /api/student/quizzes/:id/start
// @access  Private/Student
const startQuizAttempt = async (req, res) => {
    try {
      const quiz = await Quiz.findOne({
        _id: req.params.id,
        isPublished: true,
      }).populate('questions');
  
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found or not published' });
      }
  
      // Check if user has already completed this quiz
      const completedAttempt = await QuizAttempt.findOne({
        quiz: quiz._id,
        student: req.user._id,
        isCompleted: true,
      });
  
      if (completedAttempt) {
        return res.status(403).json({ 
          message: 'You have already completed this quiz and cannot attempt it again' 
        });
      }
  
      // Check for ongoing attempts
      const ongoingAttempt = await QuizAttempt.findOne({
        quiz: quiz._id,
        student: req.user._id,
        isCompleted: false,
      });
  
      if (ongoingAttempt) {
        return res.json(ongoingAttempt);
      }
  
      // Create a new attempt
      const attempt = await QuizAttempt.create({
        quiz: quiz._id,
        student: req.user._id,
        startTime: new Date(),
        answers: quiz.questions.map((question) => ({
          questionId: question._id,
          selectedOptions: [],
        })),
      });
  
      // Return the attempt with the quiz questions
      const populatedAttempt = await QuizAttempt.findById(attempt._id)
        .populate({
          path: 'quiz',
          populate: {
            path: 'questions',
            select: '-options.isCorrect', // Don't send correct answers to client
          },
        });
  
      res.status(201).json(populatedAttempt);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server Error' });
    }
  };

// @desc    Save an answer for a question
// @route   PUT /api/student/attempts/:attemptId/answer
// @access  Private/Student
const saveAnswer = async (req, res) => {
  try {
    const { questionId, selectedOptions } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: 'Question ID is required' });
    }

    // Find the attempt
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      isCompleted: false,
    });

    if (!attempt) {
      return res.status(404).json({ message: 'Active quiz attempt not found' });
    }

    // Update the answer for this question
    const answerIndex = attempt.answers.findIndex(
      (a) => a.questionId.toString() === questionId
    );

    if (answerIndex >= 0) {
      attempt.answers[answerIndex].selectedOptions = selectedOptions || [];
    } else {
      attempt.answers.push({
        questionId,
        selectedOptions: selectedOptions || [],
      });
    }

    await attempt.save();
    res.json({ message: 'Answer saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Submit a quiz attempt
// @route   PUT /api/student/attempts/:attemptId/submit
// @access  Private/Student
const submitQuizAttempt = async (req, res) => {
  try {
    const { submissionReason } = req.body || { submissionReason: 'manual' };

    // Find the attempt
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      isCompleted: false,
    });

    if (!attempt) {
      return res.status(404).json({ message: 'Active quiz attempt not found' });
    }

    // Mark as completed
    attempt.isCompleted = true;
    attempt.endTime = new Date();
    attempt.submittedAutomatically = submissionReason !== 'manual';
    attempt.submissionReason = submissionReason;

    // Calculate score
    await attempt.calculateScore();

    const result = await QuizAttempt.findById(attempt._id)
      .populate('quiz', 'title description duration')
      .select('score maxScore startTime endTime submissionReason');

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Register time away from quiz
// @route   PUT /api/student/attempts/:attemptId/away
// @access  Private/Student
const registerTimeAway = async (req, res) => {
  try {
    const { action } = req.body; // 'start' or 'end'
    
    if (!['start', 'end'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    // Find the attempt
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
      isCompleted: false,
    });

    if (!attempt) {
      return res.status(404).json({ message: 'Active quiz attempt not found' });
    }

    // Handle starting away time
    if (action === 'start') {
      attempt.timeAway.lastAway = new Date();
      await attempt.save();
      return res.json({ message: 'Away time started' });
    }
    
    // Handle ending away time
    if (action === 'end' && attempt.timeAway.lastAway) {
      const awayDuration = (new Date() - new Date(attempt.timeAway.lastAway)) / 1000; // seconds
      attempt.timeAway.count += 1;
      attempt.timeAway.totalDuration += awayDuration;
      attempt.timeAway.lastAway = null;
      
      // If away for more than 3 minutes (180 seconds), auto-submit
      if (awayDuration > 180) {
        attempt.isCompleted = true;
        attempt.endTime = new Date();
        attempt.submittedAutomatically = true;
        attempt.submissionReason = 'away_too_long';
        await attempt.calculateScore();
        
        return res.json({ 
          autoSubmitted: true,
          message: 'Quiz auto-submitted due to inactivity',
          score: attempt.score,
          maxScore: attempt.maxScore
        });
      }
      
      await attempt.save();
      return res.json({ message: 'Away time ended', autoSubmitted: false });
    }
    
    res.status(400).json({ message: 'Invalid state for away action' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};


module.exports = {
  getPublishedQuizzes,
  getQuizDetailsForStudent,
  startQuizAttempt,
  saveAnswer,
  submitQuizAttempt,
  registerTimeAway,
  getAttemptResults,
  getQuizAttemptById,
};