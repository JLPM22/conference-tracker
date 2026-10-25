import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({ src: './fonts/inter-latin.woff2', variable: '--font-inter', display: 'swap', weight: '100 900' });
const outfit = localFont({ src: './fonts/outfit-latin.woff2', variable: '--font-outfit', display: 'swap', weight: '100 900' });
export const metadata = {
  title: 'Conference tracker | Jose Luis Ponton',
  description: 'A research conference tracker for graphics, vision, robotics, VR/HCI and AI/ML. Official submission deadlines, transparent estimates, timelines and live countdowns.',
};
export default function RootLayout({ children }) {
  return <html lang="en" className={`${inter.variable} ${outfit.variable}`}><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
