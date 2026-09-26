# Getting this running on your laptop

Written for someone who hasn't done this before. Follow it top to bottom.
Nothing here can break your computer.

---

## Step 1 — Install Node.js (one time only)

Node.js is the program that runs this app. You only ever do this once.

1. Go to **https://nodejs.org**
2. Download the big green button that says **LTS** (it means "stable")
3. Run the installer, click Next through everything, Finish

**Check it worked.** Press the `Windows` key, type `cmd`, press Enter.
A black window opens. Type this and press Enter:

```
node --version
```

If you see something like `v22.14.0`, you're good. If it says
*"'node' is not recognized"*, close the black window, open a new one, and
try again — the installer needs a fresh window to take effect.

---

## Step 2 — Unzip the project

1. Find the `indian-momentum-dashboard-v0.12.1.zip` file you downloaded
2. **Right-click it → "Extract All..." → Extract**
3. You now have a folder. Open it until you see files like `package.json`
   and folders called `src` and `scripts`. **That folder is the one you need.**

---

## Step 3 — Point the terminal at that folder

Easiest way, no typing:

1. Open that folder in File Explorer
2. Click the **address bar** at the top (where the folder path is shown)
3. Type `cmd` and press Enter

A black window opens, already pointing at the right folder. Perfect.

*(The alternative is typing `cd "C:\path\to\the\folder"` — the trick above
just saves you getting the path exactly right.)*

---

## Step 4 — Install the app's parts

In that black window, type:

```
npm install
```

Press Enter and **wait**. It downloads a few hundred small building blocks
the app needs. This takes 1–3 minutes and prints a lot of text. That's normal.

You might see **warnings** in yellow. Warnings are fine and can be ignored.
Only red `ERR!` lines mean something actually failed.

You only need to do this once.

---

## Step 5 — See the app 🎉

```
npm run dev
```

You'll see something like:

```
  ➜  Local:   http://localhost:5173/
```

**Hold Ctrl and click that link**, or copy it into your browser.

The dashboard opens. It's running on **realistic sample data**, not live
prices — the header says "Synthetic sample data" so you're never misled.
All the maths, rankings, charts and CSV exports are fully working.

**To stop it:** click the black window and press `Ctrl + C`.

---

## Step 6 (optional) — Try connecting live market data

Only do this once Step 5 works. This is the part that tries to fetch real
prices from Yahoo Finance, which has never been tested from a real machine.

**6a.** Install the extra tool (one time):

```
npm install -g netlify-cli
```

If this fails with a permissions error, close the window, then right-click
`cmd` in the Start menu and choose **"Run as administrator"**, and try again.

**6b.** Start the app with the data functions running:

```
netlify dev
```

It may ask a question or two the first time — if it offers to link to a
Netlify account, you can decline; you don't need an account for this.

**6c.** Now open a **second** black window in the same folder (repeat Step 3),
and run the checker:

```
node scripts/verify-live-data.mjs http://localhost:8888/api
```

It runs 13 checks and prints a tidy list of ✅ and ❌.

**Send me whatever it prints — including the failures.** The failures are
the useful part; they tell me exactly what needs fixing. It also writes the
same results to `scripts/verify-live-data-results.json` if that's easier to
copy.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| `'node' is not recognized` | Node isn't installed, or the window is stale | Redo Step 1, then open a **new** cmd window |
| `'npm' is not recognized` | Same as above | Same as above |
| `ENOENT ... package.json` | You're in the wrong folder | Redo Step 3 — you must be in the folder containing `package.json` |
| Red `ERR!` during `npm install` | Usually a dropped connection | Just run `npm install` again |
| Port 5173 already in use | The app is already running elsewhere | Press `Ctrl + C` in the other window, or use the different port it offers |
| `netlify: command not found` | Step 6a didn't complete | Retry 6a as administrator |

Nothing in Step 6 can damage anything. If it fails, the app still works
perfectly on sample data via Step 5.

---

## Useful commands, once you're set up

| Command | What it does |
|---|---|
| `npm run dev` | Run the dashboard (sample data) |
| `npm test` | Run all 256 automated checks |
| `npm run build` | Build the production version into `dist/` |
| `npm run lint` | Check the code for mistakes |
