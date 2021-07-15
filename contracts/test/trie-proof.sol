// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

import "../lib.sol";

// This contract is for testing. It exposes internal methods of
// TrieProof lib so that we can test them.
//
// *************************************************************
// *** Never deploy this contract!                           ***
// *************************************************************

contract TrieProofTest {
    function verify(bytes memory siblings, bytes32 rootHash, bytes32 key) public pure returns (bytes memory value) {
        return TrieProof.verify(siblings, rootHash, key);
    }
}
