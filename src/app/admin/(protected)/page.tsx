import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminPage() {
  await requireAdmin();
  return <main><h1>Archive administration</h1><p>The application and private administrator foundation are ready.</p><p>Content management will be added in later milestones.</p></main>;
}
