pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./profiles/AddrResolver.sol";
import "./profiles/TextResolver.sol";
import "./profiles/TextListResolver.sol";

contract EntityResolver is  AddrResolver, TextResolver, TextListResolver {
    function isAuthorised(bytes32 node) internal view returns(bool) {
        return getEntityId(msg.sender) == node;
    }

    function getEntityId(address entityAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(entityAddress));
    }
}
