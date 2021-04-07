// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;


library SafeUint8 {
    /// @notice Adds two uint8 integers and fails if an overflow occurs
    function add8(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 c = a + b;
        require(c >= a, "overflow");

        return c;
    }
}


library ContractSupport {
    // Compatible contract functions signatures
    bytes4 private constant BALANCE_OF_ADDR = bytes4(
        keccak256("balanceOf(address)")
    );

    function isContract(address targetAddress) internal view returns (bool) {
        uint256 size;
        if (targetAddress == address(0)) return false;
        assembly {
            size := extcodesize(targetAddress)
        }
        return size > 0;
    }

    function isSupporting(address targetAddress, bytes memory data)
        private
        returns (bool)
    {
        bool success;
        assembly {
            success := call(
                gas(), // gas remaining
                targetAddress, // destination address
                0, // no ether
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data), // input length (loaded from the first 32 bytes in the `data` array)
                0, // output buffer
                0 // output length
            )
        }
        return success;
    }

    function supportsBalanceOf(address targetAddress) internal returns (bool) {
        bytes memory data = abi.encodeWithSelector(
            BALANCE_OF_ADDR,
            address(0x0)
        );
        return isSupporting(targetAddress, data);
    }
}

/**
* @author Hamdi Allam hamdi.allam97@gmail.com
* Please reach out with any questions or concerns
*/
library RLP {
    uint8 constant STRING_SHORT_START = 0x80;
    uint8 constant STRING_LONG_START  = 0xb8;
    uint8 constant LIST_SHORT_START   = 0xc0;
    uint8 constant LIST_LONG_START    = 0xf8;

    uint8 constant WORD_SIZE = 32;

    struct RLPItem {
        uint256 len;
        uint256 memPtr;
    }

    function toBoolean(RLPItem memory item) internal pure returns (bool) {
        require(item.len == 1, "Invalid RLPItem. Booleans are encoded in 1 byte");
        uint256 result;
        uint256 memPtr = item.memPtr;
        assembly {
            result := byte(0, mload(memPtr))
        }

        return result == 0 ? false : true;
    }

    function toAddress(RLPItem memory item) internal pure returns (address) {
        // 1 byte for the length prefix according to RLP spec
        require(item.len <= 21, "Invalid RLPItem. Addresses are encoded in 20 bytes or less");

        return address(toUint(item));
    }

    function toUint(RLPItem memory item) internal pure returns (uint256) {
        uint256 offset = _payloadOffset(item.memPtr);
        uint256 len = item.len - offset;
        uint256 memPtr = item.memPtr + offset;

        uint256 result;
        assembly {
            result := div(mload(memPtr), exp(256, sub(32, len))) // shift to the correct location
        }

        return result;
    }

    function toRLPBytes(RLPItem memory item) internal pure returns (bytes memory) {
        bytes memory result = new bytes(item.len);

        uint256 ptr;
        assembly {
            ptr := add(0x20, result)
        }

        _copy(item.memPtr, ptr, item.len);
        return result;
    }

    function toBytes(RLPItem memory item) internal pure returns (bytes memory) {
        uint256 offset = _payloadOffset(item.memPtr);
        uint256 len = item.len - offset; // data length
        bytes memory result = new bytes(len);

        uint256 destPtr;
        assembly {
            destPtr := add(0x20, result)
        }

        _copy(item.memPtr + offset, destPtr, len);
        return result;
    }

    function toRLPItem(bytes memory item) internal pure returns (RLPItem memory) {
        if (item.length == 0)
            return RLPItem(0, 0);

        uint256 memPtr;
        assembly {
            memPtr := add(item, 0x20)
        }

        return RLPItem(item.length, memPtr);
    }

    function toList(RLPItem memory item) internal pure returns (RLPItem[] memory result) {
        require(isList(item), "Cannot convert to list a non-list RLPItem.");

        uint256 items = numItems(item);
        result = new RLPItem[](items);

        uint256 memPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 dataLen;
        for (uint256 i = 0; i < items; i++) {
            dataLen = _itemLength(memPtr);
            result[i] = RLPItem(dataLen, memPtr);
            memPtr = memPtr + dataLen;
        }
    }

    function isList(RLPItem memory item) internal pure returns (bool) {
        uint8 byte0;
        uint256 memPtr = item.memPtr;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < LIST_SHORT_START)
            return false;
        return true;
    }

    function numItems(RLPItem memory item) internal pure returns (uint256) {
        uint256 count = 0;
        uint256 currPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            currPtr = currPtr + _itemLength(currPtr); // skip over an item
            count++;
        }

        return count;
    }

    function _itemLength(uint256 memPtr) private pure returns (uint256 len) {
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            return 1;
        } else if (byte0 < STRING_LONG_START) {
            return byte0 - STRING_SHORT_START + 1;
        } else if (byte0 < LIST_SHORT_START) {
            assembly {
                let byteLen := sub(byte0, 0xb7) // # of bytes the actual length is
                memPtr := add(memPtr, 1) // skip over the first byte

            /* 32 byte word size */
                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to get the len
                len := add(dataLen, add(byteLen, 1))
            }
        } else if (byte0 < LIST_LONG_START) {
            return byte0 - LIST_SHORT_START + 1;
        } else {
            assembly {
                let byteLen := sub(byte0, 0xf7)
                memPtr := add(memPtr, 1)

                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to the correct length
                len := add(dataLen, add(byteLen, 1))
            }
        }
    }

    function _payloadOffset(uint256 memPtr) private pure returns (uint256) {
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            return 0;
        } else if (byte0 < STRING_LONG_START || (byte0 >= LIST_SHORT_START && byte0 < LIST_LONG_START)) {
            return 1;
        } else if (byte0 < LIST_SHORT_START) {  // being explicit
            return byte0 - (STRING_LONG_START - 1) + 1;
        } else {
            return byte0 - (LIST_LONG_START - 1) + 1;
        }
    }

    // solium-disable security/no-assign-params
    function _copy(uint256 src, uint256 dest, uint256 len) private pure {
        // copy as many word sizes as possible
        for (; len >= WORD_SIZE; len -= WORD_SIZE) {
            assembly {
                mstore(dest, mload(src))
            }

            src += WORD_SIZE;
            dest += WORD_SIZE;
        }

        // left over bytes. Mask is used to remove unwanted bytes from the word
        uint256 mask = 256 ** (WORD_SIZE - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask)) // zero out src
            let destpart := and(mload(dest), mask) // retrieve the bytes
            mstore(dest, or(destpart, srcpart))
        }
    }
}

