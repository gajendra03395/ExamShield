import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import questionRoutes from './routes/question.routes';
import testRoutes from './routes/test.routes';
import examRoutes from './routes/exam.routes';
import { initializeSocket } from './socket';
import gradingRoutes from './routes/grading.routes';
import adminRoutes from './routes/admin.routes';
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimiter';
import prisma from './config/database';
import { ENV } from './config/env';
import { examService } from './services/exam.service';

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  'https://exam-shield-livid.vercel.app',
]);
app.use(helmet());
app.use(apiLimiter);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '8mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// Route mountings
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/admin', adminRoutes);
app.use((_req, res) => res.status(404).json({ success: false, message: 'API route not found' }));
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled API error:', error);
  const status = Number(error?.status || error?.statusCode) || 500;
  return res.status(status >= 400 && status < 600 ? status : 500).json({ success: false, message: status < 500 ? error.message : 'Internal server error' });
});

export function startServer() {
  const server = createServer(app);
  const io = initializeSocket(server);
  app.set('io', io);
  const expiryTimer = setInterval(() => {
    void examService.expireOverdueSessions().then((expired) => {
      expired.forEach(({ studentTestId }) => io.to(`student_${studentTestId}`).emit('exam:force_submitted', {
        studentTestId,
        reason: 'TIME_UP',
        message: 'The exam time limit was reached and your exam was submitted.',
      }));
    }).catch((error) => console.error('Exam expiry sweep failed:', error));
  }, 15000);
  expiryTimer.unref();
  server.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`ExamShield API server listening on http://0.0.0.0:${ENV.PORT}`);
  });
  const shutdown = () => {
    clearInterval(expiryTimer);
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    io.close(() => {
      void prisma.$disconnect().finally(() => clearTimeout(forceExit));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) startServer();

export default app;
