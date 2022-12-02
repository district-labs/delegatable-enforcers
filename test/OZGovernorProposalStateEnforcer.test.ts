import { ethers, network, artifacts } from 'hardhat';
import { expect } from 'chai';
import { Provider } from '@ethersproject/providers';
import { BigNumber, Contract, ContractFactory, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// @ts-ignore
import { generateUtil } from 'eth-delegatable-utils';
import { getPrivateKeys } from '../utils/getPrivateKeys';
import { generateDelegation } from './utils';
import { deployMockContract, MockContract } from 'ethereum-waffle';

const { getSigners } = ethers;

describe('OZGovernorProposalStateEnforcer', () => {
  const CONTACT_NAME = 'ERC20Delegatable';
  let CONTRACT_INFO: any;
  let delegatableUtils: any;
  let signer0: SignerWithAddress;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let pk0: string;
  let pk1: string;

  // Smart Contracts
  let OZGovernorProposalStateEnforcer: Contract;
  let OZGovernorProposalStateEnforcerFactory: ContractFactory;
  let ERC20Delegatable: Contract;
  let ERC20DelegatableFactory: ContractFactory;
  let mockGovernor: MockContract;

  before(async () => {
    [signer0] = await getSigners();
    [wallet0, wallet1] = getPrivateKeys(signer0.provider as unknown as Provider);
    ERC20DelegatableFactory = await ethers.getContractFactory('ERC20Delegatable');
    OZGovernorProposalStateEnforcerFactory = await ethers.getContractFactory(
      'OZGovernorProposalStateEnforcer',
    );
    pk0 = wallet0._signingKey().privateKey;
    pk1 = wallet1._signingKey().privateKey;
  });

  beforeEach(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    ERC20Delegatable = await ERC20DelegatableFactory.connect(wallet0).deploy(
      CONTACT_NAME,
      'TRUST',
      ethers.utils.parseEther('1'),
    );

    let oracleArtifact = await artifacts.readArtifact('IGovernor');
    mockGovernor = await deployMockContract(wallet0, oracleArtifact.abi);

    OZGovernorProposalStateEnforcer = await OZGovernorProposalStateEnforcerFactory.connect(
      wallet0,
    ).deploy();

    CONTRACT_INFO = {
      chainId: ERC20Delegatable.deployTransaction.chainId,
      verifyingContract: ERC20Delegatable.address,
      name: CONTACT_NAME,
    };
    delegatableUtils = generateUtil(CONTRACT_INFO);
  });

  it('should SUCCEED to INVOKE method if desiredState is equal to Governor.ProposalState', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let governorAddress = mockGovernor.address;
    let proposalId = '0000000000000000000000000000000000000000000000000000000000000000';
    let desiredState = '04';

    let inputTerms = governorAddress + proposalId + desiredState;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: OZGovernorProposalStateEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockGovernor.mock.state.returns(4);

    await ERC20Delegatable.invoke([
      {
        signature: invocation.signature,
        invocations: invocation.invocations,
      },
    ]);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('0.5'));
  });
  it('should FAIL to INVOKE method if desiredState is NOT [0,7]', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let governorAddress = mockGovernor.address;
    let proposalId = '0000000000000000000000000000000000000000000000000000000000000000';
    let desiredState = '04';

    let inputTerms = governorAddress + proposalId + desiredState;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: OZGovernorProposalStateEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockGovernor.mock.state.returns(3);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('OZGovernorProposalStateEnforcer:desiredState not reached');
  });
  it('should FAIL to INVOKE method if desiredState is NOT equal to Governor.ProposalState', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let governorAddress = mockGovernor.address;
    let proposalId = '0000000000000000000000000000000000000000000000000000000000000000';
    let desiredState = '08';

    let inputTerms = governorAddress + proposalId + desiredState;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: OZGovernorProposalStateEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockGovernor.mock.state.returns(3);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith(
      'OZGovernorProposalStateEnforcer:desiredStatus infeasible, must be [0, 7]',
    );
  });
  it('should FAIL to INVOKE method if governor address wrong', async () => {
    const PK = wallet0._signingKey().privateKey.substring(2);
    expect(await ERC20Delegatable.balanceOf(wallet0.address)).to.eq(ethers.utils.parseEther('1'));

    let governorAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // wrong address
    let proposalId = '0000000000000000000000000000000000000000000000000000000000000000';
    let desiredState = '04';

    let inputTerms = governorAddress + proposalId + desiredState;

    const _delegation = generateDelegation(CONTACT_NAME, ERC20Delegatable, PK, wallet1.address, [
      {
        enforcer: OZGovernorProposalStateEnforcer.address,
        terms: inputTerms,
      },
    ]);
    const INVOCATION_MESSAGE = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [
        {
          authority: [_delegation],
          transaction: {
            to: ERC20Delegatable.address,
            gasLimit: '210000000000000000',
            data: (
              await ERC20Delegatable.populateTransaction.transfer(
                wallet1.address,
                ethers.utils.parseEther('0.5'),
              )
            ).data,
          },
        },
      ],
    };
    const invocation = delegatableUtils.signInvocation(INVOCATION_MESSAGE, pk1);

    await mockGovernor.mock.state.returns(4);

    await expect(
      ERC20Delegatable.invoke([
        {
          signature: invocation.signature,
          invocations: invocation.invocations,
        },
      ]),
    ).to.be.revertedWith('function returned an unexpected amount of data');
  });
});
