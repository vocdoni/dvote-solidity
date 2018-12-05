pragma solidity ^0.5.0;

contract VotingProcess {

    struct Process {
        address organizer; //address of the createor of the process
        string name; //name of the process.
        uint256 startBlock; //Only after this block, votesBatches will be accepted
        uint256 endBlock; // After this block no more votesBatches will be accepted
        string voteEncryptionPublicKey; //Key used by the voter to encrypt her vote
        string voteEncryptionPrivateKey; //Key used by the verifier to decrypt voters votes. Only public at the end of the process
        bytes32 censusMerkleRoot; //Hash of the MerkleTree of census. Used by the voter and the verifiers to shee if a voter can vote
        address[] registeredRelays; //List of relays than can add votesBatches
        mapping(address => bytes32[]) votesBatches; //List of votesBatches hashes by organized by the relay that added them
    }

    mapping (bytes32 => Process) public processes;
    bytes32[] public processesIndex;

    constructor() public {
        
    }

    modifier onlyOrganizer (bytes32 processId) {
        require (msg.sender == processes[processId].organizer, "msg.sender is not organizer");
        _;
    }

    modifier onlyRunningProcess (bytes32 processId) {
        require (block.number > processes[processId].startBlock, "Process has not started yet");
        //Todo enable this:
        //require (block.number < processes[processId].endBlock, "Process has finished already");
        _;
    }

    modifier onlyFinishedProcess (bytes32 processId) {
        require (block.number > processes[processId].endBlock, "Process still running");
        _;
    }

    function createProcess(
        string memory name,
        uint256 startBlock,
        uint256 endBlock,
        bytes32 censusMerkleRoot,
        string memory voteEncryptionPublicKey)
        public
    {
        //Todo (not implemnting to faciltate testing)
        //prevent publishing if startBlock is due
        //prevent publishing if endBlock is smaller than startBlock

        bytes32 processId = getProcessId(msg.sender, name);
        processes[processId].name = name;
        processes[processId].organizer = msg.sender;
        processes[processId].startBlock = startBlock;
        processes[processId].endBlock = endBlock;
        processes[processId].censusMerkleRoot = censusMerkleRoot;
        processes[processId].voteEncryptionPublicKey = voteEncryptionPublicKey;

        processesIndex.push(processId);
    }

    function publishVoteEncryptionPrivateKey(bytes32 processId, string memory voteEncryptionPrivateKey)
        public onlyOrganizer (processId) onlyFinishedProcess(processId) 
    {
        //Todo
        //Verify voteEncryptionPrivateKey matches voteEncryptionPublicKey
        processes[processId].voteEncryptionPrivateKey = voteEncryptionPrivateKey;
    }

    function registerRelay(bytes32 processId, address relayAddress)
        public onlyOrganizer(processId)
    {
        processes[processId].registeredRelays.push(relayAddress);
        processes[processId].votesBatches[relayAddress].push(getNullVotesBatchValue()); //This is so we can check on chain ifa relay is registred
    }

    function getRelaysLength(bytes32 processId) public view
        returns (uint256)
    {
        return processes[processId].registeredRelays.length;
    }

    function getRelayByIndex(bytes32 processId, uint256 index) public view
        returns (address)
    {
        return processes[processId].registeredRelays[index];
    }

    function addVotesBatch(bytes32 processId, bytes32 votesBatch)
        public onlyRunningProcess(processId)
    {
        //Todo
        require(isRelayRegistered(processId, msg.sender) == true, "Relay is not registered");
        processes[processId].votesBatches[msg.sender].push(votesBatch);
    }

    function getRelayVotesBatchesLength(bytes32 processId, address relayAddress) public view
        returns (uint256)
    {
        return processes[processId].votesBatches[relayAddress].length;
    }

    function getVotesBatch(bytes32 processId, address relayAddress, uint256 index ) public view
        returns (bytes32)
    {
        return processes[processId].votesBatches[relayAddress][index];
    }

    function getProcessId(address organizer, string memory name) public pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(organizer, name));
    }

    function getProcessesLength() public view
        returns (uint256)
    {
        return processesIndex.length;
    }

    function getProcessIdByIndex(uint256 processIndex) public view
        returns (bytes32)
    {
        return processesIndex[processIndex];
    }

    function getProcessMetadata(bytes32 processId) public view
        returns (
        string memory name,
        uint256 startBlock,
        uint256 endBlock,
        bytes32 censusMerkleRoot,
        string memory voteEncryptionPublicKey,
        string memory voteEncryptionPrivateKey)
    {
        return(
            processes[processId].name,
            processes[processId].startBlock,
            processes[processId].endBlock,
            processes[processId].censusMerkleRoot,
            processes[processId].voteEncryptionPublicKey,
            processes[processId].voteEncryptionPrivateKey
        );
    }

    function getNullVotesBatchValue() public pure
        returns (bytes32)
    {
        return 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    }

    function isRelayRegistered(bytes32 processId, address relayAddress) public view
        returns (bool)
    {
        if(processes[processId].votesBatches[relayAddress].length == 0)
        {
            return false;
        }
        
        return true;
    }
}