import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FOODSHI - Share Food, Earn Rewards',
  description: 'A Web3 platform for food donation with Karma Points, $SHARE tokens, and NFT medals',
  keywords: ['food donation', 'web3', 'blockchain', 'NFT', 'karma points'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
