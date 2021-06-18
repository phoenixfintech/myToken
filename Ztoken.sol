/**
 * MIT License
 * ===========
 *
 * Copyright (c) 2021 Phoenix
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract TokenInterface {
    function balanceOf(address account) external view virtual returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        virtual
        returns (bool success);
}

/**
 * @dev interface defining the TokenRecipient
 */
interface TokenRecipient {
    function tokenFallback(
        address _from,
        uint256 _value,
        bytes calldata data
    ) external;
}

/**
 * @title ZToken
 * @author Phoenix
 * @notice Contract for the ZToken
 * @dev All function calls are currently implemented without side effects
 */
contract ZToken is Ownable, ERC20, TokenRecipient {
    // attach library functions
    using SafeMath for uint256;
    using SafeERC20 for TokenInterface;
    using Address for address;

    //event
    event CommssionUpdate(
        uint256 _numerator,
        uint256 _denominator,
        string _data
    );
    event TransferPreSigned(address _from, address _to, uint256 _value, uint256 _networkFee);

    //public variables
    TokenInterface private backedTokenContract;

    //private variables
    uint8 private decimal = 8;

    // These variable help to calculate the commissions on each token transfer transcation
    uint256 public commission_numerator_minting = 1; // commission percentage on minting 0.025%
    uint256 public commission_denominator_minting = 4;

    uint256 public commission_numerator_zcrw = 1; // commission percentage to zowner 0.005%
    uint256 public commission_denominator_zcrw = 200;

    uint256 public commission_numerator_phoenix_crw = 1; // commission percentage to zowner 0.005%
    uint256 public commission_denominator_phoenix_crw = 200;

    // addresses at which fees transferred
    address public phoenixCrw; // Z commission to phoenixCRW
    address public zCrw; // Z commission to ZCRW

    // tokens minted in this wallet
    address public sellingWallet;

    constructor(
        address _goldTokenAddress,
        address _phoenixCrw,
        address _zcrw,
        address _sellingWallet
    )
        isContractaAddress(_goldTokenAddress)
        onlyNonZeroAddress(_phoenixCrw)
        onlyNonZeroAddress(_zcrw)
        onlyNonZeroAddress(_sellingWallet)
        ERC20("ZToken", "ZT")
    {
        backedTokenContract = TokenInterface(_goldTokenAddress);
        phoenixCrw = _phoenixCrw;
        zCrw = _zcrw;
        sellingWallet = _sellingWallet;
    }

    ////////////////////////////////////////////////////////////////
    //                 modifiers
    ////////////////////////////////////////////////////////////////

    modifier onlyNonZeroAddress(address _user) {
        require(_user != address(0), "Zero address not allowed");
        _;
    }

    modifier onlyTokenContract() {
        require(
            msg.sender == address(backedTokenContract),
            "Only Token contract is allowed"
        );
        _;
    }

    modifier isContractaAddress(address _addressContract) {
        require(
            _addressContract.isContract(),
            "Only Token contract is allowed"
        );
        _;
    }

    modifier onlyPhoenix {
        require(msg.sender == phoenixCrw, "Only Phoenix is allowed");
        _;
    }

    ////////////////////////////////////////////////////////////////
    //                  Only Owner functions
    ////////////////////////////////////////////////////////////////

    /**
     * @notice transfer tokens from contract 
     * @dev Only owner can call, tokens will be transferred and equivalent amount of ZToken will be burnt.
     * @param _amount the amount of tokens to be transferred
     * @param _receiver address of the receiver

     */
    function transferToken(uint256 _amount, address _receiver)
        external
        onlyOwner
        onlyNonZeroAddress(_receiver)
    {
        require(
            backedTokenContract.balanceOf(address(this)) >= _amount,
            "Insufficiet balance of token"
        );
        backedTokenContract.transfer(_receiver, _amount);
        _burn(msg.sender, _amount);
    }

    /**
     * @notice Function called by token contract whenever tokens are deposited to this contract
     * @dev Only token contract can call.
     * @param _from Who transferred, not utlised
     * @param _value The amount transferred
     * @param data The data supplied by token contract. It will be ignored
     */
    function tokenFallback(
        address _from,
        uint256 _value,
        bytes calldata data
    ) external override onlyTokenContract {
        uint256 fee = calculateCommissionMint(_value);
        if (fee > 0) _mint(phoenixCrw, fee);
        _mint(sellingWallet, _value.sub(fee));
    }

    ////////////////////////////////////////////////////////////////
    //                  overriden functions
    ////////////////////////////////////////////////////////////////
    function decimals() public view virtual override returns (uint8) {
        return decimal;
    }


    /**
     * @notice Standard transfer function to Transfer token
     * @dev overriden Function of the openzeppelin ERC20 contract
     * @param recipient receiver's address
     * @param amount The amount to be transferred
     */
    function transfer(address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        privateTransfer(msg.sender, recipient, amount);
        return true;
    }
    
    /**
     * @notice Standard transferFrom. Send tokens on behalf of spender
     * @dev overriden Function of the openzeppelin ERC20 contract
     * @param recipient receiver's address
     * @param sender transfer token from account
     * @param amount The amount to be transferred
     */
    function transferFrom(address sender, address recipient, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        uint256 currentAllowance = allowance(sender, _msgSender());
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _approve(sender, _msgSender(), currentAllowance - amount);
        privateTransfer(sender, recipient, amount);
        return true;
    }
    

    /**
     * @notice Internal method to handle transfer logic
     * @dev Notifies recipient, if recipient is a trusted contract
     * @param _from Sender address
     * @param _recipient Recipient address
     * @param _amount amount of tokens to be transferred
     * @return bool
     */
    function privateTransfer(address _from, address _recipient, uint256 _amount)
        internal
        onlyNonZeroAddress(_recipient)
        returns (bool)
    {
        uint256 feeToOlegacy = calculateCommissionPhoenixCrw(_amount);
        uint256 feeToZowner = calculateCommissionToZCrw(_amount);

        if (feeToOlegacy > 0) _transfer(_from, phoenixCrw, feeToOlegacy);
        if (feeToZowner > 0) _transfer(_from, zCrw, feeToZowner);
        uint256 amount_credit = feeToZowner.add(feeToOlegacy);
        _transfer(_from, _recipient, _amount.sub(amount_credit));
        return true;
    } 
 
    /**
     * @notice update phoenix wallet address. This address will be responsible for holding commission on tokens transfer
     * @dev Only Phoenix can call
     * @param _user The address of phoenixCrw wallet
     * @return Bool value
     */
    function updatePhoenixAddress(address _user)
        external
        onlyPhoenix
        returns (bool)
    {
        phoenixCrw = _user;
        return true;
    }

    /**
     * @notice check Minting fee
     * @dev Does not checks if sender/recipient is whitelisted
     * @param _amount The intended amount of transfer
     * @return uint256 Calculated commission
     */
    function calculateCommissionMint(uint256 _amount)
        public
        view
        returns (uint256)
    {
        return
            _amount
                .mul(commission_numerator_minting)
                .div(commission_denominator_minting)
                .div(100);
    }

    /**
     * @notice check transer fee credited to ZToken owner
     * @param _amount The intended amount of transfer
     * @return uint256 Calculated commission
     */
    function calculateCommissionToZCrw(uint256 _amount)
        public
        view
        returns (uint256)
    {
        return
            _amount
                .mul(commission_numerator_zcrw)
                .div(commission_denominator_zcrw)
                .div(100);
    }

    /**
     * @notice check transer fee credited to Phoenix
     * @param _amount The intended amount of transfer
     * @return uint256 Calculated commission
     */
    function calculateCommissionPhoenixCrw(uint256 _amount)
        public
        view
        returns (uint256)
    {
        return
            _amount
                .mul(commission_numerator_phoenix_crw)
                .div(commission_denominator_phoenix_crw)
                .div(100);
    }

    /**
     * @notice Update commission to be charged on each token transfer for Phoenix
     * @dev Only Phoenix Owner can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionPhoenixTransfer(uint256 _n, uint256 _d)
        public
        onlyPhoenix
    {
        commission_denominator_phoenix_crw = _d;
        commission_numerator_phoenix_crw = _n;
        emit CommssionUpdate(_n, _d, "Phoenix commission");
    }

    /**
     * @notice Update commission to be charged on each token transfer for Z owner
     * @dev Only owner can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionZTranfer(uint256 _n, uint256 _d) public onlyOwner {
        commission_denominator_zcrw = _d;
        commission_numerator_zcrw = _n;
        emit CommssionUpdate(_n, _d, "Z owner's commission");
    }

    /**
     * @notice Update commission to be charged on token minting
     * @dev Only phoenix can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionMint(uint256 _n, uint256 _d) public onlyPhoenix {
        commission_denominator_minting = _d;
        commission_numerator_minting = _n;
        emit CommssionUpdate(_n, _d, "Minting commision");
    }
    
    
    /**
     * @notice Prevents contract from accepting ETHs
     * @dev Contracts can still be sent ETH with self destruct. If anyone deliberately does that, the ETHs will be lost
     */
    receive() external payable {
        revert("Contract does not accept ethers");
    }
    
    
}

