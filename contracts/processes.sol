// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./interfaces.sol";

contract Processes is IProcessStore {
    // CONSTANTS AND ENUMS

    /*
    Process Mode flags
    The process mode defines how the process behaves externally. It affects both the Vochain, the contract itself and even the metadata.

    0x00011111
         |||||
         ||||`- autoStart
         |||`-- interruptible
         ||`--- dynamicCensus
         |`---- allowVoteOverwrite
         `----- encryptedMetadata
    */
    uint8 internal constant MODE_AUTO_START = 1 << 0;
    uint8 internal constant MODE_INTERRUPTIBLE = 1 << 1;
    uint8 internal constant MODE_DYNAMIC_CENSUS = 1 << 2;
    uint8 internal constant MODE_ALLOW_VOTE_OVERWRITE = 1 << 3;
    uint8 internal constant MODE_ENCRYPTED_METADATA = 1 << 4;

    /*
    Envelope Type flags
    The envelope type tells how the vote envelope will be formatted and handled. Its value is generated by combining the flags below.

    0x00000111
           |||
           ||`- serial
           |`-- anonymous
           `--- encryptedVote
    */
    uint8 internal constant ENV_TYPE_SERIAL = 1 << 0;
    uint8 internal constant ENV_TYPE_ANONYMOUS = 1 << 1;
    uint8 internal constant ENV_TYPE_ENCRYPTED_VOTES = 1 << 2;

    // EVENTS

    event NamespaceAddressUpdated(address namespaceAddr);

    // GLOBAL DATA

    address internal contractOwner; // See `onlyContractOwner`
    address public predecessorAddress; // Instance that we forked
    address public successorAddress; // Instance that forked from us (only when activated)
    uint256 public activationBlock; // Block after which the contract operates. Zero means still inactive.

    address public namespaceAddress; // Address of the namespace contract instance that holds the current state

    // DATA STRUCTS
    struct ProcessResults {
        uint32[][] tally;     // apperence count for every question and option value
        uint32 height;        // total number of votes of the process
    }

    struct Process {
        uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
        uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/smart-contracts/process?id=flags
        address entityAddress; // The Ethereum address of the Entity
        uint64 startBlock; // Tendermint block number on which the voting process starts
        uint32 blockCount; // Amount of Tendermint blocks during which the voting process should be active
        string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
        string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        Status status; // One of 0 [ready], 1 [ended], 2 [canceled], 3 [paused], 4 [results]
        uint8 questionIndex; // The index of the currently active question (only assembly processes)
        // How many questions are available to vote
        // questionCount >= 1
        uint8 questionCount;
        // How many choices can be made for each question.
        // 1 <= maxCount <= 100
        uint8 maxCount;
        // Determines the acceptable value range.
        // N => valid votes will range from 0 to N (inclusive)
        uint8 maxValue;
        uint8 maxVoteOverwrites; // How many times a vote can be replaced (only the last one counts)
        // Choices for a question cannot appear twice or more
        bool uniqueValues;
        // Limits up to how much cost, the values of a vote can add up to (if applicable).
        // 0 => No limit / Not applicable
        uint16 maxTotalCost;
        // Defines the exponent that will be used to compute the "cost" of the options voted and compare it against `maxTotalCost`.
        // totalCost = Σ (value[i] ** costExponent) <= maxTotalCost
        //
        // Exponent range:
        // - 0 => 0.0000
        // - 10000 => 1.0000
        // - 65535 => 6.5535
        uint16 costExponent;
        // Self-assign to a certain namespace.
        // This will determine the oracles that listen and react to it.
        // Indirectly, it will also determine the Vochain that hosts this process.
        uint16 namespace;
        bytes32 paramsSignature; // entity.sign({...}) // fields that the oracle uses to authentify process creation
        ProcessResults results; // results wraps the tally, the total number of votes, a list of signatures and a list of proofs
    }

    /// @notice An entry for each process created by an Entity.
    /// @notice Keeps track of when it was created and what index this process has within the entire history of the Entity.
    /// @notice Use this to determine whether a process index belongs to the current instance or to a predecessor one.
    struct ProcessCheckpoint {
        uint256 index; // The index of this process within the entity's history, including predecessor instances
    }

    // PER-PROCESS DATA

    mapping(address => ProcessCheckpoint[]) internal entityCheckpoints; // Array of ProcessCheckpoint indexed by entity address
    mapping(bytes32 => Process) internal processes; // Mapping of all processes indexed by the Process ID

    // MODIFIERS

    /// @notice Fails if the sender is not the contract owner
    modifier onlyContractOwner override {
        require(msg.sender == contractOwner, "onlyContractOwner");
        _;
    }

    /// @notice Fails if the contract is not yet active or if a successor has been activated
    modifier onlyIfActive override {
        require(
            activationBlock > 0 && successorAddress == address(0),
            "Inactive"
        );
        _;
    }

    /// @notice Fails if the msg.sender is not an authorired oracle
    modifier onlyOracle(bytes32 processId) override {
         // Only an Oracle within the process' namespace is valid
        INamespaceStore namespace = INamespaceStore(namespaceAddress);
        require(
            namespace.isOracle(processes[processId].namespace, msg.sender),
            "Not oracle"
        );
        _;
    }

    // HELPERS

    function getEntityProcessCount(address entityAddress)
        public
        override
        view
        returns (uint256)
    {
        if (entityCheckpoints[entityAddress].length == 0) {
            // Not found locally
            if (predecessorAddress == address(0x0)) return 0; // No predecessor to ask

            // Ask the predecessor
            // Note: The predecessor's method needs to follow the old version's signature
            IProcessStore predecessor = IProcessStore(predecessorAddress);
            return predecessor.getEntityProcessCount(entityAddress);
        }

        return
            entityCheckpoints[entityAddress][entityCheckpoints[entityAddress]
                .length - 1]
                .index + 1;
    }

    /// @notice Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress, uint16 namespace)
        public
        override
        view
        returns (bytes32)
    {
        // From 0 to N-1, the next index is N
        uint256 processCount = getEntityProcessCount(entityAddress);
        return getProcessId(entityAddress, processCount, namespace);
    }

    /// @notice Compute the process ID
    function getProcessId(
        address entityAddress,
        uint256 processCountIndex,
        uint16 namespace
    ) public override pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(entityAddress, processCountIndex, namespace)
            );
    }

    function isContract(address _targetAddress) internal view returns (bool) {
        uint256 size;
        if (_targetAddress == address(0)) return false;
        assembly {
            size := extcodesize(_targetAddress)
        }
        return size > 0;
    }

    // GLOBAL METHODS

    /// @notice Creates a new instance of the contract and sets the contract owner.
    /// @param predecessor The address of the predecessor instance (if any). `0x0` means no predecessor.
    constructor(address predecessor, address namespace) public {
        if (predecessor != address(0)) {
            require(predecessor != address(this), "Can't be itself");
            require(isContract(predecessor), "Invalid predecessor");
        }

        require(isContract(namespace), "Invalid namespace");
        // `namespace` should also be checked for `!= address(this)`
        // However, since setting this value is not irreversible, we opt to save some gas.

        contractOwner = msg.sender;
        namespaceAddress = namespace;
        if (predecessor != address(0)) {
            // Set the predecessor instance and leave ourselves inactive
            predecessorAddress = predecessor;
        } else {
            // Set no predecessor and activate ourselves now
            activationBlock = block.number;
        }
    }

    /// @notice Sets the activation block of the instance, so that it can start operating
    function activate() public override {
        require(msg.sender == predecessorAddress, "Unauthorized");
        require(activationBlock == 0, "Already active");

        activationBlock = block.number;

        emit Activated(block.number);
    }

    /// @notice invokes `activate()` on the successor contract and deactivates itself
    function activateSuccessor(address successor)
        public
        override
        onlyContractOwner
    {
        require(activationBlock > 0, "Must be active"); // we can't activate someone else before being active ourselves
        require(successorAddress == address(0), "Already inactive"); // we can't do it twice
        require(successor != address(this), "Can't be itself");
        require(isContract(successor), "Not a contract"); // we can't activate a non-contract

        // Attach to the instance that will become active
        IProcessStore succInstance = IProcessStore(successor);
        succInstance.activate();
        successorAddress = successor;

        emit ActivatedSuccessor(block.number, successor);
    }

    function setNamespaceAddress(address namespace) public onlyContractOwner {
        require(isContract(namespace), "Invalid namespace");
        namespaceAddress = namespace;

        emit NamespaceAddressUpdated(namespace);
    }

    // GETTERS

    /// @notice Retrieves all the stored fields for the given processId
    function get(bytes32 processId)
        public
        override
        view
        returns (
            uint8[2] memory mode_envelopeType, // [mode, envelopeType]
            address entityAddress,
            string[3] memory metadata_censusMerkleRoot_censusMerkleTree, // [metadata, censusMerkleRoot, censusMerkleTree]
            uint64 startBlock, // startBlock
            uint32 blockCount, // blockCount
            Status status, // status
            uint8[5]
                memory questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites, // [questionIndex, questionCount, maxCount, maxValue, maxVoteOverwrites]
            bool uniqueValues, // uniqueValues
            uint16[3] memory maxTotalCost_costExponent_namespace
        )
    {
        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask

            // Ask the predecessor
            // Note: The predecessor's method needs to follow the old version's signature
            IProcessStore predecessor = IProcessStore(predecessorAddress);
            return predecessor.get(processId);
        }

        Process storage proc = processes[processId];
        mode_envelopeType = [proc.mode, proc.envelopeType];
        entityAddress = proc.entityAddress;
        metadata_censusMerkleRoot_censusMerkleTree = [
            proc.metadata,
            proc.censusMerkleRoot,
            proc.censusMerkleTree
        ];
        startBlock = proc.startBlock;
        blockCount = proc.blockCount;
        status = proc.status;
        questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites = [
            proc.questionIndex,
            proc.questionCount,
            proc.maxCount,
            proc.maxValue,
            proc.maxVoteOverwrites
        ];
        uniqueValues = proc.uniqueValues;
        maxTotalCost_costExponent_namespace = [
            proc.maxTotalCost,
            proc.costExponent,
            proc.namespace
        ];
    }

    /// @notice Gets the signature of the process parameters, so that authentication can be performed on the Vochain as well
    function getParamsSignature(bytes32 processId)
        public
        override
        view
        returns (bytes32)
    {
        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask

            // Ask the predecessor
            // Note: The predecessor's method needs to follow the old version's signature
            IProcessStore predecessor = IProcessStore(predecessorAddress);
            return predecessor.getParamsSignature(processId);
        }
        Process storage proc = processes[processId];
        return proc.paramsSignature;
    }

    /// @notice Fetch the results of the given processId, if any
    function getResults(bytes32 processId)
        public
        override
        view
        returns (uint32[][] memory tally, uint32 height)
    {
        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask

            // Ask the predecessor
            // Note: The predecessor's method needs to follow the old version's signature
            IProcessStore predecessor = IProcessStore(predecessorAddress);
            return predecessor.getResults(processId);
        }
        // Found locally
        ProcessResults storage results = processes[processId].results;
        return (results.tally, results.height);
    }

    /// @notice Gets the address of the process instance where the given processId was originally created.
    /// @notice This allows to know where to send update transactions, after a fork has occurred.
    function getCreationInstance(bytes32 processId)
        public
        override
        view
        returns (address)
    {
        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask

            // Ask the predecessor
            // Note: The predecessor's method needs to follow the old version's signature
            IProcessStore predecessor = IProcessStore(predecessorAddress);
            return predecessor.getCreationInstance(processId);
        }

        // Found locally
        return address(this);
    }

    // ENTITY METHODS

    function newProcess(
        uint8[2] memory mode_envelopeType, // [mode, envelopeType]
        string[3] memory metadata_merkleRoot_merkleTree, //  [metadata, merkleRoot, merkleTree]
        uint64 startBlock,
        uint32 blockCount,
        uint8[4] memory questionCount_maxCount_maxValue_maxVoteOverwrites, // [questionCount, maxCount, maxValue, maxVoteOverwrites]
        bool uniqueValues,
        uint16[2] memory maxTotalCost_costExponent, // [maxTotalCost, costExponent]
        uint16 namespace,
        bytes32 paramsSignature
    ) public override onlyIfActive {
        uint8 mode = mode_envelopeType[0];
        if (mode & MODE_AUTO_START != 0) {
            require(startBlock > 0, "Auto start requires a start block");
        }
        if (mode & MODE_INTERRUPTIBLE == 0) {
            require(blockCount > 0, "Uninterruptible needs blockCount");
        }
        require(
            bytes(metadata_merkleRoot_merkleTree[0]).length > 0,
            "No metadata"
        );
        require(
            bytes(metadata_merkleRoot_merkleTree[1]).length > 0,
            "No merkleRoot"
        );
        require(
            bytes(metadata_merkleRoot_merkleTree[2]).length > 0,
            "No merkleTree"
        );
        require(
            questionCount_maxCount_maxValue_maxVoteOverwrites[0] > 0,
            "No questionCount"
        );
        require(
            questionCount_maxCount_maxValue_maxVoteOverwrites[1] > 0 &&
                questionCount_maxCount_maxValue_maxVoteOverwrites[1] <= 100,
            "Invalid maxCount"
        );
        require(
            questionCount_maxCount_maxValue_maxVoteOverwrites[2] > 0,
            "No maxValue"
        );
        if (mode & MODE_ALLOW_VOTE_OVERWRITE != 0) {
            require(
                questionCount_maxCount_maxValue_maxVoteOverwrites[3] > 0,
                "Overwrite needs maxVoteOverwrites > 0"
            );
        }

        // Index the process for the entity
        uint256 prevCount = getEntityProcessCount(msg.sender);

        entityCheckpoints[msg.sender].push();
        ProcessCheckpoint storage checkpoint = entityCheckpoints[msg
            .sender][entityCheckpoints[msg.sender].length - 1];
        checkpoint.index = prevCount;

        // By default, processes start PAUSED (auto start disabled)
        Status status = Status.PAUSED;

        if (mode & MODE_AUTO_START != 0) {
            // Auto-start enabled processes start in READY state
            status = Status.READY;
        }

        // Store the new process
        bytes32 processId = getProcessId(msg.sender, prevCount, namespace);
        Process storage processData = processes[processId];

        processData.mode = mode_envelopeType[0];
        processData.envelopeType = mode_envelopeType[1];
        processData.entityAddress = msg.sender;
        processData.startBlock = startBlock;
        processData.blockCount = blockCount;
        processData.metadata = metadata_merkleRoot_merkleTree[0];
        processData.censusMerkleRoot = metadata_merkleRoot_merkleTree[1];
        processData.censusMerkleTree = metadata_merkleRoot_merkleTree[2];
        processData.status = status;
        // processData.questionIndex = 0;
        processData
            .questionCount = questionCount_maxCount_maxValue_maxVoteOverwrites[0];
        processData
            .maxCount = questionCount_maxCount_maxValue_maxVoteOverwrites[1];
        processData
            .maxValue = questionCount_maxCount_maxValue_maxVoteOverwrites[2];
        processData
            .maxVoteOverwrites = questionCount_maxCount_maxValue_maxVoteOverwrites[3];
        processData.uniqueValues = uniqueValues;
        processData.maxTotalCost = maxTotalCost_costExponent[0];
        processData.costExponent = maxTotalCost_costExponent[1];
        processData.namespace = namespace;
        processData.paramsSignature = paramsSignature;
        
        emit NewProcess(processId, namespace);
    }

    function setStatus(bytes32 processId, Status newStatus) public override {
        require(
            uint8(newStatus) <= uint8(Status.PAUSED), // [READY 0..3 PAUSED] => RESULTS (4) is not allowed
            "Invalid status code"
        );

        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask
            revert("Not found: Try on predecessor");
        }

        // Only the process creator
        require(
            processes[processId].entityAddress == msg.sender,
            "Invalid entity"
        );

        Status currentStatus = processes[processId].status;
        if (currentStatus != Status.READY && currentStatus != Status.PAUSED) {
            // When currentStatus is [ENDED, CANCELED, RESULTS], no update is allowed
            revert("Process terminated");
        } else if (currentStatus == Status.PAUSED) {
            // newStatus can only be [READY, ENDED, CANCELED, PAUSED] (see the require above)

            if (processes[processId].mode & MODE_INTERRUPTIBLE == 0) {
                // Is not interruptible, we can only go from PAUSED to READY, the first time
                require(newStatus == Status.READY, "Not interruptible");
            }
        } else {
            // currentStatus is READY

            if (processes[processId].mode & MODE_INTERRUPTIBLE == 0) {
                // If not interruptible, no status update is allowed
                revert("Not interruptible");
            }

            // newStatus can only be [READY, ENDED, CANCELED, PAUSED] (see require above).
        }

        // If currentStatus is READY => Can go to [ENDED, CANCELED, PAUSED].
        // If currentStatus is PAUSED => Can go to [READY, ENDED, CANCELED].
        require(newStatus != currentStatus, "Must differ");

        // Note: the process can also be ended from incrementQuestionIndex
        // If questionIndex is already at the last one
        processes[processId].status = newStatus;

        emit StatusUpdated(
            processId,
            processes[processId].namespace,
            newStatus
        );
    }

    function incrementQuestionIndex(bytes32 processId) public override {
        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask
            revert("Not found: Try on predecessor");
        }

        // Only the process creator
        require(
            processes[processId].entityAddress == msg.sender,
            "Invalid entity"
        );
        // Only if READY
        require(
            processes[processId].status == Status.READY,
            "Process not ready"
        );
        // Only when the envelope is in serial mode
        require(
            processes[processId].envelopeType & ENV_TYPE_SERIAL != 0,
            "Process not serial"
        );

        uint8 nextIdx = processes[processId].questionIndex.add8(1);

        if (nextIdx < processes[processId].questionCount) {
            processes[processId].questionIndex = nextIdx;

            // Not at the last question yet
            emit QuestionIndexUpdated(
                processId,
                processes[processId].namespace,
                nextIdx
            );
        } else {
            // The last question was currently active => End the process
            processes[processId].status = Status.ENDED;

            emit StatusUpdated(
                processId,
                processes[processId].namespace,
                Status.ENDED
            );
        }
    }

    function setCensus(
        bytes32 processId,
        string memory censusMerkleRoot,
        string memory censusMerkleTree
    ) public override onlyIfActive {
        require(bytes(censusMerkleRoot).length > 0, "No Merkle Root");
        require(bytes(censusMerkleTree).length > 0, "No Merkle Tree");

        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask
            revert("Not found: Try on predecessor");
        }

        // Only the process creator
        require(
            processes[processId].entityAddress == msg.sender,
            "Invalid entity"
        );
        // Only if active
        require(
            processes[processId].status == Status.READY ||
                processes[processId].status == Status.PAUSED,
            "Process terminated"
        );
        // Only when the census is dynamic
        require(
            processes[processId].mode & MODE_DYNAMIC_CENSUS != 0,
            "Read-only census"
        );

        processes[processId].censusMerkleRoot = censusMerkleRoot;
        processes[processId].censusMerkleTree = censusMerkleTree;

        emit CensusUpdated(processId, processes[processId].namespace);
    }

    function setResults(bytes32 processId, uint32[][] memory tally, uint32 height)
        public
        override
        onlyOracle(processId)
    {
        require(height > 0, "No votes");

        if (processes[processId].entityAddress == address(0x0)) {
            // Not found locally
            if (predecessorAddress == address(0x0)) revert("Not found"); // No predecessor to ask
            revert("Not found: Try on predecessor");
        }

        require(tally.length == processes[processId].questionCount, "Invalid tally");

        // cannot publish results on a canceled process or on a process
        // that already has results
        require(
            processes[processId].status != Status.CANCELED &&
                processes[processId].status != Status.RESULTS,
            "Canceled or already set"
        );
       
        processes[processId].results.tally = tally;
        processes[processId].results.height = height;
        processes[processId].status = Status.RESULTS;

        emit ResultsAvailable(processId);
    }
}
