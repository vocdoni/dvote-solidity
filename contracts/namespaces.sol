// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./base.sol";
import "./common.sol";

contract Namespaces is INamespaceStore {
    // GLOBAL DATA

    // The contract associated to each namespaceId
    // Important: Index 0 is reserved.
    mapping(uint32 => address) public namespaces;
    uint32 public namespaceCount;

    // GLOBAL METHODS

    /**
     * Registers the (processes) contract calling this function into a new namespace, assigning it to the given chainId.
     * Returns the new namespace ID that has been registered
     */
    function register() public override returns (uint32 result) {
        // It would be good to enforce that the caller is a contract, but `register()` is called upon deployment
        // and the code segment is not yet available to be checked. 
        // Taking a compromise and accepting any Ethereum address, as a `uint32` has plenty of margin for
        // hypothetic spam registrations.

        // The mapping starts at index 1
        namespaceCount = namespaceCount + 1;

        namespaces[namespaceCount] = msg.sender;
        emit NamespaceRegistered(namespaceCount);
        result = namespaceCount;
    }

    // GETTERS

    function processContractAt(uint32 namespaceId)
        public
        view
        override
        returns (address)
    {
        return namespaces[namespaceId];
    }
}
