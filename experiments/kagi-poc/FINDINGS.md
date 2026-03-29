# Kagi Translate PoC - Cloudflare Turnstile Bypass Findings

**Date:** 2026-03-29  
**Goal:** Automate Kagi Translate (https://translate.kagi.com) with browser automation  
**Challenge:** Cloudflare Turnstile protection

---

## Summary

After testing **4 different approaches**, none successfully bypassed Cloudflare Turnstile on Kagi Translate automatically. Kagi's Turnstile implementation is **highly resistant to automation**.

---

## Approaches Tested

### 1. Playwright + playwright-extra + Stealth ✅/❌ (Partial Success)

**Setup:**

- `playwright-extra` with `puppeteer-extra-plugin-stealth`
- Random user-agent rotation
- Human-like mouse movements, scrolling, delays
- Anti-detection browser launch arguments

**Result:**

- ✅ Successfully passes bot detection (page loads correctly)
- ✅ No hard Cloudflare block page
- ❌ Turnstile checkbox still appears and blocks translation
- ❌ Requires manual user click on "Verify you are human"

**Verdict:** Best stealth, but cannot bypass Turnstile checkbox.

---

### 2. Manual Turnstile Click via Iframe ❌ (Failed)

**Setup:**

- Detect Turnstile iframe
- Programmatically click checkbox inside iframe

**Result:**

- ❌ Cannot find iframe (Turnstile renders differently than expected)
- ❌ No clickable element detected even with extensive selectors
- Page structure shows `#cf-turnstile` div but no interactive iframe

**Verdict:** Turnstile structure is too complex for simple click automation.

---

### 3. Docker Solver (theyka/turnstile_solver) ❌ (Unsuitable)

**Setup:**

- Docker container: `theyka/turnstile_solver:latest`
- Python Flask/Quart API to solve Turnstile
- Node.js client to call API and inject token

**Result:**

- ❌ Docker image designed for RDP access, not API automation
- ❌ Requires manual script launch inside container
- ❌ Missing `xvfb-run` for headless browser (X server issue)
- ❌ Playwright browsers not pre-installed
- ❌ Installation takes too long and requires manual intervention

**Verdict:** Not viable for automated workflows. Designed for manual RDP use.

---

### 4. puppeteer-real-browser ❌ (Failed Verification)

**Setup:**

- Package: `puppeteer-real-browser` (https://github.com/ZFC-Digital/puppeteer-real-browser)
- Uses rebrowser patches for anti-detection
- `turnstile: true` option for auto-bypass

**Result:**

- ❌ **"Verification failed"** error appears on page
- ❌ Turnstile not bypassed despite `turnstile: true`
- ❌ Translation does not execute
- ⚠️ Package is **deprecated** (no longer receives updates)

**Screenshot:** `debug-real-browser-failed.png` shows red "Verification failed" banner

**Verdict:** Does not work for Kagi Translate's Turnstile implementation.

---

## Why Kagi Turnstile is Hard to Bypass

1. **Advanced Bot Detection:** Cloudflare Turnstile analyzes browser fingerprints, behavior patterns, and execution environment
2. **Dynamic Challenge:** Turnstile adapts based on risk score (automation triggers harder challenges)
3. **No Public Bypass:** Unlike ReCaptcha v2, Turnstile has fewer known public bypass methods
4. **Server-Side Validation:** Even if token is obtained, Kagi validates it server-side
5. **Continuous Updates:** Cloudflare updates Turnstile regularly to counter new bypass techniques

---

## Viable Alternatives

### Option A: Manual Intervention Workflow

- Launch browser in **headed mode** (`HEADLESS=false`)
- Pause automation and prompt user to click Turnstile
- Resume translation extraction after user verification
- **Pros:** 100% success rate, simple implementation
- **Cons:** Requires user presence, not fully automated

### Option B: Paid Captcha Solving Services

- Integrate services like:
  - **2captcha** (https://2captcha.com)
  - **CapMonster** (https://capmonster.cloud)
  - **AntiCaptcha** (https://anti-captcha.com)
- Send Turnstile site key to service, receive solved token
- Inject token into page
- **Pros:** Automated, high success rate
- **Cons:** Costs money ($1-3 per 1000 solves), requires API integration

### Option C: Official Kagi API

- Check if Kagi offers an official translation API
- Use API instead of web scraping
- **Pros:** Legitimate, stable, no CAPTCHA
- **Cons:** May require paid subscription, limited features

### Option D: Browser Extension Approach

- Build Chrome/Firefox extension with content script
- User manually opens Kagi Translate, extension auto-extracts result
- **Pros:** Runs in real user browser, no bot detection
- **Cons:** Requires user to install extension, semi-manual

---

## Current Implementation

The PoC includes:

✅ **Stealth automation** (Approach 1)

- Best-effort bypass with random UA, human behavior, anti-detection args
- Works for pages without Turnstile
- Code: `src/translator.ts`, `src/humanLikeBehavior.ts`

⚠️ **puppeteer-real-browser** (Approach 4)

- Tested but failed for Kagi
- Code: `src/translator-real-browser.ts`
- Kept for reference/future testing with other sites

❌ **Docker solver**, **Manual click** - Removed (not viable)

---

## Recommendations

**For Development/Testing:**

- Use `HEADLESS=false` and manually click Turnstile
- Works perfectly for local dev and debugging

**For Production:**

1. **Best:** Use official Kagi API (if available)
2. **Good:** Integrate 2captcha or similar service
3. **Acceptable:** Implement manual verification workflow (user clicks Turnstile)
4. **Not Recommended:** Continue trying to bypass (high maintenance, low success)

---

## Files

- `src/translator.ts` - Playwright + stealth (current best approach)
- `src/translator-real-browser.ts` - puppeteer-real-browser (failed test)
- `src/extractor.ts` - Translation extraction logic
- `src/humanLikeBehavior.ts` - Stealth helpers (UA rotation, mouse moves, delays)
- `src/turnstile-clicker.ts` - Manual click attempt (failed)
- `debug-real-browser-failed.png` - Screenshot showing verification failure
- `cloudflare-challenge.png` - Screenshot showing Turnstile checkbox

---

## Conclusion

Automating Kagi Translate with full Turnstile bypass is **not feasible** with current open-source tools. Turnstile is designed to resist automation, and Kagi's implementation is effective.

**The pragmatic solution is to use headed mode with manual user verification, or integrate a paid captcha solving service.**
