import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: { default: 'ERP Umira', template: '%s · ERP Umira' },
  description: 'ERP & manajemen proyek untuk kontraktor: tender, BQ, proyek, procurement, cost control, keuangan dan aset.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'inherit', borderRadius: 12 } }} />
      </body>
    </html>
  );
}
