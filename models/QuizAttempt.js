const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  selectedOptions: [{
    type: mongoose.Schema.Types.ObjectId,
  }],
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    answers: [answerSchema],
    score: {
      type: Number,
      default: 0,
    },
    maxScore: {
      type: Number,
      default: 0,
    },
    timeAway: {
      count: {
        type: Number,
        default: 0,
      },
      totalDuration: {
        type: Number,
        default: 0,
      },
      lastAway: {
        type: Date,
      },
    },
    submittedAutomatically: {
      type: Boolean,
      default: false,
    },
    submissionReason: {
      type: String,
      enum: ['manual', 'time_expired', 'away_too_long', null],
      default: null,
    },
    isScorePublished: {
        type: Boolean,
        default: false,
      },
  },
  { timestamps: true }
);

// Add method to calculate score
quizAttemptSchema.methods.calculateScore = async function() {
  let score = 0;
  let maxScore = 0;
  
  // Populate questions if they're not already
  const attempt = this.populated('quiz') 
    ? this 
    : await this.populate({
        path: 'quiz',
        populate: { path: 'questions' }
      });
  
  const questions = attempt.quiz.questions;
  
  // For each answer, check if the selected options match the correct ones
  for (const answer of this.answers) {
    const question = questions.find(q => q._id.toString() === answer.questionId.toString());
    
    if (question) {
      maxScore += question.points;
      
      // Get correct option IDs
      const correctOptionIds = question.options
        .filter(option => option.isCorrect)
        .map(option => option._id.toString());
      
      // Get selected option IDs
      const selectedOptionIds = answer.selectedOptions.map(id => id.toString());
      
      // For multiple choice, all selections must be correct
      if (question.questionType === 'multiple-choice') {
        const allCorrect = correctOptionIds.every(id => selectedOptionIds.includes(id)) &&
                          selectedOptionIds.every(id => correctOptionIds.includes(id));
        
        if (allCorrect) {
          score += question.points;
        }
      } 
      // For true/false, just need one correct selection
      else if (question.questionType === 'true-false') {
        if (selectedOptionIds.length === 1 && correctOptionIds.includes(selectedOptionIds[0])) {
          score += question.points;
        }
      }
    }
  }
  
  this.score = score;
  this.maxScore = maxScore;
  
  return this.save();
};

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt;