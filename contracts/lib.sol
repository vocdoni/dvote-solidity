// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.0 <0.7.0;

library SafeUint8 {
    /// @notice Adds two uint8 integers and fails if an overflow occurs
    function add8(uint8 a, uint8 b) internal pure returns (uint8) {
        uint8 c = a + b;
        require(c >= a, "overflow");

        return c;
    }
}

library ContractSupport {
    // Compatible contract functions signatures
    bytes4 private constant BALANCE_OF_ADDR = bytes4(
        keccak256("balanceOf(address)")
    );

    function isContract(address targetAddress) internal view returns (bool) {
        uint256 size;
        if (targetAddress == address(0)) return false;
        assembly {
            size := extcodesize(targetAddress)
        }
        return size > 0;
    }

    function isSupporting(address targetAddress, bytes memory data)
        private
        returns (bool)
    {
        bool success;
        assembly {
            success := call(
                gas(), // gas remaining
                targetAddress, // destination address
                0, // no ether
                add(data, 32), // input buffer (starts after the first 32 bytes in the `data` array)
                mload(data), // input length (loaded from the first 32 bytes in the `data` array)
                0, // output buffer
                0 // output length
            )
        }
        return success;
    }

    function supportsBalanceOf(address targetAddress) internal returns (bool) {
        bytes memory data = abi.encodeWithSelector(
            BALANCE_OF_ADDR,
            address(0x0)
        );
        return isSupporting(targetAddress, data);
    }
}
