# Kuwenta — Client Update

Where we are today and what's still ahead, in plain language.

---

## What freelancers can already do today

- **Sign in** with a username and password — no separate app to install, works in any browser.
- **Set up their account** once: TIN, RDO code, registered address, type of work, and whether they already elected the 8% rate at the BIR.
- **Add their 2307 income slips** (the forms payors issue when they pay a freelancer) by typing the figures or uploading the slip.
- **See all 8 tax returns they owe**, in the exact legal order the BIR requires, with a colour-coded status (Filed / Pending / Blocked).
- **Get their taxes calculated automatically** from the 2307 data — no spreadsheet work.
- **Generate the BIR forms** (2551Q, 1701Q, 1701A) as ready-to-print PDFs.
- **File each return** in one click. The system re-checks the rules, computes any late-filing penalties, and saves the signed PDF.
- **Get an immutable receipt on the Stellar blockchain** for every filed return. Each receipt has a QR code that any bank, embassy, or auditor can scan to confirm the filing is real.
- **Download a complete filing package** as a ZIP — all return PDFs, a cover sheet, and the SAWT summary CSV in one go.
- **See an automatic tax-payment journal** that bookkeepers can hand straight to an accountant. It's exportable to Excel.
- **Get warned before they cross the ₱3,000,000 VAT registration threshold** so they have time to register with the BIR.

For the BIR / admin team:

- **View a list of all registered freelancers** with their TIN and status.
- **See a full activity log** of every action — every election, every filed return, every Stellar retry — with filters and a CSV export.

---

## What's still being added

In flight over the next few sprints:

- **Support for freelancers with a day job** ("mixed-income" earners). They file a different annual form (1701 instead of 1701A). The routing is in place; we're finishing the form template and the end-to-end flow.
- **Graduated tax-rate option** for users who don't pick the 8% flat rate. Today the 8% path is fully working; the graduated bracket calculation is the next priority.
- **A "you've crossed the VAT line" banner** that clearly tells the user they can no longer file 1701A and must register for VAT instead.
- **More admin tools for the BIR side** — managing the list of tax codes, the Philippine holiday calendar, and the per-RDO compromise penalty schedule.
- **A system-health dashboard** for admins so they can see at a glance that Stellar, the database, and file storage are all up.
- **Cleaner UX polish** — a sign-out button in the top-right menu, loading skeletons and empty-state messages across all pages, and security headers.
- **Dockerfile + Railway one-click deploy** so the system can be stood up in a fresh environment without manual setup.
- **A bigger automated test suite** and a CI pipeline that runs on every pull request, so regressions are caught before they reach production.

---

## The single moment this product is built around

A Filipino freelancer uploads their 2307 certificates, the system figures out every peso they owe, files all 8 returns in the right order, and stamps each one to the Stellar blockchain — producing a compliance trail the freelancer, their bank, and the BIR can all verify in seconds. The 8% freelancer path is the one that demo is built on, and it's working end to end today. Mixed-income and graduated-rate support extend the same experience to the rest of the freelancer population; that's the next stretch.
