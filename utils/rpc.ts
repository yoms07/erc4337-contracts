import hre from "hardhat";
import { UserOperation } from "../types/UserOperation";
import { TESTNET_ENTRYPOINT_ADDRESS } from "./address";
import {
  EstimateGasFeeResult,
  EstimateUserOperationGasResult,
} from "../types/bundler";

export async function sendUserOperationRPC(userOp: UserOperation) {
  const requestData: Record<string, any> = {
    sender: userOp.sender,
    nonce: userOp.nonce,
    callData: userOp.callData,
    callGasLimit: "0x" + userOp.callGasLimit.toString(16),
    verificationGasLimit: "0x" + userOp.verificationGasLimit.toString(16),
    preVerificationGas: "0x" + userOp.preVerificationGas.toString(16),
    maxFeePerGas: "0x" + userOp.maxFeePerGas.toString(16),
    maxPriorityFeePerGas: "0x" + userOp.maxPriorityFeePerGas.toString(16),
    paymasterVerificationGasLimit:
      "0x" + userOp.paymasterVerificationGasLimit?.toString(16),
    paymasterPostOpGasLimit:
      "0x" + userOp.paymasterPostOpGasLimit?.toString(16),
    signature: userOp.signature,
    paymaster: userOp.paymaster,
    paymasterData: userOp.paymasterData,
  };
  if (userOp.factory !== "0x") {
    requestData.factory = userOp.factory;
    requestData.factoryData = userOp.factoryData;
  }
  const result = await hre.ethers.provider.send("eth_sendUserOperation", [
    requestData,
    TESTNET_ENTRYPOINT_ADDRESS,
  ]);

  return result;
}

export async function estimateUserOpGas(
  userOp: UserOperation
): Promise<EstimateUserOperationGasResult> {
  const requestBody: Record<string, any> = {
    sender: userOp.sender,
    nonce: userOp.nonce,
    callData: userOp.callData,
    // paymaster: userOp.paymaster,
    // paymasterData: userOp.paymasterData,
    signature:
      "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
  };
  if (userOp.factory !== "0x") {
    requestBody.factory = userOp.factory;
    requestBody.factoryData = userOp.factoryData;
  }
  console.log("REQUEST BODY");
  console.log(requestBody);
  const result = await hre.ethers.provider.send(
    "eth_estimateUserOperationGas",
    [requestBody, TESTNET_ENTRYPOINT_ADDRESS]
  );

  return result as EstimateUserOperationGasResult;
}

export async function estimateGasFee(): Promise<EstimateGasFeeResult> {
  const { maxFeePerGas } = await hre.ethers.provider.getFeeData();
  const result = await hre.ethers.provider.send(
    "rundler_maxPriorityFeePerGas",
    []
  );

  return {
    maxFeePerGas: maxFeePerGas!,
    maxPriorityFeePerGas: parseInt(result, 16),
  };
}
