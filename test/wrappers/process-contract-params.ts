import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessStatus, IProcessStatus, wrapProcessCreateParams, unwrapProcessState } from "../../lib"
import { BigNumber } from "ethers/utils"

addCompletionHooks()

describe("Process contract parameter wrapper", () => {
    it("should wrap the 'create' input parameters", () => {
        const params1 = wrapProcessCreateParams({
            mode: 12,
            envelopeType: 34,
            metadata: "56",
            censusMerkleRoot: "78",
            censusMerkleTree: "90",
            startBlock: 11,
            blockCount: 22,
            questionCount: 33,
            maxVoteOverwrites: 44,
            maxValue: 55,
            uniqueValues: true,
            maxTotalCost: 66,
            costExponent: 77,
            namespace: 88,
            paramsSignature: "0x99"
        })
        expect(params1[0][0]).to.eq(12)
        expect(params1[0][1]).to.eq(34)
        expect(params1[1][0]).to.eq("56")
        expect(params1[1][1]).to.eq("78")
        expect(params1[1][2]).to.eq("90")
        expect(params1[2]).to.eq(11)
        expect(params1[3]).to.eq(22)
        expect(params1[4][0]).to.eq(33)
        expect(params1[4][1]).to.eq(44)
        expect(params1[4][2]).to.eq(55)
        expect(params1[5]).to.eq(true)
        expect(params1[6][0]).to.eq(66)
        expect(params1[6][1]).to.eq(77)
        expect(params1[7]).to.eq(88)
        expect(params1[8]).to.eq("0x99")

        const params2 = wrapProcessCreateParams({
            mode: 21,
            envelopeType: 43,
            metadata: "65",
            censusMerkleRoot: "87",
            censusMerkleTree: "09",
            startBlock: 111,
            blockCount: 222,
            questionCount: 333,
            maxVoteOverwrites: 444,
            maxValue: 555,
            uniqueValues: false,
            maxTotalCost: 666,
            costExponent: 777,
            namespace: 888,
            paramsSignature: "0x999"
        })
        expect(params2[0][0]).to.eq(21)
        expect(params2[0][1]).to.eq(43)
        expect(params2[1][0]).to.eq("65")
        expect(params2[1][1]).to.eq("87")
        expect(params2[1][2]).to.eq("09")
        expect(params2[2]).to.eq(111)
        expect(params2[3]).to.eq(222)
        expect(params2[4][0]).to.eq(333)
        expect(params2[4][1]).to.eq(444)
        expect(params2[4][2]).to.eq(555)
        expect(params2[5]).to.eq(false)
        expect(params2[6][0]).to.eq(666)
        expect(params2[6][1]).to.eq(777)
        expect(params2[7]).to.eq(888)
        expect(params2[8]).to.eq("0x999")
    })

    it("should unwrap the 'get' response values", () => {
        const json1 = unwrapProcessState([
            [1, 2],
            "0x3",
            ["0x4", "0x5", "0x6"],
            new BigNumber(7),
            8,
            0,
            [11, 12, 13, 14],
            true,
            [15, 16],
            17,
            "0x18"
        ])

        expect(json1.mode).to.eq(1)
        expect(json1.envelopeType).to.eq(2)
        expect(json1.entityAddress).to.eq("0x3")
        expect(json1.metadata).to.eq("0x4")
        expect(json1.censusMerkleRoot).to.eq("0x5")
        expect(json1.censusMerkleTree).to.eq("0x6")
        expect(json1.startBlock.toNumber()).to.eq(7)
        expect(json1.blockCount).to.eq(8)
        expect(json1.status).to.eq(0)
        expect(json1.questionIndex).to.eq(11)
        expect(json1.questionCount).to.eq(12)
        expect(json1.maxVoteOverwrites).to.eq(13)
        expect(json1.maxValue).to.eq(14)
        expect(json1.uniqueValues).to.eq(true)
        expect(json1.maxTotalCost).to.eq(15)
        expect(json1.costExponent).to.eq(16)
        expect(json1.namespace).to.eq(17)
        expect(json1.paramsSignature).to.eq("0x18")

        const json2 = unwrapProcessState([
            [10, 20],
            "0x30",
            ["0x40", "0x50", "0x60"],
            new BigNumber(70),
            80,
            1,
            [110, 120, 130, 140],
            false,
            [150, 160],
            170,
            "0x180"
        ])

        expect(json2.mode).to.eq(10)
        expect(json2.envelopeType).to.eq(20)
        expect(json2.entityAddress).to.eq("0x30")
        expect(json2.metadata).to.eq("0x40")
        expect(json2.censusMerkleRoot).to.eq("0x50")
        expect(json2.censusMerkleTree).to.eq("0x60")
        expect(json2.startBlock.toNumber()).to.eq(70)
        expect(json2.blockCount).to.eq(80)
        expect(json2.status).to.eq(1)
        expect(json2.questionIndex).to.eq(110)
        expect(json2.questionCount).to.eq(120)
        expect(json2.maxVoteOverwrites).to.eq(130)
        expect(json2.maxValue).to.eq(140)
        expect(json2.uniqueValues).to.eq(false)
        expect(json2.maxTotalCost).to.eq(150)
        expect(json2.costExponent).to.eq(160)
        expect(json2.namespace).to.eq(170)
        expect(json2.paramsSignature).to.eq("0x180")
    })
})
