import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessMode } from "../../lib"

addCompletionHooks()

describe("Process Mode wrapper", () => {
    it("Should build correct bitmasks", () => {
        expect(ProcessMode.AUTO_START).to.eq(1)
        expect(ProcessMode.INTERRUPTIBLE).to.eq(2)
        expect(ProcessMode.DYNAMIC_CENSUS).to.eq(4)
        expect(ProcessMode.ENCRYPTED_METADATA).to.eq(8)

        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: false, interruptible: false, autoStart: false })).to.eq(0)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: false, interruptible: false, autoStart: true })).to.eq(1)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: false, interruptible: true, autoStart: false })).to.eq(2)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: false, interruptible: true, autoStart: true })).to.eq(3)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: true, interruptible: false, autoStart: false })).to.eq(4)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: true, interruptible: false, autoStart: true })).to.eq(5)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: true, interruptible: true, autoStart: false })).to.eq(6)
        expect(ProcessMode.make({ encryptedMetadata: false, dynamicCensus: true, interruptible: true, autoStart: true })).to.eq(7)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: false, interruptible: false, autoStart: false })).to.eq(8)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: false, interruptible: false, autoStart: true })).to.eq(9)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: false, interruptible: true, autoStart: false })).to.eq(10)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: false, interruptible: true, autoStart: true })).to.eq(11)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: false, autoStart: false })).to.eq(12)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: false, autoStart: true })).to.eq(13)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: true, autoStart: false })).to.eq(14)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: true, autoStart: true })).to.eq(15)

        expect(ProcessMode.make({})).to.eq(0)
        expect(ProcessMode.make({ autoStart: true })).to.eq(1)
        expect(ProcessMode.make({ interruptible: true })).to.eq(2)
        expect(ProcessMode.make({ interruptible: true, autoStart: true })).to.eq(3)
        expect(ProcessMode.make({ dynamicCensus: true })).to.eq(4)
        expect(ProcessMode.make({ dynamicCensus: true, autoStart: true })).to.eq(5)
        expect(ProcessMode.make({ dynamicCensus: true, interruptible: true })).to.eq(6)
        expect(ProcessMode.make({ dynamicCensus: true, interruptible: true, autoStart: true })).to.eq(7)
        expect(ProcessMode.make({ encryptedMetadata: true })).to.eq(8)
        expect(ProcessMode.make({ encryptedMetadata: true, autoStart: true })).to.eq(9)
        expect(ProcessMode.make({ encryptedMetadata: true, interruptible: true })).to.eq(10)
        expect(ProcessMode.make({ encryptedMetadata: true, interruptible: true, autoStart: true })).to.eq(11)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true })).to.eq(12)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, autoStart: true })).to.eq(13)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: true })).to.eq(14)
        expect(ProcessMode.make({ encryptedMetadata: true, dynamicCensus: true, interruptible: true, autoStart: true })).to.eq(15)

        expect(ProcessMode.make()).to.eq(0)
    })

    it("Should identify the appropriate flags", () => {
        expect(new ProcessMode(0).isAutoStart).to.be.false
        expect(new ProcessMode(ProcessMode.AUTO_START).isAutoStart).to.be.true

        expect(new ProcessMode(0).isInterruptible).to.be.false
        expect(new ProcessMode(ProcessMode.INTERRUPTIBLE).isInterruptible).to.be.true

        expect(new ProcessMode(0).hasDynamicCensus).to.be.false
        expect(new ProcessMode(ProcessMode.DYNAMIC_CENSUS).hasDynamicCensus).to.be.true

        expect(new ProcessMode(0).hasEncryptedMetadata).to.be.false
        expect(new ProcessMode(ProcessMode.ENCRYPTED_METADATA).hasEncryptedMetadata).to.be.true
    })

    it("Should identify the appropriate census origin enum on the mode", () => {
        expect(new ProcessMode(0).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_OFF_CHAIN)

        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_OFF_CHAIN })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_OFF_CHAIN)
        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_ERC20 })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_ERC20)
        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_ERC721 })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_ERC721)
        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_ERC1155 })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_ERC1155)
        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_ERC777 })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_ERC777)
        expect(new ProcessMode(ProcessMode.make({ censusOrigin: ProcessMode.CENSUS_ORIGIN_MINI_ME })).censusOrigin).to.eq(ProcessMode.CENSUS_ORIGIN_MINI_ME)
    })

    it("Should fail for invalid types", () => {
        for (let i = 256; i < 512; i++) {
            expect(() => { new ProcessMode(i as any) }).to.throw
        }
    })
})
