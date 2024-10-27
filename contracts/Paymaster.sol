// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import "@account-abstraction/contracts/core/UserOperationLib.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Paymaster is IPaymaster, Ownable, ERC20 {
    using UserOperationLib for PackedUserOperation;

    IEntryPoint public immutable entryPoint;
    address public verifyingSigner;

    uint256 public constant COST_OF_POST = 15000; // gas cost of postOp. precalculated
    uint256 private constant VALID_TIMESTAMP_OFFSET =
        UserOperationLib.PAYMASTER_DATA_OFFSET;
    uint256 private constant SIGNATURE_OFFSET = VALID_TIMESTAMP_OFFSET + 64;

    constructor(
        IEntryPoint ep,
        address _verifyingSigner
    ) Ownable(msg.sender) ERC20("GT", "GT") {
        entryPoint = ep;
        verifyingSigner = _verifyingSigner;

        _mint(address(this), 1);
    }

    function getHash(
        PackedUserOperation calldata userOp,
        uint48 validUntil,
        uint48 validAfter
    ) public view returns (bytes32) {
        address sender = userOp.getSender();
        return
            keccak256(
                abi.encode(
                    sender,
                    userOp.nonce,
                    keccak256(userOp.initCode),
                    keccak256(userOp.callData),
                    userOp.accountGasLimits,
                    uint256(
                        bytes32(
                            userOp.paymasterAndData[UserOperationLib
                                .PAYMASTER_VALIDATION_GAS_OFFSET:UserOperationLib
                                .PAYMASTER_DATA_OFFSET]
                        )
                    ),
                    userOp.preVerificationGas,
                    userOp.gasFees,
                    block.chainid,
                    address(this),
                    validUntil,
                    validAfter
                )
            );
    }

    function getTokenValueOfEth(
        uint256 valueEth
    ) internal pure returns (uint256) {
        return valueEth / 100;
    }

    /**
     * Payment validation: check if paymaster agrees to pay.
     * Must verify sender is the entryPoint.
     * Revert to reject this request.
     * Note that bundlers will reject this method if it changes the state, unless the paymaster is trusted (whitelisted).
     * The paymaster pre-pays using its deposit, and receive back a refund after the postOp method returns.
     * @param userOp          - The user operation.
     * @param userOpHash      - Hash of the user's request data.
     * @param maxCost         - The maximum cost of this transaction (based on maximum gas and gas price from userOp).
     * @return context        - Value to send to a postOp. Zero length to signify postOp is not required.
     * @return validationData - Signature and time-range of this operation, encoded the same as the return
     *                          value of validateUserOperation.
     *                          <20-byte> sigAuthorizer - 0 for valid signature, 1 to mark signature failure,
     *                                                    other values are invalid for paymaster.
     *                          <6-byte> validUntil - last timestamp this operation is valid. 0 for "indefinite"
     *                          <6-byte> validAfter - first timestamp this operation is valid
     *                          Note that the validation code cannot use block.timestamp (or block.number) directly.
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external view returns (bytes memory context, uint256 validationData) {
        /**
         * Signer Validation
         */
        (
            uint48 validUntil,
            uint48 validAfter,
            bytes calldata signature
        ) = parsePaymasterAndData(userOp.paymasterAndData);
        require(
            signature.length == 64 || signature.length == 65,
            "VerifyingPaymaster: invalid signature length in paymasterAndData"
        );
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(
            getHash(userOp, validUntil, validAfter)
        );
        address signer = ECDSA.recover(hash, signature);
        if (signer != verifyingSigner) {
            return ("", _packValidationData(true, validUntil, validAfter));
        }
        /**
         * End Of Signer Validation
         */

        uint256 postOpGasLimit = userOp.unpackPostOpGasLimit();
        require(postOpGasLimit > COST_OF_POST, "gas too low for postOp");

        uint256 tokenPrefund = getTokenValueOfEth(maxCost);
        require(balanceOf(userOp.sender) >= tokenPrefund, "no balance");

        return (
            abi.encode(userOp.sender, tokenPrefund, userOpHash),
            _packValidationData(false, validUntil, validAfter)
        );
    }

    /**
     * Post-operation handler.
     * Must verify sender is the entryPoint.
     * @param mode          - Enum with the following options:
     *                        opSucceeded - User operation succeeded.
     *                        opReverted  - User op reverted. The paymaster still has to pay for gas.
     *                        postOpReverted - never passed in a call to postOp().
     * @param context       - The context value returned by validatePaymasterUserOp
     * @param actualGasCost - Actual gas used so far (without this postOp call).
     * @param actualUserOpFeePerGas - the gas price this UserOp pays. This value is based on the UserOp's maxFeePerGas
     *                        and maxPriorityFee (and basefee)
     *                        It is not the same as tx.gasprice, which is what the bundler pays.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        (mode);
        // charge with erc20
        address sender = abi.decode(context, (address));
        uint256 charge = getTokenValueOfEth(
            actualGasCost + COST_OF_POST * actualUserOpFeePerGas
        );

        _transfer(sender, address(this), charge);
    }

    function parsePaymasterAndData(
        bytes calldata paymasterAndData
    )
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        (validUntil, validAfter) = abi.decode(
            paymasterAndData[VALID_TIMESTAMP_OFFSET:],
            (uint48, uint48)
        );
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }

    /**
     * Add a deposit for this paymaster, used for paying for transaction fees.
     */
    function deposit() public payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    /**
     * Return current paymaster's deposit on the entryPoint.
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function withdrawTo(
        address payable withdrawAddress,
        uint256 amount
    ) public onlyOwner {
        entryPoint.withdrawTo(withdrawAddress, amount);
    }

    /**
     * Add stake for this paymaster.
     * This method can also carry eth value to add to the current stake.
     * @param unstakeDelaySec - The unstake delay for this paymaster. Can only be increased.
     */
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /**
     * Unlock the stake, in order to withdraw it.
     * The paymaster can't serve requests once unlocked, until it calls addStake again
     */
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /**
     * Withdraw the entire paymaster's stake.
     * stake must be unlocked first (and then wait for the unstakeDelay to be over)
     * @param withdrawAddress - The address to send withdrawn value.
     */
    function withdrawStake(address payable withdrawAddress) external onlyOwner {
        entryPoint.withdrawStake(withdrawAddress);
    }

    function mintTokens(address recipient, uint256 amount) external onlyOwner {
        _mint(recipient, amount);
    }
}
