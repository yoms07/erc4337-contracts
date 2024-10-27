// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/utils/Create2.sol";
import "./Account.sol";

contract AccountFactory {
    receive() external payable {}
    function createAccount(
        address owner,
        bytes32 salt,
        address entryPoint
    ) external returns (address) {
        bytes memory creationCode = type(Account).creationCode;

        // encode with constructor calldata
        bytes memory bytecode = abi.encodePacked(
            creationCode,
            abi.encode(owner, entryPoint)
        );

        address addr = Create2.computeAddress(salt, keccak256(bytecode));
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return addr;
        }

        return deploy(salt, bytecode);
    }

    function deploy(
        bytes32 salt,
        bytes memory bytecode
    ) internal returns (address addr) {
        require(bytecode.length != 0, "Create2: bytecode length is zero");
        assembly ("memory-safe") {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            // if no address was created, and returndata is not empty, bubble revert
            if and(iszero(addr), not(iszero(returndatasize()))) {
                let p := mload(0x40)
                returndatacopy(p, 0, returndatasize())
                revert(p, returndatasize())
            }
        }
        require(addr != address(0), "Create2: Failed on deploy");
    }
}
