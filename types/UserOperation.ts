import * as typ from "./SolidityTypes";
import { packAccountGasLimits } from "../utils/gas";
import { packPaymasterAndPaymasterData } from "../utils/paymaster";
export interface UserOperation {
  sender: typ.address;
  nonce: typ.uint256;
  factory?: string;
  factoryData?: string;
  initCode: string;
  callData: string;
  callGasLimit: typ.uint128;
  verificationGasLimit: typ.uint128;
  preVerificationGas: typ.uint256;
  maxFeePerGas: typ.uint256;
  maxPriorityFeePerGas: typ.uint256;
  paymaster?: typ.address;
  paymasterVerificationGasLimit?: typ.uint128;
  paymasterPostOpGasLimit?: typ.uint128;
  paymasterData?: typ.bytes;
  signature: string;
}

export interface PackedUserOperation {
  sender: typ.address;
  nonce: typ.uint256;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: typ.uint256;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
}

export interface SimpleUserOperation {
  callData: string;
  paymaster?: typ.address;
  paymasterData?: typ.bytes;
}

export const packUserOperation = (op: UserOperation): PackedUserOperation => {
  const accountGasLimits = packAccountGasLimits(
    op.verificationGasLimit,
    op.callGasLimit
  );
  const gasFees = packAccountGasLimits(
    op.maxPriorityFeePerGas,
    op.maxFeePerGas
  );
  let paymasterAndData = packPaymasterAndPaymasterData(
    op.paymaster as string,
    op.paymasterVerificationGasLimit,
    op.paymasterPostOpGasLimit,
    op.paymasterData as string
  );

  return {
    sender: op.sender,
    nonce: op.nonce,
    callData: op.callData,
    accountGasLimits,
    initCode: op.initCode,
    preVerificationGas: op.preVerificationGas,
    gasFees,
    paymasterAndData,
    signature: op.signature,
  };
};
