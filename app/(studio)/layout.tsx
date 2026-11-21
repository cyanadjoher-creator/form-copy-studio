import { DataProvider } from '@/components/data';
import { Sidebar } from '@/components/Sidebar';
import { Gate } from '@/components/Gate';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="app">
        <Sidebar />
        <main className="main"><Gate>{children}</Gate></main>
      </div>
    </DataProvider>
  );
}
