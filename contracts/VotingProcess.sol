pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;


contract VotingProcess {
    // GLOBAL STRUCTS

    struct Process {
        uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/components/process
        uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/components/process
        address entityAddress; // The Ethereum address of the Entity
        uint256 startBlock; // Tendermint block number on which the voting process starts
        uint256 numberOfBlocks; // Amount of Tendermint blocks during which the voting process is active
        string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
        string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        uint8 status; // One of 0 [open], 1 [ended], 2 [canceled], 3 [paused]
        uint8 questionIndex; // The index of the currently active question (only assembly processes)
        string results; // string containing the results
    }

    // GLOBAL DATA

    address contractOwner;
    string[] validators; // Public key array
    address[] oracles; // Public key array
    string genesis; // Content Hashed URI
    uint256 chainId;
    mapping(uint8 => bool) envelopeTypes; // valid envelope types
    mapping(uint8 => bool) modes; // valid process modes

    // PER-PROCESS DATA

    Process[] public processes; // Array of Process struct
    mapping(bytes32 => uint256) processesIndex; // Mapping of processIds with processess idx
    mapping(address => uint256) public entityProcessCount; // index of the last process for a given address

    // EVENTS

    event GenesisChanged(string genesis);
    event ChainIdChanged(uint256 chainId);
    event ProcessCreated(
        address indexed entityAddress,
        bytes32 processId,
        string merkleTree
    );
    event ProcessStatusUpdated(
        address indexed entityAddress,
        bytes32 processId,
        uint8 status
    );
    event ValidatorAdded(string validatorPublicKey);
    event ValidatorRemoved(string validatorPublicKey);
    event OracleAdded(address oracleAddress);
    event OracleRemoved(address oracleAddress);
    event QuestionIndexIncremented(bytes32 indexed processId, uint8 newIndex);
    event ResultsPublished(bytes32 indexed processId, string results);
    event EnvelopeTypeAdded(uint8 envelopeType);
    event EnvelopeTypeRemoved(uint8 envelopeType);
    event ModeAdded(uint8 mode);
    event ModeRemoved(uint8 mode);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {
        uint256 processIdx = getProcessIndex(processId);
        require(
            processes[processIdx].entityAddress == msg.sender,
            "Invalid entity"
        );
        _;
    }

    modifier onlyContractOwner {
        require(msg.sender == contractOwner, "Only contract owner");
        _;
    }

    modifier onlyOracle {
        bool authorized = false;
        for (uint256 i = 0; i < oracles.length; i++) {
            if (msg.sender == oracles[i]) {
                authorized = true;
                break;
            }
        }
        require(authorized == true, "unauthorized");
        _;
    }

    // HELPERS

    function getEntityProcessCount(address entityAddress)
        public
        view
        returns (uint256)
    {
        return entityProcessCount[entityAddress];
    }

    // Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress)
        public
        view
        returns (bytes32)
    {
        uint256 idx = getEntityProcessCount(entityAddress);
        return getProcessId(entityAddress, idx);
    }

    // Compute a process ID
    function getProcessId(address entityAddress, uint256 processCountIndex)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    entityAddress,
                    processCountIndex,
                    genesis,
                    chainId
                )
            );
    }

    function getProcessIndex(bytes32 processId) public view returns (uint256) {
        return processesIndex[processId];
    }

    function equalStrings(string memory str1, string memory str2)
        public
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked((str1))) ==
            keccak256(abi.encodePacked((str2)));
    }

    function validatorExists(string memory validator)
        public
        view
        returns (bool)
    {
        for (uint256 i = 0; i < validators.length; i++) {
            if (equalStrings(validators[i], validator)) {
                return true;
            }
        }
        return false;
    }

    function oracleExists(address oracle) public view returns (bool) {
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracle) {
                return true;
            }
        }
        return false;
    }

    // METHODS

    constructor(
        uint256 chainIdValue,
        uint8[] memory validEnvelopeTypes,
        uint8[] memory validModes
    ) public {
        contractOwner = msg.sender;
        chainId = chainIdValue;
        // add supported envelopeTypes and modes
        for (uint256 i = 0; i < validEnvelopeTypes.length; i++) {
            // avoid setting same envelopeType twice
            if (envelopeTypes[validEnvelopeTypes[i]] == true) {
                continue;
            }
            envelopeTypes[validEnvelopeTypes[i]] = true;
        }
        for (uint256 i = 0; i < validModes.length; i++) {
            // avoid setting same mode twice
            if (modes[validModes[i]] == true) {
                continue;
            }
            modes[validModes[i]] = true;
        }
    }

    function setGenesis(string memory newValue) public onlyContractOwner {
        require(
            equalStrings(genesis, newValue) == false,
            "New genesis can't be the same"
        );

        genesis = newValue;

        emit GenesisChanged(genesis);
    }

    function getGenesis() public view returns (string memory) {
        return genesis;
    }

    function setChainId(uint256 newValue) public onlyContractOwner {
        require(chainId != newValue, "New chainId can't be the same");
        chainId = newValue;

        emit ChainIdChanged(chainId);
    }

    function getChainId() public view returns (uint256) {
        return chainId;
    }

    function create(
        uint8 envelopeType,
        uint8 mode,
        string memory metadata,
        string memory merkleRoot,
        string memory merkleTree,
        uint256 startBlock,
        uint256 numberOfBlocks
    ) public {
        require(bytes(metadata).length > 0, "Empty metadata");
        require(bytes(merkleRoot).length > 0, "Empty merkleRoot");
        require(bytes(merkleTree).length > 0, "Empty merkleTree");
        require(envelopeTypes[envelopeType] == true, "Invalid envelope type");
        require(modes[mode] == true, "Invalid mode");

        address entityAddress = msg.sender;
        bytes32 processId = getNextProcessId(entityAddress);
        // require(processesIndex[processId] == 0, "ProcessId already exists");

        // by default status is open
        uint8 status = 0;
        // on-demand process
        if (mode == 1) {
            // by default on-demand processes status is paused
            status = 3;
        }
        Process memory process = Process({
            envelopeType: envelopeType,
            mode: mode,
            entityAddress: entityAddress,
            startBlock: startBlock,
            numberOfBlocks: numberOfBlocks,
            metadata: metadata,
            censusMerkleRoot: merkleRoot,
            censusMerkleTree: merkleTree,
            status: status,
            questionIndex: 0,
            results: ""
        });

        processes.push(process);
        processesIndex[processId] = processes.length - 1;
        entityProcessCount[entityAddress]++;

        emit ProcessCreated(entityAddress, processId, merkleTree);
    }

    function get(bytes32 processId)
        public
        view
        returns (
            uint8 envelopeType,
            uint8 mode,
            address entityAddress,
            uint256 startBlock,
            uint256 numberOfBlocks,
            string memory metadata,
            string memory censusMerkleRoot,
            string memory censusMerkleTree,
            uint8 status
        )
    {
        uint256 processIndex = processesIndex[processId];
        envelopeType = processes[processIndex].envelopeType;
        mode = processes[processIndex].mode;
        entityAddress = processes[processIndex].entityAddress;
        startBlock = processes[processIndex].startBlock;
        numberOfBlocks = processes[processIndex].numberOfBlocks;
        metadata = processes[processIndex].metadata;
        censusMerkleRoot = processes[processIndex].censusMerkleRoot;
        censusMerkleTree = processes[processIndex].censusMerkleTree;
        status = processes[processIndex].status;
    }

    function setProcessStatus(bytes32 processId, uint8 status)
        public
        onlyEntity(processId)
    {
        require(status >= 0 && status < 4, "Invalid status code");
        uint256 processIndex = getProcessIndex(processId);

        // check status code and conditions for changing it
        if (status == 0) {
            require(
                processes[processIndex].status == 3,
                "Process must be paused"
            );
        } else if (status == 1 || status == 2) {
            require(
                processes[processIndex].status == 0 ||
                    processes[processIndex].status == 3,
                "Process must be open or paused"
            );
        } else if (status == 3) {
            require(
                processes[processIndex].status == 0,
                "Process must be open"
            );
        }

        processes[processIndex].status = status;

        emit ProcessStatusUpdated(msg.sender, processId, status);
    }

    function addEnvelopeType(uint8 envelopeType) public onlyContractOwner {
        require(
            envelopeTypes[envelopeType] == false,
            "Envelope type already supported"
        );
        envelopeTypes[envelopeType] = true;

        emit EnvelopeTypeAdded(envelopeType);
    }

    function removeEnvelopeType(uint8 envelopeType) public onlyContractOwner {
        require(
            envelopeTypes[envelopeType] == true,
            "Envelope type already not supported"
        );
        envelopeTypes[envelopeType] = false;

        emit EnvelopeTypeRemoved(envelopeType);
    }

    function isEnvelopeTypeSupported(uint8 envelopeType) public view returns (bool) {
        return envelopeTypes[envelopeType];
    }

    function addMode(uint8 mode) public onlyContractOwner {
        require(modes[mode] == false, "Mode already supported");
        modes[mode] = true;

        emit ModeAdded(mode);
    }

    function removeMode(uint8 mode) public onlyContractOwner {
        require(modes[mode] == true, "Mode already not supported");
        modes[mode] = false;

        emit ModeRemoved(mode);
    }

    function isModeSupported(uint8 mode) public view returns (bool) {
        return modes[mode];
    }

    function addValidator(string memory validatorPublicKey)
        public
        onlyContractOwner
    {
        require(
            validatorExists(validatorPublicKey) == false,
            "Validator already exists"
        );
        validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey);
    }

    function removeValidator(uint256 idx, string memory validatorPublicKey)
        public
        onlyContractOwner
    {
        require(
            equalStrings(validators[idx], validatorPublicKey),
            "Validator to remove does not match index"
        );
        // swap with the last element from the list
        validators[idx] = validators[validators.length - 1];
        validators.pop();

        emit ValidatorRemoved(validatorPublicKey);
    }

    function getValidators() public view returns (string[] memory) {
        return validators;
    }

    function addOracle(address oracleAddress) public onlyContractOwner() {
        require(oracleExists(oracleAddress) == false, "Oracle already exists");
        oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress);
    }

    function removeOracle(uint256 idx, address oracleAddress)
        public
        onlyContractOwner
    {
        require(idx < oracles.length, "Invalid index");
        require(
            oracles[idx] == oracleAddress,
            "Oracle to remove does not match index"
        );

        // swap with the last element from the list
        oracles[idx] = oracles[oracles.length - 1];
        oracles.pop();

        emit OracleRemoved(oracleAddress);
    }

    function getOracles() public view returns (address[] memory) {
        return oracles;
    }

    function incrementQuestionIndex(bytes32 processId)
        public
        onlyEntity(processId)
    {
        uint256 processIndex = getProcessIndex(processId);

        // require(
        //     (processes[processIndex].mode & 0x02) == 0x02,
        //     "The question index only works in assembly mode"
        // );
        require(
            processes[processIndex].questionIndex < 255,
            "The question index cannot overflow"
        );

        uint8 nextIdx = processes[processIndex].questionIndex + 1;
        processes[processIndex].questionIndex = nextIdx;

        emit QuestionIndexIncremented(processId, nextIdx);
    }

    function getQuestionIndex(bytes32 processId)
        public
        view
        returns (uint8 questionIndex)
    {
        uint256 processIndex = processesIndex[processId];
        questionIndex = processes[processIndex].questionIndex;
    }

    function publishResults(bytes32 processId, string memory results)
        public
        onlyOracle
    {
        uint256 processIndex = getProcessIndex(processId);

        // cannot publish results of a canceled process
        require(
            processes[processIndex].status != 2,
            "Process must not be canceled"
        );
        // results can only be published once
        require(
            equalStrings(processes[processIndex].results, "") == true,
            "Results already published"
        );

        processes[processIndex].results = results;

        emit ResultsPublished(processId, results);
    }

    function getResults(bytes32 processId)
        public
        view
        returns (string memory results)
    {
        uint256 processIndex = getProcessIndex(processId);
        results = processes[processIndex].results;
    }
}
