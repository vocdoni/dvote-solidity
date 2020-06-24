import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessEnvelopeType } from "../../lib"

addCompletionHooks()

describe("Envelope Type wrapper", () => {
    it("Should build correct bitmasks", () => {
        expect(ProcessEnvelopeType.SERIAL).to.eq(1)
        expect(ProcessEnvelopeType.ANONYMOUS).to.eq(2)
        expect(ProcessEnvelopeType.ENCRYPTED_VOTES).to.eq(4)

        expect(ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: false, serial: false })).to.eq(0)
        expect(ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: false, serial: true })).to.eq(1)
        expect(ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: true, serial: false })).to.eq(2)
        expect(ProcessEnvelopeType.make({ encryptedVotes: false, anonymousVoters: true, serial: true })).to.eq(3)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: false, serial: false })).to.eq(4)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: false, serial: true })).to.eq(5)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true, serial: false })).to.eq(6)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true, serial: true })).to.eq(7)

        expect(ProcessEnvelopeType.make({})).to.eq(0)
        expect(ProcessEnvelopeType.make({ serial: true })).to.eq(1)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true })).to.eq(2)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true, serial: true })).to.eq(3)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true })).to.eq(4)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, serial: true })).to.eq(5)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true })).to.eq(6)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true, anonymousVoters: true, serial: true })).to.eq(7)

        expect(ProcessEnvelopeType.make()).to.eq(0)
    })

    it("Should identity the appropriate flags", () => {
        expect(new ProcessEnvelopeType(0).hasSerialVoting).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.SERIAL).hasSerialVoting).to.be.true

        expect(new ProcessEnvelopeType(0).hasAnonymousVoters).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ANONYMOUS).hasAnonymousVoters).to.be.true

        expect(new ProcessEnvelopeType(0).hasEncryptedVotes).to.be.false
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ENCRYPTED_VOTES).hasEncryptedVotes).to.be.true
    })

    it("Should fail for invalid types", () => {
        for (let i = 8; i < 256; i++) {
            expect(() => { new ProcessEnvelopeType(i as any) }).to.throw
        }
    })
})
