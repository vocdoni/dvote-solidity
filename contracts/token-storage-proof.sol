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
    string private constant ERROR_TOKEN_NOT_SUPPORTED = "TOKEN_NOT_SUPPORTED";
    string private constant ERROR_NOT_ENOUGH_FUNDS = "NOT_ENOUGH_FUNDS";
    string private constant ERROR_ALREADY_REGISTERED = "ALREADY_REGISTERED";
    string private constant ERROR_NOT_REGISTERED = "NOT_REGISTERED";
    string private constant ERROR_ALREADY_VERIFIED = "ALREADY_VERIFIED";
    string private constant ERROR_INVALID_ADDRESS = "INVALID_ADDRESS";
    string private constant ERROR_SAME_VALUE = "SAME_VALUE";

    modifier onlyHolder(address tokenAddress) {
        _isHolder(tokenAddress, msg.sender);
        _;
    }

    struct ERC20Token {
        bool registered;
        bool verified;
        uint256 balanceMappingPosition;
    }

    mapping(address => ERC20Token) public tokens;
    address[] public tokenAddresses;
    uint32 public tokenCount = 0;

    function registerToken(address tokenAddress, uint256 balanceMappingPosition) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);

        // Check contract supports balanceOf()
        require(ContractSupport.supportsBalanceOf(tokenAddress), ERROR_TOKEN_NOT_SUPPORTED);
        
        // Check token not already registered
        require(!tokens[tokenAddress].registered, ERROR_ALREADY_REGISTERED);
        
        // Register token
        ERC20Token memory newToken;
        newToken.registered = true;
        newToken.balanceMappingPosition = balanceMappingPosition;
        tokenAddresses.push(tokenAddress);
        tokens[tokenAddress] = newToken;
        tokenCount = tokenCount + 1;
        
        // Event
        emit TokenRegistered(tokenAddress);
    }

    function setVerifiedBalanceMappingPosition(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof,
        bytes memory storageProof
    ) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token is registered
        require(tokens[tokenAddress].registered, ERROR_NOT_REGISTERED);

        // Check token is not verified
        require(!tokens[tokenAddress].verified, ERROR_ALREADY_VERIFIED);
        
        // Get storage root
        bytes32 root = _processStorageRoot(tokenAddress, blockNumber, blockHeaderRLP, accountStateProof);
        
        // Check balance using the computed storage root and the provided proofs
        uint256 balanceFromTrie = _getBalance(
            msg.sender,
            storageProof,
            root,
            balanceMappingPosition
        );

        // Check balance obtained > 0 
        require(balanceFromTrie > 0, ERROR_NOT_ENOUGH_FUNDS);
        
        // Modify storage
        tokens[tokenAddress].verified = true;
        tokens[tokenAddress].balanceMappingPosition = balanceMappingPosition;
        
        // Emit event
        emit BalanceMappingPositionUpdated(tokenAddress, balanceMappingPosition);
    }

    function setBalanceMappingPosition(address tokenAddress, uint256 balanceMappingPosition) public override onlyHolder(tokenAddress) {
        // Check that the address is a contract
        require(ContractSupport.isContract(tokenAddress), ERROR_NOT_A_CONTRACT);
        
        // Check token registered
        require(tokens[tokenAddress].registered, ERROR_NOT_REGISTERED);
        
        // Check token not already verified
        require(!tokens[tokenAddress].verified, ERROR_ALREADY_VERIFIED);
        
        // Check not same balance mapping position
        require(tokens[tokenAddress].balanceMappingPosition != balanceMappingPosition, ERROR_SAME_VALUE);
        
        // Modify storage
        tokens[tokenAddress].balanceMappingPosition = balanceMappingPosition;
        
        // Emit event
        emit BalanceMappingPositionUpdated(tokenAddress, balanceMappingPosition);
    }


    function isRegistered(address tokenAddress) external view override returns (bool) {
        return tokens[tokenAddress].registered;
    }
    
    function _isHolder(address tokenAddress, address holder) internal view {
        // check msg.sender balance calling 'balanceOf' function on the ERC20 contract
       require (IERC20(tokenAddress).balanceOf(holder) > 0, ERROR_NOT_ENOUGH_FUNDS);
    }

    function _processStorageRoot(
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

    function _getBalance(
        address holder,
        bytes memory storageProof,
        bytes32 root,
        uint256 balanceMappingPosition
    )
        internal pure returns (uint256)
    {
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);
        // The path for a storage value is the hash of its slot
        bytes32 slot = _getHolderBalanceSlot(holder, balanceMappingPosition);
        bytes32 storageProofPath = keccak256(abi.encodePacked(slot));

        bytes memory value;
        value = TrieProof.verify(storageProof, root, storageProofPath);

        return value.toRLPItem().toUint();
    }

    function _getHolderBalanceSlot(address holder, uint256 balanceMappingPosition) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bytes32(uint256(holder)), balanceMappingPosition));
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