library TrieProof {
    using RLP for RLP.RLPItem;
    using RLP for bytes;

    bytes32 internal constant EMPTY_TRIE_ROOT_HASH = 0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421;

    // decoding from compact encoding (hex prefix encoding on the yellow paper)
    function decodeNibbles(bytes memory compact, uint256 skipNibbles)
    internal
    pure
    returns (bytes memory nibbles)
    {
        require(compact.length > 0); // input > 0

        uint256 length = compact.length * 2; // need bytes, compact uses nibbles
        require(skipNibbles <= length);
        length -= skipNibbles;

        nibbles = new bytes(length);
        uint256 nibblesLength = 0;

        for (uint256 i = skipNibbles; i < skipNibbles + length; i += 1) {
            if (i % 2 == 0) {
                nibbles[nibblesLength] = bytes1(
                    (uint8(compact[i / 2]) >> 4) & 0xF
                );
            } else {
                nibbles[nibblesLength] = bytes1(
                    (uint8(compact[i / 2]) >> 0) & 0xF
                );
            }
            nibblesLength += 1;
        }

        assert(nibblesLength == nibbles.length);
    }

    function merklePatriciaCompactDecode(bytes memory compact)
    internal
    pure
    returns (bool isLeaf, bytes memory nibbles)
    {
        require(compact.length > 0, "Empty");

        uint256 first_nibble = (uint8(compact[0]) >> 4) & 0xF;
        uint256 skipNibbles;

        if (first_nibble == 0) {
            skipNibbles = 2;
            isLeaf = false;
        } else if (first_nibble == 1) {
            skipNibbles = 1;
            isLeaf = false;
        } else if (first_nibble == 2) {
            skipNibbles = 2;
            isLeaf = true;
        } else if (first_nibble == 3) {
            skipNibbles = 1;
            isLeaf = true;
        } else {
            // Not supposed to happen!
            revert("failed decoding Trie");
        }

        return (isLeaf, decodeNibbles(compact, skipNibbles));
    }

    function isEmptyByteSequence(RLP.RLPItem memory item)
    internal
    pure
    returns (bool)
    {
        if (item.len != 1) {
            return false;
        }
        uint8 b;
        uint256 memPtr = item.memPtr;
        assembly {
            b := byte(0, mload(memPtr))
        }
        return b == 0x80; /* empty byte string */
    }

    function sharedPrefixLength(
        uint256 xsOffset,
        bytes memory xs,
        bytes memory ys
    ) internal pure returns (uint256) {
        uint256 i;
        for (i = 0; i + xsOffset < xs.length && i < ys.length; i++) {
            if (xs[i + xsOffset] != ys[i]) {
                return i;
            }
        }
        return i;
    }

    /// @dev Computes the hash of the Merkle-Patricia-Trie hash of the input.
    ///      Merkle-Patricia-Tries use a hash function that outputs
    ///      *variable-length* hashes: If the input is shorter than 32 bytes,
    ///      the MPT hash is the input. Otherwise, the MPT hash is the
    ///      Keccak-256 hash of the input.
    ///      The easiest way to compare variable-length byte sequences is
    ///      to compare their Keccak-256 hashes.
    /// @param input The byte sequence to be hashed.
    /// @return Keccak-256(MPT-hash(input))
    function mptHashHash(bytes memory input) internal pure returns (bytes32) {
        if (input.length < 32) {
            return keccak256(input);
        } else {
            return
            keccak256(abi.encodePacked(keccak256(abi.encodePacked(input))));
        }
    }

    /// @dev Validates a Merkle-Patricia-Trie proof.
    ///      If the proof proves the inclusion of some key-value pair in the
    ///      trie, the value is returned. Otherwise, i.e. if the proof proves
    ///      the exclusion of a key from the trie, an empty byte array is
    ///      returned.
    /// @param siblings is the stack of MPT nodes (starting with the root) that need to be traversed during verification.
    /// @param rootHash is the Keccak-256 hash of the root node of the MPT
    /// @param key is the key of the node whose inclusion/exclusion we are proving.
    /// @return value whose inclusion is proved or an empty byte array for a proof of exclusion
    function verify(
        bytes memory siblings, // proofs
        bytes32 rootHash,
        bytes32 key
    ) internal pure returns (bytes memory value) {
        // copy key for convenience
        bytes memory decoded_key = new bytes(32);
        assembly {
            mstore(add(decoded_key, 0x20), key)
        }
        // key consisting on nibbles
        decoded_key = decodeNibbles(decoded_key, 0);

        // siblings to RLP encoding list
        RLP.RLPItem[] memory rlpSiblings = siblings.toRLPItem().toList();
        bytes memory rlpNode;
        bytes32 nodeHashHash;
        RLP.RLPItem[] memory node;
        RLP.RLPItem memory rlpValue;

        uint256 keyOffset = 0; // Offset of the proof

        // if not siblings the root hash is the hash of an empty trie
        if (rlpSiblings.length == 0) {
            // Root hash of empty tx trie
            require(rootHash == EMPTY_TRIE_ROOT_HASH, "Bad empty proof");
            return new bytes(0);
        }

        // Traverse stack of nodes starting at root.
        for (uint256 i = 0; i < rlpSiblings.length; i++) {
            // We use the fact that an rlp encoded list consists of some
            // encoding of its length plus the concatenation of its
            // *rlp-encoded* items.
            rlpNode = rlpSiblings[i].toRLPBytes();

            // The root node is hashed with Keccak-256
            if (i == 0 && rootHash != keccak256(rlpNode)) {
                revert("bad first proof part");
            }
            // All other nodes are hashed with the MPT hash function.
            if (i != 0 && nodeHashHash != mptHashHash(rlpNode)) {
                revert("bad hash");
            }

            node = rlpSiblings[i].toList();

            // Extension or Leaf node
            if (node.length == 2) {
                bool isLeaf;
                bytes memory nodeKey;
                (isLeaf, nodeKey) = merklePatriciaCompactDecode(
                    node[0].toBytes()
                );

                uint256 prefixLength = sharedPrefixLength(
                    keyOffset,
                    decoded_key,
                    nodeKey
                );
                keyOffset += prefixLength;

                if (prefixLength < nodeKey.length) {
                    // Proof claims divergent extension or leaf. (Only
                    // relevant for proofs of exclusion.)
                    // An Extension/Leaf node is divergent if it "skips" over
                    // the point at which a Branch node should have been had the
                    // excluded key been included in the trie.
                    // Example: Imagine a proof of exclusion for path [1, 4],
                    // where the current node is a Leaf node with
                    // path [1, 3, 3, 7]. For [1, 4] to be included, there
                    // should have been a Branch node at [1] with a child
                    // at 3 and a child at 4.

                    // Sanity check
                    if (i < rlpSiblings.length - 1) {
                        // divergent node must come last in proof
                        revert("divergent node must come last in proof");
                    }
                    return new bytes(0);
                }

                if (isLeaf) {
                    // Sanity check
                    if (i < rlpSiblings.length - 1) {
                        // leaf node must come last in proof
                        revert("leaf must come last in proof");
                    }

                    if (keyOffset < decoded_key.length) {
                        return new bytes(0);
                    }

                    rlpValue = node[1];
                    return rlpValue.toBytes();
                } else {
                    // extension node
                    // Sanity check
                    if (i == rlpSiblings.length - 1) {
                        // should not be at last level
                        revert("extension node cannot be at last level");
                    }

                    if (!node[1].isList()) {
                        // rlp(child) was at least 32 bytes. node[1] contains
                        // Keccak256(rlp(child)).
                        nodeHashHash = keccak256(node[1].toBytes());
                    } else {
                        // rlp(child) was at less than 32 bytes. node[1] contains
                        // rlp(child).
                        nodeHashHash = keccak256(node[1].toRLPBytes());
                    }
                }
            } else if (node.length == 17) {
                // Branch node
                if (keyOffset != decoded_key.length) {
                    // we haven't consumed the entire path, so we need to look at a child
                    uint8 nibble = uint8(decoded_key[keyOffset]);
                    keyOffset += 1;
                    if (nibble >= 16) {
                        // each element of the path has to be a nibble
                        revert("if branch node each element has to be a nibble");
                    }

                    if (isEmptyByteSequence(node[nibble])) {
                        // Sanity
                        if (i != rlpSiblings.length - 1) {
                            // leaf node should be at last level
                            revert("leaf nodes only at last level");
                        }
                        return new bytes(0);
                    } else if (!node[nibble].isList()) {
                        nodeHashHash = keccak256(node[nibble].toBytes());
                    } else {
                        nodeHashHash = keccak256(node[nibble].toRLPBytes());
                    }
                } else {
                    // we have consumed the entire mptKey, so we need to look at what's contained in this node.
                    // Sanity

                    if (i != rlpSiblings.length - 1) {
                        // should be at last level
                        revert("should be at last level");
                    }
                    return node[16].toBytes();
                }
            }
        }
    }
}
