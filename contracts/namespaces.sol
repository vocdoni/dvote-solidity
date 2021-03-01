// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./common.sol";
import "./lib.sol";

contract Namespaces is INamespaceStore {
    // GLOBAL DATA

    struct NamespaceEntry {
        address processContract; // The contract associated to this namespace
        uint32 chainId; // See Genesis > chains[chainId]
    }
    mapping(uint32 => NamespaceEntry) internal namespaces;
    uint32 public namespaceCount;

    // GLOBAL METHODS

    /// @notice Registers the (processes) contract calling this function into a new namespace, assigning it to the given chainId.
    function register(uint32 chainId) public override returns(uint32) {
        require(
            ContractSupport.isContract(msg.sender),
            "Caller must be a contract"
        );

        NamespaceEntry storage entry = namespaces[namespaceCount];
        entry.processContract = msg.sender;
        entry.chainId = chainId;
        emit NamespaceRegistered(namespaceCount);

        namespaceCount = namespaceCount + 1;
        return namespaceCount;
    }

    // GETTERS

    function getNamespace(uint32 namespace)
        public
        view
        override
        returns (address processContract, uint32 chainId)
    {
        return (namespaces[namespace].processContract, namespaces[namespace].chainId);
    }
}
