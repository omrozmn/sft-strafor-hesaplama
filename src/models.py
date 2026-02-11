from typing import List, Optional, Dict, Literal, Any
from pydantic import BaseModel, Field

# Constants from Spec
BLOCK_DIMS = [103, 122, 202]  # cm
TOLERANCE_202 = 3.0  # cm
EFFECTIVE_202 = 202 - TOLERANCE_202  # 199 cm
RULE_44_LIMIT = 44.0  # cm
WIRE_THICKNESS = 0.5  # cm
SLICE_THICKNESS = 0.2  # cm

class ExtraPart(BaseModel):
    name: str
    count: int = Field(..., ge=1, description="Quantity per box")
    thickness_cm: float = Field(..., gt=0)

class EPSInput(BaseModel):
    # Product Dimensions
    boy: float = Field(..., gt=0, description="Length in cm")
    en: float = Field(..., gt=0, description="Width in cm")
    yukseklik: float = Field(..., gt=0, description="Height in cm")
    
    wall_thickness: float = Field(..., gt=0, description="Wall thickness in cm")
    
    # Extra Parts (Caps, Separators, etc)
    extra_parts: List[ExtraPart] = []
    
    # Optional
    req_boxes: Optional[int] = Field(None, gt=0, description="Requested box count")
    dns: Optional[int] = Field(None, description="Density")
    start_time_unix: Optional[int] = None 

class Pricing(BaseModel):
    unit_price: float
    total_price: float

class CutDims(BaseModel):
    footprint: List[float] # [x, y]
    box_h: float
    parts_h: Dict[str, float] # name -> height

class Layout2D(BaseModel):
    table_axes: List[float] # [103, 122] usually
    rotation: str # description
    sira_adedi: int

class DetailedReport(BaseModel):
    block_cm: List[float]
    rule_44cm: Dict
    cut_dims_cm: CutDims
    layout_2d: Layout2D
    per_sira: Dict[str, int] # "box" -> quantity, "part_name" -> quantity
    sira_plan: Dict[str, int] # "box" -> rows, "part_name" -> rows

class EPSOutput(BaseModel):
    blocks_needed: int
    per_block: Dict[str, int] # box -> count, parts -> count
    required: Optional[Dict[str, int]] = None
    excess: Optional[Dict[str, int]] = None
    pricing: Pricing
    details: DetailedReport
