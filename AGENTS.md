# Project Architecture Rules

- Budget Buddy product discovery must stay in its own authenticated-context-free server function and server-only Gemini service, because its Google Search grounding must never consume the separate Compare Prices/SerpApi search path.