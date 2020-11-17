import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessCensusOrigin, IProcessCensusOrigin } from "../../lib"

addCompletionHooks()

describe("Process Census Origin wrapper", () => {
    it("should handle valid census origins", () => {
        let pm = new ProcessCensusOrigin(0)
        expect(pm.isOffChain).to.eq(true)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN)
        expect(pm.isOffChain).to.eq(true)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(1)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(true)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC20)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(true)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(2)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(true)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC721)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(true)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(3)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(true)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC1155)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(true)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(4)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(true)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC777)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(true)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(5)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(true)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.MINI_ME)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(true)
    })

    it("should fail on invalid process status", () => {
        for (let i = 5; i < 260; i++) expect(() => new ProcessCensusOrigin(i as IProcessCensusOrigin)).to.throw
    })
})
