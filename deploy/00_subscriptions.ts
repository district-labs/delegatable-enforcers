import { utils } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function deploy(hardhat: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hardhat;

  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const token = await deploy("TokenPermit", {
    contract: "TokenPermit",
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: false,
    log: true,
  });

  await deploy("DistrictERC20PermitSubscriptionsEnforcer", {
    contract: "DistrictERC20PermitSubscriptionsEnforcer",
    from: deployer,
    args: [],
    skipIfAlreadyDeployed: false,
    log: true,
  });

  await deploy("VerifyingContractERC20PermitSubscriptions", {
    contract: "VerifyingContractERC20PermitSubscriptions",
    from: deployer,
    args: ["DistrictLabs", token.address, utils.parseEther("10")],
    skipIfAlreadyDeployed: false,
    log: true,
  });
}
