import { Contract, ContractFactory } from "ethers"
import { abi as tokenStorageProofAbi, bytecode as tokenStorageProofByteCode } from "../../build/token-storage-proof.json"
import { Erc20StorageProofContractMethods } from "../../lib/index"
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
