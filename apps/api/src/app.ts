import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import IORedis from 'ioredis';
import passport from './config/passport';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user.route';
import { aiRouter } from './routes/ai.route';
import { createRepoAnalysisRouter } from './routes/repoAnalysis.route';
import { createQuestsRouter } from './routes/quests.route';
import { createIndexRepoRouter } from './routes/inddexRepo.route';
import { createRagQueryRouter } from './routes/ragQuery.route';
import { createRagPipelineRouter } from './routes/ragPipelineStream.route';
import { createArchitectureRouter } from './routes/architecture.route';
import { config } from './config/env';

const app = express();

// Redis for BullMQ job queue
const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

app.use(helmet());
app.use(cors({
    origin: config.ALLOWED_ORIGINS.split(','),
    credentials: true,
}));
app.use(express.json());
app.use(pinoHttp());

// Session configuration (must come before passport)
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/ai', aiRouter);
app.use('/api/repo', createRepoAnalysisRouter());
app.use('/api/repo', createQuestsRouter());
app.use('/api/index', createIndexRepoRouter(redis));
app.use('/api/rag', createRagQueryRouter());
app.use('/api/rag', createRagPipelineRouter());
app.use('/api/repo', createArchitectureRouter());

app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

export default app;

