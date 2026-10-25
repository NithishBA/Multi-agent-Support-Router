# Multi-agent Support Router

A live demo that classifies an incoming support message into a department (Billing,
Technical Support, Sales, General Inquiries) and replies in character as that
department's agent — in a single model call.

- **Problem:** support inboxes mix billing, technical, and sales questions — routing them
  manually wastes time.
- **Approach:** one call classifies intent and generates an in-character reply.
- **Result:** type a message and watch it get routed and answered live.

## Stack
Groq API (`groq-sdk`), Vercel serverless functions.

## Setup
```
npm install
cp .env.example .env   # fill in GROQ_API_KEY
vercel dev              # or: vercel deploy
```

## Routes
- `POST /api/route-agent` — send `{ message }`, returns `{ agent, reply }`.
