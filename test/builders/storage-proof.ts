import { StorageProofContractMethods } from "../../lib/index"
import { Contract, ContractFactory } from "ethers"
import { getAccounts, TestAccount } from "../utils"

import { abi as namespaceAbi, bytecode as namespaceByteCode } from "../../build/storage-proof.json"

// BUILDER
export default class StorageProofBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
    }

    async build(): Promise<Contract & StorageProofContractMethods> {
        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(namespaceAbi, namespaceByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy() as Contract & StorageProofContractMethods

        // TODO: Register a token

        return contractInstance.connect(this.entityAccount.wallet) as Contract & StorageProofContractMethods
    }
}
