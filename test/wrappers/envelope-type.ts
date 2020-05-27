import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessEnvelopeType } from "../../lib"

addCompletionHooks()

describe("Envelope Type wrapper", () => {
    it("Should build correct bitmasks", () => {
        expect(ProcessEnvelopeType.ENCRYPTED_VOTES).to.eq(1)
        expect(ProcessEnvelopeType.ANONYMOUS_VOTERS).to.eq(2)
        expect(ProcessEnvelopeType.MULTI_ENVELOPE).to.eq(4)

        expect(ProcessEnvelopeType.make({ multiEnvelope: false, anonymousVoters: false, encryptedVotes: false })).to.eq(0)
        expect(ProcessEnvelopeType.make({ multiEnvelope: false, anonymousVoters: false, encryptedVotes: true })).to.eq(1)
        expect(ProcessEnvelopeType.make({ multiEnvelope: false, anonymousVoters: true, encryptedVotes: false })).to.eq(2)
        expect(ProcessEnvelopeType.make({ multiEnvelope: false, anonymousVoters: true, encryptedVotes: true })).to.eq(3)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: false, encryptedVotes: false })).to.eq(4)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: false, encryptedVotes: true })).to.eq(5)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: true, encryptedVotes: false })).to.eq(6)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: true, encryptedVotes: true })).to.eq(7)

        expect(ProcessEnvelopeType.make({})).to.eq(0)
        expect(ProcessEnvelopeType.make({ encryptedVotes: true })).to.eq(1)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true })).to.eq(2)
        expect(ProcessEnvelopeType.make({ anonymousVoters: true, encryptedVotes: true })).to.eq(3)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true })).to.eq(4)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, encryptedVotes: true })).to.eq(5)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: true })).to.eq(6)
        expect(ProcessEnvelopeType.make({ multiEnvelope: true, anonymousVoters: true, encryptedVotes: true })).to.eq(7)

        expect(ProcessEnvelopeType.make()).to.eq(0)
    })

    it("Should identity the appropriate flags", () => {
        expect(new ProcessEnvelopeType(0).hasAnonymousVoters).to.be.false
        expect(new ProcessEnvelopeType(0).isRealtime).to.be.true

        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ANONYMOUS_VOTERS).hasAnonymousVoters).to.be.true

        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ENCRYPTED_VOTES).hasEncryptedVotes).to.be.true
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.ENCRYPTED_VOTES).isRealtime).to.be.false

        expect(new ProcessEnvelopeType(ProcessEnvelopeType.MULTI_ENVELOPE).isMultiEnvelope).to.be.true
        expect(new ProcessEnvelopeType(ProcessEnvelopeType.MULTI_ENVELOPE).isSingleEnvelope).to.be.false
        expect(new ProcessEnvelopeType(0).isMultiEnvelope).to.be.false
        expect(new ProcessEnvelopeType(0).isSingleEnvelope).to.be.true
    })

    it("Should fail for invalid types", () => {
        for (let i = 8; i < 256; i++) {
            expect(() => { new ProcessEnvelopeType(i as any) }).to.throw
        }
    })
})
