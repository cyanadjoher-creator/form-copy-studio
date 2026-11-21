import { Ingestion } from '@/components/Ingestion';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Ingestion key={id} id={id} />;
}
