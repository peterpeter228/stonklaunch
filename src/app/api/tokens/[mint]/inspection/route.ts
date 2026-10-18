import { api } from '@/lib/errors';
import { inspectToken } from '@/lib/raydium/token-inspection';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

export async function GET(_request: Request, { params }: { params: Promise<{ mint: string }> }) {
  return api(async () => inspectToken((await params).mint));
}
