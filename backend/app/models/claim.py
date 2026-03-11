from pydantic import BaseModel
from typing import Optional


class Claim(BaseModel):
    id: str
    patient_id: str
    procedure_code: str
    insurance_id: str
    diagnosis_code: Optional[str] = None