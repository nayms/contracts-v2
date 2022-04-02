import _ from 'lodash'
import got from 'got'
import * as ethUtil from 'ethereumjs-util'
import { ADDRESS_ZERO } from '../../utils/constants'
import { createLog } from './log'
import { networks } from '../../hardhat.config.js'
import deployedAddresses from '../../deployedAddresses.json'

export { createLog }
export * from './postDeployment'

const defaultGetTxParams = (txParamsOverride = {}) => Object.assign({
  gasPrice: 1 * 1000000000, // 1 GWEI,
}, txParamsOverride)

let accounts
export const getAccounts = async () => {
  if (!accounts) {
    accounts = await hre.ethers.getSigners()
  }
  return accounts.map(a => a.address)
}

export const getAccountWallet = (address) => accounts.find(a => a.address === address)

export const deployContract = async ({ log, artifacts, getTxParams = defaultGetTxParams }, name, args, overrides = {}) => {
  const C = artifacts.require(name)
  const c = await C.new(...args, { ...getTxParams(), ...overrides })

  await log.task(`Verifying contract ${name} ${c.address} on etherscan`, async task => { 
    try {
      await hre.run("verify:verify", {
        address: c.address,
        constructorArguments: args,
      })
    }
    catch(e) {
      task.log(`hre verify contract error: ${e}`)
    }
  })

  return c
}

export const getContractAt = async ({ artifacts }, name, addr) => {
  const C = artifacts.require(name)
  return C.at(addr)
}

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


export const buildGetTxParamsHandler = async (network, { log }) => {
  // additional tx params (used to ensure enough gas is supplied alongside the correct nonce)
  let getTxParams

  if (!network.isLocal) {
    /*
    - On mainnet, use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    let gwei
    if ('mainnet' === network.name) {
      gwei = await getLiveGasPrice({ log })
    } else {
      gwei = 3
    }

    const signer = (await hre.ethers.getSigners())[1] 
    const address = await signer.getAddress()
    // console.log(address) // Rinkeby/Mainnet: 0xfcE918c07BD4c900941500A6632deB24bA7897Ce
    
    let nonce = await signer.getTransactionCount()

    getTxParams = (txParamsOverride = {}) => {
      log.log(`Nonce: ${nonce}`)

      nonce += 1

      return defaultGetTxParams(Object.assign({
        gasPrice: gwei * 1000000000,
        nonce: nonce - 1,
        from: address,
      }, txParamsOverride))
    }
  }

  return getTxParams
}


export const execMethod = async ({ ctx, task, contract }, method, ...args) => {
  const { getTxParams = defaultGetTxParams } = ctx

  await task.task(`CALL ${method}() on ${contract.address}`, async () => {
    return await contract[method].apply(contract, args.concat(getTxParams()))
  }, { col: 'yellow' })
}

export const getMethodExecutor = ({ ctx, task, contract }) => (method, ...args) => execMethod({ ctx, task, contract }, method, ...args)

let safeNonce // keep track of ongoing nonce

export const execMultisigCall = async ({ ctx, task, contract, method, args }) => {
  const { accounts, network, multisig, hdWallet, onlyDeployingUpgrades } = ctx

  if (multisig && onlyDeployingUpgrades) {
    await task.log(`   QUEUE: ${method}() on ${contract.address} (multisig: ${multisig})`, 'green')

    let baseUrl 
    switch (network.id) {
      case 1:
        baseUrl = `https://safe-client.gnosis.io/v1/chains/1/transactions`
        break
      case 4:
        baseUrl = `https://safe-client.gnosis.io/v1/chains/4/transactions`
        break
      default:
        throw new Error(`Cannot use multisig for network ${JSON.stringify(network)}`)
    }

    const { data } = await contract[method].request(...args, { from: multisig })
    await task.log(`     --> Data: ${data}`, 'green')

    const safeTxGas = await contract[method].estimateGas(...args, { from: multisig })
    await task.log(`     --> Gas estimate: ${safeTxGas}`, 'green')

    const safe = await getContractAt(ctx, 'GnosisSafe', multisig)

    if (!safeNonce) {
      safeNonce = (await safe.nonce()).toNumber()
    } else {
      safeNonce++
    }
    await task.log(`     --> Nonce: ${safeNonce}`, 'green')

    const safeTxHash = await safe.getTransactionHash(
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
    await task.log(`     --> Signable hash: ${safeTxHash}`, 'green')

    const sender = hdWallet.getAddresses()[1]
    await task.log(`     --> Sender: ${sender}`, 'green')
    
    const rawSig = ethUtil.ecsign(
      ethUtil.toBuffer(safeTxHash),
      hdWallet.getPrivateKey(sender)
    )
    const signature = ethUtil.bufferToHex(concatSig(rawSig.v, rawSig.r, rawSig.s)).substr(2)
    await task.log(`     --> Signature: ${signature}`, 'green')
      
    const endpoint = `${baseUrl}/${multisig}/propose`

    const tx = {
      baseGas: "0",
      data,
      gasPrice: "0",
      gasToken: ADDRESS_ZERO,
      nonce: `${safeNonce}`,
      operation: 0,
      origin: null,    
      refundReceiver: ADDRESS_ZERO,
      safeTxGas: `${safeTxGas}`,
      safeTxHash,
      sender: accounts[1],
      signature,  
      to: contract.address,
      value: "0",
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
    await execMethod({ ctx, task, contract }, method, ...args)
  }
}



export const getDeployedContractInstance = async(ctx, { lookupType, type }) => {
  const { network, log  } = ctx

  let inst

  await log.task(`Loading ${lookupType} address from deployed address list for network ${network.id}`, async task => {
    inst = await getContractAt(ctx, type, _.get(deployedAddresses, `${lookupType}.${network.id}.address`))
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