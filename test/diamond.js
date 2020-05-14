import { keccak256 } from './utils/web3'
import { ADDRESS_ZERO, hdWallet } from './utils'

const DiamondExample = artifacts.require("./diamond/DiamondExample")
const DiamondFacet = artifacts.require("./diamond/DiamondFacet")
const Test1Facet = artifacts.require("./diamond/Test1Facet")

function getSelectors (contractInstance) {
  const sigs = contractInstance.contract._jsonInterface
    .filter(({ type }) => type === 'function')
    .map(({ signature }) => signature)

  return sigs.reduce((acc, val) => {
    return acc + val.slice(2);
  }, '');
}

contract('Diamond', accounts => {
  it('cannot delegate to null implementation', async () => {
    const de = await DiamondExample.new()
    const df = await DiamondFacet.at(de.address)

    const t = await Test1Facet.new()

    const selectors = getSelectors(t)

    console.log('add facet...')

    await df.diamondCut([ t.address + selectors ])
    const tf = await Test1Facet.at(de.address)
    await tf.setNumber(53);
    console.log((await tf.getNumber()).toNumber())

    console.log('remove facet...')

    await df.diamondCut([ADDRESS_ZERO + selectors])
    await tf.setNumber(25).should.be.rejectedWith('does not exist')

    console.log('freeze...')

    const diamondCutSelectors = getSelectors(df)
    await df.diamondCut([ADDRESS_ZERO + diamondCutSelectors])

    console.log('try adding again...')

    await df.diamondCut([t.address + selectors]).should.be.rejectedWith('does not exist')
  })
})
