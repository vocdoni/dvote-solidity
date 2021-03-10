// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./base.sol";
import "./common.sol";

contract Genesis is IGenesisStore, Owned {
    // GLOBAL DATA

    struct ChainEntry {
        string genesis;
        // Full list for exhaustive retrieval
        bytes[] validatorList; // Public key array
        address[] oracleList; // Oracles allowed to submit processes to the Vochain and publish results on the process contract
        // Bool mapping for fast checking
        mapping(bytes => bool) validators; // Indicates whether a public key is a validator on the current chain
        mapping(address => bool) oracles; // Indicates whether an address is an oracle on the current chain
    }
    // Mapping chains[chainId] => ChainEntry
    mapping(uint32 => ChainEntry) internal chains;
    uint32 internal chainCount;

    // HELPERS

    function equalBytes(bytes memory val1, bytes memory val2) private pure returns (bool) {
        return
            keccak256(abi.encodePacked((val1))) ==
            keccak256(abi.encodePacked((val2)));
    }

    function equalStrings(string memory str1, string memory str2)
        private
        pure
        returns (bool)
    {
        return equalBytes(bytes(str1), bytes(str2));
    }

    // GLOBAL METHODS

    // Registers a new chain ID, along with the given genesis, validators and oracles.
    // Returns the new chain ID that has been registered
    function newChain(
        string memory genesis,
        bytes[] memory validatorList,
        address[] memory oracleList
    ) public override onlyContractOwner returns (uint32 newChainId) {
        ChainEntry storage entry = chains[chainCount];

        entry.genesis = genesis;
        entry.validatorList = validatorList;
        entry.oracleList = oracleList;

        for (uint256 i = 0; i < validatorList.length; i++) {
            entry.validators[validatorList[i]] = true;
        }
        for (uint256 i = 0; i < oracleList.length; i++) {
            entry.oracles[oracleList[i]] = true;
        }

        emit ChainRegistered(chainCount);
        newChainId = chainCount;

        chainCount = chainCount + 1;
    }

    // Sets the given data as the new genesis for the chain
    function setGenesis(uint32 chainId, string memory newGenesis)
        public
        override
        onlyContractOwner
    {
        require(chainId < chainCount, "Not found");
        require(
            !equalStrings(chains[chainId].genesis, newGenesis),
            "Must differ"
        );

        chains[chainId].genesis = newGenesis;

        emit GenesisUpdated(chainId);
    }

    function addValidator(uint32 chainId, bytes memory validatorPublicKey)
        public
        override
        onlyContractOwner
    {
        require(chainId < chainCount, "Not found");
        require(!isValidator(chainId, validatorPublicKey), "Already present");

        ChainEntry storage entry = chains[chainId];
        entry.validatorList.push(validatorPublicKey);
        entry.validators[validatorPublicKey] = true;

        emit ValidatorAdded(chainId, validatorPublicKey);
    }

    function removeValidator(
        uint32 chainId,
        uint256 idx,
        bytes memory validatorPublicKey
    ) public override onlyContractOwner {
        require(chainId < chainCount, "Not found");

        ChainEntry storage entry = chains[chainId];
        uint256 currentLength = entry.validatorList.length;

        require(idx < currentLength, "Invalid index");
        // using `idx` to avoid searching/looping and using `validatorPublicKey` to enforce that the correct idx/value is removed
        require(
            equalBytes(entry.validatorList[idx], validatorPublicKey),
            "Index-key mismatch"
        );
        // swap with the last element from the list
        entry.validatorList[idx] = entry.validatorList[currentLength - 1];
        entry.validatorList.pop();
        entry.validators[validatorPublicKey] = false;

        emit ValidatorRemoved(chainId, validatorPublicKey);
    }

    function addOracle(uint32 chainId, address oracleAddress)
        public
        override
        onlyContractOwner
    {
        require(chainId < chainCount, "Not found");
        require(!isOracle(chainId, oracleAddress), "Already present");

        ChainEntry storage entry = chains[chainId];
        entry.oracleList.push(oracleAddress);
        entry.oracles[oracleAddress] = true;

        emit OracleAdded(chainId, oracleAddress);
    }

    function removeOracle(
        uint32 chainId,
        uint256 idx,
        address oracleAddress
    ) public override onlyContractOwner {
        require(chainId < chainCount, "Not found");
        
        ChainEntry storage entry = chains[chainId];
        uint256 currentLength = entry.oracleList.length;

        require(idx < currentLength, "Invalid index");
        require(entry.oracleList[idx] == oracleAddress, "Index-key mismatch"); // using `idx` to avoid searching/looping and using `oracleAddress` to enforce that the correct value is removed

        // swap with the last element from the list
        entry.oracleList[idx] = entry.oracleList[currentLength - 1];
        entry.oracleList.pop();
        entry.oracles[oracleAddress] = false;

        emit OracleRemoved(chainId, oracleAddress);
    }

    // GETTERS

    function get(uint32 chainId)
        public
        view
        override
        returns (
            string memory genesis,
            bytes[] memory validators,
            address[] memory oracles
        )
    {
        require(chainId < chainCount, "Not found");

        return (
            chains[chainId].genesis,
            chains[chainId].validatorList,
            chains[chainId].oracleList
        );
    }

    function getChainCount() public view override returns (uint32) {
        return chainCount;
    }

    function isValidator(uint32 chainId, bytes memory validatorPublicKey)
        public
        view
        override
        returns (bool)
    {
        return chains[chainId].validators[validatorPublicKey];
    }

    function isOracle(uint32 chainId, address oracleAddress)
        public
        view
        override
        returns (bool)
    {
        return chains[chainId].oracles[oracleAddress];
    }
}
