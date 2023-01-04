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

async function getPermitSignature(signer, token, spender, value, deadline) {
  const [nonce, name, version, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    '1',
    signer.getChainId(),
  ]);

  return ethers.utils.splitSignature(
    await signer._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: 'owner',
            type: 'address',
          },
          {
            name: 'spender',
            type: 'address',
          },
          {
            name: 'value',
            type: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
          },
          {
            name: 'deadline',
            type: 'uint256',
          },
        ],
      },
      {
        owner: signer.address,
        spender,
        value,
        nonce,
        deadline,
      },
    ),
  );
}

describe('DistrictERC20SubscriptionsEnforcer', () => {
  const CONTRACT_NAME = 'ERC20PermitSubscriptions';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;

  let signer0: SignerWithAddress;
  let signer1: SignerWithAddress;
  let verifyingContract: Contract;
  let verifyingContractFactory: ContractFactory;
  let erc20PermitTokenFactory: ContractFactory;
  let erc20PermitToken: Contract;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;
  let districtERC20SubscriptionsEnforcer: Contract;
  let districtERC20SubscriptionsEnforcerFactory: ContractFactory;
  let districtApproveERC20PermitEnforcer: Contract;
  let districtApproveERC20PermitEnforcerFactory: ContractFactory;

  before(async () => {
    [signer0, signer1] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider); //
    console.log(signer0.address);
    console.log(wallet0.address);
    verifyingContractFactory = await ethers.getContractFactory(
      'VerifyingContractERC20PermitSubscriptions',
    );
    erc20PermitTokenFactory = await ethers.getContractFactory('TokenPermit');
    districtERC20SubscriptionsEnforcerFactory = await ethers.getContractFactory(
      'DistrictERC20PermitSubscriptionsEnforcer',
    );
    districtApproveERC20PermitEnforcerFactory = await ethers.getContractFactory(
      'DistrictApproveERC20PermitEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
    console.log(pk0);
  });
  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    erc20PermitToken = await erc20PermitTokenFactory.connect(wallet0).deploy();
    await erc20PermitToken.deployed();

    verifyingContract = await verifyingContractFactory
      .connect(wallet0)
      .deploy(CONTRACT_NAME, erc20PermitToken.address, 1);
    await verifyingContract.deployed();

    districtERC20SubscriptionsEnforcer = await districtERC20SubscriptionsEnforcerFactory
      .connect(wallet0)
      .deploy();

    districtApproveERC20PermitEnforcer = await districtApproveERC20PermitEnforcerFactory
      .connect(wallet0)
      .deploy();

    CONTRACT_INFO = {
      chainId: verifyingContract.deployTransaction.chainId,
      verifyingContract: verifyingContract.address,
      name: CONTRACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });
  it('should SUCCEED to approveSubscription', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    const _approveDelegation = generateDelegation(
      CONTRACT_NAME,
      verifyingContract,
      pk0,
      wallet1.address,
      [
        {
          enforcer: districtApproveERC20PermitEnforcer.address,
          terms: '0x',
        },
      ],
    );

    const APPROVE_INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_approveDelegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
      ],
    };

    const approveInvocation = delegatableUtils.signInvocation(APPROVE_INVOCATION_MESSAGE, pk1);

    let approveTx = await verifyingContract.invoke([
      {
        signature: approveInvocation.signature,
        invocations: approveInvocation.invocations,
      },
    ]);
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      totalSubscriptionAmount,
    );
  });

  it('should SUCCEED to INVOKE paySubscription', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    const _approveDelegation = generateDelegation(
      CONTRACT_NAME,
      verifyingContract,
      pk0,
      wallet1.address,
      [
        {
          enforcer: districtApproveERC20PermitEnforcer.address,
          terms: '0x',
        },
      ],
    );

    const APPROVE_INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_approveDelegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
      ],
    };

    const approveInvocation = delegatableUtils.signInvocation(APPROVE_INVOCATION_MESSAGE, pk1);

    let subPeriodIn = '0x0000000000000005';
    let inputTerms = subPeriodIn;
    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x02',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    let tx = await verifyingContract.invoke([
      {
        signature: approveInvocation.signature,
        invocations: approveInvocation.invocations,
      },
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await erc20PermitToken.balanceOf(verifyingContract.address)).to.equal(1);
  });

  it('should FAIL to INVOKE paySubscription if early', async () => {
    expect(await erc20PermitToken.allowance(wallet0.address, verifyingContract.address)).to.equal(
      0,
    );
    const deadline = ethers.constants.MaxUint256;
    let totalSubscriptionAmount = 12;
    const { v, r, s } = await getPermitSignature(
      wallet0,
      erc20PermitToken,
      verifyingContract.address,
      totalSubscriptionAmount,
      deadline,
    );

    const _approveDelegation = generateDelegation(
      CONTRACT_NAME,
      verifyingContract,
      pk0,
      wallet1.address,
      [
        {
          enforcer: districtApproveERC20PermitEnforcer.address,
          terms: '0x',
        },
      ],
    );

    const APPROVE_INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_approveDelegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (
              await verifyingContract.populateTransaction.approveSubscription(
                wallet0.address,
                totalSubscriptionAmount,
                deadline,
                v,
                r,
                s,
              )
            ).data,
          },
        },
      ],
    };

    const approveInvocation = delegatableUtils.signInvocation(APPROVE_INVOCATION_MESSAGE, pk1);

    let subPeriodIn = '0x0000000000000005';
    let inputTerms = subPeriodIn;
    const _delegation = generateDelegation(CONTRACT_NAME, verifyingContract, pk0, wallet1.address, [
      {
        enforcer: districtERC20SubscriptionsEnforcer.address,
        terms: inputTerms,
      },
    ]);

    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x02',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    let tx = await verifyingContract.invoke([
      {
        signature: approveInvocation.signature,
        invocations: approveInvocation.invocations,
      },
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await erc20PermitToken.balanceOf(verifyingContract.address)).to.equal(1);
    const INVOCATION_MESSAGE_1 = {
      replayProtection: {
        nonce: '0x03',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: verifyingContract.address,
            gasLimit: '210000000000000000',
            data: (await verifyingContract.populateTransaction.paySubscription()).data,
          },
        },
      ],
    };

    const invocation1 = delegatableUtils.signInvocation(INVOCATION_MESSAGE_1, pk1);

    await expect(
      verifyingContract.invoke([
        {
          signature: invocation1.signature,
          invocations: invocation1.invocations,
        },
      ]),
    ).to.be.revertedWith('DistrictERC20SubscriptionsEnforcer:invalid-subscritpion-time');
  });
});
