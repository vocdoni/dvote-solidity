// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

/// @notice The `IProcessStore` interface allows different versions of the contract to talk to each other. Not all methods in the contract need to be future proof.
/// @notice Should operations be updated, then two versions should be kept, one for the old version and one for the new.
interface IProcessStore {
    enum Status {READY, ENDED, CANCELED, PAUSED, RESULTS}

    modifier onlyOracle() virtual;

    // GET
    function getEntityProcessCount(address entityAddress) external view returns (uint256);
    function getNextProcessId(address entityAddress, uint32 namespace) external view returns (bytes32);
    function getProcessId(address entityAddress, uint256 processCountIndex, uint32 namespace, uint32 chainId) external pure returns (bytes32);
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
    event NewProcess(bytes32 processId, uint32 namespace);
    event StatusUpdated(bytes32 processId, uint32 namespace, Status status);
    event QuestionIndexUpdated(
        bytes32 processId,
        uint32 namespace,
        uint8 newIndex
    );
    event CensusUpdated(bytes32 processId, uint32 namespace);
    event ResultsAvailable(bytes32 processId);
    event ProcessPriceUpdated(uint256 processPrice);
    event Withdraw(address to, uint256 amount);
}

/// @notice The `INamespaceStore` interface defines the standard methods that allow querying and updating the details of each namespace.
interface INamespaceStore {
    // SETTERS
    function register(uint32 chainId) external returns(uint32);
    function setGenesis(address genesis) external;

    // GETTERS
    function getNamespace(uint32 namespace) external view returns (address processContract, uint32 chainId);
    function getGenesisAddress() external view returns(address);

    // EVENTS
    event NamespaceRegistered(uint32 namespace);
}

/// @notice The `IGenesisStore` interface defines the standard methods that allow querying and updating the details of each namespace.
interface IGenesisStore {
    // SETTERS
    function newChain(string memory genesis, string[] memory validators, address[] memory oracles) external returns (uint32);
    function setGenesis(uint32 chainId, string memory newGenesis) external;
    function addValidator(uint32 chainId, string memory validatorPublicKey) external;
    function removeValidator(uint32 chainId, uint256 idx, string memory validatorPublicKey) external;
    function addOracle(uint32 chainId, address oracleAddress) external;
    function removeOracle(uint32 chainId, uint256 idx, address oracleAddress) external;

    // GETTERS
    function get(uint32 chainId) view external returns ( string memory genesis, string[] memory validators, address[] memory oracles);
    function isValidator(uint32 chainId, string memory validatorPublicKey) external view returns (bool);
    function isOracle(uint32 chainId, address oracleAddress) external view returns (bool);
    function getChainCount() external view returns(uint32);

    // EVENTS
    event ChainRegistered(uint32 chainId);
    event GenesisUpdated(string genesis, uint32 chainId);
    event ValidatorAdded(string validatorPublicKey, uint32 chainId);
    event ValidatorRemoved(string validatorPublicKey, uint32 chainId);
    event OracleAdded(address oracleAddress, uint32 chainId);
    event OracleRemoved(address oracleAddress, uint32 chainId);
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
