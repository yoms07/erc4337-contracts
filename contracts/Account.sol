// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Account is IAccount {
    using UserOperationLib for PackedUserOperation;

    uint public count;
    address public owner;
    IEntryPoint private immutable _entryPoint;

    uint256 public counter = 0;

    constructor(address _owner, address ep) {
        owner = _owner;
        _entryPoint = IEntryPoint(ep);
    }

    modifier onlyEntryPoint() {
        require(
            msg.sender == address(entryPoint()),
            "Only entryPoint can call this method"
        );
        _;
    }

    modifier onlyOwner() {
        require(
            msg.sender == address(owner),
            "Only owner can call this method"
        );
        _;
    }

    // Require the function call went through EntryPoint or owner
    modifier onlyFromEntryPointOrOwner() {
        require(
            msg.sender == address(entryPoint()) || msg.sender == owner,
            "not Owner or EntryPoint"
        );
        _;
    }

    function entryPoint() public view returns (IEntryPoint) {
        return _entryPoint;
    }

    // Enable receive ETH
    receive() external payable {}

    // Enable withdraw eth to owner
    function withdrawETH(
        address to,
        uint256 value
    ) external onlyFromEntryPointOrOwner {
        payable(to).transfer(value);
    }

    function withdrawERC20(
        address token,
        address to,
        uint256 value
    ) external onlyFromEntryPointOrOwner {
        SafeERC20.safeTransfer(IERC20(token), to, value);
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        validationData = _validateSignature(userOp, userOpHash);
        _prefundEntryPoint(missingAccountFunds);
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyFromEntryPointOrOwner {
        _call(dest, value, func);
    }

    function testCall() external onlyFromEntryPointOrOwner {
        counter++;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256 validationData) {
        bytes32 ethSignedhash = MessageHashUtils.toEthSignedMessageHash(
            userOpHash
        );
        address signer = ECDSA.recover(ethSignedhash, userOp.signature);

        return owner == signer ? SIG_VALIDATION_SUCCESS : SIG_VALIDATION_FAILED;
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 0x20), mload(result))
            }
        }
    }

    function _prefundEntryPoint(uint256 amount) internal onlyEntryPoint {
        if (amount == 0) {
            return;
        }

        (bool success, ) = payable(address(entryPoint())).call{value: amount}(
            ""
        );
        (success);

        // ingore failure (it's entrypoint job to verify)
    }

    /**
     * EntryPoint Deposit Section
     */

    // Check deposit to entryPoint
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    // Deposit ETH to entryPoint
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    function withdrawDepositTo(
        address payable target,
        uint256 amount
    ) public onlyOwner {
        entryPoint().withdrawTo(target, amount);
    }

    function allowPaymaster() public onlyFromEntryPointOrOwner {}
}
