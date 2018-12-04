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
    bytes32[] public index;

    constructor() public {
        
    }

    modifier onlyOrganizer (bytes32 processId) {
        require (msg.sender == processes[processId].organizer, "msg.sender is not organizer");
        _;
    }

    modifier onlyRunningProcess (bytes32 processId) {
        require (block.number > processes[processId].startBlock, "Process has not started yet");
        require (block.number < processes[processId].endBlock, "Process has finished already");
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

        index.push(processId);
    }

    function publishVoteEncryptionPrivateKey(bytes32 processId, string memory voteEncryptionPrivateKey)
        public onlyOrganizer (processId) onlyFinishedProcess(processId) 
    {
        //Todo
        //Verify voteEncryptionPrivateKey matches voteEncryptionPublicKey
        processes[processId].voteEncryptionPrivateKey = voteEncryptionPrivateKey;
    }

    function addVotesBatchHash(bytes32 processId, bytes32 batchHash)
        public onlyRunningProcess(processId)
    {
        //Todo
        //Verify sender is a registered relay
        processes[processId].votesBatches[msg.sender].push(batchHash);
    }

    function getRelayVotesBatchesLength(bytes32 processId, address relayAddress) public view
        returns (uint256)
    {
        return processes[processId].votesBatches[relayAddress].length;
    }

    function getVotesBatchHash(bytes32 processId, address relayAddress, uint256 index ) public view
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
        return index.length;
    }

    function getProcessIdByIndex(uint256 processIndex) public view
        returns (bytes32)
    {
        return index[processIndex];
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
}