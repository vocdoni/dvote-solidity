// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.9;
pragma experimental ABIEncoderV2;

import "./vendor/openzeppelin/token/ERC20/ERC20.sol";

contract ERC20Info {
    function decimals(address tokenAddress) external view returns(uint8) {
        return ERC20(tokenAddress).decimals();
    }
    
    function name(address tokenAddress) external view returns(string memory) {
        return ERC20(tokenAddress).name();
    }
    
    function totalSupply(address tokenAddress) external view returns(uint256) {
        return ERC20(tokenAddress).totalSupply();
    }
    
    function symbol(address tokenAddress) external view returns(string memory) {
        return ERC20(tokenAddress).symbol();
    }
}