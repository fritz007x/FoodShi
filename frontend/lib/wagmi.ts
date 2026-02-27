import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy } from 'viem/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'FOODSHI',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
  chains: [polygonAmoy],
  ssr: true,
});
