// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

import "./vendor/openzeppelin/token/ERC20/IERC20.sol";
import "./common.sol";
import "./lib.sol";

contract TokenStorageProof is ITokenStorageProof {
    using RLP for bytes;
    using RLP for RLP.RLPItem;
    using TrieProof for bytes;

    uint8 private constant ACCOUNT_STORAGE_ROOT_INDEX = 2;

    string private constant ERROR_BLOCKHASH_NOT_AVAILABLE = "BLOCKHASH_NOT_AVAILABLE";
    string private constant ERROR_INVALID_BLOCK_HEADER = "INVALID_BLOCK_HEADER";
    string private constant ERROR_UNPROCESSED_STORAGE_ROOT = "UNPROCESSED_STORAGE_ROOT";
    string private constant ERROR_NOT_A_CONTRACT = "NOT_A_CONTRACT";
    string private constant ERROR_NOT_ENOUGH_FUNDS = "NOT_ENOUGH_FUNDS";
    string private constant ERROR_ALREADY_REGISTERED = "ALREADY_REGISTERED";
    string private constant ERROR_NOT_REGISTERED = "NOT_REGISTERED";
    string private constant ERROR_ALREADY_VERIFIED = "ALREADY_VERIFIED";
    string private constant ERROR_INVALID_ADDRESS = "INVALID_ADDRESS";

    struct ERC20Token {
        uint256 balanceMappingPosition;
        bool registered;
        bool verified;
    }

    mapping(address => ERC20Token) public tokens;
    address[] public tokenAddresses;
    uint32 public tokenCount = 0;

    function isRegistered(address tokenAddress) public view override returns (bool) {
        require(tokenAddress != address(0x0), ERROR_INVALID_ADDRESS);
        return tokens[tokenAddress].registered;
    }

    function isVerified(address tokenAddress) public view override returns (bool) {
        require(tokenAddress != address(0x0), ERROR_INVALID_ADDRESS);
        return tokens[tokenAddress].verified;
    }

    function isHolder(address tokenAddress) internal view returns(bool) {
        // check msg.sender balance calling 'balanceOf' function on the ERC20 contract
        IERC20 tokenContract = IERC20(tokenAddress);
        uint256 balance = tokenContract.balanceOf(msg.sender);
        return balance > 0;
    }

    function setBalanceMappingPosition(address tokenAddress, uint256 balanceMappingPosition) public override {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token registered
        require(isRegistered(tokenAddress), ERROR_NOT_REGISTERED);
        
        // Check token not already verified
        require(!isVerified(tokenAddress), ERROR_ALREADY_VERIFIED);
        
        // Check sender is holder 
        require(isHolder(msg.sender), ERROR_NOT_ENOUGH_FUNDS);
        
        // Set balanceMappingPosition
        ERC20Token storage token = tokens[tokenAddress];
        token.balanceMappingPosition = balanceMappingPosition;
        
        // Event
        emit BalanceMappingPositionUpdated(tokenAddress, msg.sender, balanceMappingPosition);
    }

    function registerToken(address tokenAddress, uint256 balanceMappingPosition) public override {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token not already registered
        require(!isRegistered(tokenAddress), ERROR_ALREADY_REGISTERED);
        
        // Check token not already verified
        require(!isVerified(tokenAddress), ERROR_ALREADY_VERIFIED);
        
        // Check sender is holder 
        require(isHolder(tokenAddress), ERROR_NOT_ENOUGH_FUNDS);
        
        // Register token
        ERC20Token storage newToken = tokens[tokenAddress];
        newToken.registered = true;
        newToken.balanceMappingPosition = balanceMappingPosition;
        tokenAddresses.push(tokenAddress);
        tokenCount = tokenCount + 1;
        
        // Event
        emit TokenRegistered(tokenAddress, msg.sender);
    }

    function registerTokenWithProof(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof
    ) public override {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token is not verified
        require(!isVerified(tokenAddress), ERROR_ALREADY_VERIFIED);
        
        // Check sender is holder 
        require(isHolder(msg.sender), ERROR_NOT_ENOUGH_FUNDS);
        
        // Get storage root
        bytes32 root = processStorageRoot(tokenAddress, blockNumber, blockHeaderRLP, accountStateProof);
        
        // Check balance using the computed storage root and the provided proofs
        uint256 balanceFromTrie = getBalance(
            msg.sender,
            storageProof,
            root,
            balanceMappingPosition
        );
        require(balanceFromTrie > 0, ERROR_NOT_ENOUGH_FUNDS);
        
        // Register token
        ERC20Token storage token = tokens[tokenAddress];
        token.verified = true;
        if (token.registered && (token.balanceMappingPosition != balanceMappingPosition)) {
            token.balanceMappingPosition = balanceMappingPosition;
        } else {
            token.registered = true;
            token.balanceMappingPosition = balanceMappingPosition;
            tokenAddresses.push(tokenAddress);
            tokenCount = tokenCount + 1;
        }
        
        // Event
        emit TokenRegistered(tokenAddress, msg.sender);
    }

    function processStorageRoot(
        address tokenAddress,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof
    )
        internal view returns (bytes32 accountStorageRoot)
    {
        bytes32 blockHash = blockhash(blockNumber);
        // Before Constantinople only the most recent 256 block hashes are available
        require(blockHash != bytes32(0), ERROR_BLOCKHASH_NOT_AVAILABLE);

        // The path for an account in the state trie is the hash of its address
        bytes32 accountProofPath = keccak256(abi.encodePacked(tokenAddress));

        // Get the account state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes32 stateRoot = _getStateRoot(blockHeaderRLP, blockHash);
        bytes memory accountRLP = accountStateProof.verify(stateRoot, accountProofPath);

        // Extract the storage root from the account node and convert to bytes32
        accountStorageRoot = bytes32(accountRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint());
    }

    function getBalance(
        address holder,
        bytes memory storageProof,
        bytes32 root,
        uint256 balanceMappingPosition
    )
        internal pure returns (uint256)
    {
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);
        // The path for a storage value is the hash of its slot
        bytes32 slot = getHolderBalanceSlot(holder, balanceMappingPosition);
        bytes32 storageProofPath = keccak256(abi.encodePacked(slot));

        bytes memory value;
        value = TrieProof.verify(storageProof, root, storageProofPath);

        return value.toRLPItem().toUint();
    }

    function getHolderBalanceSlot(address holder, uint256 balanceMappingPosition) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(uint256(holder)), balanceMappingPosition));
    }


    function getBalanceMappingPosition(address tokenAddress) public view override returns (uint256) {
        require(tokenAddress != address(0x0), ERROR_INVALID_ADDRESS);
        return tokens[tokenAddress].balanceMappingPosition;
    }

    /**
    * @dev Extract state root from block header, verifying block hash
    */
    function _getStateRoot(bytes memory blockHeaderRLP, bytes32 blockHash) internal pure returns (bytes32 stateRoot) {
        require(blockHeaderRLP.length > 123, ERROR_INVALID_BLOCK_HEADER); // prevent from reading invalid memory
        require(keccak256(blockHeaderRLP) == blockHash, ERROR_INVALID_BLOCK_HEADER);
        // 0x7b = 0x20 (length) + 0x5b (position of state root in header, [91, 123])
        assembly { stateRoot := mload(add(blockHeaderRLP, 0x7b)) }
    }
}
