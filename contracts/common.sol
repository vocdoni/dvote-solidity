// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

/// @notice The `IProcessStore` interface allows different versions of the contract to talk to each other. Not all methods in the contract need to be future proof.
/// @notice Should operations be updated, then two versions should be kept, one for the old version and one for the new.
interface IProcessStore {
    enum Status {READY, ENDED, CANCELED, PAUSED, RESULTS}

    // GET
    function getEntityProcessCount(address entityAddress) external view returns (uint256);
    function getNextProcessId(address entityAddress) external view returns (bytes32);
    function getProcessId(address entityAddress, uint256 processCountIndex, uint32 namespaceId, uint32 chainId) external pure returns (bytes32);
    function get(bytes32 processId) external view returns (
        uint8[3] memory mode_envelopeType_censusOrigin,
        address entityAddress,
        string[3] memory metadata_censusRoot_censusUri,
        uint32[2] memory startBlock_blockCount,
        Status status,
        uint8[5] memory questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[2] memory maxTotalCost_costExponent,
        uint256 evmBlockHeight // EVM only
    );
    function getParamsSignature(bytes32 processId) external view returns (bytes32);
    function getCreationInstance(bytes32 processId) external view returns (address);

    // SET
    function newProcessStd(
        uint8[3] memory mode_envelopeType_censusOrigin,
        string[3] memory metadata_censusRoot_censusUri,
        uint32[2] memory startBlock_blockCount,
        uint8[4] memory questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[2] memory maxTotalCost_costExponent,
        bytes32 paramsSignature
    ) payable external;

    function newProcessEvm(
        uint8[3] memory mode_envelopeType_censusOrigin,
        string[2] memory metadata_censusRoot,
        uint32[2] memory startBlock_blockCount,
        uint8[4] memory questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[2] memory maxTotalCost_costExponent,
        address tokenContractAddress,
        uint256 evmBlockHeight,
        bytes32 paramsSignature
    ) payable external;

    function setStatus(bytes32 processId, Status newStatus) external;
    function incrementQuestionIndex(bytes32 processId) external;
    function setCensus(bytes32 processId, string memory censusRoot, string memory censusUri) external;
    function setProcessPrice(uint256 processPrice) external;
    function withdraw(address payable to, uint256 amount) external;

    // EVENTS
    event NewProcess(bytes32 processId, uint32 namespace);
    event StatusUpdated(bytes32 processId, uint32 namespace, Status status);
    event QuestionIndexUpdated(
        bytes32 processId,
        uint32 namespace,
        uint8 newIndex
    );
    event CensusUpdated(bytes32 processId, uint32 namespace);
    event ProcessPriceUpdated(uint256 processPrice);
    event Withdraw(address to, uint256 amount);
}

/// @notice The `IResultsStore` interface allows different versions of the contract to talk to each other. Not all methods in the contract need to be future proof.
/// @notice Should operations be updated, then two versions should be kept, one for the old version and one for the new.
interface IResultsStore {
    modifier onlyOracle(uint32 vochainId) virtual;

    // GET
    function getResults(bytes32 processId) external view returns (uint32[][] memory tally, uint32 height);

    // SET
    function setProcessesAddress(address processesAddr) external;
    function setResults(bytes32 processId, uint32[][] memory tally, uint32 height, uint32 vochainId) external;

    // EVENTS
    event ResultsAvailable(bytes32 processId);
}

/// @notice The `INamespaceStore` interface defines the contract methods that allow process contracts to self register to a namespace ID
interface INamespaceStore {
    // SETTERS
    function register() external returns(uint32);

    // GETTERS
    function processContractAt(uint32 namespaceId) external view returns (address);

    // EVENTS
    event NamespaceRegistered(uint32 namespace);
}

/// @notice The `IGenesisStore` interface defines the standard methods that allow querying and updating the details of each namespace.
interface IGenesisStore {
    // SETTERS
    function newChain(string memory genesis, bytes[] memory validators, address[] memory oracles) external returns (uint32);
    function setGenesis(uint32 chainId, string memory newGenesis) external;
    function addValidator(uint32 chainId, bytes memory validatorPublicKey) external;
    function removeValidator(uint32 chainId, uint256 idx, bytes memory validatorPublicKey) external;
    function addOracle(uint32 chainId, address oracleAddress) external;
    function removeOracle(uint32 chainId, uint256 idx, address oracleAddress) external;

    // GETTERS
    function get(uint32 chainId) view external returns ( string memory genesis, bytes[] memory validators, address[] memory oracles);
    function isValidator(uint32 chainId, bytes memory validatorPublicKey) external view returns (bool);
    function isOracle(uint32 chainId, address oracleAddress) external view returns (bool);
    function getChainCount() external view returns(uint32);

    // EVENTS
    event ChainRegistered(uint32 chainId);
    event GenesisUpdated(uint32 chainId);
    event ValidatorAdded(uint32 chainId, bytes validatorPublicKey);
    event ValidatorRemoved(uint32 chainId, bytes validatorPublicKey);
    event OracleAdded(uint32 chainId, address oracleAddress);
    event OracleRemoved(uint32 chainId, address oracleAddress);
}

/// @notice The `ITokenStorageProof` interface defines the standard methods that allow checking ERC token balances.
interface ITokenStorageProof {
    /// @notice Checks that the given contract is an ERC token, validates that the balance of the sender matches the one obtained from the storage position and registers the token address
    function registerTokenWithProof(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof) external;

    /// @notice Checks that the given contract is an ERC token, check the balance of the holder and registers the token
    function registerToken(address tokenAddress, uint256 balanceMappingPosition) external;

    /// @notice Sets the balanceMappingPosition of the given token address if unverified
    function setBalanceMappingPosition(address tokenAddress, uint256 balanceMappingPosition) external;

    /// @notice Determines whether the given address is registered as an ERC token contract
    function isRegistered(address tokenAddress) external view returns (bool);

     /// @notice Determines whether the given address is registered as an ERC token contract and verified
    function isVerified(address tokenAddress) external view returns (bool);

    /// @notice Determines if the msg.sender of the tx is holder for the given token address
    function isHolder(address tokenAddress, address holder) external view returns (bool);
  
    /// @notice Determines the balance slot of a holder of an ERC20 token given a balance slot
    function getHolderBalanceSlot(address holder, uint256 balanceMappingPosition) external pure returns(bytes32);

    /// @notice Returns the balance mapping position of a token for users to generate proofs
    function getBalanceMappingPosition(address tokenAddress) external view returns (uint256);

    // EVENTS
    event TokenRegistered(address indexed tokenAddress, address indexed registrar);
    event BalanceMappingPositionUpdated(address tokenAddress, address holder, uint256 balanceMappingPosition);
}
