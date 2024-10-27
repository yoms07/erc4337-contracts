import { concat, toBeHex, zeroPadValue } from "ethers";
import { BigNumberish } from "ethers";

export function packAccountGasLimits(
  verificationGasLimit: BigNumberish,
  callGasLimit: BigNumberish
): string {
  return concat([
    zeroPadValue(toBeHex(verificationGasLimit), 16),
    zeroPadValue(toBeHex(callGasLimit), 16),
  ]);
}
