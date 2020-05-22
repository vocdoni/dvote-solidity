pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../EntityResolverBase.sol";


abstract contract TextListResolver is ResolverBase {
    bytes4 private constant TEXT_LIST_INTERFACE_ID = 0x00000000;

    event ListItemChanged(bytes32 indexed node, string key, uint256 index);
    event ListItemRemoved(bytes32 indexed node, string key, uint256 index);

    mapping(bytes32 => mapping(bytes32 => string[])) lists;

    /**
     * Sets the text data associated with an ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param node The node to update.
     * @param key The key of the list to set.
     * @param index The index of the list to set.
     * @param value The text data value to set.
     */
    function setListText(
        bytes32 node,
        string calldata key,
        uint256 index,
        string calldata value
    ) external authorised(node) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        require(lists[node][keyHash].length > index, "Invalid index");

        lists[node][keyHash][index] = value;
        emit ListItemChanged(node, key, index);
    }

    /**
     * Adds a new value on the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @param value The text data value to set.
     */
    function pushListText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external authorised(node) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        lists[node][keyHash].push(value);
        emit ListItemChanged(node, key, lists[node][keyHash].length - 1);
    }

    /**
     * Removes the value on the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @param index The index to remove.
     */
    function removeListIndex(
        bytes32 node,
        string calldata key,
        uint256 index
    ) external authorised(node) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        require(lists[node][keyHash].length > index, "Invalid index");

        uint256 length = lists[node][keyHash].length;
        lists[node][keyHash][index] = lists[node][keyHash][length - 1];
        lists[node][keyHash].pop();
        emit ListItemRemoved(node, key, index);
    }

    /**
     * Returns the list associated with a node and key.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @return The associated text data.
     */
    function list(bytes32 node, string calldata key)
        external
        view
        returns (string[] memory)
    {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        return lists[node][keyHash];
    }

    /**
     * Returns the value associated with a node, key and index.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @param index The index of the list to retrieve.
     * @return The associated text data.
     */
    function listText(
        bytes32 node,
        string calldata key,
        uint256 index
    ) external view returns (string memory) {
        bytes32 keyHash = keccak256(abi.encodePacked(key));
        return lists[node][keyHash][index];
    }

    function supportsInterface(bytes4 interfaceID)
        public
        virtual
        override
        pure
        returns (bool)
    {
        return
            interfaceID == TEXT_LIST_INTERFACE_ID ||
            super.supportsInterface(interfaceID);
    }
}
