# Worldview Quiz - Complete Setup Guide

**For project managers and non-coders.** This guide walks you through every step to get the quiz running, from zero to deployed.

---

## What This App Does

1. **Quiz**: Asks neutral questions about beliefs (scale or yes/no) with branching follow-ups
2. **Evidence Network**: Upload articles/documents, auto-tag with AI, link to topics
3. **Politician Tracking**: Track public statements vs. actual actions
4. **Fact-Checking**: Compare new articles against past promises/claims
5. **Corruption Focus**: Highlight perception vs. reality of institutions
6. **Session Persistence**: Users can save and track how views evolve

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] A Mac, Windows, or Linux computer
- [ ] Internet connection
- [ ] About 30 minutes
- [ ] (Optional) OpenAI API key for AI features

---

## PHASE 1: Install Required Software

### Step 1.1: Install Node.js

Node.js is the engine that runs this application.

1. Open your web browser
2. Go to: **https://nodejs.org**
3. Click the **LTS** (Long Term Support) button - it's the green one
4. Download will start automatically
5. Open the downloaded file
6. Follow the installer prompts (click "Next" / "Continue" through everything)
7. **Restart your computer** after installation

**To verify it worked:**
1. Open Terminal (Mac) or Command Prompt (Windows)
   - Mac: Press `Cmd + Space`, type "Terminal", press Enter
   - Windows: Press `Windows key`, type "cmd", press Enter
2. Type: `node --version`
3. Press Enter
4. You should see something like `v20.10.0` (numbers may vary)

If you see an error, reinstall Node.js.

---

### Step 1.2: Install a Code Editor (Optional but Recommended)

If you don't already have one:

1. Go to: **https://code.visualstudio.com**
2. Download and install VS Code
3. This makes viewing and editing files much easier

---

## PHASE 2: Set Up the Project

### Step 2.1: Open Terminal in the Project Folder

**Mac:**
1. Open Finder
2. Navigate to: `/Users/dan.maguire/Documents/Projects/Politics`
3. Right-click on the `Politics` folder
4. Select "New Terminal at Folder"

**Alternative (any OS):**
1. Open Terminal/Command Prompt
2. Type: `cd /Users/dan.maguire/Documents/Projects/Politics`
3. Press Enter

**You'll know you're in the right place if you type `ls` (Mac/Linux) or `dir` (Windows) and see files like `package.json` and `README.md`**

---

### Step 2.2: Install Project Dependencies

This downloads all the code libraries the project needs.

**In your terminal, type:**
```
npm install
```

**What to expect:**
- This takes 1-3 minutes
- You'll see a progress bar and lots of text scrolling
- It's done when you see your cursor blinking on a new line
- You may see some yellow "warnings" - these are normal, ignore them
- If you see red "errors", something went wrong (see Troubleshooting below)

---

### Step 2.3: Set Up the Database

The database stores all your questions, evidence, and user responses.

**Run these three commands, one at a time:**

```
npx prisma generate
```
*Wait for it to finish, then:*

```
npx prisma db push
```
*Wait for it to finish, then:*

```
npm run db:seed
```

**What each command does:**
1. `prisma generate` - Creates the database connection code
2. `prisma db push` - Creates the database file and tables
3. `db:seed` - Fills the database with sample questions and data

**You'll know it worked when you see:**
- "✅ Created X categories"
- "✅ Created X questions"
- "🎉 Seeding complete!"

---

## PHASE 3: Run the Application

### Step 3.1: Start the Development Server

**In your terminal, type:**
```
npm run dev
```

**What to expect:**
- You'll see "Ready" and a URL like `http://localhost:1776`
- The terminal will stay "running" - this is normal
- **Don't close this terminal window** while using the app

---

### Step 3.2: Open the Application

1. Open your web browser (Chrome, Safari, Firefox, etc.)
2. Go to: **http://localhost:1776**
3. You should see the Worldview Quiz home page!

**Available pages:**
| URL | What it does |
|-----|--------------|
| http://localhost:1776 | Home page |
| http://localhost:1776/quiz | Take the quiz |
| http://localhost:1776/admin | Admin panel |
| http://localhost:1776/admin/documents | Document editor with AI |

---

### Step 3.3: Stop the Server (When Done)

When you want to stop the application:
1. Go to the terminal window where it's running
2. Press `Ctrl + C` (hold Control, press C)
3. The server will stop

To start it again later, just run `npm run dev` again.

---

## PHASE 4: Managing Content

### Step 4.1: Access the Admin Panel

1. Make sure the server is running (`npm run dev`)
2. Go to: **http://localhost:1776/admin**

---

