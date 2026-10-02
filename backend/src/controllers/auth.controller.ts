import { Request, Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { ENV } from '../config/env';
import { recordAudit } from '../services/audit';

const JWT_SECRET = ENV.JWT_SECRET;
type UserRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

function issueToken(user: { id: string; name: string; email: string }, role: UserRole) {
  return jwt.sign({ id: user.id, userId: user.id, role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export const login = async (req: Request, res: Response) => {
  try {
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = typeof req.body.role === 'string' ? req.body.role.toUpperCase() as UserRole : undefined;

    if (!identifier || identifier.length > 254 || !password || password.length > 128) return res.status(400).json({ error: 'Enter an identifier (maximum 254 characters) and password (maximum 128 characters)' });
    if (role && !['STUDENT', 'FACULTY', 'ADMIN'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    if (!role || role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { OR: [{ email: identifier.toLowerCase() }, { enrollmentNo: identifier }] }
      });
      if (student && await bcrypt.compare(password, student.passwordHash)) {
        if (!student.isActive) return res.status(403).json({ error: 'Student account is pending administrator activation' });
        const user = {
          id: student.id, name: student.name, email: student.email,
          enrollmentNo: student.enrollmentNo, batch: student.batch, division: student.division, role: 'STUDENT' as const
        };
        await recordAudit(req, "AUTH_LOGIN", { role: "STUDENT" });
        return res.json({ token: issueToken(user, 'STUDENT'), user });
      }
      if (role === 'STUDENT') return res.status(401).json({ error: 'Invalid identifier or password' });
    }

    if (!role || role === 'FACULTY') {
      const faculty = await prisma.faculty.findUnique({ where: { email: identifier.toLowerCase() } });
      if (faculty && faculty.isActive && await bcrypt.compare(password, faculty.passwordHash)) {
        const user = { id: faculty.id, name: faculty.name, email: faculty.email, department: faculty.department, role: 'FACULTY' as const };
        await recordAudit(req, "AUTH_LOGIN", { role: "FACULTY" });
        return res.json({ token: issueToken(user, 'FACULTY'), user });
      }
      if (role === 'FACULTY') return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!role || role === 'ADMIN') {
      const admin = await prisma.admin.findUnique({ where: { email: identifier.toLowerCase() } });
      if (admin && await bcrypt.compare(password, admin.passwordHash)) {
        const user = { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' as const };
        await recordAudit(req, "AUTH_LOGIN", { role: "ADMIN" });
        return res.json({ token: issueToken(user, 'ADMIN'), user });
      }
      if (role === 'ADMIN') return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.status(401).json({ error: 'Invalid identifier or password' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

export const registerStudent = async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const enrollmentNo = typeof req.body.enrollmentNo === 'string' ? req.body.enrollmentNo.trim() : '';
    const batch = typeof req.body.batch === 'string' ? req.body.batch.trim() : 'S1';
    const division = typeof req.body.division === 'string' ? req.body.division.trim() : 'A';
    if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128 || !enrollmentNo || enrollmentNo.length > 64) {
      return res.status(400).json({ error: 'Enter a valid name, email and enrollment number; password must be 8-128 characters' });
    }
    if (!batch || batch.length > 32 || !division || division.length > 32) return res.status(400).json({ error: 'Batch and division are required' });
    await prisma.batch.createMany({ data: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"].map((name) => ({ name })), skipDuplicates: true });
    await prisma.division.createMany({ data: ["A", "B", "C"].map((name) => ({ name })), skipDuplicates: true });
    const [validBatch, validDivision] = await Promise.all([
      prisma.batch.findUnique({ where: { name: batch }, select: { id: true } }),
      prisma.division.findUnique({ where: { name: division }, select: { id: true } }),
    ]);
    if (!validBatch || !validDivision) return res.status(400).json({ error: 'Select a batch and division configured by your administrator' });
    const existing = await prisma.student.findFirst({ where: { OR: [{ email }, { enrollmentNo }] } });
    if (existing) return res.status(409).json({ error: 'A student with this email or enrollment number already exists. Sign in with the existing password or ask an administrator to activate/reset the account.' });
    const student = await prisma.student.create({ data: {
      name, email, passwordHash: await bcrypt.hash(password, 10), enrollmentNo,
      batch: batch || 'S1', division: division || 'A', isActive: ENV.NODE_ENV !== 'production',
    } });
    await recordAudit(req, "STUDENT_REGISTERED", { studentId: student.id, enrollmentNo: student.enrollmentNo });
    return res.status(ENV.NODE_ENV === 'production' ? 202 : 201).json({
      message: ENV.NODE_ENV === 'production'
        ? 'Registration submitted. An administrator must activate the student account before sign-in.'
        : 'Student registered successfully. You can sign in now.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    if (err?.code === 'P2002') return res.status(409).json({ error: 'A student with this email or enrollment number already exists. Sign in with the existing password or ask an administrator to activate/reset the account.' });
    return res.status(500).json({ error: 'Registration failed' });
  }
};

export const registerFaculty = async (req: Request, res: Response) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim().slice(0, 120) : 'CS';
    const subject = typeof req.body.subject === 'string' ? req.body.subject.trim().slice(0, 120) : undefined;
    if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid name and email; password must be 8-128 characters' });
    }
    const faculty = await prisma.faculty.create({ data: {
      name, email, passwordHash: await bcrypt.hash(password, 10), department, subject, isActive: ENV.NODE_ENV !== 'production',
    } });
    await recordAudit(req, 'FACULTY_REGISTERED', { facultyId: faculty.id, email: faculty.email });
    return res.status(ENV.NODE_ENV === 'production' ? 202 : 201).json({
      message: ENV.NODE_ENV === 'production'
        ? 'Faculty registration submitted. An administrator must activate the account before sign-in.'
        : 'Faculty registered successfully. You can sign in now.',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Faculty account with this email already exists' });
    return res.status(500).json({ error: 'Registration failed' });
  }
};

export const bootstrapAdmin = async (req: Request, res: Response) => {
  const bootstrapToken = ENV.ADMIN_BOOTSTRAP_TOKEN;
  if (!bootstrapToken) return res.status(404).json({ error: 'Admin bootstrap is disabled' });
  const supplied = req.get('x-bootstrap-token') || '';
  const expectedBuffer = Buffer.from(bootstrapToken);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.status(403).json({ error: 'Invalid bootstrap token' });
  }
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid name and email; administrator password must be 12-128 characters' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.$transaction(async (tx) => {
      if (await tx.admin.count() > 0) throw Object.assign(new Error('An administrator already exists'), { code: 'BOOTSTRAP_CLOSED' });
      return tx.admin.create({ data: { name, email, passwordHash } });
    }, { isolationLevel: 'Serializable' });
    const user = { id: admin.id, name: admin.name, email: admin.email, role: 'ADMIN' as const };
    await recordAudit(req, 'ADMIN_BOOTSTRAPPED', { adminId: admin.id });
    return res.status(201).json({ token: issueToken(user, 'ADMIN'), user });
  } catch (error: any) {
    if (error?.code === 'P2002' || error?.code === 'P2034' || error?.code === 'BOOTSTRAP_CLOSED') return res.status(409).json({ error: 'An administrator already exists or that email is already registered' });
    console.error('Admin bootstrap failed:', error);
    return res.status(500).json({ error: 'Could not create initial administrator' });
  }
};

export const getRegistrationOptions = async (_req: Request, res: Response) => {
 try {
  await prisma.batch.createMany({ data: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"].map((name) => ({ name })), skipDuplicates: true });
  await prisma.division.createMany({ data: ["A", "B", "C"].map((name) => ({ name })), skipDuplicates: true });
  const [batches, divisions] = await Promise.all([
    prisma.batch.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.division.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  res.json({ batches: batches.map((item) => item.name), divisions: divisions.map((item) => item.name) });
 } catch {
  res.status(503).json({ error: "Registration options are temporarily unavailable" });
 }
};

export const getMe = async (req: Request, res: Response) => res.json({ user: (req as any).user });
