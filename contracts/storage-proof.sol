// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin/IERC20.sol";
import "./lib.sol";

contract Erc20StorageProof {
    struct ErcToken {
        bool available;
        uint256 indexSlot;
    }

    mapping(address => ErcToken) public tokens;

    function register(address ercTokenAddress, uint256 indexSlot) public {
        // Check that the address is a contract
        require(
            ContractSupport.isContract(ercTokenAddress),
            "The address must be a contract"
        );

        IERC20 tokenContract = IERC20(ercTokenAddress);
        uint256 effectiveBalance = tokenContract.balanceOf(msg.sender);
        require(effectiveBalance > 0, "Insufficient funds");

        // TODO: Implement

        // TODO: Check storageProofRootHash valid for current block height
        // TODO: Check storageProof valid for:
        //      key: keccak(holder+indexSlot)
        //      value: effectiveBalance

        // TODO: Register token
    }

    function isRegistered(address ercTokenAddress) public view returns (bool) {
        return tokens[ercTokenAddress].available;
    }

    function getProof(address ercTokenAddress, uint256 blockNumber)
        public
        view
    {
        // TODO: Implement
    }
}
