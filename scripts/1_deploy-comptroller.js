const { ethers } = require('hardhat');
const {
  readDeploymentData,
  writeDeploymentData,
} = require('./deploymentDataManipulation');

const deploy = async () => {
  console.log('Deploying...');
  const Comptroller = await ethers.getContractFactory('ComptrollerG1');
  const comptroller = await Comptroller.deploy();

  console.log('deployed');

  const deploymentData = await readDeploymentData();
  deploymentData.comptrollerAddress = comptroller.address;

  writeDeploymentData(deploymentData);
};

deploy();
