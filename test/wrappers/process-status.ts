import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessStatus, IProcessStatus } from "../../lib"

addCompletionHooks()

describe("Process Status wrapper", () => {
    it("should handle valid process status", () => {
        let pm = new ProcessStatus(0)
        expect(pm.isReady).to.eq(true)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(ProcessStatus.READY)
        expect(pm.isReady).to.eq(true)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(1)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(true)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(ProcessStatus.ENDED)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(true)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(2)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(true)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(ProcessStatus.CANCELED)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(true)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(3)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(true)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(ProcessStatus.PAUSED)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(true)
        expect(pm.hasResults).to.eq(false)

        pm = new ProcessStatus(4)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(true)

        pm = new ProcessStatus(ProcessStatus.RESULTS)
        expect(pm.isReady).to.eq(false)
        expect(pm.isEnded).to.eq(false)
        expect(pm.isCanceled).to.eq(false)
        expect(pm.isPaused).to.eq(false)
        expect(pm.hasResults).to.eq(true)
    })

    it("should fail on invalid process status", () => {
        for (let i = 5; i < 260; i++) expect(() => new ProcessStatus(i as IProcessStatus)).to.throw
    })
})
