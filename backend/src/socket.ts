import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import prisma from './config/database';
import { verifyToken, TokenPayload } from './utils/jwt';

type AuthenticatedSocket = Socket & { data: { user?: TokenPayload } };

export function initializeSocket(server: HttpServer) {
  const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5000',
      'https://exam-shield-livid.vercel.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('Authentication required'));
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    if (!user) return socket.disconnect(true);
    const tokenExpiry = (user as TokenPayload & { exp?: number }).exp;
    if (tokenExpiry) {
      const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, tokenExpiry * 1000 - Date.now()));
      expiryTimer.unref();
      socket.once('disconnect', () => clearTimeout(expiryTimer));
    }

    const isActive = user.role === 'STUDENT'
      ? await prisma.student.findFirst({ where: { id: user.userId, isActive: true }, select: { id: true } }).catch(() => null)
      : user.role === 'FACULTY'
        ? await prisma.faculty.findFirst({ where: { id: user.userId, isActive: true }, select: { id: true } }).catch(() => null)
        : await prisma.admin.findUnique({ where: { id: user.userId }, select: { id: true } }).catch(() => null);
    if (!isActive) return socket.disconnect(true);
    socket.join(`user_${user.userId}`);

    if (user.role === 'STUDENT') {
      socket.join(`student_user_${user.userId}`);
      const attempts = await prisma.studentTest.findMany({
        where: { studentId: user.userId },
        select: { id: true },
      }).catch(() => []);
      attempts.forEach(({ id }) => socket.join(`student_${id}`));
    }

    socket.on('join-test', async (testId: string, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      if (!testId || !['FACULTY', 'ADMIN'].includes(user.role)) {
        acknowledge?.({ ok: false, error: 'Not authorized to monitor tests' });
        return;
      }
      const test = await prisma.test.findUnique({ where: { id: testId }, select: { facultyId: true } }).catch(() => null);
      if (!test || (user.role === 'FACULTY' && test.facultyId !== user.userId)) {
        acknowledge?.({ ok: false, error: 'Test not found or access denied' });
        return;
      }
      socket.join(`test_${testId}`);
      acknowledge?.({ ok: true });
    });
  });

  return io;
}
