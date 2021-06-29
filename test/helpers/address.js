const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const getOwner = accounts => accounts[0];

const getUserAddress = (accounts, i) => {
  if (i < 0 || i > 5) throw Error('Index must be between 0 and 5');
  return accounts[5 + i];
};

const getAccountsAsync = web3.eth.getAccounts;

const getRaffleActors = (accounts, i = 0) => ({
  owner: getOwner(accounts),
  user: getUserAddress(accounts, i)
});

const getRaffleActorsAsync = async () => {
  const accounts = await getAccountsAsync();

  return getRaffleActors(accounts);
};

const getBurpTokenActors = accounts => ({
  owner: getOwner(accounts),
  saleWallet: getUserAddress(accounts, 1),
  stakingWallet: getUserAddress(accounts, 2),
  reserveWallet: getUserAddress(accounts, 3),
  teamWallet: getUserAddress(accounts, 4),
  airdorpWallet: getUserAddress(accounts, 5)
});

const getBurpTokenActorsAsync = async () => {
  const accounts = await getAccountsAsync();

  return getBurpTokenActors(accounts);
};

const getStakeActors = accounts => ({
  owner: getOwner(accounts),
  firstUser: getUserAddress(accounts, 1),
  secondUser: getUserAddress(accounts, 2),
  rewardsWallet: getUserAddress(accounts, 3)
});

const getStakeActorsAsync = async () => {
  const accounts = await getAccountsAsync();

  return getStakeActors(accounts);
};

module.exports = {
  ZERO_ADDRESS,
  getUserAddress,
  getOwner,
  getStakeActorsAsync,
  getRaffleActors,
  getRaffleActorsAsync,
  getAccountsAsync,
  getBurpTokenActors,
  getBurpTokenActorsAsync
};
