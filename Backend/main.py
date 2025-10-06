import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi import File, UploadFile, Form
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI()

# CORS (allow Vite dev server and common localhost ports)
default_origins = {
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # Vite dev server in this repo
    "http://localhost:8080",
    "http://127.0.0.1:8080",
}

# Allow override via comma-separated env var
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
else:
    allowed_origins = sorted(default_origins)

allow_all = os.getenv("ALLOW_ALL_ORIGINS", "false").lower() == "true"
origin_regex = os.getenv("ALLOW_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else allowed_origins,
    allow_origin_regex=origin_regex if (not allow_all and origin_regex) else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply_ml: str
    reply_en: str


class VoiceDemoResponse(BaseModel):
    reply_ml: str
    reply_en: str


@app.get("/")
async def read_root():
    return {"message": "Krishi Mitra backend is running"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest):
    """
    Call Groq LLM with the user's message and return the assistant's reply.
    Requires GROQ_API_KEY in environment.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured on server")

    # Simple topic filter: only allow agricultural queries; warn otherwise
    def is_agriculture_query(text: str) -> bool:
        # Normalize and lowercase text for robust matching
        try:
            import unicodedata
            t = unicodedata.normalize("NFKC", text or "").lower()
        except Exception:
            t = (text or "").lower()

        english_keywords = [
            # general
            "agriculture", "agricultural", "farming", "farm", "farmer", "field", "kerala",
            # crops and operations
            "crop", "crops", "soil", "seed", "sowing", "plough", "plow", "irrigation",
            "harvest", "harvesting", "fertilizer", "fertiliser", "manure", "compost",
            "mulch", "pesticide", "pest", "disease", "fungicide", "weed", "weeding",
            "yield", "spacing", "transplant", "nursery", "germination",
            # weather/region
            "monsoon", "rain", "rainfall", "humidity", "temperature", "weather",
            # common Kerala crops
            "rice", "paddy", "coconut", "arecanut", "banana", "plantain", "pepper",
            "cardamom", "rubber", "tea", "coffee", "cashew", "tapioca", "tomato",
            "vegetable", "vegetables",
        ]

        mal_keywords = [
            # general
            "കൃഷി", "കർഷകൻ", "വയൽ", "കേരളം",
            # crops and operations
            "വിള", "വിളകൾ", "മണ്ണ്", "വിത്ത്", "വിത്തിടൽ", "ജലസേചനം",
            "വാരി", "വാരിപ്പ്", "വളം", "ജൈവവളം", "കമ്പോസ്റ്റ്",
            "മൾച്ച്", "കീടം", "കീടനിയന്ത്രണം", "രോഗം", "ഫംഗിസൈഡ്", "കുറ്റിവെട്ടൽ",
            "ഉൽപ്പാദനം", "ഇടവിട്ട്", "തൈ", "മുളച്ചുവരവ്",
            # weather/region
            "മൺസൂൺ", "മഴ", "ഈർപ്പം", "താപനില", "കാലാവസ്ഥ",
            # common Kerala crops (Malayalam)
            "നെല്ല്", "അരി", "തേങ്ങ", "വാഴ", "കുരുമുളക്", "ഏലക്ക",
            "റബ്ബർ", "ചായ", "കാപ്പി", "കശുവണ്ടി", "കപ്പ", "തക്കാളി",
            "പച്ചക്കറി", "പച്ചക്കറികൾ",
        ]

        def contains_any(haystack: str, needles: list[str]) -> bool:
            return any(n in haystack for n in needles)

        return contains_any(t, english_keywords) or contains_any(t, mal_keywords)

    if not is_agriculture_query(payload.message):
        warn_en = (
            "This assistant is only for agricultural purposes. "
            "Please ask farming-related questions (e.g., crops, soil, weather, pest management)."
        )
        warn_ml = (
            "ഈ അസിസ്റ്റന്റ് കാർഷിക ആവശ്യങ്ങൾക്ക് മാത്രമാണ്. "
            "ദയവായി കൃഷിയുമായി ബന്ധപ്പെട്ട ചോദ്യങ്ങൾ ചോദിക്കുക (ഉദാ: വിളകൾ, മണ്ണ്, കാലാവസ്ഥ, കീടനിയന്ത്രണം)."
        )
        return ChatResponse(reply_ml=warn_ml, reply_en=warn_en)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        # Malayalam system prompt
        system_prompt_ml = (
            "You are Krishi Mitra, a helpful AI assistant focused on Kerala agriculture. "
            "Respond in Malayalam (Malayalam script). Be concise and practical. "
            "If relevant, use short bullet points."
        )
        completion_ml = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": system_prompt_ml},
                {"role": "user", "content": payload.message},
            ],
            temperature=float(os.getenv("GROQ_TEMPERATURE", "0.3")),
            max_tokens=int(os.getenv("GROQ_MAX_TOKENS", "512")),
        )
        reply_ml = completion_ml.choices[0].message.content if completion_ml.choices else ""

        # Detect if the query is in Malayalam (basic check: presence of Malayalam Unicode block)
        is_malayalam = any('\u0d00' <= c <= '\u0d7f' for c in payload.message)

        if is_malayalam:
            reply_en = ""
        else:
            # English system prompt
            system_prompt_en = (
                "You are Krishi Mitra, a helpful AI assistant focused on Kerala agriculture. "
                "Respond in English. Be concise and practical. "
                "If relevant, use short bullet points."
            )
            completion_en = client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
                messages=[
                    {"role": "system", "content": system_prompt_en},
                    {"role": "user", "content": payload.message},
                ],
                temperature=float(os.getenv("GROQ_TEMPERATURE", "0.3")),
                max_tokens=int(os.getenv("GROQ_MAX_TOKENS", "512")),
            )
            reply_en = completion_en.choices[0].message.content if completion_en.choices else ""

        if not reply_ml and not reply_en:
            raise HTTPException(status_code=502, detail="Empty response from model")

        return ChatResponse(reply_ml=reply_ml, reply_en=reply_en)
    except HTTPException:
        raise
    except Exception as e:
        # Hide internal error details from client but log for server
        # In production, integrate proper logging here
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate response") from e


@app.post("/api/voice-demo", response_model=VoiceDemoResponse)
async def voice_demo_endpoint(
    prompt: str = Form(...),
    audio: UploadFile = File(None)
):
    """
    Accepts a prompt and (optionally) an audio file. Ignores audio for now.
    Returns both Malayalam and English responses from Groq.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured on server")

    try:
        client = Groq(api_key=api_key)

        # Always use the same question for both calls
        question = "suggest best crops for red soil"

        # Malayalam response
        system_prompt_ml = (
            "You are Krishi Mitra, a helpful AI assistant focused on Kerala agriculture. "
            "Respond in Malayalam (Malayalam script). Be concise and practical. "
            "If relevant, use short bullet points."
        )
        completion_ml = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": system_prompt_ml},
                {"role": "user", "content": question},
            ],
            temperature=float(os.getenv("GROQ_TEMPERATURE", "0.3")),
            max_tokens=int(os.getenv("GROQ_MAX_TOKENS", "512")),
        )
        reply_ml = completion_ml.choices[0].message.content if completion_ml.choices else ""

        # English response
        system_prompt_en = (
            "You are Krishi Mitra, a helpful AI assistant focused on Kerala agriculture. "
            "Respond in English. Be concise and practical. "
            "If relevant, use short bullet points."
        )
        completion_en = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": system_prompt_en},
                {"role": "user", "content": question},
            ],
            temperature=float(os.getenv("GROQ_TEMPERATURE", "0.3")),
            max_tokens=int(os.getenv("GROQ_MAX_TOKENS", "512")),
        )
        reply_en = completion_en.choices[0].message.content if completion_en.choices else ""

        if not reply_ml and not reply_en:
            raise HTTPException(status_code=502, detail="Empty response from model")

        return VoiceDemoResponse(reply_ml=reply_ml, reply_en=reply_en)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate response") from e

