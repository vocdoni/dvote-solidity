pragma solidity ^0.5.0;

contract VotingProcess {

    // DATA AND STRUCTS

    struct Process {
        address entityResolver;    // A pointer to the Entity's resolver instance to fetch metadata
        address entityAddress;     // The address of the Entity's creator
        string processName;
        string metadataContentUri; // Content URI to fetch the JSON metadata from
        uint256 startTime;         // block.timestamp after which votes can be registered
        uint256 endTime;           // block.timestamp after which votes can be registered
        bytes32 voteEncryptionPublicKey;
        bool canceled;

        address[] relayList;       // Relay addresses to let users fetch the Relay data
        mapping (address => Relay) relays;
        
        mapping (uint64 => string) voteBatches;  // Mapping from [0..N-1] to Content URI's to fetch the vote batches
        uint64 voteBatchCount;                   // N vote batches registered
    }
    
    struct Relay {
        bool active;
        string publicKey;
        string messagingUri;
    }
    
    // MAPPINGS

    mapping (bytes32 => Process) public processes;   // processId => process data
    mapping (address => uint) public processCount;   // index of the last process for a given address

    // EVENTS

    event ProcessCreated(address indexed entityAddress, bytes32 processId);
    event ProcessCanceled(bytes32 indexed processId);
    event RelayAdded(bytes32 indexed processId, address relayAddress);
    event RelayDisabled(bytes32 indexed processId, address relayAddress);
    event BatchRegistered(bytes32 indexed processId, uint64 batchNumber);
    event PrivateKeyRevealed(bytes32 indexed processId);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {


    	_;
    }

    modifier onlyRelay(bytes32 processId) {


    	_;
    }

    // HELPERS

    // Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress) public view returns (bytes32){
        uint idx = processCount[entityAddress] + 1;
        return getProcessId(entityAddress, idx);
    }
    // Compute a process ID
    function getProcessId(address entityAddress, uint processIndex) public pure returns (bytes32){
        return keccak256(abi.encodePacked(entityAddress, processIndex));
    }
    
    // METHODS

    constructor() public {

    }

    function create(
    	address entityResolver,
    	string memory processName,
    	string memory metadataContentUri,
    	uint256 startTime,
    	uint256 endTime,
    	string memory voteEncryptionPublicKey
    ) public {

            address entityAddress = msg.sender;

        
    }

    function get(bytes32 processId) public view returns (
    	address entityResolver,
    	address entityAddress,
    	string memory processName,
    	string memory metadataContentUri,
    	uint256 startTime,
    	uint256 endTime,
    	string memory voteEncryptionPublicKey,
        bool canceled
    ) {

    }
    
    function cancel(bytes32 processId) public onlyEntity(processId) {

    }
    
    function addRelay(bytes32 processId, address relayAddress, string memory publicKey, string memory messagingUri) public onlyEntity(processId) {

    }
    
    function disableRelay(bytes32 processId, address relayAddress) public onlyEntity(processId) {

    }
    
    function getRelayIndex(bytes32 processId) public view returns (address[] memory) {

    }
    
    function isActiveRelay(bytes32 processId, address relayAddress) public view returns (bool) {

    }
    
    function getRelay(bytes32 processId, address relayAddress) public view returns (string memory publicKey, string memory messagingUri) {

    }
    
    function registerVoteBatch(bytes32 processId, string memory dataContentUri) public onlyRelay(processId) {

    }
    
    function getVoteBatchCount(bytes32 processId) public view returns (uint64) {

    }
    
    function getBatch(bytes32 processId, uint64 batchNumber) public view returns (string memory batchContentUri) {

    }
    
    function revealPrivateKey(bytes32 processId, string memory privateKey) public onlyEntity(processId) {

    }

    function getPrivateKey(bytes32 processId) public view returns (string memory privateKey) {

    }

}
