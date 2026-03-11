from fastapi import FastAPI
from app.routers import claims

app = FastAPI(
    title="Revenue Cycle Optimization API",
    version="0.1"
)

app.include_router(claims.router)

@app.get("/")
def root():
    return {"message": "Revenue Cycle Optimization API running"}