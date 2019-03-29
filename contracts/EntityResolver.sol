pragma solidity ^0.5.0;

import "./profiles/AddrResolver.sol";
import "./profiles/TextResolver.sol";

contract EntityResolver is  AddrResolver, TextResolver {
    function isAuthorised(bytes32 node) internal view returns(bool) {
        return keccak256(abi.encodePacked(msg.sender)) == node;
    }
}