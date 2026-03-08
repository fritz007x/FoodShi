import {
  cre,
  Runner,
  type Runtime,
  type HTTPPayload,
  HTTPClient,
  EVMClient,
  decodeJson,
  json,
  ok,
  prepareReportRequest,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters } from "viem";
import type { Config, DailyPointsResponse } from "./types/types";

/**
 * Foodshi Daily Emission Workflow
 *
 * Trigger: HTTP (called daily by cron or manually)
 * Input:   { "date": "YYYY-MM-DD", "apiKey": "..." }
 * Flow:    1. Each node fetches daily points from backend API
 *          2. Consensus aggregates the result
 *          3. ABI-encode report and write on-chain via CRE forwarder
 *             → EmissionPoolReceiver.onReport(metadata, report)
 */

const CHAIN_SELECTOR = EVMClient.SUPPORTED_CHAIN_SELECTORS["polygon-testnet-amoy"];

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const input = decodeJson(payload.input) as { date: string; apiKey: string };

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Input must include 'date' in YYYY-MM-DD format");
  }
  if (!input.apiKey) {
    throw new Error("Input must include 'apiKey' for backend authentication");
  }

  runtime.log(`Fetching daily points for ${input.date}`);

  // Each node fetches from the backend, consensus aggregates
  const httpClient = new HTTPClient();
  const fetchPoints = httpClient.sendRequest(runtime, (sendRequester) => {
    const response = sendRequester.sendRequest({
      url: `${runtime.config.backendUrl}/api/internal/daily-points?date=${input.date}`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
    }).result();

    if (!ok(response)) {
      throw new Error(`Backend API returned status ${response.statusCode}`);
    }

    return json(response) as DailyPointsResponse;
  }, { mode: "MEDIAN" });

  const data = fetchPoints().result();

  if (!data.users || data.users.length === 0) {
    runtime.log(`No unsynced points found for ${input.date}`);
    return "no_data";
  }

  runtime.log(`Found ${data.users.length} users with unsynced points`);

  // Prepare arrays for on-chain call
  const users = data.users.map((u) => u.walletAddress as `0x${string}`);
  const points = data.users.map((u) => BigInt(u.points));

  // Convert date to day number (days since Unix epoch)
  const dayTimestamp = Math.floor(new Date(input.date).getTime() / 1000);
  const day = BigInt(Math.floor(dayTimestamp / 86400));

  runtime.log(`Encoding report: ${users.length} users, day=${day}`);

  // ABI-encode the report payload: abi.encode(address[], uint256[], uint256)
  // This matches what EmissionPoolReceiver.onReport decodes from the `report` param
  const encodedReport = encodeAbiParameters(
    [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "uint256" },
    ],
    [users, points, day]
  );

  // Create a signed report for the CRE forwarder
  const reportRequest = prepareReportRequest(encodedReport);
  const report = runtime.report(reportRequest).result();

  // Write on-chain — CRE forwarder will call EmissionPoolReceiver.onReport(metadata, report)
  const evmClient = new EVMClient(CHAIN_SELECTOR);
  evmClient.writeReport(runtime, {
    receiver: runtime.config.emissionPoolReceiverAddress,
    report,
  });

  runtime.log(`On-chain write submitted for day ${day}`);
  return "submitted";
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
