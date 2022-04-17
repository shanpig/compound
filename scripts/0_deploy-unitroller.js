const { ethers } = require('hardhat');
const {
  readDeploymentData,
  writeDeploymentData,
} = require('./deploymentDataManipulation');

const deploy = async () => {
  console.log('Deploying...');
  const Unitroller = await ethers.getContractFactory('Unitroller');
  const unitroller = await Unitroller.deploy();

  console.log('deployed');

  const deploymentData = await readDeploymentData();
  deploymentData.unitrollerAddress = unitroller.address;

  writeDeploymentData(deploymentData);
};

deploy();
