import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessCensusOrigin, IProcessCensusOrigin } from "../../lib"

addCompletionHooks()

describe("Process Census Origin wrapper", () => {
    it("should handle valid census origins", () => {
        // 1
        let pm = new ProcessCensusOrigin(1)
        expect(pm.isOffChain).to.eq(true)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE)
        expect(pm.isOffChain).to.eq(true)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 2
        pm = new ProcessCensusOrigin(2)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(true)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE_WEIGHTED)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(true)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 3
        pm = new ProcessCensusOrigin(3)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(true)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_CA)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(true)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 11
        pm = new ProcessCensusOrigin(11)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(true)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC20)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(true)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 12
        pm = new ProcessCensusOrigin(12)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(true)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC721)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(true)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 13
        pm = new ProcessCensusOrigin(13)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(true)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC1155)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(true)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(false)

        // 14
        pm = new ProcessCensusOrigin(14)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(true)
        expect(pm.isMiniMe).to.eq(false)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.ERC777)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(true)
        expect(pm.isMiniMe).to.eq(false)

        // 15
        pm = new ProcessCensusOrigin(15)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(true)

        pm = new ProcessCensusOrigin(ProcessCensusOrigin.MINI_ME)
        expect(pm.isOffChain).to.eq(false)
        expect(pm.isOffChainWeighted).to.eq(false)
        expect(pm.isOffChainCA).to.eq(false)
        expect(pm.isErc20).to.eq(false)
        expect(pm.isErc721).to.eq(false)
        expect(pm.isErc1155).to.eq(false)
        expect(pm.isErc777).to.eq(false)
        expect(pm.isMiniMe).to.eq(true)
    })

    it("should fail on invalid process status", () => {
        expect(() => new ProcessCensusOrigin(0 as IProcessCensusOrigin)).to.throw
        for (let i = 4; i < 11; i++) expect(() => new ProcessCensusOrigin(i as IProcessCensusOrigin)).to.throw
        for (let i = 16; i < 260; i++) expect(() => new ProcessCensusOrigin(i as IProcessCensusOrigin)).to.throw
    })
})