/**
 * @title AdvancedOToken
 * @author Phoenix 
 */    
contract AdvancedZToken is ZToken {
    mapping(address => mapping(bytes32 => bool)) public tokenUsed; // mapping to track token is used or not
    
    bytes4 public methodWord_transfer = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 public methodWord_approve = bytes4(keccak256("approve(address,uint256)"));
    bytes4 public methodWord_increaseApproval = bytes4(keccak256("increaseAllowance(address,uint256)"));
    bytes4 public methodWord_decreaseApproval = bytes4(keccak256("decreaseAllowance(address,uint256)"));

    using SafeMath for uint256;

    constructor(
        address _goldTokenAddress,
        address _phoenixCrw,
        address _zcrw,
        address _sellingWallet)  ZToken( _goldTokenAddress, _phoenixCrw, _zcrw, _sellingWallet) {
    }

    /**
    * @dev ID of the executing chain
    * @return uint value
     */
    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    /**
     * @notice Validates the message and signature
     * @param proof The message that was expected to be signed by user
     * @param message The message that user signed
     * @param r Signature component
     * @param s Signature component
     * @param v Signature component
     * @param token The unique token for each delegated function
     * @return address Signer of message
     */
    function preAuthValidations(bytes32 proof, bytes32 message, bytes32 token, bytes32 r, bytes32 s, uint8 v)
        private
        returns(address)
    {
        address signer = getSigner(message, r, s, v);
        require(signer != address(0),"Zero address not allowed");
        require(!tokenUsed[signer][token],"Token already used");
        require(proof == message, "Invalid proof");
        tokenUsed[signer][token] = true;
        return signer;
    }

    /**
     * @notice Find signer
     * @param message The message that user signed
     * @param r Signature component
     * @param s Signature component
     * @param v Signature component
     * @return address Signer of message
     */
    function getSigner(bytes32 message, bytes32 r, bytes32 s, uint8 v)
        public
        pure
        returns (address)
    {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, message));
        address signer = ecrecover(prefixedHash, v, r, s);
        return signer;
    }

     /**
     * @notice Delegated transfer. Gas fee will be paid by relayer
     * @param message The message that user signed
     * @param r Signature component
     * @param s Signature component
     * @param v Signature component
     * @param token The unique token for each delegated function
     * @param networkFee The fee that will be paid to relayer for gas fee he spends
     * @param to The array of recipients
     * @param amount The array of amounts to be transferred
     */
    function preAuthorizedTransfer(
        bytes32 message, bytes32 r, bytes32 s, uint8 v, bytes32 token, uint256 networkFee, address to, uint256 amount)
        public
    {
        bytes32 proof = getProofTransfer(methodWord_transfer, token, networkFee, msg.sender, to, amount);
        address signer = preAuthValidations(proof, message, token, r, s, v);

        // Deduct network fee if broadcaster charges network fee
        if (networkFee > 0) {
            privateTransfer(signer, msg.sender, networkFee);
        }
        privateTransfer(signer, to, amount);
        emit TransferPreSigned(signer, to, amount, networkFee);
    }

    /**
     * @notice Delegated approval. Gas fee will be paid by relayer
     * @dev Only approve, increaseApproval and decreaseApproval can be delegated
     * @param message The message that user signed
     * @param r Signature component
     * @param s Signature component
     * @param v Signature component
     * @param token The unique token for each delegated function
     * @param networkFee The fee that will be paid to relayer for gas fee he spends
     * @param to The spender address
     * @param amount The amount to be allowed
     * @return Bool value
     */
    function preAuthorizedApproval(
        bytes4 methodHash, bytes32 message, bytes32 r, bytes32 s, uint8 v, bytes32 token, uint256 networkFee, address to, uint256 amount)
        public
        returns (bool)
    {
        bytes32 proof = getProofApproval (methodHash, token, networkFee, msg.sender, to, amount);
        address signer = preAuthValidations(proof, message, token, r, s, v);
        uint256 currentAllowance = allowance(signer, _msgSender());
        // Perform approval
        if(methodHash == methodWord_approve) _approve(signer, to, amount);
        else if(methodHash == methodWord_increaseApproval) _approve(signer, to, currentAllowance.add(amount));
        else if(methodHash == methodWord_decreaseApproval) _approve(signer, to, currentAllowance.sub(amount));
        return true;
    }

    /**
     * @notice Get the message to be signed in case of delegated transfer/approvals
     * @param methodHash The method hash for which delegate action in to be performed
     * @param token The unique token for each delegated function
     * @param networkFee The fee that will be paid to relayer for gas fee he spends
     * @param to The recipient or spender
     * @param amount The amount to be transferred
     * @return Bool value
     */
    function getProofTransfer(bytes4 methodHash, bytes32 token, uint256 networkFee, address broadcaster, address to, uint256 amount)
        public
        view
        returns (bytes32)
    {
        require(methodHash == methodWord_transfer, "Method not supported");
        bytes32 proof = keccak256(abi.encodePacked(
            getChainID(),
            bytes4(methodHash),
            address(this),
            token,
            networkFee,
            broadcaster,
            to,
            amount
    ));
        return proof;
    }

    /**
     * @notice Get the message to be signed in case of delegated transfer/approvals
     * @param methodHash The method hash for which delegate action in to be performed
     * @param token The unique token for each delegated function
     * @param networkFee The fee that will be paid to relayer for gas fee he spends
     * @param to The recipient or spender
     * @param amount The amount to be approved
     * @return Bool value
     */
    function getProofApproval(bytes4 methodHash, bytes32 token, uint256 networkFee, address broadcaster, address to, uint256 amount)
        public
        view
        returns (bytes32)
    {
        require(
            methodHash == methodWord_approve ||
            methodHash == methodWord_increaseApproval ||
            methodHash == methodWord_decreaseApproval,
            "Method not supported");
        bytes32 proof = keccak256(abi.encodePacked(
            getChainID(),
            bytes4(methodHash),
            address(this),
            token,
            networkFee,
            broadcaster,
            to,
            amount
        ));
        return proof;
    }
    
}