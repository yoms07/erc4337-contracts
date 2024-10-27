import hre from "hardhat";
import { getInitCode } from "../utils/userOperation";
import { zeroPadValue } from "ethers";
import { toHex } from "alchemy-sdk";
import {
  LOCAL_ACCOUNT_FACTORY_ADDRESS,
  LOCAL_ENTRYPOINT_ADDRESS,
  TESTNET_ACCOUNT_FACTORY_ADDRESS,
  TESTNET_ENTRYPOINT_ADDRESS,
} from "../utils/address";
const EP_ADDRESS = TESTNET_ENTRYPOINT_ADDRESS;
const AF_ADDRESS = TESTNET_ACCOUNT_FACTORY_ADDRESS;
async function main() {
  const ep = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);
  const signer0 = await hre.ethers.provider.getSigner(0);
  const owner = await signer0.getAddress();
  const initCode = await getInitCode(
    AF_ADDRESS,
    owner,
    zeroPadValue(toHex(1), 32),
    EP_ADDRESS
  );

  try {
    await ep.getSenderAddress(initCode);
  } catch (er: any) {
    console.log(er.data);
    console.log("Address: 0x" + er.data.slice(-40));
  }
}

main().catch(console.error);
