const { ethers } = require('hardhat');
const {
  readDeploymentData,
  writeDeploymentData,
} = require('./deploymentDataManipulation');

const deploy = async (tokenName) => {
  console.log('Deploying...');
  const ERC = await ethers.getContractFactory('CErc20');

  const deploymentData = await readDeploymentData();

  const token = await ERC.deploy();

  deploymentData.cTokenAddresses = {
    ...deploymentData.cTokenAddresses,
    [tokenName]: token.address,
  };

  console.log('token ', tokenName, ' deployed at: ', token.address);

  writeDeploymentData(deploymentData);
};

deploy('CPig').catch((error) => console.log(error));
