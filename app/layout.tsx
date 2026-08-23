import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Intel Computer & Electronics | Top Tech Store Kathmandu Nepal',
  description: 'Nepal\'s trusted store for laptops, computers, CCTV systems, printers, networking gear & IT repair services with official warranty.',
  openGraph: {
    title: 'Intel Computer & Electronics | Top Tech Store Kathmandu Nepal',
    description: 'Nepal\'s trusted store for laptops, computers, CCTV systems, printers, networking gear & IT repair services with official warranty.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Intel Computer & Electronics | Top Tech Store Kathmandu Nepal',
    description: 'Nepal\'s trusted store for laptops, computers, CCTV systems, printers, networking gear & IT repair services with official warranty.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
