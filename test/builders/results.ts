import { Contract, ContractFactory } from "ethers"
import { abi as resultsAbi, bytecode as resultsByteCode } from "../../build/results.json"
import { ResultsContractMethods } from "../../lib/index"
import { getAccounts, TestAccount } from "../utils"
import GenesisBuilder from "./genesis"


// BUILDER
export default class ResultsBuilder {
    accounts: TestAccount[]

    entityAccount: TestAccount
    genesisAddress: string | null | undefined

    constructor() {
        this.accounts = getAccounts()
        this.entityAccount = this.accounts[1]
        this.genesisAddress = null
    }

    async build(): Promise<Contract & ResultsContractMethods> {
        if (!this.genesisAddress) {
            // Deploy one
            const genesisInstance = await new GenesisBuilder().build()
            this.genesisAddress = genesisInstance.address
        }

        const deployAccount = this.accounts[0]
        const contractFactory = new ContractFactory(resultsAbi, resultsByteCode, deployAccount.wallet)
        let contractInstance = await contractFactory.deploy(this.genesisAddress) as Contract & ResultsContractMethods

        return contractInstance.connect(this.entityAccount.wallet) as Contract & ResultsContractMethods
    }

    withGenesisAddress(genesisAddr: string) {
        this.genesisAddress = genesisAddr

        return this
    }
}
