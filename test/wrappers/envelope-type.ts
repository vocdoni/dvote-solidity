import { expect } from "chai"
import "mocha" // using @types/mocha
import { ProcessEnvelopeType } from "../../lib"
import { addCompletionHooks } from "../utils/mocha-hooks"

addCompletionHooks()

describe("Envelope Type wrapper", () => {
    it("Should build correct bitmasks", () => {
        expect(ProcessEnvelopeType.SERIAL).to.eq(1)
        expect(ProcessEnvelopeType.ANONYMOUS).to.eq(2)
        expect(ProcessEnvelopeType.ENCRYPTED_VOTES).to.eq(4)
        expect(ProcessEnvelopeType.UNIQUE_VALUES).to.eq(8)
        expect(ProcessEnvelopeType.COST_FROM_WEIGHT).to.eq(16)

        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: false, serial: false, costFromWeight: false })).to.eq(0)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: false, serial: true, costFromWeight: false })).to.eq(1)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: true, serial: false, costFromWeight: false })).to.eq(2)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: true, serial: true, costFromWeight: false })).to.eq(3)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: false, serial: false, costFromWeight: false })).to.eq(4)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: false, serial: true, costFromWeight: false })).to.eq(5)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: true, serial: false, costFromWeight: false })).to.eq(6)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: true, serial: true, costFromWeight: false })).to.eq(7)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: false, serial: false, costFromWeight: false })).to.eq(8)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: false, serial: true, costFromWeight: false })).to.eq(9)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: true, serial: false, costFromWeight: false })).to.eq(10)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: true, serial: true, costFromWeight: false })).to.eq(11)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: false, serial: false, costFromWeight: false })).to.eq(12)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: false, serial: true, costFromWeight: false })).to.eq(13)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true, serial: false, costFromWeight: false })).to.eq(14)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true, serial: true, costFromWeight: false })).to.eq(15)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: false, serial: false, costFromWeight: true })).to.eq(16)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: false, serial: true, costFromWeight: true })).to.eq(17)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: true, serial: false, costFromWeight: true })).to.eq(18)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: false, anonymousVoters: true, serial: true, costFromWeight: true })).to.eq(19)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: false, serial: false, costFromWeight: true })).to.eq(20)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: false, serial: true, costFromWeight: true })).to.eq(21)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: true, serial: false, costFromWeight: true })).to.eq(22)
        expect(ProcessEnvelopeType.make({ uniqueValues: false, encryptedVotes: true, anonymousVoters: true, serial: true, costFromWeight: true })).to.eq(23)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: false, serial: false, costFromWeight: true })).to.eq(24)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: false, serial: true, costFromWeight: true })).to.eq(25)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: true, serial: false, costFromWeight: true })).to.eq(26)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: false, anonymousVoters: true, serial: true, costFromWeight: true })).to.eq(27)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: false, serial: false, costFromWeight: true })).to.eq(28)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: false, serial: true, costFromWeight: true })).to.eq(29)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true, serial: false, costFromWeight: true })).to.eq(30)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true, serial: true, costFromWeight: true })).to.eq(31)

        expect(ProcessEnvelopeType.make({})).to.eq(0)
        expect(ProcessEnvelopeType.make({ serial: true })).to.eq(1)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true })).to.eq(2)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true, serial: true })).to.eq(3)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true })).to.eq(4)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, serial: true })).to.eq(5)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true })).to.eq(6)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true, serial: true })).to.eq(7)
        expect(ProcessEnvelopeType.make({ uniqueValues: true })).to.eq(8)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, serial: true })).to.eq(9)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, anonymousVoters: true })).to.eq(10)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, anonymousVoters: true, serial: true })).to.eq(11)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true })).to.eq(12)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, serial: true })).to.eq(13)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true })).to.eq(14)
        expect(ProcessEnvelopeType.make({ uniqueValues: true, encryptedVotes: true, anonymousVoters: true, serial: true })).to.eq(15)

        expect(ProcessEnvelopeType.make()).to.eq(0)
    })

    it("Should identity the appropriate flags", () => {
        expect(new ProcessEnvelopeType(0).hasSerialVoting).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.SERIAL).hasSerialVoting).to.be.true

        expect(new ProcessEnvelopeType(0).hasAnonymousVoters).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ANONYMOUS).hasAnonymousVoters).to.be.true

        expect(new ProcessEnvelopeType(0).hasEncryptedVotes).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ENCRYPTED_VOTES).hasEncryptedVotes).to.be.true

        expect(new ProcessEnvelopeType(0).hasUniqueValues).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.UNIQUE_VALUES).hasUniqueValues).to.be.true

        expect(new ProcessEnvelopeType(0).hasCostFromWeight).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.COST_FROM_WEIGHT).hasCostFromWeight).to.be.true
    })

    it("Should fail for invalid types", () => {
        for (let i = 32; i < 256; i++) {
            expect(() => { new ProcessEnvelopeType(i as any) }).to.throw
        }
    })
})
