import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import './globals.css';
export const metadata: Metadata = { title: 'Opravovňa', description: 'Spoločné opravovanie PDF riešení.' };
export default function RootLayout({children}:{children:React.ReactNode}) {
 return <html lang="sk"><body><ClerkProvider appearance={{theme:shadcn}}>{children}</ClerkProvider></body></html>;
}
