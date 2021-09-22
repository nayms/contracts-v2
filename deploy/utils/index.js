import _ from 'lodash'
import got from 'got'
import ethUtil from 'ethereumjs-util'
import { ADDRESS_ZERO } from '../../utils/constants'
import { createLog } from './log'
import { networks } from '../../hardhat.config.js'
import deployedAddresses from '../../deployedAddresses.json'

export { createLog }
export * from './postDeployment'

export const deployContract = async ({ getTxParams }, name, ...args) => {
  const C = await hre.ethers.getContractFactory(name)
  return await C.deploy(...args, getTxParams())
}
export const getContractAt = async (p, a, s) => await hre.ethers.getContractAt(p, a, s)

export const getMatchingNetwork = ({ chainId: id }) => {
  const match = Object.keys(networks).find(k => networks[k].chainId == id)

  if (!match) {
    throw new Error(`Could not find matching network with id ${id}`)
  }

  return Object.assign({
    name: match,
    id,
  }, networks[match], {
    isLocal: (id > 100)
  })
}

export const getLiveGasPrice = async ({ log }) => {
  let gwei

  await log.task('Fetching live fast gas price', async task => {
    const { body } = await got('https://www.ethgasstationapi.com/api/fast', { rejectUnauthorized: false })
    const fast = parseFloat(body)
    gwei = fast + 1
    task.log(`${gwei} GWEI`)
  })

  return gwei
}

export const buildGetTxParamsHandler = async (accounts, network, { log }) => {
  // additional tx params (used to ensure enough gas is supplied alongside the correct nonce)
  let getTxParams = (txParamsOverride = {}) => Object.assign({
    gasPrice: 1 * 1000000000, // 1 GWEI
  }, txParamsOverride)

  if (!network.isLocal) {
    /*
    - On mainnet, use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    let gwei
    if ('mainnet' === network.name) {
      gwei = await getLiveGasPrice({ log })
    } else {
      gwei = 1
    }

    let nonce = await accounts[0].getTransactionCount()

    getTxParams = (txParamsOverride = {}) => {
      log.log(`Nonce: ${nonce}`)

      nonce += 1

      return defaultGetTxParams(Object.assign({
        gasPrice: gwei * 1000000000,
        nonce: nonce - 1,
      }, txParamsOverride))
    }
  }

  return getTxParams
}


let safeNonce // keep track of ongoing nonce

export const execCall = async ({ ctx, task, contract, method, args }) => {
  const { accounts, getTxParams, network, multisig, hdWallet, onlyDeployingUpgrades } = ctx

  if (multisig && onlyDeployingUpgrades) {
    await task.log(`   QUEUE: ${method}() on ${contract.address} (multisig: ${multisig})`, 'green')

    let baseUrl 
    switch (network.id) {
      case 1:
        baseUrl = `https://safe-transaction.mainnet.gnosis.io`
        break
      case 4:
        baseUrl = `https://safe-transaction.rinkeby.gnosis.io`
        break
      default:
        throw new Error(`Cannot use multisig for network ${JSON.stringify(network)}`)
    }

    const safe = getContractAt('GnosisSafe', multsig, multsig)

    const data = contract.interface.encodeFunctionData(method, args)
    await task.log(`     --> Data: ${data}`, 'green')

    const safeTxGas = await contract.estimateGas[method](...args)
    await task.log(`     --> Gas estimate: ${safeTxGas}`, 'green')

    if (!safeNonce) {
      safeNonce = (await safe.nonce()).toNumber()
    } else {
      safeNonce++
    }
    await task.log(`     --> Nonce: ${safeNonce}`, 'green')

    const contractTransactionHash = await safe.getTransactionHash(
      /*to: */contract.address,
      /*value: */0,
      /*data: */data,
      /*operation: */0,
      /*safeTxGas: */safeTxGas,
      /*baseGas: */0,
      /*gasPrice: */0,
      /*gasToken: */ADDRESS_ZERO,
      /*refundReceiver: */ADDRESS_ZERO,
      /*_nonce: */safeNonce,
    )
    await task.log(`     --> Signable hash: ${contractTransactionHash}`, 'green')

    const sender = hdWallet.getAddresses()[0]
    await task.log(`     --> Sender: ${sender}`, 'green')
    
    const rawSig = ethUtil.ecsign(
      ethUtil.toBuffer(contractTransactionHash),
      hdWallet.getPrivateKey(sender)
    )
    const signature = ethUtil.bufferToHex(concatSig(rawSig.v, rawSig.r, rawSig.s)).substr(2)
    await task.log(`     --> Signature: ${signature}`, 'green')
      
    const endpoint = `${baseUrl}/api/v1/safes/${multisig}/transactions/`

    const tx = {
      to: contract.address,
      value: 0,
      data,
      operation: 0,
      nonce: safeNonce,
      safeTxGas,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ADDRESS_ZERO,
      refundReceiver: ADDRESS_ZERO,
      contractTransactionHash,
      transactionHash: null,
      sender: accounts[0],
      origin: null,    
      signature,  
    }

    try {
      await got.post(endpoint, { json: tx })
    } catch (err) {
      console.error(`Error submitting to SAFE endpoint: ${err.message}`)
      console.log(`${endpoint}\n\n${JSON.stringify(err.options.headers, null, 2)}\n\n${JSON.stringify(tx, null, 2)}`)
      throw err
    }

    await task.log(`     --> Successfully added to web GUI`, 'green')
  } else {
    await task.log(`   CALL ${method}() on ${contract.address}`, 'yellow')
    return await contract[method].apply(contract, args.concat(getTxParams()))
  }
}



export const getDeployedContractInstance = async ({ lookupType, type, network, log }) => {
  log = createLog(log)

  let inst

  await log.task(`Loading ${lookupType} address from deployed address list for network ${network.id}`, async task => {
    inst = await getContractAt(type, _.get(deployedAddresses, `${lookupType}.${network.id}.address`))
    task.log(`Instance: ${inst.address}`)
  })

  return inst
}


const padWithZeroes = (number, length) => {
  let myString = `${number}`;
  while (myString.length < length) {
    myString = `0${myString}`;
  }
  return myString;
}

const concatSig = (v, r, s) => {
  const rSig = ethUtil.fromSigned(r);
  const sSig = ethUtil.fromSigned(s);
  const vSig = ethUtil.bufferToInt(v);
  const rStr = padWithZeroes(ethUtil.toUnsigned(rSig).toString('hex'), 64);
  const sStr = padWithZeroes(ethUtil.toUnsigned(sSig).toString('hex'), 64);
  const vStr = ethUtil.stripHexPrefix(ethUtil.intToHex(vSig));
  return ethUtil.addHexPrefix(rStr.concat(sStr, vStr)).toString('hex');
}