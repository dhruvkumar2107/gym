const { body, param, query, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

const validateRegistration = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('phone').optional().trim().isMobilePhone('en-IN').withMessage('Valid Indian phone number required'),
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  handleValidation
];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation
];

const validateContact = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('subject').optional().trim(),
  body('message').trim().notEmpty().withMessage('Message is required'),
  handleValidation
];

const validateFreeTrial = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('fitness_goal').optional().trim(),
  body('preferred_date').optional().isDate().withMessage('Valid date required'),
  body('preferred_time').optional().trim(),
  body('message').optional().trim(),
  handleValidation
];

const validateBlogPost = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('category').optional().trim(),
  body('tags').optional().isArray(),
  body('excerpt').optional().trim(),
  handleValidation
];

const validateTrainer = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('designation').optional().trim(),
  body('experience_years').optional().isInt({ min: 0 }).withMessage('Experience must be a positive number'),
  body('bio').optional().trim(),
  body('specializations').optional().isArray(),
  body('certifications').optional().isArray(),
  handleValidation
];

const validateMembershipPlan = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('duration_months').isInt({ min: 1 }).withMessage('Duration must be at least 1 month'),
  body('description').optional().trim(),
  body('original_price').optional().isFloat({ gt: 0 }),
  body('features').optional().isArray(),
  handleValidation
];

const validateFAQ = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required'),
  body('category').optional().trim(),
  handleValidation
];

const validateGallery = [
  body('title').optional().trim(),
  body('category').optional().trim(),
  body('description').optional().trim(),
  handleValidation
];

const validateTestimonial = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('testimonial').trim().notEmpty().withMessage('Testimonial is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  handleValidation
];

const validateTransformation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('duration').optional().trim(),
  body('start_weight').optional().isFloat({ gt: 0 }),
  body('end_weight').optional().isFloat({ gt: 0 }),
  body('story').optional().trim(),
  handleValidation
];

const validateOffer = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('discount_percent').optional().isFloat({ min: 1, max: 100 }),
  body('start_date').optional().isDate(),
  body('end_date').optional().isDate(),
  body('coupon_code').optional().trim(),
  handleValidation
];

const validateLocation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('state').optional().trim(),
  body('pincode').optional().trim(),
  body('phone').optional().trim(),
  body('email').optional().isEmail(),
  handleValidation
];

const validateAppointment = [
  body('trainer_id').isInt().withMessage('Trainer is required'),
  body('type').trim().notEmpty().withMessage('Appointment type is required'),
  body('date').isDate().withMessage('Valid date is required'),
  body('time').trim().notEmpty().withMessage('Time is required'),
  handleValidation
];

const validateCoupon = [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
  body('discount_percent').optional().isFloat({ min: 1, max: 100 }),
  body('discount_amount').optional().isFloat({ min: 1 }),
  body('max_uses').optional().isInt({ min: 1 }),
  body('valid_from').optional().isDate(),
  body('valid_until').optional().isDate(),
  handleValidation
];

const validateClass = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('duration_minutes').optional().isInt({ min: 1 }),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'all']),
  body('max_participants').optional().isInt({ min: 1 }),
  handleValidation
];

const validateFacility = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  handleValidation
];

const validateLead = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').optional().trim(),
  body('email').optional().isEmail(),
  body('source').optional().trim(),
  body('fitness_goal').optional().trim(),
  handleValidation
];

const validateIdParam = [
  param('id').isInt().withMessage('Invalid ID'),
  handleValidation
];

module.exports = {
  handleValidation,
  validateRegistration,
  validateLogin,
  validateContact,
  validateFreeTrial,
  validateBlogPost,
  validateTrainer,
  validateMembershipPlan,
  validateFAQ,
  validateGallery,
  validateTestimonial,
  validateTransformation,
  validateOffer,
  validateLocation,
  validateAppointment,
  validateCoupon,
  validateClass,
  validateFacility,
  validateLead,
  validateIdParam
};
