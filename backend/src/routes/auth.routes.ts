import { Router } from 'express';
import { login, registerStudent, registerFaculty, bootstrapAdmin, getMe, getRegistrationOptions } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/register/student', authLimiter, registerStudent);
router.post('/register/faculty', authLimiter, registerFaculty);
router.post('/bootstrap-admin', authLimiter, bootstrapAdmin);
router.get('/options', getRegistrationOptions);
router.get('/me', authenticateToken, getMe);

export default router;
