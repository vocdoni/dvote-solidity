import { Contract, ContractFactory } from "ethers"
import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"
import { Erc20StorageProofContractMethods } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"


// BUILDER
export default class TokenStorageProofBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & Erc20StorageProofContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(tokenStorageProofAbi, tokenStorageProofByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & Erc20StorageProofContractMethods

        // TODO: Register a token

        return contractInstance.connect(this.entityAccount.wallet) as Contract & Erc20StorageProofContractMethods
    }
}
