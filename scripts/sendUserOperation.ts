import hre from "hardhat";
import dotenv from "dotenv";
import { SimpleUserOperation } from "../types/UserOperation";
import {
  localSendUserOperation,
  testNetSendUserOperation,
} from "../utils/userOperation";
import {
  LOCAL_PAYMASTER_ADDRESS,
  TESTNET_PAYMASTER_ADDRESS,
} from "../utils/address";

dotenv.config();

type SignFunction = (userOpHash: string) => Promise<string>;

async function main() {
  const account = await hre.ethers.getContractFactory("Account");
  const [signer0, signer1] = await hre.ethers.getSigners();
  console.log("Signer1 Address:");
  console.log(await signer1.getAddress());

  const simpleOp: SimpleUserOperation = {
    callData: "0x",
    paymaster: TESTNET_PAYMASTER_ADDRESS,
    paymasterData: "0x",
  };

  const signFunction: SignFunction = (userOpHash: string): Promise<string> => {
    return signer0.signMessage(hre.ethers.getBytes(userOpHash));
  };
  try {
    await testNetSendUserOperation(simpleOp, signFunction);
  } catch (e: any) {
    console.error(e.data);
    throw e;
  }
}

main().catch(console.error);
