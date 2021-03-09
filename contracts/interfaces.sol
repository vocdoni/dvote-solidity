// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

/// @notice The `IProcessStore` interface allows different versions of the contract to talk to each other. Not all methods in the contract need to be future proof.
/// @notice Should operations be updated, then two versions should be kept, one for the old version and one for the new.
interface IProcessStore {
    enum Status {READY, ENDED, CANCELED, PAUSED, RESULTS}

    modifier onlyOracle(bytes32 processId) virtual;

    // GET
    function getEntityProcessCount(address entityAddress) external view returns (uint256);
    function getNextProcessId(address entityAddress, uint16 namespace) external view returns (bytes32);
    function getProcessId(address entityAddress, uint256 processCountIndex, uint16 namespace, uint64 chainId) external pure returns (bytes32);
    function get(bytes32 processId) external view returns (
        uint8[3] memory mode_envelopeType_censusOrigin,
        address entityAddress,
        string[3] memory metadata_censusRoot_censusUri,
        uint32[2] memory startBlock_blockCount,
        Status status,
        uint8[5] memory questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[3] memory maxTotalCost_costExponent_namespace,
        uint256 evmBlockHeight // EVM only
    );
    function getParamsSignature(bytes32 processId) external view returns (bytes32);
    function getResults(bytes32 processId) external view returns (uint32[][] memory tally, uint32 height);
    function getCreationInstance(bytes32 processId) external view returns (address);

    // SET
    function newProcess(
        uint8[3] memory mode_envelopeType_censusOrigin,
        address tokenContractAddress,
        string[3] memory metadata_censusRoot_censusUri,
        uint32[2] memory startBlock_blockCount,
        uint8[4] memory questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[3] memory maxTotalCost_costExponent_namespace,
        uint256 evmBlockHeight, // EVM only
        bytes32 paramsSignature
    ) payable external;
    function setStatus(bytes32 processId, Status newStatus) external;
    function incrementQuestionIndex(bytes32 processId) external;
    function setCensus(bytes32 processId, string memory censusRoot, string memory censusUri) external;
    function setResults(bytes32 processId, uint32[][] memory tally, uint32 height) external;
    function setProcessPrice(uint256 processPrice) external;

    // WITHDRAW
    function withdraw(address payable to, uint256 amount) external;

    // EVENTS
    event Activated(uint blockNumber);
    event ActivatedSuccessor(uint blockNumber, address successor);
    event NewProcess(bytes32 processId, uint16 namespace);
    event StatusUpdated(bytes32 processId, uint16 namespace, Status status);
    event QuestionIndexUpdated(
        bytes32 processId,
        uint16 namespace,
        uint8 newIndex
    );
    event CensusUpdated(bytes32 processId, uint16 namespace);
    event ResultsAvailable(bytes32 processId);
    event ProcessPriceUpdated(uint256 processPrice);
    event Withdraw(address to, uint256 amount);
}

/// @notice The `ITokenStorageProof` interface defines the standard methods that allow checking ERC token balances.
interface ITokenStorageProof {
    /// @notice Checks that the given contract is an ERC token, validates that the balance of the sender matches the one obtained from the storage position and registers the token address
    function registerToken(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof) external;

    /// @notice Determines whether the given address is registered as an ERC token contract
    function isRegistered(address ercTokenAddress) external view returns (bool);
    
    /// @notice Returns the token balance of a holder at the given block number
    function getBalance(
        address token,
        address holder,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof,
        uint256 balanceMappingPosition) external returns (uint256);

    /// @notice Returns the balance mapping position of a token for users to generate proofs
    function getBalanceMappingPosition(address ercTokenAddress) external view returns (uint256);
}

/// @notice The `INamespaceStore` interface defines the standard methods that allow querying and updating the details of each namespace.
interface INamespaceStore {
    modifier onlyContractOwner virtual;

    // SETTERS
    function setNamespace(uint16 namespace, string memory chainId, string memory genesis, string[] memory validators, address[] memory oracles) external;
    function setChainId(uint16 namespace, string memory newChainId) external;
    function setGenesis(uint16 namespace, string memory newGenesis) external;
    function addValidator(uint16 namespace, string memory validatorPublicKey) external;
    function removeValidator(uint16 namespace, uint256 idx, string memory validatorPublicKey) external;
    function addOracle(uint16 namespace, address oracleAddress) external;
    function removeOracle(uint16 namespace, uint256 idx, address oracleAddress) external;

    // GETTERS
    function getNamespace(uint16 namespace) external view returns (string memory chainId, string memory genesis, string[] memory validators, address[] memory oracles);
    function isValidator(uint16 namespace, string memory validatorPublicKey) external view returns (bool);
    function isOracle(uint16 namespace, address oracleAddress) external view returns (bool);

    // EVENTS
    event NamespaceUpdated(uint16 namespace);
    event ChainIdUpdated(string chainId, uint16 namespace);
    event GenesisUpdated(string genesis, uint16 namespace);
    event ValidatorAdded(string validatorPublicKey, uint16 namespace);
    event ValidatorRemoved(string validatorPublicKey, uint16 namespace);
    event OracleAdded(address oracleAddress, uint16 namespace);
    event OracleRemoved(address oracleAddress, uint16 namespace);
}
