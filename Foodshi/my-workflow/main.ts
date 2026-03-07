import { cre, Runner, type Runtime, type HTTPPayload, decodeJson } from "@chainlink/cre-sdk";
import type { Config, DailyPointsResponse } from "./types/types";

/**
 * Foodshi Daily Emission Workflow
 *
 * Trigger: HTTP (called daily by cron or manually)
 * Input:   { "date": "YYYY-MM-DD", "apiKey": "..." }
 * Flow:    1. Fetch daily points from backend API
 *          2. ABI-encode users, points, and day
 *          3. Write on-chain to EmissionPoolReceiver.onReport()
 */

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const input = decodeJson(payload.input) as { date: string; apiKey: string };

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Input must include 'date' in YYYY-MM-DD format");
  }
  if (!input.apiKey) {
    throw new Error("Input must include 'apiKey' for backend authentication");
  }

  runtime.log(`Fetching daily points for ${input.date}`);

  // Fetch daily points from backend internal API
  const http = new cre.capabilities.HTTPCapability();
  const response = http.fetch(`${runtime.config.backendUrl}/api/internal/daily-points?date=${input.date}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = JSON.parse(response) as DailyPointsResponse;

  if (!data.users || data.users.length === 0) {
    runtime.log(`No unsynced points found for ${input.date}`);
    return JSON.stringify({ date: input.date, status: "no_data", usersProcessed: 0 });
  }

  runtime.log(`Found ${data.users.length} users with unsynced points`);

  // Prepare arrays for on-chain call
  const users = data.users.map(u => u.walletAddress);
  const points = data.users.map(u => u.points);

  // Convert date to day number (days since Unix epoch)
  const dayTimestamp = Math.floor(new Date(input.date).getTime() / 1000);
  const day = Math.floor(dayTimestamp / 86400);

  runtime.log(`Encoding report: ${users.length} users, day=${day}`);

  // ABI-encode the report payload: (address[] users, uint256[] points, uint256 day)
  const report = cre.abi.encode(
    ["address[]", "uint256[]", "uint256"],
    [users, points, day]
  );

  // Write on-chain to EmissionPoolReceiver
  const chain = new cre.capabilities.ChainWriteCapability();
  chain.write({
    chainId: runtime.config.chainId,
    contractAddress: runtime.config.emissionPoolReceiverAddress,
    method: "onReport(bytes,bytes)",
    params: ["0x", report], // metadata is empty, report contains the encoded data
  });

  runtime.log(`On-chain write submitted for day ${day}`);

  return JSON.stringify({
    date: input.date,
    day,
    status: "submitted",
    usersProcessed: users.length,
  });
};

const initWorkflow = (config: Config) => {
  const http = new cre.capabilities.HTTPCapability();

  return [
    cre.handler(http.trigger({}), onHttpTrigger),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
