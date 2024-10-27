import { BigNumberish } from "ethers";

export type EstimateUserOperationGasResult = {
  preVerificationGas: string;
  callGasLimit: string;
  verificationGasLimit: string;
  paymasterVerificationGasLimit?: string;
};

export type EstimateGasFeeResult = {
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
};
