import { workflow, http, evm } from '@chainlink/workflow-sdk';
import { z } from 'zod';

const Config = z.object({
  apiUrl: z.string().url(),
  receiverAddress: z.string(),
  emissionPoolAddress: z.string(),
});

// Minimal ABI for the EmissionPool view function used to check finalization state
const EMISSION_POOL_ABI = [
  {
    name: 'dailyDistributions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'day', type: 'uint256' }],
    outputs: [
      { name: 'timestamp', type: 'uint256' },
      { name: 'totalPoints', type: 'uint256' },
      { name: 'totalDistributed', type: 'uint256' },
      { name: 'finalized', type: 'bool' },
    ],
  },
] as const;

export default workflow(Config, async (ctx) => {
  // Step 1: Calculate yesterday's day number and date string
  const dayNumber = Math.floor(Date.now() / 1000 / 86400) - 1;
  const dateStr = new Date(dayNumber * 86400 * 1000).toISOString().split('T')[0];

  // Step 2: Fetch confirmed points from backend
  const res = await http.get(
    `${ctx.config.apiUrl}/api/internal/daily-points?date=${dateStr}`,
    { headers: { Authorization: `Bearer ${ctx.secrets.apiKey}` } }
  );
  const { users } = res.json() as { users: { walletAddress: string; points: number }[] };

  // Step 3: Read on-chain finalization state
  const distribution = await evm.read({
    address: ctx.config.emissionPoolAddress,
    abi: EMISSION_POOL_ABI,
    fn: 'dailyDistributions',
    args: [dayNumber],
  });

  if (distribution.finalized) {
    console.log(`Day ${dayNumber} already finalized, skipping`);
    return;
  }

  // Step 4: Validate — filter nulls, cap at 10,000 (on-chain limit)
  const MAX_POINTS = 10_000;
  const valid = users.filter((u) => u.walletAddress && u.points > 0);
  const addresses = valid.map((u) => u.walletAddress);
  const points = valid.map((u) => Math.min(u.points, MAX_POINTS));

  if (addresses.length === 0) {
    console.log('No eligible users, finalizing empty day');
  }

  // Step 5: ABI-encode and submit report to EmissionPoolReceiver
  const report = evm.abiEncode(
    ['address[]', 'uint256[]', 'uint256'],
    [addresses, points.map(BigInt), BigInt(dayNumber)]
  );

  await evm.write({
    address: ctx.config.receiverAddress,
    report,
  });
});
