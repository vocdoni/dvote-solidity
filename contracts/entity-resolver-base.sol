// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.0;

abstract contract ResolverBase {
    bytes4 private constant INTERFACE_META_ID = 0x01ffc9a7;

    function supportsInterface(bytes4 interfaceID)
        public
        virtual
        pure
        returns (bool)
    {
        return interfaceID == INTERFACE_META_ID;
    }

    function isAuthorised(bytes32 node) internal virtual view returns (bool);

    modifier authorised(bytes32 node) {
        require(isAuthorised(node), "Unauthorized");
        _;
    }
}
