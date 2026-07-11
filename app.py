"""
AI-Powered Research Abstract Quality Checker
Flask backend integrating with IBM Granite via LangFlow API.
"""

import os
import uuid
import json
import re
import requests
from flask import Flask, render_template, request, jsonify

# ---------------------------------------------------------------------------
# Configuration — do NOT modify the API key or URL below
# ---------------------------------------------------------------------------
API_KEY = "sk-"
FLOW_URL = "http://localhost:7860/api/v1/run/1047e8f8-091b-4ce5-82b5-c749577bc1cb"

HEADERS = {"x-api-key": API_KEY}

# ---------------------------------------------------------------------------
# The evaluation prompt sent to IBM Granite
# ---------------------------------------------------------------------------
EVALUATION_PROMPT_TEMPLATE = """You are an expert academic reviewer specialising in research abstract quality assessment.

Analyse the following research abstract and return a structured JSON response with EXACTLY this format (no extra keys, no markdown fences):

{{
  "abstract_type": "Structured" or "Unstructured",
  "detected_components": {{
    "Background": true or false,
    "Objective": true or false,
    "Methodology": true or false,
    "Results": true or false,
    "Conclusion": true or false
  }},
  "quality_scores": {{
    "Structure": <integer 0-100>,
    "Clarity": <integer 0-100>,
    "Completeness": <integer 0-100>,
    "Technical_Depth": <integer 0-100>,
    "Novelty": <integer 0-100>,
    "Publication_Readiness": <integer 0-100>
  }},
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommendations": ["...", "..."],
  "overall_assessment": "A concise 2-3 sentence overall assessment."
}}

Abstract to evaluate:
\"\"\"
{abstract}
\"\"\"

Return ONLY valid JSON — no preamble, no explanation, no markdown code fences."""


# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
app = Flask(__name__)


def call_granite_api(abstract_text: str) -> dict:
    """
    Send the abstract to the IBM Granite LangFlow endpoint and return the
    parsed evaluation dictionary.

    Raises:
        requests.exceptions.RequestException: on network/HTTP errors.
        ValueError: if the response cannot be parsed as expected JSON.
    """
    prompt = EVALUATION_PROMPT_TEMPLATE.format(abstract=abstract_text)

    payload = {
        "output_type": "chat",
        "input_type": "chat",
        "input_value": prompt,
        "session_id": str(uuid.uuid4()),
    }

    response = requests.post(FLOW_URL, json=payload, headers=HEADERS, timeout=120)
    response.raise_for_status()

    data = response.json()

    # Extract the text output from the LangFlow response envelope
    raw_text = _extract_output_text(data)

    # Parse the JSON payload from the model's reply
    evaluation = _parse_json_from_text(raw_text)
    return evaluation


def _extract_output_text(api_response: dict) -> str:
    """
    Navigate the LangFlow response envelope to find the model's text output.
    Tries multiple common response shapes for robustness.
    """
    # Shape 1: outputs[0].outputs[0].results.message.text
    try:
        return api_response["outputs"][0]["outputs"][0]["results"]["message"]["text"]
    except (KeyError, IndexError, TypeError):
        pass

    # Shape 2: outputs[0].outputs[0].messages[0].message
    try:
        return api_response["outputs"][0]["outputs"][0]["messages"][0]["message"]
    except (KeyError, IndexError, TypeError):
        pass

    # Shape 3: flat text field
    try:
        return api_response["text"]
    except (KeyError, TypeError):
        pass

    raise ValueError("Unable to extract text from API response: " + json.dumps(api_response)[:300])


def _parse_json_from_text(text: str) -> dict:
    """
    Extract and parse the JSON object from the model's reply.
    Handles cases where the model wraps the JSON in markdown fences.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", text).strip()

    # Find the first { ... } block
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model response.")

    return json.loads(match.group())


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Render the main landing page."""
    return render_template("index.html")


@app.route("/evaluate", methods=["POST"])
def evaluate():
    """
    POST /evaluate
    Body (JSON): { "abstract": "<abstract text>" }
    Returns (JSON): evaluation dict or { "error": "<message>" }
    """
    body = request.get_json(silent=True) or {}
    abstract_text = (body.get("abstract") or "").strip()

    if not abstract_text:
        return jsonify({"error": "Abstract text cannot be empty."}), 400

    if len(abstract_text) < 50:
        return jsonify({"error": "Abstract is too short. Please provide a complete research abstract."}), 400

    try:
        evaluation = call_granite_api(abstract_text)
        return jsonify({"success": True, "evaluation": evaluation})

    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": "Cannot reach the AI backend. Please ensure the LangFlow server is running on localhost:7860."
        }), 503

    except requests.exceptions.Timeout:
        return jsonify({
            "error": "The AI evaluation timed out. Please try again with a shorter abstract."
        }), 504

    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        return jsonify({
            "error": f"AI backend returned an error (HTTP {status}). Check your API key and flow ID."
        }), 502

    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        return jsonify({
            "error": f"Failed to parse the AI response: {str(exc)}"
        }), 500

    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"error": f"Unexpected error: {str(exc)}"}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)
