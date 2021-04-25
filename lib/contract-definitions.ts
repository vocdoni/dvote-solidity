import { BigNumber, ContractTransaction } from "ethers"
import { IMethodOverrides } from "./contract-utils"
import { IProcessResults, IProcessStatus } from "./data-wrappers"

///////////////////////////////////////////////////////////////////////////////
// ENS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an ENS Registry contract */
export interface EnsRegistryContractMethods {
    setRecord(node: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeRecord(node: string, label: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setOwner(node: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeOwner(node: string, label: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setResolver(node: string, resolver: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setTTL(node: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setApprovalForAll(operator: string, approved: Boolean, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    owner(node: string): Promise<string>,
    resolver(node: string): Promise<string>,
    ttl(node: string): Promise<BigNumber>,
    recordExists(node: string): Promise<boolean>,
    isApprovedForAll(_owner: string, operator: string): Promise<boolean>,
}

/** Custom Smart Contract operations for a Public Resolver contract */
export interface EnsResolverContractMethods {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string, overrides?: IMethodOverrides): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param hashedEntityAddress The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(hashedEntityAddress: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param hashedEntityAddress The ENS node to modify. @see ensHashAddress()
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(hashedEntityAddress: string, key: string, value: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// PROCESS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Voting Process contract */
export type ProcessesContractMethods = ProcessMethods & Chained

interface ProcessMethods {
    // HELPERS

    /** Retrieves the amount of processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next process */
    getNextProcessId(entityAddress: string): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number, namespace: number, ethChainId: number | BigNumber): Promise<string>,

    // GLOBAL VARIABLES

    /** The chain ID of the Ethereum network where the contract lives */
    ethChainId(): Promise<number>
    /** The namespace ID to which the process contract is assigned */
    namespaceId(): Promise<number>
    /** The namespace contract to which the process contract is registered */
    namespaceAddress(): Promise<string>
    /** The address of the contract on which results shoud be published */
    resultsAddress(): Promise<string>
    /** The address of the token storage proofs contract used by EVM census processes */
    tokenStorageProofAddress(): Promise<string>
    /** The ProcessPrice is the amount to send to the contract for creating a process */
    processPrice(): Promise<BigNumber>

    // GETTERS

    /**
     * Retrieve the on-chain parameters for the given process:
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        entityAddress: string,  
        metadata_censusRoot_censusUri: string[],
        startBlock_blockCount: number[],
        status: IProcessStatus,
        questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent: number[]
     * ]```
     */
    get(processId: string): Promise<IProcessStateTuple>,
    /** Retrieve the parameters of the given process */
    getParamsSignature(processId: string): Promise<{ paramsSignature: string }>
    /** Gets the address of the process instance where the given processId was originally created. 
     * This allows to know where to send update transactions, after a fork has occurred. */
    getCreationInstance(processId): Promise<string>,

    // GLOBAL METHODS

    /** Updates the address of the contract holding the details of the active namespaces */
    setNamespaceAddress(namespaceAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the process creation price */
    setProcessPrice(processPrice: number | BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Withdraw the given amount to a given address */
    withdraw(to: string, amount: number | BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,

    // PER-PROCESS METHODS

    /**
     * Publish a new voting process using the given parameters
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        metadata_censusRoot_censusUri: string[],
        tokenContractAddress: string,  
        startBlock_blockCount: number[],
        questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent_namespace: number[],
        paramsSignature: string,
        overrides?: IMethodOverrides?
     * ]```
     * */
    newProcessStd(...args: IProcessCreateStdParamsTuple): Promise<ContractTransaction>,
    newProcessEvm(...args: IProcessCreateEvmParamsTuple): Promise<ContractTransaction>,
    /** Update the process status that corresponds to the given ID */
    setStatus(processId: string, status: IProcessStatus, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
    /** Updates the census of the given process (only if the mode allows dynamic census) */
    setCensus(processId: string, censusRoot: string, censusUri: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

export type IProcessCreateStdParamsTuple = [
    number[], // mode_envelopeType_censusOrigin
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    number[], // questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent
    string, // paramsSignature
    IMethodOverrides? // (Optional) Ethereum transaction overrides
]
export type IProcessCreateEvmParamsTuple = [
    number[], // mode_envelopeType_censusOrigin
    string[], // metadata_censusRoot
    number[], // startBlock_blockCount
    number[], // questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent
    string,   // tokenContractAddress
    number, // evmBlockHeight
    string, // paramsSignature
    IMethodOverrides? // (Optional) Ethereum transaction overrides
]
export type IProcessStateTuple = [
    number[], // mode_envelopeType_censusOrigin
    string,   // entityAddress
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    IProcessStatus, // status
    number[], // questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent
    BigNumber // evmBlockHeight
]

///////////////////////////////////////////////////////////////////////////////
// RESULTS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Processes instance */
export interface ResultsContractMethods {
    // GLOBAL VARIABLES
    genesisAddress(): Promise<string>,
    processesAddress(): Promise<string>,

    // GETTERS
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<IProcessResults>

    // SETTERS
    /** Defines the address of the processes contract where the `RESULTS` status will be set */
    setProcessesAddress(processesAddr: string): Promise<ContractTransaction>;
    setResults(processId: string, tally: number[][], height: number, vochainId: number, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// GENESIS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Genesis instance */
export interface GenesisContractMethods {
    // GETTERS

    /** Retrieves the given chain */
    get(chainId: number): Promise<{ genesis: string, validators: string[], oracles: string[] }>,
    /** Retrieves the amount of chains currently registered */
    getChainCount(): Promise<number>,
    /** Checks whether the given public key is registered as a validator in the given chain */
    isValidator(chainId: number, validatorPublicKey: string): Promise<boolean>,
    /** Checks whether the given address is registered as an oracle in the given chain */
    isOracle(chainId: number, oracleAddress: string): Promise<boolean>,

    // SETTERS
    /** Registers a new chain with the given parameters */
    newChain(genesis: string, validatorList: string[], oracleList: string[], overrides?: IMethodOverrides): Promise<ContractTransaction>
    /** Sets the given data as the new genesis for the chain */
    setGenesis(chainId: number, newGenesis: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
    /** Registers the public key of a new validator */
    addValidator(chainId: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(chainId: number, idx: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the address of a new oracle */
    addOracle(chainId: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(chainId: number, idx: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

///////////////////////////////////////////////////////////////////////////////
// NAMESPACE TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Namespace */
export interface NamespacesContractMethods {
    // GLOBAL VARIABLES

    /** How many namespaces are currently registered */
    namespaceCount(): Promise<number>

    // GETTERS

    /** Retrieves the process contract registered at the given namespace */
    processContractAt(namespaceId: number): Promise<string>,

    // SETTERS

    /** NOTE: This method should not be called from any JS client, only from a contract. Registers the (processes) contract calling the function into a new namespace, assigning it to the given chainId. */
    register(): Promise<ContractTransaction>,
}

///////////////////////////////////////////////////////////////////////////////
// STORAGE PROOF TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for Storage Proofs */
export interface Erc20StorageProofContractMethods {
    // GETTERS

    /** Determines whether the given address is registered as an ERC token contract */
    isRegistered(tokenAddress: string): Promise<boolean>

    /** Determines wheter the given address have a verified balance mapping position */
    isVerified(tokenAddress: string): Promise<boolean>

    /** Determines if the msg.sender of the tx is holder for the given token address */
    isHolder(tokenAddress: string, holder: string): Promise<boolean>

    /** Retrieves the token addresses registered at the given index. If it doesn't exist, the request throws an error. */
    tokenAddresses(idx: number): Promise<string>,

    /** Retrieves the amount of ERC20 tokens registered on the contract.  */
    tokenCount(): Promise<number>,

    /** Fetches the balance mapping position stored for a given token */
    getBalanceMappingPosition(tokenAddress: string): Promise<BigNumber>

    /** Fetches the holder storage slot given the holder address */
    getHolderBalanceSlot(holder: string, balanceMappingPosition: number | BigNumber)

    // SETTERS

    /** Checks that the given contract is an ERC token, validates that the balance of the sender matches the one obtained from the storage position and registers the token address */
    registerTokenWithProof(tokenAddress: string,  balanceMappingPosition: number | BigNumber, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, overrides?: IMethodOverrides): Promise<ContractTransaction>

    /** Checks that the given contract is an ERC token, validates that sender is holder of that token using the ERC20 method BalanceOf() and registers the token address */
    registerToken(tokenAddress: string,  balanceMappingPosition: number | BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>

    /** Sets the balanceMapping position of a token if the balance mapping position is not verified and the message sender is a token holder */
    setBalanceMappingPosition(tokenAddress: string, balanceMappingPosition: number | BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// BASE TYPES
///////////////////////////////////////////////////////////////////////////////

type Chained = {
    // GLOBAL VARIABLES

    /** The block at which the contract became active. If it is zero, then it still needs activation from its predecessor. */
    activationBlock(): Promise<BigNumber>
    /** The address of the contract in operation before us. It if is zero, it means that we are the first instance. */
    predecessorAddress(): Promise<string>
    /** The address of our successor. If zero, it means that we are the current active instance.
     * Otherwise, new processes need to be created on the last successor instance.
     */
    successorAddress(): Promise<string>

    // SETTERS

    /** Sets the current instance as active, if not already */
    activate(overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the target instance as the successor and deactivates the current one */
    activateSuccessor(successor: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

