import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { polygonAmoy } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Use a dummy ID so the app can boot without WalletConnect configured (e.g.
// during e2e tests). Wallet-connect flows will fail at runtime, but the rest
// of the app remains functional.
const safeProjectId = projectId || 'MISSING_WALLETCONNECT_PROJECT_ID';

const tenderlyRpc = process.env.NEXT_PUBLIC_TENDERLY_RPC;

export const wagmiConfig = getDefaultConfig({
  appName: 'FOODSHI',
  projectId: safeProjectId,
  chains: [polygonAmoy],
  ssr: true,
  ...(tenderlyRpc ? { transports: { [polygonAmoy.id]: http(tenderlyRpc) } } : {}),
});
