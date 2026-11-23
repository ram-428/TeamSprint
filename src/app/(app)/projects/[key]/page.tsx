import { redirect } from 'next/navigation';

export default async function ProjectIndex({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  redirect(`/projects/${key}/board`);
}
