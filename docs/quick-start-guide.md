# Kuwenta — Quick Start Guide

A short guide for first-time users. If you've never used Kuwenta before
and you're not sure where to start, start here. We'll walk through
everything in plain language. If anything is unclear, ask the person
who shared this with you — there's no such thing as a dumb question
when it comes to taxes.

---

## Before you begin

You'll need:

- **A computer or phone** with a web browser (Chrome, Edge, Firefox, or Safari).
- **Your login details.** Your admin or accountant should have given
  you a username and password. If you don't have one yet, ask them.
- **About 20 minutes.** Most of the time is typing things in, not
  waiting for the system.

When you're ready, open the website in your browser and sign in.

---

## 1. Sign in

Type your username and password, then click **Sign in**. The page
will take you to your dashboard — that's your home screen, where you
can see the big picture of your taxes for the year.

If you ever need to come back later, just open the same website and
sign in again.

---

## 2. Set up your profile (one time only)

If this is your first time signing in, the system will walk you
through a short setup. It asks for:

- **Your name and TIN.** Your TIN is the 12-digit tax ID number the
  BIR gave you. It looks like `123-456-789-000`.
- **Your RDO code.** The 3-digit code of the BIR office that handles
  you (your accountant can tell you this).
- **Your address and ZIP code.** The address on your BIR
  registration, not your home address.
- **What kind of work you do.** A short description, like
  "freelance writer" or "software consultant".
- **What kind of income you have.** Most freelancers pick "Pure
  Self-Employment". If you also have a regular job with a salary,
  pick "Mixed Income".
- **Whether your BIR registration includes 2551Q.** Your accountant
  will know. If you're not sure, ask them — it changes the number of
  returns you have to file.
- **Whether you just registered with the BIR for the first time.**
  Pick "Yes" if you only just signed up; pick "No" if you've been
  filing for years.

Click **Next** to go to the next step. The system will then check
whether you're allowed to use the simple 8% tax rate (most
freelancers are), ask you to pick the type of work code that applies
to you, and ask for the year you want to file for.

When you're done, click **Complete Onboarding** and you'll land on
your dashboard. You only do this once.

---

## 3. Add your Form 2307 income slips

A Form 2307 is the slip your client (the person who paid you) gives
you when they pay you and withhold tax on your behalf. Most of your
tax computation comes from these slips.

Click **Income** in the menu on the left.

Click **Add 2307** (or whatever the button says).

For each slip, type in:

- **Which quarter of the year** the payment was for (1, 2, 3, or 4).
- **The client's TIN and name** (the person who paid you).
- **The type of work** (pick from the dropdown — your accountant
  will know which one to use).
- **How much you were paid each month** during that quarter.
- **How much tax the client withheld** for you.

Click **Save**.

Repeat this for every Form 2307 you have. The more slips you add,
the more accurate your tax computation will be.

Don't worry about getting it perfect the first time — you can come
back later and edit or delete any slip.

---

## 4. Look at your filing roadmap

Go back to your **Dashboard** (click "Dashboard" in the left menu).

The main thing to look at is the **Filing Roadmap** — a list of all
the tax returns you need to file, in the order the BIR wants them.
For a freelancer on the standard 8% path, that's 8 returns. If your
registration doesn't include 2551Q, it's 4.

Each return has a colour-coded status:

- **Red (Blocked):** you need to file the previous return first
  before this one unlocks.
- **Yellow (Pending):** everything you need is in place, and this
  return is ready to be generated and filed.
- **Blue (Generated):** the system has computed the form, but you
  haven't filed it yet. You can review the numbers before filing.
- **Green (Filed):** done. The system has submitted the form and
  saved a receipt on the blockchain.

---

## 5. Generate and file each return, in order

Start with the first one (2551Q Q1).

Click **Generate**. The system will look at your 2307 slips and
compute the form. Take a moment to look at the numbers — the page
will show you the gross income, the tax due, and any credits. If
something looks wrong, you can go back and edit your 2307 slips.

When you're happy with the numbers, click **File**. The system will:

- Recalculate the numbers one more time, just to be safe.
- Generate a PDF you can print or email to the BIR.
- Send a small receipt to the Stellar blockchain (this is the
  permanent proof that you filed).

The return will turn green and show a transaction ID. That's the
proof — keep it somewhere safe.

Repeat for the next return. Work down the list in order. Don't
skip ahead — the system won't let you, and even if it did, the BIR
would reject an out-of-order filing.

---

## 6. Download your filing package

When all your returns are filed, click **Filing Package** in the
left menu (or look for a "Download" button on the dashboard).

Your browser will save a file called `filing-package-2026.zip` (or
similar — the year will match the year you filed). Open it. Inside
you'll find:

- A **cover sheet** PDF that summarises the whole year.
- One **PDF for each return** you filed.
- A **SAWT spreadsheet** (CSV) that lists all your 2307 slips in
  the format the BIR wants for alphalist submission.

Save this ZIP somewhere safe — it's your complete filing record for
the year, including the blockchain receipts.

---

## 7. (Optional) Check your Stellar receipts

Click **Stellar** in the left menu. You'll see a list of every
return you filed, with a QR code for each.

The QR code is a permanent proof of your filing. Any bank,
accountant, or government office can scan it to confirm that your
return is real and was filed at the time shown. The blockchain
can't be faked or changed after the fact.

You don't need to do anything with these — they exist for you in
case anyone ever questions whether you filed.

---

## That's it

You signed in, told the system about your income, generated and
filed every return, and downloaded your package. Everything else
(dashboard, journal, audit log) is for accountants and admins.

If you run into trouble, the person who set up your account can
help. Common questions:

- **"I made a mistake on a 2307 slip"** — go to Income, find the
  slip, click Edit, fix it, and Save. The system will
  automatically update all the returns that depend on it.
- **"I need to file again because something changed"** — the
  system keeps the original filing on the blockchain. If you need
  to amend a return, contact your accountant; the system will
  create a new filing alongside the old one.
- **"I forgot my password"** — ask your admin to reset it for
  you.
