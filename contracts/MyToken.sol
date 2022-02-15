// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./access/Ownable.sol";
import "./token/ERC20/utils/SafeERC20.sol";
import "./token/ERC20/ERC20.sol";

abstract contract TokenInterface is IERC20 {
    function balanceOf(address account)
        external
        view
        virtual
        override
        returns (uint256);

    function transfer(address recipient, uint256 amount)
        external
        virtual
        override
        returns (bool success);

    function calculateCommission(uint256 amount)
        external
        view
        virtual
        returns (uint256 bal);

    function transferFrom(address sender, address recipient, uint256 amount)
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
 * @title ERC20 Token
 * @author Phoenix
 * @notice Contract for the Token
 */
contract ERC20Token is Ownable, ERC20, TokenRecipient {
    // attach library functions
    using SafeERC20 for TokenInterface;
    using Address for address;

    //event
    event CommssionUpdate(
        uint256 _numerator,
        uint256 _denominator,
        string _data
    );
    event TransferPreSigned(
        address _from,
        address _to,
        uint256 _value,
        uint256 _networkFee
    );

    //public variables
    TokenInterface private backedTokenContract;

    //private variables
    uint8 private constant decimal = 8;
    bool private migrated;
    bool private paused;
    // These variable help to calculate the commissions on each token transfer transcation
    uint256 public commission_numerator_minting = 1; // commission percentage on minting 0.25%
    uint256 public commission_denominator_minting = 4;

    uint256 public commission_numerator_tokenCrw = 1; // commission percentage to token owner 0.005%
    uint256 public commission_denominator_tokenCrw = 200;

    uint256 public commission_numerator_phoenix_crw = 1; // commission percentage to token owner 0.005%
    uint256 public commission_denominator_phoenix_crw = 200;

    // addresses at which fees transferred
    address public phoenixCrw; // token commission to phoenixCRW
    address public myTokenCrw; // token commission to token Central revenue wallet

    // tokens minted in this wallet when backed token is received
    address public sellingWallet;

    constructor(
        address _goldTokenAddress,
        address _phoenixCrw,
        address _mytokencrw,
        address _sellingWallet,
        string memory _name,
        string memory _symbol
    )
        isContractAddress(_goldTokenAddress)
        onlyNonZeroAddress(_phoenixCrw)
        onlyNonZeroAddress(_mytokencrw)
        onlyNonZeroAddress(_sellingWallet)
        ERC20(_name, _symbol)
    {
        backedTokenContract = TokenInterface(_goldTokenAddress);
        phoenixCrw = _phoenixCrw;
        myTokenCrw = _mytokencrw;
        sellingWallet = _sellingWallet;
        migrated = false;
        paused = false;
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

    modifier isContractAddress(address _addressContract) {
        require(_addressContract.isContract(), "Only contract is allowed");
        _;
    }

    modifier onlyPhoenix() {
        require(msg.sender == phoenixCrw, "Only Phoenix is allowed");
        _;
    }

    modifier isNotPaused {
        require(paused == false, "Operations paused");
        _;
    }
    ////////////////////////////////////////////////////////////////
    //                  Only Owner functions
    ////////////////////////////////////////////////////////////////

    /**
     * @notice transfer tokens from contract 
     * @dev Only owner can call, tokens will be transferred and equivalent amount of Token will be burnt from owner address.
     * @param _amount the amount of tokens to be transferred
     * @param _receiver address of the receiver

     */
    function transferToken(uint256 _amount, address _receiver)
        external
        onlyOwner
        onlyNonZeroAddress(_receiver)
        isNotPaused
    {
        require(
            backedTokenContract.balanceOf(address(this)) >= _amount,
            "Insufficiet balance of token"
        );
        backedTokenContract.transfer(_receiver, _amount);
        uint256 commission = backedTokenContract.calculateCommission(_amount);
        _burn(sellingWallet, _amount + commission);
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
    ) external override onlyTokenContract isNotPaused {
        uint256 fee = calculateCommissionMint(_value);
        if (fee > 0) _mint(phoenixCrw, fee);
        _mint(sellingWallet, _value - fee);
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
        isNotPaused
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
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override isNotPaused returns (bool) {
        uint256 currentAllowance = allowance(sender, _msgSender());
        require(
            currentAllowance >= amount,
            "ERC20: transfer amount exceeds allowance"
        );
        _approve(sender, _msgSender(), currentAllowance - amount);
        privateTransfer(sender, recipient, amount);
        return true;
    }

    /**
    * @notice Backed token contract migration function
    * @dev Replaces old tokens by the new one, can be called only once,
    * old tokens receiver is the contract owner, new tokens supplier is the contract owner
    * @param _newGoldAddress New backed contract address
    */
    function migrateGoldToken(address _newGoldAddress) public
    onlyOwner
    isContractAddress(_newGoldAddress)
    onlyNonZeroAddress(_newGoldAddress)
    returns(bool) {
        require(migrated == false, "Token already migrated");
        require(_newGoldAddress != address(backedTokenContract), "Same address is not allowed");
        uint256 balance = backedTokenContract.balanceOf(address(this));
        backedTokenContract.transfer(owner(), balance);
        backedTokenContract = TokenInterface(_newGoldAddress);
        backedTokenContract.transferFrom(owner(), address(this), balance);
        require(balance == backedTokenContract.balanceOf(address(this)), "Migration: operation error");
        migrated = true;
        paused = false;
        return true;
    }

    /**
    * @notice Private method to pause or unpause token operations
    * @param _value Bool variable that indicates the contract state
    */
    function pauseTransfers(bool _value) public onlyOwner returns(bool) {
        paused = _value;
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
    function privateTransfer(
        address _from,
        address _recipient,
        uint256 _amount
    ) internal onlyNonZeroAddress(_recipient) returns (bool) {
        uint256 feeToPhoenix = calculateCommissionPhoenixCrw(_amount);
        uint256 feeMyTokenOwner = calculateCommissionMyTokenCrw(_amount);

        if (feeToPhoenix > 0) _transfer(_from, phoenixCrw, feeToPhoenix);
        if (feeMyTokenOwner > 0) _transfer(_from, myTokenCrw, feeMyTokenOwner);
        uint256 amount_credit = feeMyTokenOwner + feeToPhoenix;
        _transfer(_from, _recipient, _amount - amount_credit);
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
        return _amount * commission_numerator_minting / commission_denominator_minting / 100;
    }

    /**
     * @notice check transer fee credited to Token owner
     * @param _amount The intended amount of transfer
     * @return uint256 Calculated commission
     */
    function calculateCommissionMyTokenCrw(uint256 _amount)
        public
        view
        returns (uint256)
    {
            return _amount * commission_numerator_tokenCrw / commission_denominator_tokenCrw / 100;
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
        return _amount * commission_numerator_phoenix_crw / commission_denominator_phoenix_crw / 100;
    }

    /**
     * @notice Update commission to be charged on each token transfer for Phoenix
     * @dev Only Phoenix Owner can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionPhoenixTransfer(uint256 _n, uint256 _d)
        external
        onlyPhoenix
    {
        commission_denominator_phoenix_crw = _d;
        commission_numerator_phoenix_crw = _n;
        emit CommssionUpdate(_n, _d, "Phoenix commission");
    }

    /**
     * @notice Update commission to be charged on token transfer
     * @dev Only owner can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionMyTokenTranfer(uint256 _n, uint256 _d)
        external
        onlyOwner
    {
        commission_denominator_tokenCrw = _d;
        commission_numerator_tokenCrw = _n;
        emit CommssionUpdate(_n, _d, "MyToken owner's commission");
    }

    /**
     * @notice Update commission to be charged on token minting
     * @dev Only phoenix can call
     * @param _n The numerator of commission
     * @param _d The denominator of commission
     */
    function updateCommssionMint(uint256 _n, uint256 _d) external onlyPhoenix {
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

    /**
     * @notice Owner can transfer out any accidentally sent ERC20 tokens accept OTokens
     * @param _tokenAddress The contract address of ERC-20 compitable token
     * @param _value The number of tokens to be transferred to owner
     */
    function transferAnyERC20Token(address _tokenAddress, uint256 _value)
        external
        onlyOwner
    {
        require(
            _tokenAddress != address(backedTokenContract),
            "Can not withdraw Backed Token"
        );
        TokenInterface(_tokenAddress).safeTransfer(owner(), _value);
    }
}

/**
 * @title AdvancedOToken
 * @author Phoenix
 */
contract MyToken is ERC20Token {
    mapping(address => mapping(bytes32 => bool)) public tokenUsed; // mapping to track token is used or not

    bytes4 public constant methodWord_transfer =
        bytes4(keccak256("transfer(address,uint256)"));
    bytes4 public constant methodWord_approve =
        bytes4(keccak256("approve(address,uint256)"));
    bytes4 public constant methodWord_increaseApproval =
        bytes4(keccak256("increaseApproval(address,uint256)"));
    bytes4 public constant methodWord_decreaseApproval =
        bytes4(keccak256("decreaseApproval(address,uint256)"));


    constructor(
        address _goldTokenAddress,
        address _phoenixCrw,
        address _tokenCrw,
        address _sellingWallet,
        string memory _name,
        string memory _symbol
    )
        ERC20Token(
            _goldTokenAddress,
            _phoenixCrw,
            _tokenCrw,
            _sellingWallet,
            _name,
            _symbol
        )
    {}

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
    function preAuthValidations(
        bytes32 proof,
        bytes32 message,
        bytes32 token,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) private returns (address) {
        address signer = getSigner(message, r, s, v);
        require(signer != address(0), "Zero address not allowed");
        require(!tokenUsed[signer][token], "Token already used");
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
    function getSigner(
        bytes32 message,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) public pure returns (address) {
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
        bytes32 message,
        bytes32 r,
        bytes32 s,
        uint8 v,
        bytes32 token,
        uint256 networkFee,
        address to,
        uint256 amount
    ) external {
        bytes32 proof = getProofTransfer(
            methodWord_transfer,
            token,
            networkFee,
            msg.sender,
            to,
            amount
        );
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
        bytes4 methodHash,
        bytes32 message,
        bytes32 r,
        bytes32 s,
        uint8 v,
        bytes32 token,
        uint256 networkFee,
        address to,
        uint256 amount
    ) external returns (bool) {
        bytes32 proof = getProofApproval(
            methodHash,
            token,
            networkFee,
            msg.sender,
            to,
            amount
        );
        address signer = preAuthValidations(proof, message, token, r, s, v);
        uint256 currentAllowance = allowance(signer, to);
        // Perform approval
        if (methodHash == methodWord_approve) _approve(signer, to, amount);
        else if (methodHash == methodWord_increaseApproval)
            _approve(signer, to, currentAllowance + amount);
        else if (methodHash == methodWord_decreaseApproval)
            _approve(signer, to, currentAllowance - amount);
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
    function getProofTransfer(
        bytes4 methodHash,
        bytes32 token,
        uint256 networkFee,
        address broadcaster,
        address to,
        uint256 amount
    ) public view returns (bytes32) {
        require(methodHash == methodWord_transfer, "Method not supported");
        bytes32 proof = keccak256(
            abi.encodePacked(
                getChainID(),
                bytes4(methodHash),
                address(this),
                token,
                networkFee,
                broadcaster,
                to,
                amount
            )
        );
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
    function getProofApproval(
        bytes4 methodHash,
        bytes32 token,
        uint256 networkFee,
        address broadcaster,
        address to,
        uint256 amount
    ) public view returns (bytes32) {
        require(
            methodHash == methodWord_approve ||
                methodHash == methodWord_increaseApproval ||
                methodHash == methodWord_decreaseApproval,
            "Method not supported"
        );
        bytes32 proof = keccak256(
            abi.encodePacked(
                getChainID(),
                bytes4(methodHash),
                address(this),
                token,
                networkFee,
                broadcaster,
                to,
                amount
            )
        );
        return proof;
    }
}
