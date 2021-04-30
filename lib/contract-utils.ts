import { utils } from "ethers"

///////////////////////////////////////////////////////////////////////////////
// ETHERS
///////////////////////////////////////////////////////////////////////////////

export type IMethodOverrides = {
    gasLimit?: number
    gasPrice?: number
    nonce?: number
    value?: number
    chainId?: number
}
export declare const defaultMethodOverrides: IMethodOverrides

/**
 * Hashes the address of an Entity to interact with the Entity Resolver contract
 * @param address
 */
export function ensHashAddress(address: string): string {
    return utils.keccak256(address)
}
