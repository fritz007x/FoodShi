import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as tdly from "@tenderly/hardhat-tenderly";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

tdly.setup({ automaticVerifications: true });

// Dummy key so compile/test work without .env; real key required only at deploy time
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "00".repeat(32);

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const TENDERLY_VIRTUAL_TESTNET_RPC = process.env.TENDERLY_VIRTUAL_TESTNET_RPC || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    tenderly: {
      url: TENDERLY_VIRTUAL_TESTNET_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT || "foodshi",
    username: process.env.TENDERLY_USERNAME || "",
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};

export default config;
