const { ethers } = require('hardhat');
const fs = require('fs');

const deploy = async () => {
  console.log('Deploying interest rate model...');
  const InterestRateModel = await ethers.getContractFactory(
    'InterestRateModel'
  );

  const interestRateModel = await InterestRateModel.deploy();
  console.log('Interest rate model deployed');
  // use fs to write comptroller address to file 'deployments'
  fs.writeFileSync(
    'deployments.json',
    JSON.stringify({ InterestRateModelAddress: interestRateModel.address })
  );
};

deploy();
