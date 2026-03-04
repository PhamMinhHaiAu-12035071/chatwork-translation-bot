# Webhook URL Setup & Chatwork Message Logging Design

## 1. Overview

The goal of this feature is to set up a public webhook URL to receive Chatwork events locally and log the detailed JSON payload of every message created in a specific room (Room ID: `424846369`). This will facilitate debugging and verifying incoming messages while maintaining the existing translation bot logic.

## 2. Architecture & Infrastructure

- **Local Server**: The Bun HTTP server (`packages/bot`) running locally on port `3000`.
- **Tunneling**: `localtunnel` will be used via `bunx localtunnel --port 3000 --subdomain <your-custom-subdomain>` to expose the local port to the internet with a persistent URL (e.g., `https://<your-custom-subdomain>.loca.lt`).
- **Chatwork Configuration**: The generated HTTPS URL along with Room ID `424846369` will be configured in the Chatwork webhook settings, listening to the `Message created` event.

## 3. Data Flow

1. User types any message in Room ID `424846369`.
2. Chatwork sends a `POST` request to `https://<your-custom-subdomain>.loca.lt/webhook`.
3. `localtunnel` forwards the request to the local Bun server at `localhost:3000/webhook`.
4. `router.ts` verifies the `X-Hub-Signature` header against `CHATWORK_WEBHOOK_SECRET`.
5. If valid, the router returns a `200 OK` response immediately to prevent Chatwork timeouts.
6. The event payload is passed asynchronously to `handleWebhookEvent(event)` in `handler.ts`.

## 4. Code Changes

- **Target File**: `packages/bot/src/webhook/handler.ts`
- **Logic**: Immediately after verifying that the event is a `ChatworkMessageEvent` (via `isChatworkMessageEvent`), log the complete raw JSON payload to the console using `console.dir(event, { depth: null, colors: true })` or `JSON.stringify(event, null, 2)`.
- **Existing Functionality**: The existing command parsing (`parseCommand`) and translation processing for `/translate` will remain intact. Messages without commands will be logged and then gracefully ignored.

## 5. Security & Edge Cases

- **Persistent Tunnel URL**: By using the `--subdomain` flag with localtunnel, we minimize the risk of the webhook URL changing across restarts, avoiding the need to update Chatwork settings frequently.
- **Security**: The existing HMAC-SHA256 signature verification in `router.ts` ensures that only authentic requests from Chatwork are processed. Any random traffic hitting the localtunnel URL will be rejected with a `401 Unauthorized`.
- **Tunnel Instability**: Localtunnel can sometimes disconnect. The developer will need to monitor the terminal running localtunnel and restart it if a connection is lost.