### Step 4.2: Add a New Question

**Scale Questions (1-5 spectrum):**
1. In Admin, click the **Questions** tab
2. Fill in the form:
   - **Question Text**: Write a neutral question (e.g., "How should education be funded?")
   - **Category**: Select from dropdown
   - **Left Label**: What the left-leaning answer means (e.g., "Fully public funding")
   - **Right Label**: What the right-leaning answer means (e.g., "Private/market-based")
3. Click **Add Question**

**Yes/No Questions:**
- Set **Question Type** to "yesno"
- Set **Yes Value**: 1 if "yes" is right-leaning, -1 if "yes" is left-leaning

**Branching Questions (Follow-ups):**
- Set **Parent Question**: The question this follows
- Set **Branch Condition**: "yes" or "no" (when to show this follow-up)

**Tips for good questions:**
- Keep them neutral - no loaded language
- Both labels should be reasonable positions someone might hold
- Focus on "how" not "should we"
- Use yes/no for absolute positions, then branch into nuance

---

### Step 4.3: Upload Documents with AI Analysis

1. Go to: **http://localhost:1776/admin/documents**
2. Choose source type:
   - **Impartial**: Factual reporting to use as evidence
   - **Partisan**: Opinion/spin to fact-check against reality
3. Upload a file OR paste a URL
4. The document loads with **automatic tag highlighting**
5. Use AI buttons to:
   - **Suggest Tags**: Auto-detect relevant topics
   - **Generate Questions**: Create quiz questions from content
   - **Extract Claims**: Find fact-checkable statements
   - **Detect Politicians**: Find mentioned public figures
   - **Check Against Backlog**: Compare to existing promises/claims

---

### Step 4.4: Add Evidence (Manual Method)

1. In Admin, click the **Evidence** tab
2. Fill in the form:
   - **Title**: Headline of the article/video
   - **Summary**: 1-2 sentence description of what it shows
   - **Source URL**: Link to the original (optional)
   - **Source Name**: Publication name (e.g., "Reuters", "NPR")
   - **Source Type**: Impartial or Partisan
   - **Category**: Which topic area it relates to
   - **Tags**: Check relevant tags
3. Click **Add Evidence**

---

### Step 4.5: Add Tag Synonyms

Synonyms help the system recognize related terms:

1. In Prisma Studio (`npm run db:studio`)
2. Go to **TagSynonym** table
3. Add entries like:
   - Tag: "Immigration" → Synonyms: "border", "migrants", "asylum", "deportation"
   - Tag: "Healthcare" → Synonyms: "medical", "insurance", "hospital", "Medicare"

These will be highlighted in documents automatically.

---

### Step 4.6: Track Politicians

1. In Prisma Studio, go to **Politician** table
2. Add public figures with:
   - **Name**: Full name
   - **Type**: politician, party, pundit, organization
   - **Title**: Current role (Senator, President, etc.)
   - **Affiliation**: Party or organization

3. Track their stances in **PoliticianStance** table:
   - **Public Stance**: What they say (-2 to 2)
   - **Action Stance**: What they do (-2 to 2)
   - **Discrepancy Note**: Explain any gap between words and actions

---

### Step 4.7: Track Statements & Promises

1. In Prisma Studio, go to **Statement** table
2. Add promises/claims with:
   - **Politician**: Who said it
   - **Text**: The exact statement
   - **Type**: promise, claim, prediction, denial
   - **Source**: Where/when it was made
   - **Status**: pending, kept, broken, debunked, confirmed

3. Link evidence in **FactCheck** table to update status over time

---

### Step 4.8: View/Edit Database Directly

For full control, use Prisma Studio:

1. Open a **new** terminal window (keep the server running in the other one)
2. Navigate to the project folder
3. Run: `npm run db:studio`
4. A browser window opens with a database GUI
5. You can view, edit, and delete any records

---

## PHASE 5: Deploy Online

### Option A: Deploy to Vercel (Easiest)

Vercel is free and designed for Next.js apps.

