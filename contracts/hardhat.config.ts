import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [requireEnv("PRIVATE_KEY")],
      chainId: 80002,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [requireEnv("PRIVATE_KEY")],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};

export default config;
