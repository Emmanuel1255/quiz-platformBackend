const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    questionType: {
      type: String,
      enum: ['multiple-choice', 'true-false'],
      required: true,
    },
    options: [
      {
        text: String,
        isCorrect: Boolean,
      },
    ],
    points: {
      type: Number,
      default: 1,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;