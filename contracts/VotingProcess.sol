pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract VotingProcess {

    // GLOBAL STRUCTS

    struct Process {
        string processType;                // One of: snark-vote, poll-vote, petition-sign
        address entityAddress;             // The Ethereum address of the Entity
        uint256 startBlock;                // Tendermint block number on which the voting process starts
        uint256 numberOfBlocks;            // Amount of Tendermint blocks during which the voting process is active
        string metadata;                   // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot;           // Hex string with the Merkle Root hash of the census
        string censusMerkleTree;           // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        string voteEncryptionPrivateKey;   // Key published after the vote ends so that scrutiny can start
        bool canceled;                     // Can be used by organization to cancel the project
        string results;                    // Content Hashed URI of the results (See Data Origins)
    }

    // GLOBAL DATA

    address contractOwner;
    string[] validators;                   // Public key array
    string[] oracles;                      // Public key array
    string genesis;                        // Content Hashed URI
    uint chainId;

    // PER-PROCESS DATA

    Process[] public processes;                 // Array of Process struct
    mapping (bytes32 => uint) processesIndex;   // Mapping of processIds with processess idx
    mapping (address => uint) public entityProcessCount;   // index of the last process for a given address

    // EVENTS

    event GenesisChanged(string genesis);
    event ChainIdChanged(uint chainId);
    event ProcessCreated(address indexed entityAddress, bytes32 processId, string merkleTree);
    event ProcessCanceled(address indexed entityAddress, bytes32 processId);
    event ValidatorAdded(string validatorPublicKey);
    event ValidatorRemoved(string validatorPublicKey);
    event OracleAdded(string oraclePublicKey);
    event OracleRemoved(string oraclePublicKey);
    event PrivateKeyPublished(bytes32 indexed processId, string privateKey);
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

    function create(string memory processType, string memory metadata, string memory merkleRoot,
        string memory merkleTree, uint256 startBlock, uint256 numberOfBlocks) public {
        require(bytes(metadata).length > 0, "Empty metadata");
        require(bytes(merkleRoot).length > 0, "Empty merkleRoot");
        require(bytes(merkleTree).length > 0, "Empty merkleTree");

        address entityAddress = msg.sender;
        bytes32 processId = getNextProcessId(entityAddress);
        // require(processesIndex[processId] == 0, "ProcessId already exists");

        Process memory process = Process({
            processType: processType,
            entityAddress: entityAddress,
            startBlock: startBlock,
            numberOfBlocks: numberOfBlocks,
            metadata: metadata,
            censusMerkleRoot: merkleRoot,
            censusMerkleTree: merkleTree,
            voteEncryptionPrivateKey: "",
            canceled: false,
            results: ""
        });

        processes.push(process);
        processesIndex[processId] = processes.length - 1;
        entityProcessCount[entityAddress]++;

        emit ProcessCreated(entityAddress, processId, merkleTree);
    }

    function get(bytes32 processId) public view returns (
        string memory processType,
    	address entityAddress,
        uint256 startBlock,
        uint256 numberOfBlocks,
    	string memory metadata,
    	string memory censusMerkleRoot,
    	string memory censusMerkleTree,
    	string memory voteEncryptionPrivateKey,
        bool canceled
    ) {
        uint processIndex = processesIndex[processId];
        processType = processes[processIndex].processType;
        entityAddress = processes[processIndex].entityAddress;
        startBlock = processes[processIndex].startBlock;
        numberOfBlocks = processes[processIndex].numberOfBlocks;
        metadata = processes[processIndex].metadata;
        censusMerkleRoot = processes[processIndex].censusMerkleRoot;
        censusMerkleTree = processes[processIndex].censusMerkleTree;
        voteEncryptionPrivateKey = processes[processIndex].voteEncryptionPrivateKey;
        canceled = processes[processIndex].canceled;
    }

    function cancel(bytes32 processId) public onlyEntity(processId) {
        uint processIndex = getProcessIndex(processId);
        require(processes[processIndex].canceled == false, "Process must not be canceled");

        processes[processIndex].canceled = true;

        emit ProcessCanceled(msg.sender, processId);
    }

    function addValidator(string memory validatorPublicKey) public onlyContractOwner()  {
        validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey);
    }

    function removeValidator(uint idx, string memory validatorPublicKey) public onlyContractOwner() {
        require(equalStrings(validators[idx], validatorPublicKey), "Validator to remove does not match index");

        // swap with the last element from the list
        validators[idx] = validators[validators.length - 1];
        validators.length--;

        emit ValidatorRemoved(validatorPublicKey);
    }

    function getValidators() public view returns (string[] memory) {
        return validators;
    }

    function addOracle(string memory oraclePublicKey) public onlyContractOwner()  {
        oracles.push(oraclePublicKey);

        emit OracleAdded(oraclePublicKey);
    }

    function removeOracle(uint idx, string memory oraclePublicKey) public onlyContractOwner() {
        require(equalStrings(oracles[idx], oraclePublicKey), "Oracle to remove does not match index");

        // swap with the last element from the list
        oracles[idx] = oracles[oracles.length - 1];
        oracles.length--;

        emit OracleRemoved(oraclePublicKey);
    }

    function getOracles() public view returns (string[] memory) {
        return oracles;
    }

    function publishPrivateKey(bytes32 processId, string memory privateKey) public onlyEntity(processId) {
        uint processIndex = getProcessIndex(processId);
        require(processes[processIndex].canceled == false, "Process must not be canceled");

        processes[processIndex].voteEncryptionPrivateKey = privateKey;

        emit PrivateKeyPublished(processId, privateKey);
    }

    function getPrivateKey(bytes32 processId) public view returns (string memory privateKey) {
        uint processIndex = getProcessIndex(processId);
        privateKey = processes[processIndex].voteEncryptionPrivateKey;
    }

    function publishResults(bytes32 processId, string memory results) public onlyEntity(processId) {
        uint processIndex = getProcessIndex(processId);
        require(processes[processIndex].canceled == false, "Process must not be canceled");
        require(equalStrings(processes[processIndex].voteEncryptionPrivateKey, "") == false, "The private key has not been revealed yet");

        processes[processIndex].results = results;

        emit ResultsPublished(processId, results);
    }

    function getResults(bytes32 processId) public view returns (string memory results) {
        uint processIndex = getProcessIndex(processId);
        results = processes[processIndex].results;
    }
}
