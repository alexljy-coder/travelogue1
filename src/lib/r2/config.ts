export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string; jurisdiction: 'default' | 'eu' | 'us' | 'fedramp' };
export function getR2Config(env: Record<string, string | undefined> = process.env): R2Config {
  const accountId = env.R2_ACCOUNT_ID?.trim(); const bucket = env.R2_BUCKET_NAME?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim(); const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const jurisdiction = env.R2_JURISDICTION?.trim() || 'default';
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !accessKeyId || !secretAccessKey) throw new Error('R2 is not configured. Follow docs/r2-setup.md.');
  if (!['default','eu','us','fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction. Follow docs/r2-setup.md.');
  return { accountId, bucket, accessKeyId, secretAccessKey, jurisdiction: jurisdiction as R2Config['jurisdiction'] };
}
