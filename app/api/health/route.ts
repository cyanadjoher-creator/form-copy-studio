import { handle } from '@/lib/http';
import { dbKind } from '@/lib/db';
import { storageKind } from '@/lib/storage';
import { aiModel, aiProvider } from '@/lib/ai';
import { authEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => ({ database: dbKind(), storage: storageKind(), ai: aiProvider(), model: aiModel(), login: authEnabled(), vercel: !!process.env.VERCEL }));
