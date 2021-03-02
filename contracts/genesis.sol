// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./base.sol";
import "./common.sol";

contract Genesis is IGenesisStore, Owned {
    // GLOBAL DATA

    struct ChainEntry {
        string genesis;
        string[] validators; // Public key array
        address[] oracles; // Oracles allowed to submit processes to the Vochain and publish results on the process contract
    }
    // Mapping chains[chainId] => ChainEntry
    mapping(uint32 => ChainEntry) internal chains;
    uint32 chainCount;

    // HELPERS

    function equalStrings(string memory str1, string memory str2)
        private
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked((str1))) ==
            keccak256(abi.encodePacked((str2)));
    }

    // GLOBAL METHODS

    /// @notice Registers a new chain ID, along with the given genesis, validators and oracles.
    /// @return The new chain ID that has been registered
    function newChain(
        string memory genesis,
        string[] memory validators,
        address[] memory oracles
    ) public override onlyContractOwner returns (uint32) {
        ChainEntry storage entry = chains[chainCount];

        entry.genesis = genesis;
        entry.validators = validators;
        entry.oracles = oracles;

        emit ChainRegistered(chainCount);

        chainCount = chainCount + 1;

        return chainCount - 1;
    }

    function setGenesis(uint32 chainId, string memory newGenesis)
        public
        override
        onlyContractOwner
    {
        require(
            !equalStrings(chains[chainId].genesis, newGenesis),
            "Must differ"
        );

        chains[chainId].genesis = newGenesis;

        emit GenesisUpdated(newGenesis, chainId);
    }

    function addValidator(uint32 chainId, string memory validatorPublicKey)
        public
        override
        onlyContractOwner
    {
        require(!isValidator(chainId, validatorPublicKey), "Already present");

        chains[chainId].validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey, chainId);
    }

    function removeValidator(
        uint32 chainId,
        uint256 idx,
        string memory validatorPublicKey
    ) public override onlyContractOwner {
        uint256 currentLength = chains[chainId].validators.length;
        require(idx < currentLength, "Invalid index");
        // using `idx` to avoid searching/looping and using `validatorPublicKey` to enforce that the correct value is removed
        require(
            equalStrings(chains[chainId].validators[idx], validatorPublicKey),
            "Index-key mismatch"
        );
        // swap with the last element from the list
        chains[chainId].validators[idx] = chains[chainId].validators[
            currentLength - 1
        ];
        chains[chainId].validators.pop();

        emit ValidatorRemoved(validatorPublicKey, chainId);
    }

    function addOracle(uint32 chainId, address oracleAddress)
        public
        override
        onlyContractOwner
    {
        require(!isOracle(chainId, oracleAddress), "Already present");

        chains[chainId].oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress, chainId);
    }

    function removeOracle(
        uint32 chainId,
        uint256 idx,
        address oracleAddress
    ) public override onlyContractOwner {
        uint256 currentLength = chains[chainId].oracles.length;
        require(idx < currentLength, "Invalid index");
        require( // using `idx` to avoid searching/looping and using `oracleAddress` to enforce that the correct value is removed
            chains[chainId].oracles[idx] == oracleAddress,
            "Index-key mismatch"
        );

        // swap with the last element from the list
        chains[chainId].oracles[idx] = chains[chainId].oracles[
            currentLength - 1
        ];
        chains[chainId].oracles.pop();

        emit OracleRemoved(oracleAddress, chainId);
    }

    // GETTERS

    function get(uint32 chainId)
        public
        view
        override
        returns (
            string memory genesis,
            string[] memory validators,
            address[] memory oracles
        )
    {
        return (
            chains[chainId].genesis,
            chains[chainId].validators,
            chains[chainId].oracles
        );
    }

    function getChainCount() public view override returns (uint32) {
        return chainCount;
    }

    function isValidator(uint32 chainId, string memory validatorPublicKey)
        public
        view
        override
        returns (bool)
    {
        for (uint256 i = 0; i < chains[chainId].validators.length; i++) {
            if (
                equalStrings(chains[chainId].validators[i], validatorPublicKey)
            ) {
                return true;
            }
        }
        return false;
    }

    function isOracle(uint32 chainId, address oracleAddress)
        public
        view
        override
        returns (bool)
    {
        for (uint256 i = 0; i < chains[chainId].oracles.length; i++) {
            if (chains[chainId].oracles[i] == oracleAddress) {
                return true;
            }
        }
        return false;
    }
}
