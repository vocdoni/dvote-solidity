pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "../ResolverBase.sol";

contract TextListResolver is ResolverBase {
    bytes4 constant private TEXT_LIST_INTERFACE_ID = 0x00000000;

    event ListChanged(bytes32 indexed node, string key, uint256 index);

    mapping(bytes32=>mapping(string=>string[])) lists;

    /**
     * Sets the text data associated with an ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param node The node to update.
     * @param key The key of the list to set.
     * @param index The index of the list to set.
     * @param value The text data value to set.
     */
    function setText(bytes32 node, string calldata key, uint256  index, string calldata value) external authorised(node) {
        lists[node][key][index] = value;
        emit ListChanged(node, key, index);
    }

    /**
     * Returns the list data associated with a node and key.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @return The associated text data.
     */
    function list(bytes32 node, string calldata key) external view returns (string[] memory) {
        return lists[node][key];
    }

    function listText(bytes32 node, string calldata key, uint256 index) external view returns (string memory) {
        return lists[node][key][index];
    }

    function supportsInterface(bytes4 interfaceID) public pure returns(bool) {
        return interfaceID == TEXT_LIST_INTERFACE_ID || super.supportsInterface(interfaceID);
    }
}