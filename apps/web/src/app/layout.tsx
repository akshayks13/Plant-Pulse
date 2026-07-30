import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Plant-Pulse — AI Plant Disease Detection',
  description: 'Upload a plant image and get instant AI-powered disease diagnosis with treatment recommendations.',
  keywords: ['plant disease', 'AI diagnosis', 'plant health', 'disease detection'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="siteBody">
        <Navbar />
        <main className="siteMain">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
