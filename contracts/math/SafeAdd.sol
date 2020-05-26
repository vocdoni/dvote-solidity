pragma solidity ^0.6.0;

library SafeAdd {
    // Inspired by Openzeppelin SafeMath.sol

    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - uint8
     * - Addition cannot overflow.
     */
    function add8(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 c = a + b;
        require(c >= a, "uint8 addition overflow");

        return c;
    }
}
