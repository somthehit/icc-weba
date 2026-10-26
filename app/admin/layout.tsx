import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Console | Intel Computer Center',
  description: 'Enterprise Admin Portal: manage inventory, catalog, customer orders, services, accounting, and site content.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
