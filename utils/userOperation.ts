import { AddressLike, zeroPadBytes, zeroPadValue } from "ethers";
import hre from "hardhat";
import {
  LOCAL_ACCOUNT_FACTORY_ADDRESS,
  LOCAL_ENTRYPOINT_ADDRESS,
  TESTNET_ACCOUNT_FACTORY_ADDRESS,
  TESTNET_ENTRYPOINT_ADDRESS,
} from "./address";
import {
  packUserOperation,
  SimpleUserOperation,
  UserOperation,
} from "../types/UserOperation";
import { estimateGasFee, estimateUserOpGas, sendUserOperationRPC } from "./rpc";
import { getPaymasterSignature, packPaymasterData } from "./paymaster";
import { bytes32 } from "../types/SolidityTypes";
import { toHex } from "alchemy-sdk";

BigInt.prototype["toJSON"] = function () {
  return this.toString();
};

type env = "local" | "testnet";

export async function getInitCode(
  factoryAddress: string,
  owner: AddressLike,
  salt: bytes32,
  entryPoint: AddressLike
): Promise<string> {
  const factoryData = await getFactoryData(owner, salt, entryPoint);
  return factoryAddress + factoryData.slice(2);
}

export async function getFactoryData(
  owner: AddressLike,
  salt: bytes32,
  entryPoint: AddressLike
): Promise<string> {
  const accountFactory = await hre.ethers.getContractFactory("AccountFactory");
  const byteCode = accountFactory.interface.encodeFunctionData(
    "createAccount",
    [owner, salt, entryPoint]
  );

  return byteCode;
}

export async function getSenderFromInitCode(
  initCode: string,
  e: env
): Promise<string> {
  const epAddress =
    e === "local" ? LOCAL_ENTRYPOINT_ADDRESS : TESTNET_ENTRYPOINT_ADDRESS;
  const entryPoint = await hre.ethers.getContractAt("EntryPoint", epAddress);
  let sender = "0x";
  try {
    const tx = await entryPoint.getSenderAddress(initCode);
  } catch (ex: any) {
    console.log(ex);
    console.log(ex.data);
    if (e === "local") {
      sender = "0x" + ex.data.data.slice(-40);
    } else {
      sender = "0x" + ex.data.slice(-40);
    }
  }

  return sender;
}

type SignFunction = (userOpHash: string) => Promise<string>;

export const localSendUserOperation = async (
  simpleOp: SimpleUserOperation,
  signFunction: SignFunction
): Promise<void> => {
  const [signer0] = await hre.ethers.getSigners();
  const address0 = await signer0.getAddress();

  const entryPoint = await hre.ethers.getContractAt(
    "EntryPoint",
    LOCAL_ENTRYPOINT_ADDRESS
  );

  let initCode = await getInitCode(
    LOCAL_ACCOUNT_FACTORY_ADDRESS,
    address0,
    zeroPadValue(toHex(2), 32),
    LOCAL_ENTRYPOINT_ADDRESS
  );
  const sender = await getSenderFromInitCode(initCode, "local");
  console.log({ sender });

  const contractCode = await hre.ethers.provider.getCode(sender);
  if (contractCode !== "0x") {
    initCode = "0x";
  }

  const userOp: UserOperation = {
    sender,
    nonce: "0x" + (await entryPoint.getNonce(sender, 0)).toString(16),
    initCode,
    callData: simpleOp.callData,
    callGasLimit: 100_000,
    verificationGasLimit: 1_200_000,
    paymasterVerificationGasLimit: 200_000,
    preVerificationGas: 400_000,
    maxFeePerGas: hre.ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("5", "gwei"),
    paymasterPostOpGasLimit: 21_000,
    paymaster: simpleOp.paymaster,
    paymasterData: simpleOp.paymasterData,
    signature: "0x",
  };

  if (simpleOp.paymaster !== undefined && simpleOp.paymaster !== "0x") {
    const { signature, validAfter, validUntil } = await getPaymasterSignature(
      userOp,
      "local"
    );
    console.log({ signature, validAfter, validUntil });
    userOp.paymasterData = packPaymasterData(validUntil, validAfter, signature);
    console.log({ paymasterData: userOp.paymasterData });
  }

  const userOpHash = await entryPoint.getUserOpHash(packUserOperation(userOp));
  const signature = await signFunction(userOpHash);
  userOp.signature = signature;

  console.log(packUserOperation(userOp));
  try {
    const tx = await entryPoint.handleOps(
      [packUserOperation(userOp)],
      address0
    );
    const receipt = await tx.wait();
    console.log(receipt);
  } catch (ex: any) {
    console.error(ex);
    console.error(ex.data);
  }
};

