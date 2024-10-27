import hre from "hardhat";
import { TESTNET_ENTRYPOINT_ADDRESS } from "../utils/address";

const main = async () => deployTestNet();

async function deployLocal() {
  const af = await hre.ethers.deployContract("AccountFactory");
  await af.waitForDeployment();

  const ep = await hre.ethers.deployContract("EntryPoint");
  await ep.waitForDeployment();

  const verifiedSigner = await hre.ethers.provider.getSigner(19);

  const pm = await hre.ethers.deployContract(
    "Paymaster",
    [ep.target, verifiedSigner.address],
    {
      from: verifiedSigner,
    }
  );
  await pm.waitForDeployment();

  console.log(`AF deployed to ${af.target}`);
  console.log(`EP deployed to ${ep.target}`);
  console.log(`PM deployed to ${pm.target}`);
}

async function deployTestNet() {
  const verifiedSigner = await hre.ethers.provider.getSigner(1);
  console.log(await verifiedSigner.getAddress());

  const af = await hre.ethers.deployContract("AccountFactory");
  await af.waitForDeployment();
  const pm = await hre.ethers.deployContract("Paymaster", [
    TESTNET_ENTRYPOINT_ADDRESS,
    verifiedSigner.address,
  ]);
  await pm.waitForDeployment();

  console.log(`AF deployed to ${af.target}`);
  console.log(`PM deployed to ${pm.target}`);
}

main().catch(console.error);
