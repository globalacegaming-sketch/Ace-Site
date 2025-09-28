🌍 Global Ace Gaming – Technical Context

This document serves as a technical blueprint for developing the Global Ace Gaming website and backend systems with FortunePanda API integration.

🔹 Tech Stack
Frontend (User Website)

Framework: Vite + React 18

Styling: TailwindCSS + ShadCN/UI

State Management: Redux Toolkit (user session, last recharge status)

API Calls: Axios (to backend only, never directly to FortunePanda)

Authentication: JWT stored in HttpOnly cookies

Pages:

Home

Games (auto-login to FortunePanda)

Platforms

About Us

Contact

Signup / Login

Backend (Core Logic)

Framework: Node.js (Express.js or NestJS)

Database: PostgreSQL/MySQL

ORM: Prisma ORM

Security: Bcrypt (user passwords), JWT, Helmet

Scheduler: Node-cron (retry failed FP transactions)

External APIs

FortunePanda Terminal API – gameplay, balances, transactions

Crypto Payment API – Coinbase Commerce, NOWPayments, Binance Pay, etc.

🔹 User Flow
1. Signup

User registers on Global Ace.

Backend calls FortunePanda registerUser with {firstname}+ace01G.

Store mapping: user_id ↔ fortune_account.

2. Login

User logs into Global Ace.

JWT issued.

FortunePanda auto-login handled during enterGame.

3. Deposit

A. Crypto Deposit

User selects crypto deposit.

Backend generates crypto address.

On payment confirmation:

Log transaction in DB.

Call FortunePanda recharge.

Update status = success or error.

B. Agent Deposit

User selects agent deposit.

Admin approves.

Backend calls FortunePanda recharge.

Log transaction in DB.

User Visibility:

Users cannot see deposit amounts or history.

Users see only the last recharge status (Success / Failed / Processing).

4. Withdrawal

User requests withdrawal.

Backend calls FortunePanda redeem → transfers money back to agent.

Admin processes payout (Crypto/manual).

Log transaction.

5. Play Game

User clicks game.

Backend calls FortunePanda enterGame with {account, kindId}.

Returns webLoginUrl.

React opens game in iframe/new tab.

Auto-login if user is logged in to Global Ace.

🔹 Admin Flow
User Management

Create/edit users.

View balances (queryInfo).

Financial Management

Approve Agent Deposits.

Approve Withdrawals.

Check Crypto Logs and transactions.

Retry failed FortunePanda transfers.

Game & Platform Management

View Game List (getGameList).

View Game Records (getGameRecord).

Add Platforms manually.

Jackpot Logs (getJpRecord).

🔹 Database Tables
Users

id, firstname, lastname, email, password_hash, fortune_account, created_at, updated_at

Transactions

id, user_id, type(deposit|withdraw), method(crypto|agent), amount, status(pending|success|failed), ref_id, fp_response(json), created_at

Crypto Deposits

id, user_id, amount, currency, tx_hash, address, status(pending|confirmed|completed|error), fp_status(success|failed|retrying), created_at

Agent Deposits

id, user_id, amount, status(pending|confirmed|completed), fp_status(success|failed), created_at

Platforms

id, name, description, logo_url, created_at

🔹 FortunePanda API Mapping
Action	API Endpoint	Usage
Agent Login	agentLogin	Cached agentKey for other calls
Register User	registerUser	On user signup
Query User Info	queryInfo	Admin/user balance sync
Get Game List	getGameList	Populate games page
Enter Game	entergame	Game session for user
Change Password	changePasswd	User/admin password reset
Recharge	recharge	Deposit (crypto/agent)
Redeem	redeem	Withdrawal
Get Trade Record	getTradeRecord	Admin financial log
Get JP Record	getJpRecord	Jackpot logs
Get Game Record	getGameRecord	Admin game session logs
🔹 Backend API Endpoints
User Routes

POST /auth/signup → Signup (create user + FP register)

POST /auth/login → Login, return JWT

POST /deposit/crypto → Start crypto deposit

POST /deposit/agent → Request agent deposit

POST /withdraw → Withdraw request

GET /games → Get game list

POST /game/play → Call enterGame, return webLoginUrl

GET /recharge/last → Return last recharge status only

Admin Routes

POST /admin/user/create → Create user

GET /admin/users → List users

GET /admin/deposits → View all deposit logs (crypto + agent)

POST /admin/deposit/approve → Approve agent deposit

POST /admin/withdraw/approve → Approve withdrawal

GET /admin/trades → getTradeRecord

GET /admin/jackpots → getJpRecord

GET /admin/game-records → getGameRecord

POST /admin/platforms/add → Add platform

GET /admin/platforms → List platforms

🔹 Security & Notes

agentKey changes every login → cache in Redis/DB.

All API calls require sign = md5(agentName + time + agentKey).toLowerCase().

Timestamp must be unique per call.

Users cannot view financial amounts, only last recharge status.

Backend logs all transactions for audit.