import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Plant-Pulse — AI Plant Disease Detection',
  description: 'Upload a plant image and get instant AI-powered disease diagnosis with treatment recommendations.',
  keywords: ['plant disease', 'AI diagnosis', 'plant health', 'disease detection'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
