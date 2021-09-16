const { createLog } = require('./utils/log')

async function main() {
  const log = createLog(console.log.bind(console))

  const releaseConfig = require('../releaseConfig.json')

  

  // We get the contract to deploy
  const Greeter = await ethers.getContractFactory("Greeter")
  const greeter = await Greeter.deploy("Hello, Hardhat!")

  console.log("Greeter deployed to:", greeter.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })