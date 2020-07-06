// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./profiles/addr-resolver.sol";
import "./profiles/text-resolver.sol";
import "./profiles/text-list-resolver.sol";


contract EntityResolver is AddrResolver, TextResolver, TextListResolver {
    function isAuthorised(bytes32 node) internal override view returns (bool) {
        return getEntityId(msg.sender) == node;
    }

    function getEntityId(address entityAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(entityAddress));
    }

    function supportsInterface(bytes4 interfaceID)
        public
        override(AddrResolver, TextResolver, TextListResolver)
        pure
        returns (bool)
    {
        return super.supportsInterface(interfaceID);
    }
}
