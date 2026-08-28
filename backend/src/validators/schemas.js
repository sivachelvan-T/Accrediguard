const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN','ACCREDITATION_ADMIN','FACULTY_REVIEWER','PROJECT_COORDINATOR','STUDENT','VIEWER']).optional(),
}).strict();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict();

const projectSchema = z.object({
  title: z.string().min(3).max(200),
  academicYear: z.string().max(20).optional(),
  semester: z.string().max(20).optional(),
  frameworkId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
}).strict();

const reviewSchema = z.object({
  decision: z.enum(['APPROVE','REJECT','PARTIAL','REQUEST_REVISION','NEEDS_HUMAN_REVIEW']),
  comment: z.string().max(2000).optional(),
}).strict();

module.exports = { registerSchema, loginSchema, projectSchema, reviewSchema };