**Step 5A.1: Create a GitHub Account (if you don't have one)**
1. Go to: **https://github.com**
2. Click "Sign up"
3. Follow the prompts

**Step 5A.2: Install Git**
1. Go to: **https://git-scm.com/downloads**
2. Download and install for your OS

**Step 5A.3: Push Code to GitHub**

In terminal (in the project folder):
```
git init
git add .
git commit -m "Initial commit"
```

Then go to GitHub.com:
1. Click the "+" icon → "New repository"
2. Name it "worldview-quiz"
3. Keep it Public or Private (your choice)
4. Click "Create repository"
5. Follow the instructions shown under "push an existing repository"

**Step 5A.4: Deploy on Vercel**
1. Go to: **https://vercel.com**
2. Click "Sign up" → "Continue with GitHub"
3. Click "New Project"
4. Find and select your "worldview-quiz" repository
5. Click "Deploy"
6. Wait 2-3 minutes
7. You'll get a URL like `worldview-quiz.vercel.app`

**Your quiz is now live on the internet!**

---

### Option B: Deploy to Netlify (Alternative)

Similar process:
1. Go to: **https://netlify.com**
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repo
5. Deploy

---

## PHASE 6: Ongoing Maintenance

### Adding Content Regularly

1. Start the local server: `npm run dev`
2. Go to: http://localhost:3000/admin
3. Add questions/evidence
4. Changes are saved to your local database

**To push changes to your live site:**
```
git add .
git commit -m "Added new questions"
git push
```
Vercel will automatically redeploy.

---

### Backing Up Your Database

Your database is stored in: `prisma/dev.db`

To back it up:
1. Find the file in Finder/Explorer
2. Copy it somewhere safe (Dropbox, Google Drive, etc.)

To restore:
1. Replace `prisma/dev.db` with your backup
2. Restart the server

---

### Resetting Everything (Start Fresh)

If you want to wipe all data and start over:
```
npm run db:reset
```
This deletes everything and re-seeds with sample data.

---

## Troubleshooting

### "command not found: npm"
Node.js isn't installed properly. Reinstall from https://nodejs.org

### "EACCES permission denied"
On Mac/Linux, try:
```
sudo npm install
```
Enter your computer password when prompted.

### "Port 1776 is already in use"
Another app is using that port. Either:
- Close the other app, or
- Run: `npm run dev -- -p 1777` (uses port 1777 instead)

### "Cannot find module..."
Dependencies aren't installed. Run:
```
npm install
```

### Database errors
Reset the database:
```
npm run db:reset
```

### Changes not showing up
1. Hard refresh the browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Restart the server: `Ctrl+C`, then `npm run dev`

---

## Glossary

| Term | Meaning |
|------|---------|
| **Terminal** | Text-based interface for running commands |
| **npm** | Node Package Manager - installs code libraries |
| **Server** | The program running your application |
| **Database** | Where all your data is stored |
| **Deploy** | Put your app on the internet |
| **Repository (repo)** | A project stored on GitHub |
| **Commit** | Save a snapshot of your code |
| **Push** | Upload your commits to GitHub |

---

## Getting Help

If you get stuck:

1. **Copy the exact error message**
2. **Google it** - Most errors have been solved before
3. **Ask an LLM** - Paste the error and ask for help
4. **Check the terminal** - Error details are usually there

---

## Quick Reference Card

```
# Start the app
npm run dev

# Stop the app
Ctrl + C

# Open database GUI
npm run db:studio

# Reset database
npm run db:reset

# Save changes to GitHub
git add .
git commit -m "description of changes"
git push
```

**URLs when running locally:**
- Quiz: http://localhost:1776
- Admin: http://localhost:1776/admin
- Documents: http://localhost:1776/admin/documents

---

## PHASE 7: Enable AI Features (Optional)

The AI features (auto-tagging, question generation, claim extraction) require an LLM API. You have two options:

### Option A: GitHub Models (Free with GitHub Account)

**Step 7A.1: Get a GitHub Personal Access Token**
1. Go to: **https://github.com/settings/tokens**
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "Worldview Quiz"
4. Select scope: `read:user` (minimal permissions needed)
5. Click "Generate token"
6. Copy the token (starts with `ghp_` or `github_pat_`)

**Step 7A.2: Add Token to Project**
1. Open the file `.env` in the project folder
2. Add this line:
   ```
   GITHUB_TOKEN="your-github-token-here"
   ```
3. Save the file
4. Restart the server (`Ctrl+C`, then `npm run dev`)

### Option B: OpenAI API (Pay-per-use)

**Step 7B.1: Get an OpenAI API Key**
1. Go to: **https://platform.openai.com**
2. Sign up or log in
3. Go to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Step 7B.2: Add Key to Project**
1. Open the file `.env` in the project folder
2. Add this line:
   ```
   OPENAI_API_KEY="sk-your-actual-key-here"
   ```
3. Save the file
4. Restart the server (`Ctrl+C`, then `npm run dev`)

### Step 7.3: Test AI Features

1. Go to: http://localhost:1776/admin/documents
2. Paste a URL and click "🔍 Analyze URL"
3. Should return auto-populated fields, detected bias, key figures, etc.
4. If you see an error, check that your token/key is correctly set in `.env`

---

*Last updated: December 2024*
