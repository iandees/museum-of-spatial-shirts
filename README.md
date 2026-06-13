# 🗺️ Museum of Spatial Shirts

A living archive of t-shirts, hoodies, and swag from the open-source geo community — 
OpenStreetMap conferences, mapping parties, geo companies past and present, and beloved 
concepts like Null Island.

**[→ View the Museum](https://museumofspatialshirts.org)**

---

## What's here

Every shirt tells a story. State of the Map conferences. Mapathons. Companies that 
changed how we think about open data. In-jokes that only make sense if you've ever 
accidentally geocoded 10,000 points to 0°N 0°E.

The museum collects them before they fade, and invites the community to add stories 
about what they meant.

## Contributing

### Easiest: Open an issue

[Open an issue](../../issues/new?template=add-shirt.md) with your photo and any 
stories or metadata you know. We'll add it to the collection.

### Via Pull Request

1. Fork this repo
2. Add your image(s) to `public/images/`
3. Add an entry to `public/collection.json` following the format below
4. Open a PR!

### Data format

Each item in `public/collection.json` looks like this:

```json
{
  "id": "sotm-us-2019",
  "name": "State of the Map US 2019",
  "category": "event",
  "year": 2019,
  "location": "Minneapolis, MN",
  "description": "The annual US OpenStreetMap conference…",
  "tags": ["openstreetmap", "sotmus", "conference"],
  "photos": [
    {
      "file": "sotm-us-2019-front.jpg",
      "caption": "Front of the shirt",
      "credit": "Your Name"  // photo credit shown in the UI
    }
  ],
  "stories": [
    {
      "author": "Your Name",
      "text": "I wore this shirt to my first mapping party…"
    }
  ]
}
```

**Categories:**
- `event` — a specific conference, mapping party, or event
- `concept` — a geo concept (Null Island, etc.)
- `company` — a company of significance (Mapzen, etc.)
- `collection` — an ungrouped batch of items

## Running locally

No build step needed — it's plain HTML/CSS/JS.

```bash
cd public
python3 -m http.server 8000
# then open http://localhost:8000
```

Or use any static file server.

## Deploying

The `public/` directory is the web root. Deploy it anywhere:
- **GitHub Pages**: set Pages source to the `public/` folder
- **Netlify / Vercel**: point root to `public/`

## License

Photos are contributed by the community. Unless otherwise noted, content is under 
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
