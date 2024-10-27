import hre from "hardhat";
import {
  LOCAL_ENTRYPOINT_ADDRESS,
  LOCAL_PAYMASTER_ADDRESS,
  TESTNET_ENTRYPOINT_ADDRESS,
  TESTNET_PAYMASTER_ADDRESS,
} from "../utils/address";

const EP_ADDRESS = TESTNET_ENTRYPOINT_ADDRESS;
const PM_ADDRESS = TESTNET_PAYMASTER_ADDRESS;

async function main() {
  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);

  const tx = await ep.depositTo(PM_ADDRESS, {
    value: hre.ethers.parseEther("0.05"),
  });

  console.log("Deposit success");
}

main().catch(console.error);
