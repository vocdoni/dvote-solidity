pragma solidity ^0.5.0;

contract VotingProcess {

    struct Process {
        address organizer;
        string name;
        uint256 startBlock;
        uint256 endBlock;
        string voteEncryptionKey;
        bytes32 censusMerkleRoot;
    }

    mapping (bytes32 => Process) public processes;

    constructor() public {
       
    }

    function createProcess(
        string memory name,
        uint256 startBlock,
        uint256 endBlock,
        bytes32 censusMerkleRoot,
        string memory voteEncryptionKey)
        public
    {

        bytes32 processId = getProcessId(msg.sender, name);
        processes[processId].organizer = msg.sender;
        processes[processId].startBlock = startBlock;
        processes[processId].endBlock = endBlock;
        processes[processId].censusMerkleRoot = censusMerkleRoot;
        processes[processId].voteEncryptionKey = voteEncryptionKey;
    }

    function getProcessId(address organizer, string memory name) public pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(organizer, name));
    }
}
