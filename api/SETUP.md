# API Setup Guide

## Quick Start

1. **Create a `.env` file in the `api` directory:**

```bash
cd api
touch .env
```

2. **Add the following environment variables to your `.env` file:**

```env
# OpenRouter Configuration (Required)
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_API_MODEL=google/gemini-2.5-pro-preview-03-25

# Optional: For leaderboard ranking
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_TITLE=Mission Simulator

# Alternative LLM Providers (Optional)
SAMBANOVA_API_KEY=
SAMBANOVA_MODEL=Llama-4-Scout-17B-16E-Instruct

ANAKIN_API_KEY=
ANAKIN_APP_ID=
ANAKIN_API_VERSION=2024-05-06

# Debug Mode
DEBUG=False
```

3. **Get your OpenRouter API key:**
   - Visit https://openrouter.ai/
   - Sign up for an account
   - Get your API key from the dashboard
   - Replace `your_openrouter_api_key_here` with your actual key

4. **Install dependencies:**

```bash
pip install -r requirements.txt
```

5. **Run the API:**

```bash
python main.py
```

The API will be available at http://localhost:8000

## Testing the API

Once running, you can test the AI mission planning:

1. Visit http://localhost:8000/docs for the interactive API documentation
2. Try the `/api/v1/mission-planning/generate-plan` endpoint
3. Or use the frontend by running the React app in the `frontend` directory 