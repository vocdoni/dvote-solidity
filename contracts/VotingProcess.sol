pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

contract VotingProcess {

    // GLOBAL STRUCTS

    struct Process {
        uint8 envelopeType;                // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/components/process
        uint8 mode;                        // 0 [scheduled-single-envelope], 1 [ondemand-single-envelope]
        address entityAddress;             // The Ethereum address of the Entity
        uint256 startBlock;                // Tendermint block number on which the voting process starts
        uint256 numberOfBlocks;            // Amount of Tendermint blocks during which the voting process is active
        string metadata;                   // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot;           // Hex string with the Merkle Root hash of the census
        string censusMerkleTree;           // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        uint8 status;                      // 0 [open], 1 [ended], 2 [canceled], 3 [paused]
        string results;                    // string containing the results
    }

    // GLOBAL DATA

    address contractOwner;
    string[] validators;                   // Public key array
    address[] oracles;                     // Public key array
    string genesis;                        // Content Hashed URI
    uint chainId;

    // PER-PROCESS DATA

    Process[] public processes;                            // Array of Process struct
    mapping (bytes32 => uint) processesIndex;              // Mapping of processIds with processess idx
    mapping (address => uint) public entityProcessCount;   // index of the last process for a given address

    // EVENTS

    event GenesisChanged(string genesis);
    event ChainIdChanged(uint chainId);
    event ProcessCreated(address indexed entityAddress, bytes32 processId, string merkleTree);
    event ProcessStatusUpdated(address indexed entityAddress, bytes32 processId, uint8 status);
    event ValidatorAdded(string validatorPublicKey);
    event ValidatorRemoved(string validatorPublicKey);
    event OracleAdded(address oracleAddress);
    event OracleRemoved(address oracleAddress);
    event ResultsPublished(bytes32 indexed processId, string results);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {
        uint processIdx = getProcessIndex(processId);
        require(processes[processIdx].entityAddress == msg.sender, "Invalid entity");
    	_;
    }

    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Only contract owner");
    	_;
    }

    modifier onlyOracle() {
        bool authorized = false;
        for (uint i = 0; i < oracles.length; i++) {
            if (msg.sender == oracles[i]) {
                authorized = true;
                break;
            }
        }
        require(authorized == true, "unauthorized");
        _;
    }

    // HELPERS

    function getEntityProcessCount(address entityAddress) public view returns (uint) {
        return entityProcessCount[entityAddress];
    }

    // Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress) public view returns (bytes32) {
        uint idx = getEntityProcessCount(entityAddress);
        return getProcessId(entityAddress, idx);
    }

    // Compute a process ID
    function getProcessId(address entityAddress, uint processCountIndex) public view returns (bytes32) {
        return keccak256(abi.encodePacked(entityAddress, processCountIndex, genesis, chainId));
    }

    function getProcessIndex(bytes32 processId) public view returns (uint) {
        return processesIndex[processId];
    }

    function equalStrings(string memory str1, string memory str2) public pure returns(bool) {
        return keccak256(abi.encodePacked((str1))) == keccak256(abi.encodePacked((str2)));
    }

    function validatorExists(string memory validator) public view returns(bool) {
        for (uint i = 0; i < validators.length; i++) {
            if (equalStrings(validators[i], validator)) {
                return true;
            }
        }
        return false;
    }

    function oracleExists(address oracle) public view returns(bool) {
          for (uint i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracle) {
                return true;
            }
        }
        return false;
    }
    // METHODS

    constructor(uint chainIdValue) public {
        contractOwner = msg.sender;
        chainId = chainIdValue;
    }

    function setGenesis(string memory newValue) public onlyContractOwner()  {
        require(equalStrings(genesis, newValue) == false, "New genesis can't be the same");

        genesis = newValue;

        emit GenesisChanged(genesis);
    }

    function getGenesis() public view returns (string memory) {
        return genesis;
    }

    function setChainId(uint newValue) public onlyContractOwner()  {
        require(chainId != newValue, "New chainId can't be the same");
        chainId = newValue;

        emit ChainIdChanged(chainId);
    }

    function getChainId() public view returns (uint) {
        return chainId;
    }

    function create(uint8 envelopeType, uint8 mode, string memory metadata, string memory merkleRoot,
        string memory merkleTree, uint256 startBlock, uint256 numberOfBlocks) public {
        require(bytes(metadata).length > 0, "Empty metadata");
        require(bytes(merkleRoot).length > 0, "Empty merkleRoot");
        require(bytes(merkleTree).length > 0, "Empty merkleTree");
        require(
            envelopeType == 0  || // Realtime poll
            envelopeType == 1  || // Petition sign
            envelopeType == 4  || // Encrypted poll
            envelopeType == 6  || // Encrypted private poll
            envelopeType == 8  || // Realtime election
            envelopeType == 10 || // Private election
            envelopeType == 12 || // Election
            envelopeType == 14,   // Realtime private election
            "Invalid envelope type"
        );
        require(mode == 0 || mode == 1, "Invalid process mode");

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
            results: ""
        });

        processes.push(process);
        processesIndex[processId] = processes.length - 1;
        entityProcessCount[entityAddress]++;

        emit ProcessCreated(entityAddress, processId, merkleTree);
    }

    function get(bytes32 processId) public view returns (
        uint8 envelopeType,
        uint8 mode,
    	address entityAddress,
        uint256 startBlock,
        uint256 numberOfBlocks,
    	string memory metadata,
    	string memory censusMerkleRoot,
    	string memory censusMerkleTree,
        uint8 status
    ) {
        uint processIndex = processesIndex[processId];
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

    function setProcessStatus(bytes32 processId, uint8 status) public onlyEntity(processId) {
        require(status >= 0 && status < 4, "Invalid status code");
        uint processIndex = getProcessIndex(processId);

        // check status code and conditions for changing it
        if (status == 0) {
            require(processes[processIndex].status == 3, "Process must be paused");
        } else if (status == 1 || status == 2) {
            require(processes[processIndex].status == 0 || processes[processIndex].status == 3, "Process must be open or paused");
        } else if (status == 3) {
            require(processes[processIndex].status == 0, "Process must be open");
        }

        processes[processIndex].status = status;

        emit ProcessStatusUpdated(msg.sender, processId, status);
    }

    function addValidator(string memory validatorPublicKey) public onlyContractOwner()  {
        require(validatorExists(validatorPublicKey) == false, "Validator already exists");
        validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey);
    }

    function removeValidator(uint idx, string memory validatorPublicKey) public onlyContractOwner() {
        require(equalStrings(validators[idx], validatorPublicKey), "Validator to remove does not match index");
        // swap with the last element from the list
        validators[idx] = validators[validators.length - 1];
        validators.pop();

        emit ValidatorRemoved(validatorPublicKey);
    }

    function getValidators() public view returns (string[] memory) {
        return validators;
    }

    function addOracle(address oracleAddress) public onlyContractOwner()  {
        require(oracleExists(oracleAddress) == false, "Oracle already exists");
        oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress);
    }

    function removeOracle(uint idx, address oracleAddress) public onlyContractOwner() {
        require(idx < oracles.length, "Invalid index");
        require(oracles[idx] == oracleAddress, "Oracle to remove does not match index");

        // swap with the last element from the list
        oracles[idx] = oracles[oracles.length - 1];
        oracles.pop();

        emit OracleRemoved(oracleAddress);
    }

    function getOracles() public view returns (address[] memory) {
        return oracles;
    }

    function publishResults(bytes32 processId, string memory results) public onlyOracle {
        uint processIndex = getProcessIndex(processId);

        // cannot publish results of a canceled process
        require(processes[processIndex].status != 2, "Process must not be canceled");
        // results can only be published once
        require(equalStrings(processes[processIndex].results, "") == true, "Results already published");

        processes[processIndex].results = results;

        emit ResultsPublished(processId, results);
    }

    function getResults(bytes32 processId) public view returns (string memory results) {
        uint processIndex = getProcessIndex(processId);
        results = processes[processIndex].results;
    }
}
