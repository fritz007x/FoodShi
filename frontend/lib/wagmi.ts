import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonAmoy } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Fail fast at startup rather than producing cryptic WalletConnect errors at
// runtime when a user tries to open the connect modal.
if (typeof window !== 'undefined' && !projectId) {
  throw new Error(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. ' +
    'Get a free project ID at https://cloud.walletconnect.com and add it to frontend/.env.local'
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: 'FOODSHI',
  projectId: projectId ?? '',
  chains: [polygonAmoy],
  ssr: true,
});
