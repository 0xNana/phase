import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-deploy";
import * as dotenv from "dotenv";
import { existsSync } from "node:fs";
import type { HardhatUserConfig } from "hardhat/config";

if (existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}
if (existsSync("../.env.local")) {
  dotenv.config({ path: "../.env.local", override: false });
}
dotenv.config();

const mnemonic =
  process.env.MNEMONIC ?? "test test test test test test test test test test test junk";
const rpcUrl = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {
      accounts: { mnemonic },
      chainId: 31337,
    },
    sepolia: {
      accounts: { mnemonic, count: 10 },
      chainId: 11155111,
      url: rpcUrl,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        bytecodeHash: "none",
      },
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
