import hre from "hardhat";
import { BigNumberish, BytesLike, Signer, ZeroAddress } from "ethers";
import { concat, zeroPadValue, toBeHex } from "ethers";
import { env } from "../types/env";
import { packUserOperation, UserOperation } from "../types/UserOperation";
import { LOCAL_PAYMASTER_ADDRESS, TESTNET_PAYMASTER_ADDRESS } from "./address";

const getPaymasterSigner = async (e: env): Promise<Signer> => {
  if (e === "local") {
    const signer = await hre.ethers.provider.getSigner(19);
    return signer;
  } else {
    //testnet
    const signer = await hre.ethers.provider.getSigner(1);
    return signer;
  }
};

export function packPaymasterAndPaymasterData(
  paymaster: string | null,
  paymasterVerificationGasLimit?: BigNumberish,
  postOpGasLimit?: BigNumberish,
  paymasterData?: string
): string {
  let paymasterAndData = "0x";
  if (
    paymaster &&
    paymaster?.length >= 20 &&
    paymaster !== ZeroAddress &&
    paymasterVerificationGasLimit !== undefined &&
    postOpGasLimit !== undefined
  ) {
    paymasterAndData = concat([
      paymaster,
      zeroPadValue(toBeHex(paymasterVerificationGasLimit), 16),
      zeroPadValue(toBeHex(postOpGasLimit), 16),
      paymasterData || "0x",
    ]);
  }

  return paymasterAndData;
}

export function packPaymasterData(
  validUntil: number,
  validAfter: number,
  signature: BytesLike
): string {
  return concat([
    hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter]
    ),
    signature,
  ]);
}

export async function getPaymasterSignature(
  userOp: UserOperation,
  e: env
): Promise<{
  signature: string;
  validUntil: number;
  validAfter: number;
}> {
  const signer = await getPaymasterSigner(e);
  const pmAddress =
    e === "local" ? LOCAL_PAYMASTER_ADDRESS : TESTNET_PAYMASTER_ADDRESS;
  const pm = await hre.ethers.getContractAt("Paymaster", pmAddress);

  const now = new Date();
  const validAfter = Math.floor(now.getTime() / 1000);
  const validUntil = validAfter + 1 * 60 * 60; // add 1 hour
  const hash = await pm.getHash(
    packUserOperation(userOp),
    validUntil,
    validAfter
  );
  const signature = await signer.signMessage(hre.ethers.getBytes(hash));
  return {
    signature,
    validAfter,
    validUntil,
  };
}
