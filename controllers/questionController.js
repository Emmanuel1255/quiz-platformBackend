const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');

// @desc    Add a question to a quiz
// @route   POST /api/quizzes/:quizId/questions
// @access  Private/Lecturer
const addQuestion = async (req, res) => {
  try {
    const { questionText, questionType, options, points } = req.body;
    const quizId = req.params.quizId;

    // Find the quiz
    const quiz = await Quiz.findById(quizId);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate options based on question type
    if (questionType === 'multiple-choice') {
      // Ensure we have at least 2 options
      if (!options || options.length < 2) {
        return res.status(400).json({ 
          message: 'Multiple choice questions must have at least 2 options' 
        });
      }
      
      // Ensure at least one option is marked as correct
      const hasCorrectOption = options.some(option => option.isCorrect === true);
      if (!hasCorrectOption) {
        return res.status(400).json({ 
          message: 'At least one option must be marked as correct' 
        });
      }
    } else if (questionType === 'true-false') {
      // Ensure we have exactly 2 options (True and False)
      if (!options || options.length !== 2) {
        return res.status(400).json({ 
          message: 'True/False questions must have exactly 2 options' 
        });
      }
      
      // Ensure one and only one option is marked as correct
      const correctCount = options.filter(option => option.isCorrect === true).length;
      if (correctCount !== 1) {
        return res.status(400).json({ 
          message: 'True/False questions must have exactly one correct option' 
        });
      }
    }

    // Create the question
    const question = await Question.create({
      quizId,
      questionText,
      questionType,
      options,
      points: points || 1,
      creator: req.user._id,
    });

    // Add the question to the quiz
    quiz.questions.push(question._id);
    await quiz.save();

    res.status(201).json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Bulk upload questions
// @route   POST /api/quizzes/:quizId/questions/bulk-upload
// @access  Private/Lecturer
const bulkUploadQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const fileBuffer = req.file.buffer;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    let questions = [];
    
    // Parse the file based on its extension
    if (fileExtension === '.csv') {
      // Parse CSV file from buffer
      questions = await parseCSVBuffer(fileBuffer);
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      // Parse Excel file from buffer
      questions = parseExcelBuffer(fileBuffer);
    }

    // Validate and save questions
    const results = await processQuestions(questions, quiz._id, req.user._id);

    res.json({
      message: 'Questions uploaded successfully',
      successCount: results.successCount,
      errorCount: results.errorCount,
      errors: results.errors
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Helper function to parse CSV buffer
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    // Create a readable stream from buffer
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Helper function to parse Excel buffer
const parseExcelBuffer = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(worksheet);
};

// Helper function to process and validate questions (remains mostly the same)
const processQuestions = async (questions, quizId, creatorId) => {
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const savedQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    try {
      const questionData = questions[i];
      
      // Basic validation
      if (!questionData.questionText || !questionData.questionType) {
        errors.push(`Row ${i + 2}: Missing required fields (questionText or questionType)`);
        errorCount++;
        continue;
      }

      // Validate question type
      if (!['multiple-choice', 'true-false'].includes(questionData.questionType)) {
        errors.push(`Row ${i + 2}: Invalid question type (should be "multiple-choice" or "true-false")`);
        errorCount++;
        continue;
      }

      // Process options
      const options = [];
      let hasCorrectOption = false;

      // For multiple choice questions
      if (questionData.questionType === 'multiple-choice') {
        for (let j = 1; j <= 4; j++) {
          const optionText = questionData[`option${j}`];
          const isCorrect = String(questionData[`option${j}Correct`]).toUpperCase() === 'TRUE';
          
          if (optionText) {
            options.push({ text: optionText, isCorrect });
            if (isCorrect) hasCorrectOption = true;
          }
        }

        // Need at least 2 options for multiple choice
        if (options.length < 2) {
          errors.push(`Row ${i + 2}: Multiple choice questions must have at least 2 options`);
          errorCount++;
          continue;
        }
      } 
      // For true/false questions
      else if (questionData.questionType === 'true-false') {
        options.push({ text: 'True', isCorrect: String(questionData.option1Correct).toUpperCase() === 'TRUE' });
        options.push({ text: 'False', isCorrect: String(questionData.option2Correct).toUpperCase() === 'TRUE' });
        
        // Exactly one option must be correct for true/false
        const correctCount = options.filter(opt => opt.isCorrect).length;
        if (correctCount !== 1) {
          errors.push(`Row ${i + 2}: True/False questions must have exactly one correct option`);
          errorCount++;
          continue;
        }
        
        hasCorrectOption = true;
      }

      // At least one option must be correct
      if (!hasCorrectOption) {
        errors.push(`Row ${i + 2}: Question must have at least one correct option`);
        errorCount++;
        continue;
      }

      // Create and save the question
      const question = new Question({
        quizId,
        questionText: questionData.questionText,
        questionType: questionData.questionType,
        options,
        points: parseInt(questionData.points) || 1,
        creator: creatorId,
      });

      const savedQuestion = await question.save();
      savedQuestions.push(savedQuestion._id);
      successCount++;
    } catch (error) {
      console.error(`Error processing row ${i + 2}:`, error);
      errors.push(`Row ${i + 2}: ${error.message}`);
      errorCount++;
    }
  }

  // Add the saved questions to the quiz
  if (savedQuestions.length > 0) {
    await Quiz.findByIdAndUpdate(
      quizId,
      { $push: { questions: { $each: savedQuestions } } }
    );
  }

  return { successCount, errorCount, errors };
};

// @desc    Update a question
// @route   PUT /api/questions/:id
// @access  Private/Lecturer
const updateQuestion = async (req, res) => {
  try {
    const { questionText, questionType, options, points } = req.body;
    
    let question = await Question.findById(req.params.id);

    // Check if question exists
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the creator
    if (question.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate options based on question type
    if (questionType === 'multiple-choice') {
      // Ensure we have at least 2 options
      if (!options || options.length < 2) {
        return res.status(400).json({ 
          message: 'Multiple choice questions must have at least 2 options' 
        });
      }
      
      // Ensure at least one option is marked as correct
      const hasCorrectOption = options.some(option => option.isCorrect === true);
      if (!hasCorrectOption) {
        return res.status(400).json({ 
          message: 'At least one option must be marked as correct' 
        });
      }
    } else if (questionType === 'true-false') {
      // Ensure we have exactly 2 options (True and False)
      if (!options || options.length !== 2) {
        return res.status(400).json({ 
          message: 'True/False questions must have exactly 2 options' 
        });
      }
      
      // Ensure one and only one option is marked as correct
      const correctCount = options.filter(option => option.isCorrect === true).length;
      if (correctCount !== 1) {
        return res.status(400).json({ 
          message: 'True/False questions must have exactly one correct option' 
        });
      }
    }

    // Update the question
    question.questionText = questionText || question.questionText;
    question.questionType = questionType || question.questionType;
    if (options) question.options = options;
    if (points) question.points = points;

    await question.save();

    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a question
// @route   DELETE /api/questions/:id
// @access  Private/Lecturer
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    // Check if question exists
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Check if user is the creator
    if (question.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Remove the question from the quiz
    await Quiz.findByIdAndUpdate(
      question.quizId,
      { $pull: { questions: question._id } }
    );

    // Delete the question
    await question.remove();

    res.json({ message: 'Question removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Bulk upload questions as JSON data
// @route   POST /api/quizzes/:quizId/questions/bulk-upload-json
// @access  Private/Lecturer
const bulkUploadQuestionsAsJson = async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'No valid questions data provided' });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    // Check if quiz exists
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is the creator
    if (quiz.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Process the questions directly from JSON
    const results = await processQuestions(questions, quiz._id, req.user._id);

    res.json({
      message: 'Questions uploaded successfully',
      successCount: results.successCount,
      errorCount: results.errorCount,
      errors: results.errors
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  addQuestion,
  updateQuestion,
  deleteQuestion,
  bulkUploadQuestions,
  bulkUploadQuestionsAsJson,
};