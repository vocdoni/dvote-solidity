// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./base.sol";
import "./common.sol";
import "./lib.sol";

contract Namespaces is INamespaceStore {
    // GLOBAL DATA

    // The contract associated to each namespaceId
    mapping(uint32 => address) public namespaces;
    uint32 public namespaceCount;

    // GLOBAL METHODS

    /**
     * Registers the (processes) contract calling this function into a new namespace, assigning it to the given chainId.
     * Returns the new namespace ID that has been registered
     */
    function register() public override returns (uint32 result) {
        require(
            ContractSupport.isContract(msg.sender),
            "Caller must be a contract"
        );

        namespaces[namespaceCount] = msg.sender;
        emit NamespaceRegistered(namespaceCount);
        result = namespaceCount;

        namespaceCount = namespaceCount + 1;
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
