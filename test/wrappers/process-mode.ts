import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessMode } from "../../lib"

addCompletionHooks()

describe("Process Mode wrapper", () => {
    it("Should build correct bitmasks", () => {
        expect(ProcessMode.SCHEDULED).to.eq(1)
        expect(ProcessMode.DYNAMIC_CENSUS).to.eq(2)
        expect(ProcessMode.DYNAMIC_METADATA).to.eq(4)
        expect(ProcessMode.ENCRYPTED_METADATA).to.eq(8)

        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: false, dynamicCensus: false, scheduled: false })).to.eq(0)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: false, dynamicCensus: false, scheduled: true })).to.eq(1)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: false, dynamicCensus: true, scheduled: false })).to.eq(2)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: false, dynamicCensus: true, scheduled: true })).to.eq(3)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: true, dynamicCensus: false, scheduled: false })).to.eq(4)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: true, dynamicCensus: false, scheduled: true })).to.eq(5)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: true, dynamicCensus: true, scheduled: false })).to.eq(6)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicMetadata: true, dynamicCensus: true, scheduled: true })).to.eq(7)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: false, dynamicCensus: false, scheduled: false })).to.eq(8)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: false, dynamicCensus: false, scheduled: true })).to.eq(9)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: false, dynamicCensus: true, scheduled: false })).to.eq(10)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: false, dynamicCensus: true, scheduled: true })).to.eq(11)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: false, scheduled: false })).to.eq(12)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: false, scheduled: true })).to.eq(13)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: true, scheduled: false })).to.eq(14)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: true, scheduled: true })).to.eq(15)

        expect(ProcessMode.make({})).to.eq(0)
        expect(ProcessMode.make({ scheduled: true })).to.eq(1)
        expect(ProcessMode.make({ dynamicCensus: true })).to.eq(2)
        expect(ProcessMode.make({ dynamicCensus: true, scheduled: true })).to.eq(3)
        expect(ProcessMode.make({ dynamicMetadata: true })).to.eq(4)
        expect(ProcessMode.make({ dynamicMetadata: true, scheduled: true })).to.eq(5)
        expect(ProcessMode.make({ dynamicMetadata: true, dynamicCensus: true })).to.eq(6)
        expect(ProcessMode.make({ dynamicMetadata: true, dynamicCensus: true, scheduled: true })).to.eq(7)
        expect(ProcessMode.make({ encryptedMetadata: true })).to.eq(8)
        expect(ProcessMode.make({ encryptedMetadata: true, scheduled: true })).to.eq(9)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true })).to.eq(10)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, scheduled: true })).to.eq(11)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true })).to.eq(12)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, scheduled: true })).to.eq(13)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: true })).to.eq(14)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicMetadata: true, dynamicCensus: true, scheduled: true })).to.eq(15)

        expect(ProcessMode.make()).to.eq(0)
    })

    it("Should identity the appropriate flags", () => {
        expect(new ProcessMode(0).isScheduled).to.be.false
        expect(new ProcessMode(0).isOnDemand).to.be.true

        expect(new ProcessMode(ProcessMode.SCHEDULED).isScheduled).to.be.true
        expect(new ProcessMode(ProcessMode.SCHEDULED).isOnDemand).to.be.false

        expect(new ProcessMode(ProcessMode.DYNAMIC_CENSUS).hasDynamicCensus).to.be.true

        expect(new ProcessMode(ProcessMode.DYNAMIC_METADATA).hasDynamicMetadata).to.be.true

        expect(new ProcessMode(ProcessMode.ENCRYPTED_METADATA).hasMetadataEncrypted).to.be.true
    })

    it("Should fail for invalid types", () => {
        for (let i = 16; i < 256; i++) {
            expect(() => { new ProcessMode(i as any) }).to.throw
        }
    })
})
