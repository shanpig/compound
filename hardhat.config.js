const { extendEnvironment } = require('hardhat/config');
const { readDeploymentData } = require('./scripts/deploymentDataManipulation');
const { accounts } = require('./nodes.constant');

require('@nomiclabs/hardhat-ethers');

extendEnvironment((hre) => {
  const buildEnv = async () => {
    const deploymentData = await readDeploymentData();

    console.log('attaching comptroller...');
    const Comptroller = await ethers.getContractFactory('ComptrollerG1');
    const comptroller = await Comptroller.attach(
      deploymentData.comptrollerAddress
    );

    console.log('attaching interest model...');
    const WhitePaperInterestRateModel = await ethers.getContractFactory(
      'WhitePaperInterestRateModel'
    );
    const interestRateModel = await WhitePaperInterestRateModel.attach(
      deploymentData.interestRateModelAddress
    );

    console.log('attaching price oracle...');
    const SimplePriceOracle = await ethers.getContractFactory(
      'SimplePriceOracle'
    );
    const oracle = await SimplePriceOracle.attach(deploymentData.oracleAddress);

    console.log('attaching CEther...');
    const CEther = await ethers.getContractFactory('CEther');
    const cEther = await CEther.attach(deploymentData.cTokenAddresses.CEther);

    console.log('attaching CPig...');
    const CPig = await ethers.getContractFactory('CErc20');
    const cPig = await CPig.attach(deploymentData.cTokenAddresses.CPig);

    console.log('attaching cPig delegate...');
    const Delegate = await ethers.getContractFactory('CErc20Delegate');
    const delegate = await Delegate.attach(deploymentData.delegateAddress);

    console.log('attaching cPig delegator...');
    const Delegator = await ethers.getContractFactory('CErc20Delegator');
    const delegator = await Delegator.attach(deploymentData.delegatorAddress);

    console.log('setting price oracle...');
    await comptroller._setPriceOracle(oracle.address);
    console.log('setting close factor...');
    await comptroller._setCloseFactor(5);
    console.log('setting max assets...');
    await comptroller._setMaxAssets(12);
    console.log('setting liquidation incentive...');
    await comptroller._setLiquidationIncentive(11);

    const tokensAddresses = deploymentData.cTokenAddresses;

    Object.entries(tokensAddresses).forEach(
      async ([cTokenName, cTokenAddress]) => {
        console.log('supporting cToken: ', cTokenName);
        await comptroller._setCollateralFactor(cTokenAddress, 9);
        await comptroller._supportMarket(cTokenAddress);
      }
    );

    console.log('entering markets for tokens...');
    await comptroller.enterMarkets(
      Object.values(deploymentData.cTokenAddresses)
    );

    let value = await cEther.balanceOf(accounts[0].address);
    console.log('current account balance is: ', value);

    console.log('mint cEther for account ', accounts[0].address, '...');
    await cEther.mint({ value: 100 });
    value = await cEther.balanceOf(accounts[0].address);
    console.log('now account balance is: ', value);

    console.log('initialization finished.');
    hre.contractAttached = {
      comptroller,
      interestRateModel,
      oracle,
      cEther,
      accounts,
      cPig,
      delegate,
      delegator,
    };
  };

  hre.buildEnv = buildEnv;
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.5.16',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: 'localhost',
  networks: {
    localhost: {
      url: 'http://localhost:8545',
    },
  },
};
