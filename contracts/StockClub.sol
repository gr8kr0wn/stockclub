// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// Shared club vault and membership log on Base.
/// USDC (6 decimals) is pulled with transferFrom. Social posts stay offchain.
contract StockClub {
    address public usdc;
    address public deployer;

    struct Proposal {
        address author;
        uint64 closesAt;
        uint32 yesVotes;
        uint32 noVotes;
        bool exists;
        bool executed;
        address recipient;
        uint256 amount;
        bool distribute;
    }

    mapping(bytes32 => address) public founderOf;
    mapping(bytes32 => bool) public collectible;
    mapping(bytes32 => mapping(address => bool)) public isMember;
    mapping(bytes32 => uint256) public memberCount;
    mapping(bytes32 => uint256) public usdcBalance;
    mapping(bytes32 => uint8) public membersPctOf;
    mapping(bytes32 => uint8) public opsPctOf;
    mapping(bytes32 => uint8) public founderPctOf;
    mapping(bytes32 => address) public opsOf;
    mapping(bytes32 => address[]) public memberList;
    mapping(bytes32 => mapping(address => uint256)) public owed;
    mapping(bytes32 => uint256) public proposalCount;
    mapping(bytes32 => mapping(uint256 => Proposal)) public proposals;
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    event ClubCreated(bytes32 indexed id, address indexed founder, string ticker);
    event Joined(bytes32 indexed id, address indexed member, bool minted);
    event Deposited(bytes32 indexed id, address indexed from, uint256 amount);
    event Proposed(bytes32 indexed id, uint256 indexed proposalId, address author);
    event Voted(bytes32 indexed id, uint256 indexed proposalId, address voter, bool yes);
    event Executed(bytes32 indexed id, uint256 indexed proposalId, address to, uint256 amount);
    event Claimed(bytes32 indexed id, address indexed member, uint256 amount);

    constructor(address usdc_) {
        usdc = usdc_;
        deployer = msg.sender;
    }

    function createClub(
        string calldata ticker,
        bool collectible_,
        uint8 membersPct,
        uint8 opsPct,
        uint8 founderPct,
        address ops
    ) external returns (bytes32 id) {
        id = keccak256(bytes(ticker));
        require(founderOf[id] == address(0), "exists");
        require(bytes(ticker).length > 0 && bytes(ticker).length <= 5, "ticker");
        require(uint256(membersPct) + opsPct + founderPct == 100, "split");
        founderOf[id] = msg.sender;
        collectible[id] = collectible_;
        membersPctOf[id] = membersPct;
        opsPctOf[id] = opsPct;
        founderPctOf[id] = founderPct;
        opsOf[id] = ops == address(0) ? msg.sender : ops;
        isMember[id][msg.sender] = true;
        memberCount[id] = 1;
        memberList[id].push(msg.sender);
        emit ClubCreated(id, msg.sender, ticker);
    }

    function join(bytes32 id) external {
        require(founderOf[id] != address(0), "missing");
        require(!collectible[id], "mint");
        require(!isMember[id][msg.sender], "member");
        isMember[id][msg.sender] = true;
        memberCount[id] += 1;
        memberList[id].push(msg.sender);
        emit Joined(id, msg.sender, false);
    }

    function mint(bytes32 id) external {
        require(founderOf[id] != address(0), "missing");
        require(collectible[id], "free");
        require(!isMember[id][msg.sender], "member");
        isMember[id][msg.sender] = true;
        memberCount[id] += 1;
        memberList[id].push(msg.sender);
        emit Joined(id, msg.sender, true);
    }

    function deposit(bytes32 id, uint256 amount) external {
        require(amount > 0, "amount");
        require(IERC20(usdc).transferFrom(msg.sender, address(this), amount), "usdc");
        usdcBalance[id] += amount;
        emit Deposited(id, msg.sender, amount);
    }

    function propose(bytes32 id, uint64 closesAt) external returns (uint256 proposalId) {
        require(isMember[id][msg.sender], "member");
        require(closesAt > block.timestamp, "closed");
        proposalId = proposalCount[id];
        proposalCount[id] = proposalId + 1;
        proposals[id][proposalId] = Proposal({
            author: msg.sender,
            closesAt: closesAt,
            yesVotes: 0,
            noVotes: 0,
            exists: true,
            executed: false,
            recipient: address(0),
            amount: 0,
            distribute: false
        });
        emit Proposed(id, proposalId, msg.sender);
    }

    /// A request to send club USDC. It does nothing until execute, and only if the vote passes.
    function proposeSpend(bytes32 id, address recipient, uint256 amount, uint64 closesAt) external returns (uint256 proposalId) {
        require(isMember[id][msg.sender], "member");
        require(recipient != address(0), "to");
        require(amount > 0 && amount <= usdcBalance[id], "amount");
        require(closesAt > block.timestamp, "closed");
        proposalId = proposalCount[id];
        proposalCount[id] = proposalId + 1;
        proposals[id][proposalId] = Proposal({
            author: msg.sender,
            closesAt: closesAt,
            yesVotes: 0,
            noVotes: 0,
            exists: true,
            executed: false,
            recipient: recipient,
            amount: amount,
            distribute: false
        });
        emit Proposed(id, proposalId, msg.sender);
    }

    /// A request to divide club USDC by the split. Members claim their share after it passes.
    function proposeSplit(bytes32 id, uint256 amount, uint64 closesAt) external returns (uint256 proposalId) {
        require(isMember[id][msg.sender], "member");
        require(amount > 0 && amount <= usdcBalance[id], "amount");
        require(closesAt > block.timestamp, "closed");
        proposalId = proposalCount[id];
        proposalCount[id] = proposalId + 1;
        proposals[id][proposalId] = Proposal({
            author: msg.sender,
            closesAt: closesAt,
            yesVotes: 0,
            noVotes: 0,
            exists: true,
            executed: false,
            recipient: address(0),
            amount: amount,
            distribute: true
        });
        emit Proposed(id, proposalId, msg.sender);
    }

    function vote(bytes32 id, uint256 proposalId, bool yes) external {
        Proposal storage proposal = proposals[id][proposalId];
        require(proposal.exists, "missing");
        require(block.timestamp < proposal.closesAt, "closed");
        require(isMember[id][msg.sender], "member");
        require(!hasVoted[id][proposalId][msg.sender], "voted");
        hasVoted[id][proposalId][msg.sender] = true;
        if (yes) proposal.yesVotes += 1;
        else proposal.noVotes += 1;
        emit Voted(id, proposalId, msg.sender, yes);
    }

    /// Sends the USDC after the vote is closed, more than half the members voted, and yes won.
    function execute(bytes32 id, uint256 proposalId) external {
        Proposal storage proposal = proposals[id][proposalId];
        require(proposal.exists, "missing");
        require(!proposal.executed, "done");
        require(block.timestamp >= proposal.closesAt, "open");
        uint256 castVotes = uint256(proposal.yesVotes) + uint256(proposal.noVotes);
        require(castVotes * 2 > memberCount[id], "quorum");
        require(proposal.yesVotes > proposal.noVotes, "lost");
        require(proposal.amount > 0 && proposal.amount <= usdcBalance[id], "amount");
        proposal.executed = true;
        usdcBalance[id] -= proposal.amount;
        if (proposal.distribute) {
            uint256 membersShare = proposal.amount * membersPctOf[id] / 100;
            uint256 opsShare = proposal.amount * opsPctOf[id] / 100;
            uint256 founderShare = proposal.amount - membersShare - opsShare;
            uint256 count = memberList[id].length;
            require(count > 0, "members");
            uint256 each = membersShare / count;
            uint256 dust = membersShare - each * count;
            for (uint256 i = 0; i < count; i++) {
                owed[id][memberList[id][i]] += each;
            }
            if (opsShare > 0) require(IERC20(usdc).transfer(opsOf[id], opsShare), "usdc");
            if (founderShare + dust > 0) require(IERC20(usdc).transfer(founderOf[id], founderShare + dust), "usdc");
            emit Executed(id, proposalId, address(0), proposal.amount);
            return;
        }
        require(proposal.recipient != address(0), "talk");
        require(IERC20(usdc).transfer(proposal.recipient, proposal.amount), "usdc");
        emit Executed(id, proposalId, proposal.recipient, proposal.amount);
    }

    function claim(bytes32 id) external {
        uint256 due = owed[id][msg.sender];
        require(due > 0, "nothing");
        owed[id][msg.sender] = 0;
        require(IERC20(usdc).transfer(msg.sender, due), "usdc");
        emit Claimed(id, msg.sender, due);
    }
}
