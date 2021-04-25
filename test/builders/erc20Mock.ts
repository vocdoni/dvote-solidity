import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

export const ERC20MOCK_CONTRACT_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
contract ERC20 {
    mapping (address => uint256) private _balances;
    mapping (address => mapping (address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    constructor (string memory name, string memory symbol) public {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
        _balances[msg.sender] = 1000000000000000000;
        _totalSupply = 1000000000000000000;
    }
    function name() public view returns (string memory) {
        return _name;
    }
    function symbol() public view returns (string memory) {
        return _symbol;
    }
    function decimals() public view returns (uint8) {
        return _decimals;
    }
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    function transfer(address recipient, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function allowance(address owner, address spender) public view virtual returns (uint256) {
        return _allowances[owner][spender];
    }
    function approve(address spender, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool) {
        return true;
    }
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        return true;
    }
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        return true;
    }
}`

// BUILDER
export default class ERC20MockBuilder {
    accounts: TestAccount[]

    constructor() {
        this.accounts = getAccounts()
    }

    async build(): Promise<Contract> {
        const solc = require("solc")
        const output = solc.compile(JSON.stringify({
            language: "Solidity",
            sources: { "dummy.sol": { content: ERC20MOCK_CONTRACT_CODE } },
            settings: { outputSelection: { "*": { "*": ["*"] } } }
        }))

        const { contracts } = JSON.parse(output)
        const erc20Abi = contracts["dummy.sol"].ERC20.abi
        const erc20Bytecode = contracts["dummy.sol"].ERC20.evm.bytecode.object


        const deployAccount = this.accounts[0]
        const dummyTokenFactory = new ContractFactory(erc20Abi, erc20Bytecode, deployAccount.wallet)
        const dummyTokenInstance = await dummyTokenFactory.deploy("Dummy Token", "DUM") as Contract

        return dummyTokenInstance
    }
}
