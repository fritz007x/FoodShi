import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { polygonAmoy } from 'viem/chains';
import { parseGwei } from 'viem';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Use a dummy ID so the app can boot without WalletConnect configured (e.g.
// during e2e tests). Wallet-connect flows will fail at runtime, but the rest
// of the app remains functional.
const safeProjectId = projectId || 'MISSING_WALLETCONNECT_PROJECT_ID';

const tenderlyRpc = process.env.NEXT_PUBLIC_TENDERLY_RPC;

// Polygon Amoy enforces a minimum gas price (~25 Gwei). Provide an async
// feeEstimator so viem uses it during every gas estimation call.
const amoy = {
  ...polygonAmoy,
  fees: {
    async estimateFeesPerGas() {
      return {
        maxFeePerGas: parseGwei('30'),
        maxPriorityFeePerGas: parseGwei('25'),
      };
    },
  },
} as const;

export const wagmiConfig = getDefaultConfig({
  appName: 'FOODSHI',
  projectId: safeProjectId,
  chains: [amoy],
  ssr: true,
  transports: {
    [amoy.id]: http(tenderlyRpc || polygonAmoy.rpcUrls.default.http[0]),
  },
});
