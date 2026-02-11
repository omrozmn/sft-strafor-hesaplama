from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .models import EPSInput, EPSOutput
from .logic import EPSLogic
import os

app = FastAPI(title="SFT EPS Automation", version="1.0.0")
engine = EPSLogic()

# Mount Static
app.mount("/static", StaticFiles(directory="src/static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse('src/static/index.html')

@app.post("/calculate", response_model=EPSOutput)
async def calculate_layout(data: EPSInput):
    try:
        result = engine.calculate(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}
