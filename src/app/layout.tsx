import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HealthPortal',
  description: 'Your personal patient portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
