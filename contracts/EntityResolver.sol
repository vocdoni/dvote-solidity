pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./profiles/AddrResolver.sol";
import "./profiles/TextResolver.sol";
import "./profiles/TextListResolver.sol";


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
