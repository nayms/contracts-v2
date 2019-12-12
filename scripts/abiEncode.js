#!/usr/bin/env node

/* This script calls abi.encode(keccak256(<input string>)) so that it can be
passed to a contract's fallback function */

const getStdin = require('get-stdin')
const { argv } = require('yargs')
const { AbiCoder } = require('web3-eth-abi')

const abiCoder = new AbiCoder()

const [ contractName, methodName, ...args ] = argv._

const { abi } = require(`../build/contracts/${contractName}.json`)

const functionAbi = abi.find(({ name }) => name === methodName)

if (!functionAbi) {
  throw new Error(`Method ${methodName} not found in ${contractName}`)
}

console.log(abiCoder.encodeFunctionCall(functionAbi, args))
