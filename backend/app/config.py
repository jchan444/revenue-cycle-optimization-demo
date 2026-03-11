from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
FHIR_SERVER = os.getenv("FHIR_SERVER")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")