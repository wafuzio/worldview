# Worldview Quiz

A political worldview quiz that assesses your beliefs without spin or leading questions, then shows you where you stand and presents evidence related to your positions.

## Features

- **Neutral Quiz**: Questions framed without political bias
- **Evidence Network**: Tag and link news articles, videos, and transcripts to topics
- **Session Persistence**: Save and track how your views evolve
- **Admin Panel**: Easy content management for questions and evidence
- **Easy Hosting**: Deploy to Vercel with one click

---

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/dan.maguire/Documents/Projects/Politics
npm install
```

### 2. Set Up Database

```bash
# Generate Prisma client and create database
npx prisma generate
npx prisma db push

# Seed with sample data
npm run db:seed
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:1776](http://localhost:1776)

For mobile testing on the same Wi-Fi:

```bash
npm run dev:mobile
```

Then open the printed `http://<LAN-IP>:1776` URL on your phone.

---

## Project Structure

```
Politics/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Sample data
├── src/
│   ├── app/
│   │   ├── api/         # API routes
│   │   │   ├── answers/
│   │   │   ├── categories/
│   │   │   ├── entities/
│   │   │   ├── evidence/
│   │   │   ├── questions/
│   │   │   ├── sessions/
│   │   │   └── tags/
│   │   ├── admin/       # Admin panel
│   │   ├── quiz/        # Quiz interface
│   │   ├── results/     # Results display
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx     # Home page
│   └── lib/
│       ├── db.ts        # Database client
│       └── utils.ts     # Utilities
├── .env                 # Environment variables
└── package.json
```

---

## Managing Content

### Admin Panel

Visit `/admin` to:
- Add/edit quiz questions
- Add evidence (articles, videos, transcripts)
- Create and manage tags
- Link evidence to questions

### Adding Questions

1. Go to Admin → Questions tab
2. Fill in:
   - **Question text**: Neutral framing (e.g., "How should healthcare be funded?")
   - **Category**: Topic area
   - **Left label**: Left-leaning position description
   - **Right label**: Right-leaning position description

### Adding Evidence

1. Go to Admin → Evidence tab
2. Fill in:
   - **Title**: Headline
   - **Summary**: Brief description
   - **Source URL**: Link to original
   - **Source Name**: Publication name
   - **Tags**: Select relevant tags

### Linking Evidence to Questions

Currently done via database. To link evidence to a question:

```typescript
// In prisma studio (npm run db:studio) or via API
await prisma.questionEvidence.create({
  data: {
    questionId: 'question-uuid',
    evidenceId: 'evidence-uuid',
    relationship: 'supports_left', // or 'supports_right', 'neutral'
    note: 'Why this evidence is relevant'
  }
});
```

---

## Database Schema Overview

### Core Models

| Model | Purpose |
|-------|---------|
| `Category` | Quiz topic areas (Economic, Social, etc.) |
| `Question` | Quiz questions with spectrum labels |
| `Evidence` | News articles, videos, transcripts |
| `Tag` | Labels for organizing evidence |
| `Session` | User quiz sessions |
| `Answer` | Individual question responses |
| `PoliticalEntity` | Reference positions (parties, movements) |

### Relationships

- Questions belong to Categories
- Evidence can have multiple Tags
- Evidence can be linked to Questions (with relationship type)
- Sessions contain Answers to Questions

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variable:
   ```
   DATABASE_URL="file:./prod.db"
   ```
4. Deploy

**Note**: For production, consider using a hosted database like:
- [Turso](https://turso.tech/) (SQLite-compatible)
- [PlanetScale](https://planetscale.com/) (MySQL)
- [Supabase](https://supabase.com/) (PostgreSQL)

To switch databases, update `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // or "mysql"
  url      = env("DATABASE_URL")
}
```

### Other Platforms

Works with any Node.js host:
- Netlify
- Railway
- Render
- DigitalOcean App Platform

---

## Customization

### Adding New Categories

```bash
npm run db:studio
```

Or via API:
```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name": "Healthcare", "description": "Views on healthcare policy", "order": 6}'
```

### Modifying Political Alignment

Each question has an `alignmentMap` JSON field:

```json
{
  "economic": 1,    // How much this affects economic score (0-1)
  "social": 0.5     // How much this affects social score (0-1)
}
```

Answer values range from -2 (strongly left) to +2 (strongly right).

### Adding Political Entities

Add reference points for comparison:

```bash
curl -X POST http://localhost:3000/api/entities \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Democratic Party",
    "type": "party",
    "economicScore": -0.5,
    "socialScore": -0.3
  }'
```

---

## API Reference

### Questions
- `GET /api/questions` - List all active questions
- `POST /api/questions` - Create question

### Evidence
- `GET /api/evidence` - List evidence (filter by `?tagId=` or `?categoryId=`)
- `POST /api/evidence` - Create evidence

### Sessions
- `POST /api/sessions` - Create/resume session
- `GET /api/sessions/[id]` - Get session with answers
- `POST /api/sessions/[id]/complete` - Calculate results

### Answers
- `POST /api/answers` - Save answer

### Tags
- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category

### Entities
- `GET /api/entities` - List political entities

---

## Future Enhancements

Potential additions:
- [ ] AI-assisted tag suggestions for uploaded articles
- [ ] Bulk evidence import from RSS/API
- [ ] Question weighting and importance
- [ ] Detailed breakdown by category
- [ ] Share results functionality
- [ ] Historical comparison charts
- [ ] Multi-language support

---

## Commands Reference

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Push schema changes
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:reset     # Reset and reseed database
```

---

## License

MIT
