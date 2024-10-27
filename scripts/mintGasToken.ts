import hre from "hardhat";
import {
  LOCAL_PAYMASTER_ADDRESS,
  TESTNET_PAYMASTER_ADDRESS,
} from "../utils/address";
const PM_ADDRESS = TESTNET_PAYMASTER_ADDRESS;
const MINT_TARGET = "0xe44a34dc8c6d221076506c05ab0a00b7f26f9121";
async function main() {
  const pm = await hre.ethers.getContractAt("Paymaster", PM_ADDRESS);

  await pm.mintTokens(MINT_TARGET, hre.ethers.parseEther("0.01"));

  console.log("Gas token deposit success");
}

main().catch(console.error);
