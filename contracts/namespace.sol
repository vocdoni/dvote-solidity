// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./interfaces.sol";

contract Namespace is INamespaceStore {
    // GLOBAL DATA

    address internal contractOwner; // See `onlyContractOwner`

    struct NamespaceItem {
        string chainId;
        string genesis;
        string[] validators; // Public key array
        address[] oracles; // Oracles allowed to submit processes to the Vochain and publish results on the process contract
    }
    mapping(uint16 => NamespaceItem) internal namespaces;

    // MODIFIERS

    /// @notice Fails if the sender is not the contract owner
    modifier onlyContractOwner override {
        require(msg.sender == contractOwner, "onlyContractOwner");
        _;
    }

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

    /// @notice Creates a new instance of the contract and sets the contract owner.
    constructor() public {
        contractOwner = msg.sender;
    }

    function setNamespace(
        uint16 namespace,
        string memory chainId,
        string memory genesis,
        string[] memory validators,
        address[] memory oracles
    ) public override onlyContractOwner {
        NamespaceItem storage nsp = namespaces[namespace];

        nsp.chainId = chainId;
        nsp.genesis = genesis;
        nsp.validators = validators;
        nsp.oracles = oracles;

        emit NamespaceUpdated(namespace);
    }

    function setChainId(uint16 namespace, string memory newChainId)
        public
        override
        onlyContractOwner
    {
        require(
            !equalStrings(namespaces[namespace].chainId, newChainId),
            "Must differ"
        );
        namespaces[namespace].chainId = newChainId;
        emit ChainIdUpdated(newChainId, namespace);
    }

    function setGenesis(uint16 namespace, string memory newGenesis)
        public
        override
        onlyContractOwner
    {
        require(
            !equalStrings(namespaces[namespace].genesis, newGenesis),
            "Must differ"
        );

        namespaces[namespace].genesis = newGenesis;

        emit GenesisUpdated(newGenesis, namespace);
    }

    function addValidator(uint16 namespace, string memory validatorPublicKey)
        public
        override
        onlyContractOwner
    {
        require(!isValidator(namespace, validatorPublicKey), "Already present");

        namespaces[namespace].validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey, namespace);
    }

    function removeValidator(
        uint16 namespace,
        uint256 idx,
        string memory validatorPublicKey
    ) public override onlyContractOwner {
        uint256 currentLength = namespaces[namespace].validators.length;
        require(idx < currentLength, "Invalid index");
        require( // using `idx` to avoid searching/looping and using `validatorPublicKey` to enforce that the correct value is removed
            equalStrings(
                namespaces[namespace].validators[idx],
                validatorPublicKey
            ),
            "Index-key mismatch"
        );
        // swap with the last element from the list
        namespaces[namespace].validators[idx] = namespaces[namespace]
            .validators[currentLength - 1];
        namespaces[namespace].validators.pop();

        emit ValidatorRemoved(validatorPublicKey, namespace);
    }

    function addOracle(uint16 namespace, address oracleAddress)
        public
        override
        onlyContractOwner
    {
        require(!isOracle(namespace, oracleAddress), "Already present");

        namespaces[namespace].oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress, namespace);
    }

    function removeOracle(
        uint16 namespace,
        uint256 idx,
        address oracleAddress
    ) public override onlyContractOwner {
        uint256 currentLength = namespaces[namespace].oracles.length;
        require(idx < currentLength, "Invalid index");
        require( // using `idx` to avoid searching/looping and using `oracleAddress` to enforce that the correct value is removed
            namespaces[namespace].oracles[idx] == oracleAddress,
            "Index-key mismatch"
        );

        // swap with the last element from the list
        namespaces[namespace].oracles[idx] = namespaces[namespace]
            .oracles[currentLength - 1];
        namespaces[namespace].oracles.pop();

        emit OracleRemoved(oracleAddress, namespace);
    }

    // GETTERS

    function getNamespace(uint16 namespace)
        public
        override
        view
        returns (
            string memory chainId,
            string memory genesis,
            string[] memory validators,
            address[] memory oracles
        )
    {
        return (
            namespaces[namespace].chainId,
            namespaces[namespace].genesis,
            namespaces[namespace].validators,
            namespaces[namespace].oracles
        );
    }

    function isValidator(uint16 namespace, string memory validatorPublicKey)
        public
        override
        view
        returns (bool)
    {
        for (uint256 i = 0; i < namespaces[namespace].validators.length; i++) {
            if (
                equalStrings(
                    namespaces[namespace].validators[i],
                    validatorPublicKey
                )
            ) {
                return true;
            }
        }
        return false;
    }

    function isOracle(uint16 namespace, address oracleAddress)
        public
        override
        view
        returns (bool)
    {
        for (uint256 i = 0; i < namespaces[namespace].oracles.length; i++) {
            if (namespaces[namespace].oracles[i] == oracleAddress) {
                return true;
            }
        }
        return false;
    }
}
