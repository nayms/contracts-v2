const path = require('path')
const got = require('got')
const ethUtil = require('ethereumjs-util')

const { keccak256 } = require('../../utils/functions')
const { ADDRESS_ZERO, BYTES32_ZERO } = require('../../utils/constants')
const { createLog } = require('./log')
const { networks } = require('../../truffle-config.js')
const addresses = require('../../deployedAddresses.json')
const packageJson = require('../../package.json')

const MNEMONIC = (packageJson.scripts.devnet.match(/\'(.+)\'/))[1]

exports.defaultGetTxParams = (txParamsOverride = {}) => Object.assign({
  gasPrice: 1 * 1000000000, // 1 GWEI
}, txParamsOverride)


let safeNonce // keep track of ongoing nonce

exports.execCall = async ({ task, contract, method, args, cfg }) => {
  const { web3, artifacts, accounts, getTxParams = exports.defaultGetTxParams, networkInfo, multisig, hdWallet } = cfg

  if (multisig) {
    await task.log(`   QUEUE: ${method}() on ${contract.address} (multisig: ${multisig})`, 'green')

    let baseUrl 
    switch (networkInfo.id) {
      case 1:
        baseUrl = `https://safe-transaction.mainnet.gnosis.io`
        break
      case 4:
        baseUrl = `https://safe-transaction.rinkeby.gnosis.io`
        break
      default:
        throw new Error(`Cannot use multisig for network ${JSON.stringify(networkInfo)}`)
    }

    const GnosisSafe = await artifacts.require('./GnosisSafe')
    const safe = await GnosisSafe.at(multisig)

    const cm = contract.contract.methods

    const data = cm[method].apply(cm, args).encodeABI()
    await task.log(`     --> Data: ${data}`, 'green')

    const safeTxGas = await cm[method].apply(cm, args).estimateGas({ from: multisig })
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

exports.deploy = async (deployer, txParams, Contract, ...constructorArgs) => {
  Contract.synchronization_timeout = 300 // 2mins

  if (deployer) {
    await deployer.deploy(Contract, ...constructorArgs.concat(txParams))
    return await Contract.deployed()
  } else {
    return await Contract.new(...constructorArgs.concat(txParams))
  }
}

exports.getCurrentInstance = async ({ artifacts, lookupType, type, networkInfo, log }) => {
  log = createLog(log)

  const Type = artifacts.require(`./${type}`)

  let inst

  await log.task(`Loading ${lookupType} address from deployed address list for network ${networkInfo.id}`, async task => {
    inst = await Type.at(_.get(addresses, `${lookupType}.${networkInfo.id}.address`))
    task.log(`Instance: ${inst.address}`)
  })

  return inst
}


exports.getMatchingNetwork = ({ network_id, name }) => {
  let match

  if (name) {
    match = Object.keys(networks).find(k => k === name)
  } else if (network_id) {
    match = Object.keys(networks).find(k => networks[k].network_id == network_id)
  }

  if (!match) {
    throw new Error(`Could not find matching network for either ${network_id} OR ${name}`)
  }

  return Object.assign({
    name: match,
    id: networks[match].network_id,
  }, networks[match], {
    isLocal: (networks[match].network_id == '*' || networks[match].network_id > 50)
  })
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