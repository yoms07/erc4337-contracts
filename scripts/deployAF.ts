import hre from "hardhat";
async function main() {
  const af = await hre.ethers.deployContract("AccountFactory");
  await af.waitForDeployment();

  console.log(`AF deployed to ${af.target}`);
}

main().catch(console.error);
