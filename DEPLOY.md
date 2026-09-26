# Putting this online with Netlify

Short answer to the obvious question: **no, you cannot drag this zip onto
Netlify and have it work.** But there is a way to do the whole thing in a
web browser, with nothing installed on your laptop. That's Option A below.

---

## Why the zip can't just be dropped on Netlify

Netlify's drag-and-drop expects a **finished** website — plain HTML, CSS and
JavaScript, ready to serve. This zip contains **source code**, which is the
recipe, not the meal. Something has to "build" it first.

That's actually fine, because **Netlify is happy to do the building for you**
— it just needs the code somewhere it can read, which means GitHub.

---

## Option A — Browser only, nothing installed  ⭐ recommended

### A1. Put the code on GitHub

1. Make a free account at **https://github.com**
2. Click **+** (top right) → **New repository**
3. Name it `momentum-dashboard`, leave it **Public**, click **Create**
4. On the next page click **"uploading an existing file"**
5. **Unzip the project on your laptop first**, then drag *everything inside
   that folder* into the browser window
   - Do NOT drag the zip itself — drag the files and folders from inside it
   - Skip `node_modules` if you somehow have one (you shouldn't)
6. Click **Commit changes**

### A2. Connect Netlify

1. Make a free account at **https://netlify.com** (sign in with GitHub — easiest)
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub**, authorise it, pick your `momentum-dashboard` repo
4. Netlify reads `netlify.toml` and fills the settings in automatically.
   You should see build command `npm run build` and publish directory `dist`.
   **Don't change them.**
5. Click **Deploy**

Wait 2–4 minutes. You'll get a live URL like
`https://something-random-123.netlify.app`. That's your dashboard, online.

### A3. Updating it later

Edit files on GitHub (or re-upload), and Netlify rebuilds automatically
within a couple of minutes. No commands, ever.

---

## Option B — Test locally first

See `SETUP.md`. Takes about 10 minutes and requires installing Node.js.

**Worth it if:** you want to see problems on your own screen, where they're
easy to debug, before they happen on a public URL.

**Skippable if:** you just want it online and are happy to iterate.

---

## What you'll actually see when it deploys

This matters, so read it.

The live data source is **Yahoo Finance**, which has an unofficial,
undocumented API. It's been **verified working** (31 July 2026: 14/14
checks, all 453 stock tickers resolve, a full year-and-a-half of history
fetches with no gaps) — but that testing ran from a home internet
connection, not from Netlify's servers, which Yahoo can treat more
cautiously. So:

**If Yahoo works** (likely, based on testing so far) → real Indian market
prices. 🎉

**If Yahoo doesn't work** → the dashboard shows a clear on-screen message
saying live data couldn't be loaded, and the specific reason underneath it.

**It will NOT quietly switch to fake numbers.** An earlier version of this
app did that — showing made-up prices with a warning banner on top — but
that was changed on purpose: a made-up number is worse than an honest "this
didn't load," even a clearly labelled made-up number. So if something's
wrong, you'll see an error message and nothing else on that section — no
charts, no rankings, no numbers of any kind — rather than a page that looks
like it's working but isn't.

**If you see that message**, send me the reason line underneath it and I'll
fix the cause.

---

## Running on made-up data on purpose (optional, for demos/testing)

If you want to deliberately run on realistic made-up numbers — for example,
to demo the app before Yahoo access is confirmed in your specific setup —
add an environment variable in Netlify:

**Site configuration → Environment variables → Add a variable**

| Key | Value |
|---|---|
| `VITE_DATA_PROVIDER` | `mock` |

Then redeploy. Remove it later to switch back to attempting live data.

---

## Things that commonly go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Build fails, mentions Node version | Netlify used an old Node | Already pinned to Node 22 in `netlify.toml` — if it still happens, set `NODE_VERSION=22` under environment variables |
| Build fails: `package.json not found` | The repo has an extra wrapper folder | Files like `package.json` must sit at the **top level** of the repo, not inside a subfolder |
| Site loads but every page is blank | Usually a build that half-succeeded | Open Netlify's **Deploy log** and send me the last ~20 red lines |
| Red error message instead of prices | Yahoo unreachable from Netlify's servers specifically | Send me the reason line printed with it |
| `/api/market-data` returns 404 | Functions didn't deploy | Confirm `netlify/functions/` was uploaded to GitHub |

---

## My honest recommendation

**Do Option A now.** Getting it deployed takes 15 minutes and tells us
something we haven't confirmed yet: whether Yahoo Finance responds the same
way from Netlify's servers as it did from a home connection during testing.

Either result is useful — if it works, you have a live dashboard on real
data. If it doesn't, the error message tells us exactly why, and that
closes the one thing this project hasn't verified yet.
