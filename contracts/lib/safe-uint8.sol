// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.6.0;

library SafeUint8 {
    /// @notice Adds two uint8 integers and fails if an overflow occurs
    function add8(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 c = a + b;
        require(c >= a, "overflow");

        return c;
    }
}
