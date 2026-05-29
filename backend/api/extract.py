"""
Extract trading ideas into Python strategy scripts.
Instead of producing a JSON config, the LLM generates a complete
strategy script that gets registered in the scripts module.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..scripts.base import registry as get_registry
from ..scripts import runner
import importlib
import inspect
import textwrap
import ast
import os

router = APIRouter()

PROMPT_TEMPLATE = """You are a trading strategy code generator. Write a Python trading strategy script.

The user's trading idea is:
{text}

Generate a complete Python function decorated with @strategy_spec that implements this idea.

RULES:
1. Use ONLY pandas and numpy — no other external dependencies.
2. The function signature must be: def strategy_name(data: pd.DataFrame, params: dict) -> dict:
3. The function must return {{"entries": pd.Series[bool], "exits": pd.Series[bool]}}
4. 'data' has columns: open, high, low, close, volume (lowercase, already downloaded).
5. Use @strategy_spec decorator with name, description, and params.
6. Each param needs: type ("int" or "float"), min, max, default, description.
7. Use rolling window calculations and simple pandas operations.
8. The code must be self-contained with no imports beyond pandas and numpy.
9. Output ONLY the Python code, no explanations, no markdown formatting.

Example structure:
@strategy_spec(
    name="My Strategy",
    description="What this strategy does",
    params={{
        "period": {{"type": "int", "min": 5, "max": 50, "default": 20, "description": "Lookback period"}},
    }}
)
def my_strategy(data, params):
    # ... pandas logic ...
    return {{"entries": entries, "exits": exits}}"""


class GenerateScriptRequest(BaseModel):
    text: str


class GenerateScriptResponse(BaseModel):
    script_name: str
    source_code: str
    params: dict


class RegisterScriptRequest(BaseModel):
    name: str
    source_code: str


class RegisterScriptResponse(BaseModel):
    name: str
    param_count: int
    params: dict


@router.get("/prompt-template")
async def get_prompt_template():
    """Return the prebuilt ChatGPT prompt template for generating scripts."""
    return {"template": PROMPT_TEMPLATE}


@router.post("/parse-strategy-script", response_model=RegisterScriptResponse)
async def parse_and_register_script(request: RegisterScriptRequest):
    """
    Accept raw Python source code from ChatGPT output, validate it,
    compile it, execute it to register the @strategy_spec, and return
    the script metadata.
    """
    source = request.source_code.strip()
    name = request.name.strip()

    # Remove markdown code fences if present
    if source.startswith("```"):
        lines = source.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        source = "\n".join(lines).strip()

    # Validate syntax
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Python syntax: {str(e)}")

    # Find the function with @strategy_spec decorator
    has_decorator = False
    extracted_name: str = name
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            for decorator in node.decorator_list:
                if (
                    isinstance(decorator, ast.Call)
                    and isinstance(decorator.func, ast.Name)
                    and decorator.func.id == "strategy_spec"
                ):
                    has_decorator = True
                    # Extract the name argument
                    for kw in decorator.keywords:
                        if kw.arg == "name":
                            extracted_name = (
                                str(kw.value.value) if isinstance(kw.value, ast.Constant) else extracted_name
                            )
                    break
            if has_decorator:
                break

    if not has_decorator:
        raise HTTPException(
            status_code=400,
            detail="Source code must contain a function decorated with @strategy_spec",
        )

    # Save the script to a file in the scripts directory
    scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
    os.makedirs(scripts_dir, exist_ok=True)

    # Create a safe filename
    safe_name = extracted_name.lower().replace(" ", "_").replace("-", "_")
    filepath = os.path.join(scripts_dir, f"{safe_name}.py")

    # Add imports at the top if missing
    full_source = source
    if "import pandas" not in full_source:
        full_source = "import pandas as pd\nimport numpy as np\nfrom .base import strategy_spec\n\n" + full_source
    elif "from .base import strategy_spec" not in full_source:
        full_source = "from .base import strategy_spec\n" + full_source

    with open(filepath, "w") as f:
        f.write(full_source)

    # Reload the module to register it
    try:
        module_name = f"..scripts.{safe_name}"
        module = importlib.import_module(module_name, package=__package__)
        importlib.reload(module)
    except Exception as e:
        # Clean up the file if it fails
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Failed to load script: {str(e)}")

    # Get the registered spec
    from ..scripts.base import get_script

    spec = get_script(extracted_name)
    if not spec:
        raise HTTPException(status_code=500, detail="Script registered but not found in registry")

    return RegisterScriptResponse(
        name=spec.name,
        param_count=len(spec.params),
        params=spec.params,
    )
