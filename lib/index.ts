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
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    getNextProcessId(entityAddress: string): Promise<string>,

    getProcessId(entityAddress: string, processCountIndex: number): Promise<string>,
    getProcessIndex(processId: string): Promise<BigNumber>,

    setGenesis(newGenesis: string): Promise<ContractTransaction>,
    getGenesis(): Promise<string>,

    setChainId(newChainId: number): Promise<ContractTransaction>,
    getChainId(): Promise<BigNumber>,

    create(processMetadataHash: string): Promise<ContractTransaction>,
    get(processId: string): Promise<[string, string, string, boolean]>, // entityAddress, processMetadataHash, voteEncryptionPrivateKey, canceled
    cancel(processId: string): Promise<ContractTransaction>,

    addValidator(validatorPublicKey: string): Promise<ContractTransaction>,
    removeValidator(idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    getValidators(): Promise<string[]>,

    addOracle(oraclePublicKey: string): Promise<ContractTransaction>,
    removeOracle(idx: number, oraclePublicKey: string): Promise<ContractTransaction>,
    getOracles(): Promise<string[]>,

    publishPrivateKey(processId: string, privateKey: string): Promise<ContractTransaction>,
    getPrivateKey(processId: string): Promise<string>,

    publishResultsHash(processId: string, resultsHash: string): Promise<ContractTransaction>,
    getResultsHash(processId: string): Promise<string>
}
