import hre from "hardhat";
async function main() {
  const ep = await hre.ethers.deployContract("EntryPoint");
  await ep.waitForDeployment();

  console.log(`EP deployed to ${ep.target}`);
}

main().catch(console.error);