export const testNetSendUserOperation = async (
  simpleOp: SimpleUserOperation,
  signFunction: SignFunction
): Promise<string> => {
  const [signer0] = await hre.ethers.getSigners();
  const address0 = await signer0.getAddress();
  const entryPoint = await hre.ethers.getContractAt(
    "EntryPoint",
    TESTNET_ENTRYPOINT_ADDRESS
  );

  const initCode = await getInitCode(
    TESTNET_ACCOUNT_FACTORY_ADDRESS,
    address0,
    zeroPadValue(toHex(1), 32),
    TESTNET_ENTRYPOINT_ADDRESS
  );
  const sender = await getSenderFromInitCode(initCode, "testnet");
  console.log({ sender });

  let factory = TESTNET_ACCOUNT_FACTORY_ADDRESS;
  let factoryData = await getFactoryData(
    address0,
    zeroPadValue(toHex(1), 32),
    TESTNET_ENTRYPOINT_ADDRESS
  );

  const contractCode = await hre.ethers.provider.getCode(sender);
  if (contractCode !== "0x") {
    factory = "0x";
    factoryData = "0x";
  }

  const userOp: UserOperation = {
    sender,
    nonce: "0x" + (await entryPoint.getNonce(sender, 0)).toString(16),
    factory,
    factoryData,
    initCode,
    callData: simpleOp.callData,
    paymaster: simpleOp.paymaster,
    paymasterData: simpleOp.paymasterData,
    signature: "0x",
    // Use dummy value first
    callGasLimit: 400_000,
    verificationGasLimit: 400_000,
    paymasterVerificationGasLimit: 200_000,
    preVerificationGas: 200_000,
    maxFeePerGas: hre.ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("5", "gwei"),
    paymasterPostOpGasLimit: 21_000,
  };

  const estimateGasResult = await estimateUserOpGas(userOp);
  userOp.preVerificationGas = Math.floor(
    parseInt(estimateGasResult.preVerificationGas, 16) * 1.1
  );
  userOp.callGasLimit = Math.floor(
    parseInt(estimateGasResult.callGasLimit, 16) * 1.1
  );
  userOp.verificationGasLimit = Math.floor(
    parseInt(estimateGasResult.verificationGasLimit, 16) * 1.1
  );
  userOp.paymasterVerificationGasLimit = 1_000_000;
  const gasFeeEstimate = await estimateGasFee();
  userOp.maxFeePerGas = gasFeeEstimate.maxFeePerGas;
  userOp.maxPriorityFeePerGas = gasFeeEstimate.maxPriorityFeePerGas;
  console.log(userOp);

  if (simpleOp.paymaster !== undefined && simpleOp.paymaster !== "0x") {
    const { signature, validAfter, validUntil } = await getPaymasterSignature(
      userOp,
      "testnet"
    );
    userOp.paymasterData = packPaymasterData(validUntil, validAfter, signature);
  }

  const userOpHash = await entryPoint.getUserOpHash(packUserOperation(userOp));
  const signature = await signFunction(userOpHash);
  userOp.signature = signature;
  console.log(userOp);

  const result = await sendUserOperationRPC(userOp);
  console.log(result);

  return "";
};
