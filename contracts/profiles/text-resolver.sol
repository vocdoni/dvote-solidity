// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.0;

import "../entity-resolver-base.sol";


abstract contract TextResolver is ResolverBase {
    bytes4 private constant TEXT_INTERFACE_ID = 0x59d1d43c;

    event TextChanged(bytes32 indexed node, string key, string value);

    mapping(bytes32 => mapping(string => string)) texts;

    /**
     * Sets the text data associated with an ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param node The node to update.
     * @param key The key to set.
     * @param value The text data value to set.
     */
    function setText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external authorised(node) {
        texts[node][key] = value;
        emit TextChanged(node, key, value);
    }

    /**
     * Returns the text data associated with an ENS node and key.
     * @param node The ENS node to query.
     * @param key The text data key to query.
     * @return The associated text data.
     */
    function text(bytes32 node, string calldata key)
        external
        view
        returns (string memory)
    {
        return texts[node][key];
    }

    function supportsInterface(bytes4 interfaceID)
        public
        virtual
        override
        pure
        returns (bool)
    {
        return
            interfaceID == TEXT_INTERFACE_ID ||
            super.supportsInterface(interfaceID);
    }
}
