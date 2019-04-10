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
        string voteEncryptionPublicKey;
        string voteEncryptionPrivateKey;  // Key revealed after the vote ends so that scrutiny can start
        bool canceled;

        address[] relayList;       // Relay addresses to let users fetch the Relay data
        mapping (address => Relay) relays;       // Mapping relayAddress => Relay
        
        mapping (uint64 => string) voteBatches;  // Mapping from [0..N-1] to Content URI's to fetch the vote batches
        uint64 voteBatchCount;                   // N vote batches registered
    }
    
    struct Relay {
        bool active;
        string publicKey;
        string messagingUri;
    }
    
    // MAPPINGS

    mapping (bytes32 => Process) public processes;         // processId => process data
    mapping (address => uint) public entityProcessCount;   // index of the last process for a given address

    // EVENTS

    event ProcessCreated(address indexed entityAddress, bytes32 processId);
    event ProcessCanceled(address indexed entityAddress, bytes32 processId);  // entityAddress could be removed. Keeping for web3 testability issues
    event RelayAdded(bytes32 indexed processId, address relayAddress);
    event RelayDisabled(bytes32 indexed processId, address relayAddress);
    event BatchRegistered(bytes32 indexed processId, uint64 batchNumber);
    event PrivateKeyRevealed(bytes32 indexed processId, string privateKey);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {
        require(processes[processId].entityAddress == msg.sender, "Invalid entity");
    	_;
    }

    modifier onlyActiveRelay(bytes32 processId) {
        require(isActiveRelay(processId, msg.sender), "Invalid relay");
    	_;
    }

    modifier onlyActiveProcessId(bytes32 processId) {
        require(!processes[processId].canceled, "Canceled process");
    	_;
    }

    // HELPERS

    // Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress) public view returns (bytes32){
        uint idx = entityProcessCount[entityAddress];
        return getProcessId(entityAddress, idx);
    }
    // Compute a process ID
    function getProcessId(address entityAddress, uint processIndex) public pure returns (bytes32){
        return keccak256(abi.encodePacked(entityAddress, processIndex));
    }
    
    // METHODS

    function create(
    	address entityResolver,
    	string memory processName,
    	string memory metadataContentUri,
    	uint256 startTime,
    	uint256 endTime,
    	string memory voteEncryptionPublicKey
    ) public {
        require(startTime > block.timestamp, "Invalid startTime");
        require(endTime > startTime, "Invalid endTime");
        require(bytes(processName).length > 0, "Empty processName");
        require(bytes(metadataContentUri).length > 0, "Empty metadataContentUri");
        require(bytes(voteEncryptionPublicKey).length > 0, "Empty voteEncryptionPublicKey");

        address entityAddress = msg.sender;
        bytes32 processId = getNextProcessId(entityAddress);

        processes[processId].entityResolver = entityResolver;
        processes[processId].entityAddress = entityAddress;
        processes[processId].processName = processName;
        processes[processId].metadataContentUri = metadataContentUri;
        processes[processId].startTime = startTime;
        processes[processId].endTime = endTime;
        processes[processId].voteEncryptionPublicKey = voteEncryptionPublicKey;

        entityProcessCount[entityAddress]++;
        
        emit ProcessCreated(entityAddress, processId);            
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
        entityResolver = processes[processId].entityResolver;
        entityAddress = processes[processId].entityAddress;
        processName = processes[processId].processName;
        metadataContentUri = processes[processId].metadataContentUri;
        startTime = processes[processId].startTime;
        endTime = processes[processId].endTime;
        voteEncryptionPublicKey = processes[processId].voteEncryptionPublicKey;
        canceled = processes[processId].canceled;
    }
    
    function cancel(bytes32 processId) public onlyEntity(processId) onlyActiveProcessId(processId) {
        require(processes[processId].startTime > block.timestamp, "Process started");

        processes[processId].relayList.length = 0;
        processes[processId].canceled = true;
        emit ProcessCanceled(msg.sender, processId);
    }
    
    function addRelay(bytes32 processId, address relayAddress, string memory publicKey, string memory messagingUri) public onlyEntity(processId) onlyActiveProcessId(processId) {
        require(!processes[processId].relays[relayAddress].active, "Relay already active");

        processes[processId].relayList.push(relayAddress);
        processes[processId].relays[relayAddress].publicKey = publicKey;
        processes[processId].relays[relayAddress].messagingUri = messagingUri;
        processes[processId].relays[relayAddress].active = true;

        emit RelayAdded(processId, relayAddress);
    }
    
    function disableRelay(bytes32 processId, address relayAddress) public onlyEntity(processId) onlyActiveProcessId(processId) {
        require(isActiveRelay(processId, relayAddress), "Relay already disabled");

        uint len = processes[processId].relayList.length;
        for (uint i = 0; i < len; i++) {
            if(processes[processId].relayList[i] != relayAddress) continue;

            // swap with the last element from the list
            processes[processId].relayList[i] = processes[processId].relayList[len - 1];
            processes[processId].relayList.length--;
            break;
        }

        processes[processId].relays[relayAddress].active = false;
        emit RelayDisabled(processId, relayAddress);
    }
    
    function getRelayIndex(bytes32 processId) public view returns (address[] memory) {
        return processes[processId].relayList;
    }
    
    function isActiveRelay(bytes32 processId, address relayAddress) public view returns (bool) {
        return processes[processId].relays[relayAddress].active;
    }
    
    function getRelay(bytes32 processId, address relayAddress) public view returns (string memory publicKey, string memory messagingUri) {
        publicKey = processes[processId].relays[relayAddress].publicKey;
        messagingUri = processes[processId].relays[relayAddress].messagingUri;
    }
    
    function registerVoteBatch(bytes32 processId, string memory dataContentUri) public onlyActiveRelay(processId) onlyActiveProcessId(processId) {
        require(block.timestamp >= processes[processId].startTime, "Process not started");
        require(block.timestamp < processes[processId].endTime, "Process ended");

        processes[processId].voteBatches[processes[processId].voteBatchCount] = dataContentUri;

        emit BatchRegistered(processId, processes[processId].voteBatchCount);

        processes[processId].voteBatchCount++;
    }
    
    function getVoteBatchCount(bytes32 processId) public view returns (uint64) {
        return processes[processId].voteBatchCount;
    }
    
    function getBatch(bytes32 processId, uint64 batchNumber) public view returns (string memory batchContentUri) {
        return processes[processId].voteBatches[batchNumber];
    }
    
    function revealPrivateKey(bytes32 processId, string memory privateKey) public onlyEntity(processId) onlyActiveProcessId(processId) {
        require(block.timestamp >= processes[processId].endTime, "Process not ended");

        processes[processId].voteEncryptionPrivateKey = privateKey;

        emit PrivateKeyRevealed(processId, privateKey);
    }

    function getPrivateKey(bytes32 processId) public view returns (string memory privateKey) {
        privateKey = processes[processId].voteEncryptionPrivateKey;
    }

}
