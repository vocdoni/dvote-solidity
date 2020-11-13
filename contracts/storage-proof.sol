// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

import "./openzeppelin/IERC20.sol";
import "./lib.sol";

contract Erc20StorageProof {
    struct ErcToken {
        bool available;
        uint256 balanceMappingPosition;
        // bytes32 storageHash;
    }

    mapping(address => ErcToken) public tokens;

    function isRegistered(address ercTokenAddress) public view returns (bool) {
        return tokens[ercTokenAddress].available;
    }

    function getProof(address ercTokenAddress, uint256 blockNumber)
        public
        view
    {
        // TODO: Implement
    }

    function register(
        address tokenAddress,
        uint256 balanceMappingPosition,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory accountStateProof
    ) public {
        // Check that the address is a contract
        require(
            ContractSupport.isContract(tokenAddress),
            "The address must be a contract"
        );

        IERC20 tokenContract = IERC20(tokenAddress);
        uint256 officialBalance = tokenContract.balanceOf(msg.sender);
        require(officialBalance > 0, "Insufficient funds");

        /*
        const provenBalance = await tokenStorageProofs.getBalance(
            token.address,
            holder,
            blockNumber,
            storageProofsRLP[0],
            tokenType,
            BALANCE_MAPPING_SLOT
        )
        */

        uint256 balanceFromStorage = getBalance(tokenAddress, msg.sender, blockNumber, storageProof, balanceMappingPosition);
        require(balanceFromStorage == officialBalance, BALANCE_MISMATCH);

        // TODO: Register Token
    }

    // INTERNAL HELPERS

    function getBalance(
        address token,
        address holder,
        uint256 blockNumber,
        bytes memory storageProof,
        uint256 balanceMappingPosition
    ) public view returns (uint256) {
        uint256 holderBalanceSlot = uint256(
            getHolderBalanceSlot(holder, balanceMappingPosition)
        );

        return getStorage(token, blockNumber, holderBalanceSlot, storageProof);
    }

    function getHolderBalanceSlot(
        address holder,
        uint256 balanceMappingPosition
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(bytes32(holder), balanceMappingPosition)
            );
    }

    function getStorage(
        address token,
        uint256 blockNumber,
        uint256 holderBalanceSlot,
        bytes memory storageProof
    ) public view returns (uint256) {
        bytes32 root = getStorageRoot(token, blockNumber, blockHeaderRLP, tokenProofRLP); // storageRoot[token][blockNumber];
        require(root != bytes32(0), ERROR_UNPROCESSED_STORAGE_ROOT);

        // The path for a storage value is the hash of its slot
        bytes32 proofPath = keccak256(abi.encodePacked(holderBalanceSlot));
        return storageProof.verify(root, proofPath).toRLPItem().toUint();
    }

    function getStorageRoot(
        address token,
        uint256 blockNumber,
        bytes memory blockHeaderRLP,
        bytes memory tokenProofRLP
    ) public {
        bytes32 blockHash = blockhash(blockNumber);
        // Before Constantinople only the most recent 256 block hashes are available
        require(blockHash != bytes32(0), ERROR_BLOCKHASH_NOT_AVAILABLE);

        bytes32 stateRoot = getHeaderStateRoot(blockHeaderRLP, blockHash);
        // The path for an token in the state trie is the hash of its address
        bytes32 proofPath = keccak256(abi.encodePacked(token));

        // Get the token state from a merkle proof in the state trie. Returns an RLP encoded bytes array
        bytes memory tokenRLP = tokenProofRLP.verify(stateRoot, proofPath); // reverts if proof is invalid
        // Extract the storage root from the token node and convert to bytes32
        return bytes32(
            tokenRLP.toRLPItem().toList()[ACCOUNT_STORAGE_ROOT_INDEX].toUint()
        );
    }

    /**
     * @dev Extract state root from block header, verifying block hash
     */
    function getHeaderStateRoot(bytes memory blockHeaderRLP, bytes32 blockHash)
        public
        pure
        returns (bytes32 stateRoot)
    {
        require(blockHeaderRLP.length > 123, ERROR_INVALID_BLOCK_HEADER); // prevent from reading invalid memory
        require(
            keccak256(blockHeaderRLP) == blockHash,
            ERROR_INVALID_BLOCK_HEADER
        );
        // 0x7b = 0x20 (length) + 0x5b (position of state root in header, [91, 123])
        assembly {
            stateRoot := mload(add(blockHeaderRLP, 0x7b))
        }
    }
}
