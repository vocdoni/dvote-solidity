import * as EntityResolver from "./entity-resolver.json"
import * as VotingProcess from "./voting-process.json"

import { ContractTransaction } from "ethers"
import { BigNumber } from "ethers/utils"

///////////////////////////////////////////////////////////////////////////////
// SMART CONTRACTS ABI + BYTECODE
///////////////////////////////////////////////////////////////////////////////

export { EntityResolver }
export { VotingProcess }

///////////////////////////////////////////////////////////////////////////////
// ENTITY RESOLVER TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an Entity Resolver contract */
export type EntityResolverContractMethods = {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the entity ID for a given Ethereum address */
    getEntityId(entityAddress: string): Promise<string>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(entityId: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(entityId: string, key: string, value: string): Promise<ContractTransaction>

    /**
     * Returns the list associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @return The list array of values.
     */
    list(entityId: string, key: string): Promise<string[]>
    /**
     * Returns the text associated with an ENS node, key and index.
     * @param entityId The ENS node to query.
     * @param key The key of the list.
     * @param index The index within the list to retrieve.
     * @return The list entry's text value.
     */
    listText(entityId: string, key: string, index: number): Promise<string>
    /**
     * Sets the text of the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index of the list to set.
     * @param value The text to store.
     */
    setListText(entityId: string, key: string, index: number, value: string): Promise<ContractTransaction>
    /**
     * Appends a new value on the given ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param value The text to store.
     */
    pushListText(entityId: string, key: string, value: string): Promise<ContractTransaction>
    /**
     * Removes the value on the ENS node, key and index.
     * May only be called by the owner of that node in the ENS registry.
     * Note: This may cause items to be arranged in a different order.
     * @param entityId The ENS node to modify.
     * @param key The key of the list to modify.
     * @param index The index to remove.
     */
    removeListIndex(entityId: string, key: string, index: number): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// VOTING PROCESS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Voting Process contract */
export interface VotingProcessContractMethods {
    /** Retrieves the amount of voting processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next voting process */
    getNextProcessId(entityAddress: string): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number): Promise<string>,
    /** Get the windex within the global array where the given process is stored */
    getProcessIndex(processId: string): Promise<BigNumber>,

    /** Update the genesis link and hash */
    setGenesis(genesisData: string): Promise<ContractTransaction>,
    /** Retrieve the current genesis block content link */
    getGenesis(): Promise<string>,

    /** Update the Chain ID */
    setChainId(newChainId: number): Promise<ContractTransaction>,
    /** Retrieve the current Chain ID */
    getChainId(): Promise<BigNumber>,

    /** Publish a new voting process using the given metadata link */
    create(metadata: string, censusMerkleRoot: string, censusMerkleTree: string): Promise<ContractTransaction>,
    /** Retrieve the current data for the given process */
    get(processId: string): Promise<{ entityAddress: string, metadata: string, censusMerkleRoot: string, censusMerkleTree: string, voteEncryptionPrivateKey: string, canceled: boolean }>,
    /** Cancel the voting process that corresponds to the given Id */
    cancel(processId: string): Promise<ContractTransaction>,

    /** Register the public key of a new validator */
    addValidator(validatorPublicKey: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for a validator */
    removeValidator(idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Retrieve the current list of validators on the Vocchain */
    getValidators(): Promise<string[]>,

    /** Register the public key of a new oracle */
    addOracle(oraclePublicKey: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for an oracle */
    removeOracle(idx: number, oraclePublicKey: string): Promise<ContractTransaction>,
    /** Retrieve the current list of oracles on the Vocchain */
    getOracles(): Promise<string[]>,

    /** Reveal the private key for the given voting process */
    publishPrivateKey(processId: string, privateKey: string): Promise<ContractTransaction>,
    /** Retrieve the current decryption key for the given process */
    getPrivateKey(processId: string): Promise<string>,

    /** Publish the results for the given process */
    publishResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
