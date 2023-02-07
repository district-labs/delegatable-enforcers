import { ethers, network, artifacts } from 'hardhat';
import { expect } from 'chai';
import { Provider } from '@ethersproject/providers';
import { Contract, ContractFactory, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// @ts-ignore
import { generateUtil } from 'eth-delegatable-utils';
import { getPrivateKeys } from '../utils/getPrivateKeys';
import { generateDelegation } from './utils';
import { deployMockContract, MockContract } from 'ethereum-waffle';

const { getSigners } = ethers;

describe('DistrictERC20StreamPaymentsEnforcer', () => {
  const CONTRACT_NAME = 'ERC20StreamPayments';
  let ENFORCER_NAME = 'DistrictERC20StreamPaymentsEnforcer';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;

  let signer0: SignerWithAddress;
  let signer1: SignerWithAddress;
  let verifyingContract: Contract;
  let verifyingContractFactory: ContractFactory;
  let erc20TokenFactory: ContractFactory;
  let erc20Token: Contract;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;
  let districtERC20StreamPaymentsEnforcer: Contract;
  let districtERC20StreamPaymentsEnforcerFactory: ContractFactory;

  before(async () => {
    [signer0, signer1] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider); //
    verifyingContractFactory = await ethers.getContractFactory(
      'VerifyingContractERC20StreamPayments',
    );
    erc20TokenFactory = await ethers.getContractFactory('Token');
    districtERC20StreamPaymentsEnforcerFactory = await ethers.getContractFactory(
      'DistrictERC20StreamPaymentsEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    erc20Token = await erc20TokenFactory.connect(wallet0).deploy();
    await erc20Token.deployed();

    let tokensPerSecond = 1;
    verifyingContract = await verifyingContractFactory
      .connect(wallet0)
      .deploy(CONTRACT_NAME, tokensPerSecond, erc20Token.address);
    await verifyingContract.deployed();

    districtERC20StreamPaymentsEnforcer = await districtERC20StreamPaymentsEnforcerFactory
      .connect(wallet0)
      .deploy();

    CONTRACT_INFO = {
      chainId: verifyingContract.deployTransaction.chainId,
      verifyingContract: verifyingContract.address,
      name: CONTRACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to INVOKE withdrawFromStream', async () => {
    let amount = 100;
    let tokensRequested = 1;
    expect(await erc20Token.allowance(wallet0.address, verifyingContract.address)).to.equal(0);
    let tx = await erc20Token.connect(wallet0).approve(verifyingContract.address, amount);
    expect(await erc20Token.allowance(wallet0.address, verifyingContract.address)).to.equal(amount);

    let recipient = wallet1.address;
    let verifierAddress = verifyingContract.address.substring(2, 42);
    let startStreamTimestamp1 = '0000000000000005';
    let endStreamTimestamp = '0000000000000009';

    let inputTerms =
      recipient + verifierAddress + startStreamTimestamp1 + endStreamTimestamp;

    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20StreamPaymentsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const delegationHash = await verifyingContract.GET_SIGNEDDELEGATION_PACKETHASH(_delegation);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.withdrawFromStream(
                wallet1.address,
                tokensRequested,
              )
            ).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    let tx1 = await verifyingContract.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await erc20Token.balanceOf(wallet1.address)).to.be.eq(tokensRequested);
  });
});
