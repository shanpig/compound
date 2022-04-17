const { ethers } = require('hardhat');
const {
  readDeploymentData,
  writeDeploymentData,
} = require('./deploymentDataManipulation');

const deploy = async (interestRateModalContractName) => {
  console.log('Deploying interest rate model...');
  const InterestRateModel = await ethers.getContractFactory(
    interestRateModalContractName
  );

  const deploymentData = await readDeploymentData();

  const interestRateModel = await InterestRateModel.deploy(1, 1);
  console.log('Interest rate model deployed');

  deploymentData.interestRateModelAddress = interestRateModel.address;
  writeDeploymentData(deploymentData);
};

deploy('WhitePaperInterestRateModel');
