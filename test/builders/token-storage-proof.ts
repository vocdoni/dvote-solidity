import { Contract, ContractFactory } from "ethers"
import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"
import { abi as trieProofTestAbi, bytecode as trieProofTestByteCode } from "../../build/test/trie-proof.json"
import { Erc20StorageProofContractMethods, TrieProofTestContractMethods } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"


// BUILDER
export default class TokenStorageProofBuilder {
    deployAccount: TestAccount

    constructor() {
        this.deployAccount = getAccounts()[0]
    }

    async build(): Promise<Contract & Erc20StorageProofContractMethods> {
        const contractFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofByteCode, this.deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & Erc20StorageProofContractMethods
        return contractInstance.connect(this.deployAccount.wallet) as Contract & Erc20StorageProofContractMethods
    }
}

// BUILDER
export class TrieProofTestBuilder {
    deployAccount: TestAccount

    constructor() {
        this.deployAccount = getAccounts()[0]
    }

    async build(): Promise<Contract & TrieProofTestContractMethods> {
        const contractFactory = new ContractFactory(trieProofTestAbi, trieProofTestByteCode, this.deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & TrieProofTestContractMethods
        return contractInstance.connect(this.deployAccount.wallet) as Contract & TrieProofTestContractMethods
    }
}
