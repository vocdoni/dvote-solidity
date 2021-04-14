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
    function newProcess(
        uint8[3] memory mode_envelopeType_censusOrigin,
        address tokenContractAddress,
        string[3] memory metadata_censusRoot_censusUri,
        uint32[2] memory startBlock_blockCount,
        uint8[4] memory questionCount_maxCount_maxValue_maxVoteOverwrites,
        uint16[2] memory maxTotalCost_costExponent,
        uint256 evmBlockHeight, // EVM only
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
    function registerToken(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof) external;

    /// @notice Determines whether the given address is registered as an ERC token contract
    function isRegistered(address tokenAddress) external view returns (bool);
  
    /// @notice Determines the balance slot of a holder of an ERC20 token given a balance slot
    function getHolderBalanceSlot(address holder, uint256 balanceMappingPosition) external pure returns(bytes32);

    /// @notice Returns the balance mapping position of a token for users to generate proofs
    function getBalanceMappingPosition(address tokenAddress) external view returns (uint256);
}

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
