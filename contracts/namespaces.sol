// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./base.sol";
import "./common.sol";
import "./lib.sol";

contract Namespaces is INamespaceStore, Owned {
    // GLOBAL DATA

    struct NamespaceEntry {
        address processContract; // The contract associated to this namespace
        uint32 chainId; // See Genesis > chains[chainId]
    }
    address genesisContract;
    mapping(uint32 => NamespaceEntry) internal namespaces;
    uint32 public namespaceCount;

    // GLOBAL METHODS

    /// @notice Creates a namespace contract associated with the given genesis instance
    constructor(address genesis) public {
        require(ContractSupport.isContract(genesis), "Not a contract");
        genesisContract = genesis;
    }

    /// @notice Registers the (processes) contract calling this function into a new namespace, assigning it to the given chainId.
    /// @return The new namespace ID that has been registered
    function register(uint32 chainId) public override returns (uint32) {
        require(
            ContractSupport.isContract(msg.sender),
            "Caller must be a contract"
        );
        require(
            chainId < IGenesisStore(genesisContract).getChainCount(),
            "No such chainId"
        );

        NamespaceEntry storage entry = namespaces[namespaceCount];
        entry.processContract = msg.sender;
        entry.chainId = chainId;
        emit NamespaceRegistered(namespaceCount);

        namespaceCount = namespaceCount + 1;
        return namespaceCount - 1;
    }

    /// @notice Sets the genesis contract address
    function setGenesis(address genesis) public override onlyContractOwner {
        require(ContractSupport.isContract(genesis), "Not a contract");
        genesisContract = genesis;
    }

    // GETTERS

    function getNamespace(uint32 namespace)
        public
        view
        override
        returns (address processContract, uint32 chainId)
    {
        return (
            namespaces[namespace].processContract,
            namespaces[namespace].chainId
        );
    }

    function getGenesisAddress() public view override returns (address) {
        return genesisContract;
    }
}
