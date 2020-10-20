import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessContractParameters } from "../../lib"
import { BigNumber } from "ethers"

addCompletionHooks()

describe("Process contract parameter wrapper", () => {
    it("should wrap the 'create' input parameters", () => {
        const params1 = ProcessContractParameters.fromParams({
            mode: 12,
            envelopeType: 3,
            metadata: "56",
            censusMerkleRoot: "78",
            censusMerkleTree: "90",
            startBlock: 11,
            blockCount: 22,
            questionCount: 33,
            maxCount: 44,
            maxValue: 55,
            maxVoteOverwrites: 66,
            uniqueValues: true,
            maxTotalCost: 77,
            costExponent: 88,
            namespace: 99,
            paramsSignature: "0x0100"
        }).toContractParams()

        expect(params1[0][0]).to.eq(12)
        expect(params1[0][1]).to.eq(3)
        expect(params1[1][0]).to.eq("56")
        expect(params1[1][1]).to.eq("78")
        expect(params1[1][2]).to.eq("90")
        expect(params1[2]).to.eq(11)
        expect(params1[3]).to.eq(22)
        expect(params1[4][0]).to.eq(33)
        expect(params1[4][1]).to.eq(44)
        expect(params1[4][2]).to.eq(55)
        expect(params1[4][3]).to.eq(66)
        expect(params1[5]).to.eq(true)
        expect(params1[6][0]).to.eq(77)
        expect(params1[6][1]).to.eq(88)
        expect(params1[7]).to.eq(99)
        expect(params1[8]).to.eq("0x0100")

        const params2 = ProcessContractParameters.fromParams({
            mode: 21,
            envelopeType: 4,
            metadata: "65",
            censusMerkleRoot: "87",
            censusMerkleTree: "09",
            startBlock: 111,
            blockCount: 222,
            questionCount: 34,
            maxCount: 45,
            maxValue: 56,
            maxVoteOverwrites: 67,
            uniqueValues: false,
            maxTotalCost: 777,
            costExponent: 888,
            namespace: 999,
            paramsSignature: "0x1000"
        }).toContractParams()

        expect(params2[0][0]).to.eq(21)
        expect(params2[0][1]).to.eq(4)
        expect(params2[1][0]).to.eq("65")
        expect(params2[1][1]).to.eq("87")
        expect(params2[1][2]).to.eq("09")
        expect(params2[2]).to.eq(111)
        expect(params2[3]).to.eq(222)
        expect(params2[4][0]).to.eq(34)
        expect(params2[4][1]).to.eq(45)
        expect(params2[4][2]).to.eq(56)
        expect(params2[4][3]).to.eq(67)
        expect(params2[5]).to.eq(false)
        expect(params2[6][0]).to.eq(777)
        expect(params2[6][1]).to.eq(888)
        expect(params2[7]).to.eq(999)
        expect(params2[8]).to.eq("0x1000")
    })

    it("should unwrap the 'get' response values", () => {
        const json1 = ProcessContractParameters.fromContract([
            [1, 2],
            "0x3",
            ["0x4", "0x5", "0x6"],
            BigNumber.from(7),
            8,
            0,
            [11, 12, 13, 14, 15],
            true,
            [16, 17, 18]
        ])

        expect(json1.mode.value).to.eq(1)
        expect(json1.envelopeType.value).to.eq(2)
        expect(json1.entityAddress).to.eq("0x3")
        expect(json1.metadata).to.eq("0x4")
        expect(json1.censusMerkleRoot).to.eq("0x5")
        expect(json1.censusMerkleTree).to.eq("0x6")
        expect(json1.startBlock).to.eq(7)
        expect(json1.blockCount).to.eq(8)
        expect(json1.status.value).to.eq(0)
        expect(json1.questionIndex).to.eq(11)
        expect(json1.questionCount).to.eq(12)
        expect(json1.maxCount).to.eq(13)
        expect(json1.maxValue).to.eq(14)
        expect(json1.maxVoteOverwrites).to.eq(15)
        expect(json1.uniqueValues).to.eq(true)
        expect(json1.maxTotalCost).to.eq(16)
        expect(json1.costExponent).to.eq(17)
        expect(json1.namespace).to.eq(18)

        const json2 = ProcessContractParameters.fromContract([
            [10, 3],
            "0x30",
            ["0x40", "0x50", "0x60"],
            BigNumber.from(70),
            80,
            1,
            [110, 120, 99, 140, 150],
            false,
            [160, 170, 180]
        ])

        expect(json2.mode.value).to.eq(10)
        expect(json2.envelopeType.value).to.eq(3)
        expect(json2.entityAddress).to.eq("0x30")
        expect(json2.metadata).to.eq("0x40")
        expect(json2.censusMerkleRoot).to.eq("0x50")
        expect(json2.censusMerkleTree).to.eq("0x60")
        expect(json2.startBlock).to.eq(70)
        expect(json2.blockCount).to.eq(80)
        expect(json2.status.value).to.eq(1)
        expect(json2.questionIndex).to.eq(110)
        expect(json2.questionCount).to.eq(120)
        expect(json2.maxCount).to.eq(99)
        expect(json2.maxValue).to.eq(140)
        expect(json2.maxVoteOverwrites).to.eq(150)
        expect(json2.uniqueValues).to.eq(false)
        expect(json2.maxTotalCost).to.eq(160)
        expect(json2.costExponent).to.eq(170)
        expect(json2.namespace).to.eq(180)
    })
})
