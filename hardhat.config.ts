import { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

const config: HardhatUserConfig = {
  defaultNetwork: "sepolia",
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.API_KEY}`,
      chainId: 11155111,
      accounts: [
        process.env.PRIVATE_KEY || "",
        process.env.PAYMASTER_SIGNER || "",
      ],
    },
  },
};

export default config;
